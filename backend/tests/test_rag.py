"""Carga del material y RAG (HU-003).

Usa el modelo de embeddings falso de conftest.py: alcanza para comprobar extracción,
fragmentación, metadatos, filtros, umbral y orden por similitud.
"""
import io
import json

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, select

from archivos import docx, pdf, pptx
from app.db import engine
from app.main import app
from app.models import FuenteAcademica, MaterialEstudio, ObjetivoEstudio, Tema
from app.services import rag


@pytest.fixture()
def client():
    from app.db import init_db
    init_db()
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


def crear_plan(c, topic="Recursividad"):
    body = dict(topic=topic, days=7, level="intermedio", target_grade=8, language="java")
    return c.post("/api/plans", json=body).json()["id"]


def id_tema(nombre):
    with Session(engine) as db:
        return db.exec(select(Tema.id_tema).where(Tema.nombre == nombre)).one()


def subir(c, plan_id, nombre, contenido: bytes):
    return c.post(f"/api/plans/{plan_id}/materials", files={"file": (nombre, io.BytesIO(contenido))})


def academica(tema, texto, id_fuente, seccion=""):
    return rag.indexar([rag.Seccion(texto, seccion)], id_origen=id_fuente, id_tema=tema, fuente=rag.ACADEMICA,
                       nombre_archivo=f"Fuente {id_fuente}", prefijo=f"f{id_fuente}")


# ---------------- Fragmentación y extracción ----------------

def test_fragmentos_respetan_tamano_y_solapan():
    texto = "\n\n".join(f"Oración número {i} sobre recursividad y caso base." for i in range(60))
    frags = rag.fragmentar(texto, tam=300, solape=60)
    assert len(frags) > 5 and all(len(f) <= 300 for f in frags)
    assert all(a[-20:].split()[-1] in b for a, b in zip(frags, frags[1:]))  # el final de uno reaparece en el siguiente


def test_tamano_por_defecto_es_el_de_la_entrega_3():
    assert (rag.TAM_FRAGMENTO, rag.SOLAPAMIENTO) == (400, 60)
    frags = rag.fragmentar("palabra " * 500)
    assert all(len(f) <= 400 for f in frags)


def test_las_oraciones_cortadas_no_empiezan_con_punto():
    frags = rag.fragmentar("El caso base corta la recursión y evita llamadas infinitas. " * 30)
    assert all(not f.startswith(".") for f in frags) and all(f.endswith(".") for f in frags)


def test_fragmentos_muy_cortos_no_se_indexan(client):
    tema = id_tema("Recursividad")
    n = rag.indexar([rag.Seccion("Según lo observado arriba:", "A"), rag.Seccion("La recursión resuelve un problema "
                     "llamándose a sí misma sobre una versión más chica del mismo problema.", "B")],
                    id_origen=1, id_tema=tema, fuente=rag.ACADEMICA, nombre_archivo="Recursión", prefijo="w5")
    assert n == 1
    # Pero un apunte de una sola línea se guarda igual.
    assert rag.indexar([rag.Seccion("Caso base: corta la recursión.", "")], id_origen=7, id_tema=tema,
                       fuente=rag.PROPIA, nombre_archivo="nota.pdf", prefijo="mat7") == 1


def test_texto_sin_espacios_se_corta_igual():
    frags = rag.fragmentar("x" * 2000, tam=800, solape=150)
    assert all(len(f) <= 800 for f in frags) and len("".join(frags)) >= 2000


def test_texto_con_titulos_se_divide_por_seccion():
    secs = rag.por_titulos("Intro\n== Caso base ==\ntexto A\n# un comentario de código\n== Pila de llamadas ==\ntexto B")
    assert [(s.pagina_o_seccion, s.texto.strip()) for s in secs] == [
        ("", "Intro"), ("Caso base", "texto A\n# un comentario de código"), ("Pila de llamadas", "texto B")]


def test_extraccion_por_pagina_seccion_y_diapositiva(tmp_path):
    (tmp_path / "a.pdf").write_bytes(pdf("Primera pagina", "El caso base corta la recursion"))
    assert [(s.pagina_o_seccion, s.texto.strip()) for s in rag.extraer(tmp_path / "a.pdf", "pdf")] == [
        ("pág. 1", "Primera pagina"), ("pág. 2", "El caso base corta la recursion")]
    (tmp_path / "a.docx").write_bytes(docx("Condición que corta la recursión.", titulo="Caso base"))
    assert ("Caso base", "Condición que corta la recursión.") in [
        (s.pagina_o_seccion, s.texto) for s in rag.extraer(tmp_path / "a.docx", "docx")]
    (tmp_path / "a.pptx").write_bytes(pptx("Recursividad", "La pila de llamadas guarda cada invocación"))
    assert [(s.pagina_o_seccion, s.texto) for s in rag.extraer(tmp_path / "a.pptx", "pptx")] == [
        ("diap. 1", "Recursividad"), ("diap. 2", "La pila de llamadas guarda cada invocación")]


def test_tipo_real_segun_el_contenido():
    assert rag.tipo_real(pdf("hola")) == "pdf"
    assert rag.tipo_real(docx("hola")) == "docx"
    assert rag.tipo_real(pptx("hola")) == "pptx"
    assert rag.tipo_real(b"esto no es un pdf") is None
    import zipfile
    b = io.BytesIO()
    with zipfile.ZipFile(b, "w") as z:
        z.writestr("cualquier.txt", "x")  # un ZIP cualquiera no es un documento de Office
    assert rag.tipo_real(b.getvalue()) is None


# ---------------- Carga del material (CA1 y CA2) ----------------

def test_subir_pdf_lo_indexa_con_los_metadatos_del_der(client):
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    r = subir(client, plan, "apunte.pdf", pdf("Toda funcion recursiva necesita un caso base que la detenga."))
    assert r.status_code == 201
    mats = client.get("/api/materials").json()
    assert mats[0]["status"] == "procesado"
    meta = rag.almacen().get(where={"id_origen": mats[0]["id"]})["metadatas"][0]
    assert meta == {"id_origen": mats[0]["id"], "id_tema": id_tema("Recursividad"), "fuente": "propia",
                    "nombre_archivo": "apunte.pdf", "pagina_o_seccion": "pág. 1"}


def test_subir_pptx_conserva_la_diapositiva(client):
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    subir(client, plan, "clase.pptx", pptx("Portada de la clase de recursividad",
                                           "La pila de llamadas guarda cada invocación pendiente"))
    metas = rag.almacen().get(where={"fuente": "propia"})["metadatas"]
    assert {m["pagina_o_seccion"] for m in metas} == {"diap. 1", "diap. 2"}


def test_archivo_sin_texto_se_informa(client):
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    subir(client, plan, "solo_imagenes.pptx", pptx("", ""))  # como una presentación de solo imágenes
    assert [m["status"] for m in client.get("/api/materials").json()] == ["sin texto"]


@pytest.mark.parametrize("nombre,contenido", [
    ("apunte.md", b"# Caso base"),  # formato no admitido
    ("apunte.txt", b"texto"),
    ("roto.pdf", b"esto no es un pdf"),  # la extensión dice PDF, el contenido no
    ("disfrazado.docx", pdf("hola")),  # un PDF renombrado a .docx
])
def test_formato_no_admitido_se_rechaza(client, nombre, contenido):
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    r = subir(client, plan, nombre, contenido)
    assert r.status_code == 415 and r.json()["detail"]
    assert client.get("/api/materials").json() == []


def test_archivo_de_mas_de_25_mb_se_rechaza(client):
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    r = subir(client, plan, "grande.pdf", b"%PDF-" + b"0" * (25 * 1024 * 1024))
    assert r.status_code == 413 and "25 MB" in r.json()["detail"]


def test_maximo_veinte_archivos_por_tema(client):
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    archivo = docx("Texto del apunte sobre la recursividad y el caso base.")
    for i in range(20):
        assert subir(client, plan, f"a{i}.docx", archivo).status_code == 201
    r = subir(client, plan, "a20.docx", archivo)
    assert r.status_code == 409 and "20 archivos" in r.json()["detail"]
    # En otro tema se puede seguir subiendo.
    otro = crear_plan(client, "Estructuras de datos lineales")
    assert subir(client, otro, "b.docx", archivo).status_code == 201


def test_cuota_de_200_mb_por_estudiante(client):
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    with Session(engine) as db:  # material ya cargado que ocupa casi toda la cuota
        db.add(MaterialEstudio(id_objetivo=plan, nombre_archivo="viejo.pdf", tipo_archivo="pdf", ruta_archivo="x",
                               tamano_bytes=200 * 1024 * 1024 - 100, estado="procesado"))
        db.commit()
    r = subir(client, plan, "nuevo.docx", docx("Un apunte más."))
    assert r.status_code == 409 and "200 MB" in r.json()["detail"]


def test_limites_de_carga(client):
    client.post("/api/auth/dev")
    lim = client.get("/api/materials/limits").json()
    assert (lim["formats"], lim["max_mb"], lim["max_files_per_topic"], lim["quota_mb"]) == (["pdf", "docx", "pptx"], 25, 20, 200)


# ---------------- Recuperación (CA3 y CA5) ----------------

def test_busqueda_devuelve_lo_mas_parecido_primero_y_aplica_el_umbral(client):
    tema = id_tema("Recursividad")
    academica(tema, "El caso base detiene la recursión y evita llamadas infinitas.", 1)
    academica(tema, "El caso base de la recursión es la condición que no vuelve a llamar a la función.", 2)
    academica(tema, "Las tablas hash usan una función para ubicar claves en cubetas.", 3)
    r = rag.buscar(tema, "qué es el caso base de la recursión", [])
    assert [f["id_origen"] for f in r][:2] in ([1, 2], [2, 1])
    assert r[0]["similitud"] >= r[1]["similitud"] >= 0.35
    assert 3 not in [f["id_origen"] for f in r]  # no alcanza la similitud mínima
    assert len(rag.buscar(tema, "qué es el caso base de la recursión", [], minima=0)) == 3


def test_seis_fragmentos_por_fuente(client):
    tema = id_tema("Recursividad")
    for i in range(10):
        academica(tema, f"El caso base detiene la recursión, ejemplo número {i} de la fuente académica.", 100 + i)
    for i in range(10):
        rag.indexar([rag.Seccion(f"El caso base detiene la recursión, nota número {i} de mi apunte.", "")],
                    id_origen=200 + i, id_tema=tema, fuente=rag.PROPIA, nombre_archivo=f"n{i}.pdf", prefijo=f"m{i}")
    r = rag.buscar(tema, "el caso base detiene la recursión", list(range(200, 210)), minima=0)
    assert sum(f["fuente"] == "académica" for f in r) == 6 and sum(f["fuente"] == "propia" for f in r) == 6


def test_material_insuficiente(client):
    tema = id_tema("Recursividad")
    academica(tema, "El caso base detiene la recursión y evita llamadas infinitas.", 1)
    assert rag.recuperar(tema, "qué es el caso base de la recursión", [])["suficiente"] is False  # un solo fragmento
    academica(tema, "Sin caso base, la recursión no termina: el caso base la detiene.", 2)
    assert rag.recuperar(tema, "qué es el caso base de la recursión", [])["suficiente"] is True


def test_busqueda_no_mezcla_temas_ni_material_ajeno(client):
    # Un estudiante sube material de Recursividad.
    client.post("/api/auth/dev")
    otro = client.get("/api/auth/me").json()["id"]
    plan_otro = crear_plan(client)
    subir(client, plan_otro, "ajeno.docx", docx("caso base secreto del otro estudiante sobre la recursión"))
    # Una fuente académica de otro tema.
    academica(id_tema("Búsqueda y ordenamiento"), "caso base de la búsqueda binaria recursiva", 9)
    # La segunda estudiante busca en su propio objetivo de Recursividad.
    from app.models import Estudiante
    from app.security import create_token
    with Session(engine) as db:
        ana = Estudiante(id_google="otra-persona", nombre="Ana", correo_electronico="ana@example.com")
        db.add(ana); db.commit(); db.refresh(ana)
    client.cookies.set("session", create_token(ana.id_estudiante))
    assert client.get("/api/auth/me").json()["id"] != otro
    plan_ana = crear_plan(client)
    assert client.get(f"/api/plans/{plan_ana}/search", params={"q": "caso base"}).json()["fragmentos"] == []
    # Y no puede buscar en el objetivo del otro estudiante.
    assert client.get(f"/api/plans/{plan_otro}/search", params={"q": "caso base"}).status_code == 404


def test_reindexar_no_duplica(client):
    tema = id_tema("Recursividad")
    for _ in range(2):
        academica(tema, "texto académico", 5)
    assert len(rag.almacen().get()["ids"]) == 1


# ---------------- Fuentes académicas precargadas (CA3, Anexo 6) ----------------

def test_html_a_texto_conserva_titulos_y_descarta_menus():
    from app.fuentes import html_a_texto
    html = ("<html><head><style>x{}</style></head><body><nav>Inicio | Índice</nav>"
            "<h2>4.4 The Three Laws<a>¶</a></h2><p>A recursive algorithm must have a base case.</p>"
            "<pre>def f(n):\n    return 1</pre><script>alert(1)</script><footer>©</footer></body></html>")
    texto = html_a_texto(html)
    assert "== 4.4 The Three Laws ==" in texto and "base case" in texto and "return 1" in texto
    assert "Inicio" not in texto and "alert" not in texto and "©" not in texto


def test_html_a_texto_documentacion_sphinx_y_ruido():
    from app.fuentes import _secciones, html_a_texto
    html = ('<dl><dt id="sys.hash_info">sys.hash_info<a class="headerlink">¶</a></dt><dd><p>Parámetros del hash.</p></dd>'
            '<dt id="sys.setrecursionlimit">sys.setrecursionlimit(limit)<a>¶</a></dt><dd><p>Establece la profundidad '
            'máxima de la pila de llamadas.</p><p>Loading...</p></dd><dt>sin id</dt></dl>')
    texto = html_a_texto(html)
    assert "== sys.setrecursionlimit(limit) ==" in texto and "¶" not in texto and "Loading" not in texto
    secs = _secciones("Módulo sys", texto, ["recursion"])
    assert [s.pagina_o_seccion for s in secs] == ["Módulo sys · sys.setrecursionlimit(limit)"]
    assert "profundidad" in secs[0].texto


def test_descarga_sin_charset_se_lee_como_utf8(monkeypatch):
    from app import fuentes

    class R:
        content = "<p>El módulo principal</p>".encode("utf-8")
        headers = {"content-type": "text/html"}
        encoding = "ISO-8859-1"  # lo que asume requests si el servidor no declara la codificación
        def raise_for_status(self): pass
        @property
        def text(self): return self.content.decode(self.encoding)
    monkeypatch.setattr(fuentes.requests, "get", lambda *a, **k: R())
    assert fuentes.descargar("https://ejemplo") == "El módulo principal"


def test_script_de_fuentes_registra_e_indexa_cada_tema(client, tmp_path, monkeypatch):
    from app import fuentes
    from app.db import TEMAS
    catalogo = {
        "fuentes": {"F5": {"titulo": "Problem Solving", "tipo": "libro o apunte de acceso abierto", "licencia": "CC BY-NC-SA 4.0"},
                    "F11": {"titulo": "PostgreSQL 7.8", "tipo": "documentación técnica oficial", "licencia": "PostgreSQL License"}},
        "temas": {t: {"F5": [["Sección A", f"https://ejemplo/{i}/a"], ["Sección B", f"https://ejemplo/{i}/b"]]}
                  for i, t in enumerate(TEMAS)},
    }
    catalogo["temas"]["Recursividad"]["F11"] = [["7.8 WITH", "https://ejemplo/sql"]]
    (tmp_path / "catalogo.json").write_text(json.dumps(catalogo), encoding="utf-8")
    monkeypatch.setattr(fuentes, "CARPETA", tmp_path)
    bajar = lambda url: f"Introducción de la sección ({url}) con texto suficiente.\n== Caso base ==\nEl caso base detiene la recursión."
    fuentes.main(catalogo=tmp_path / "catalogo.json", bajar=bajar)
    with Session(engine) as db:
        registradas = db.exec(select(FuenteAcademica)).all()
    assert len(registradas) == len(TEMAS) + 1
    assert {(f.tipo, f.licencia) for f in registradas if f.titulo == "PostgreSQL 7.8"} == {("documentación técnica oficial", "PostgreSQL License")}
    metas = rag.almacen().get()["metadatas"]
    assert {m["fuente"] for m in metas} == {"académica"}
    assert {m["id_origen"] for m in metas} == {f.id_fuente for f in registradas}
    assert len({m["id_tema"] for m in metas}) == len(TEMAS)
    assert "Sección B · Caso base" in {m["pagina_o_seccion"] for m in metas}
    # El texto descargado queda guardado con su URL: volver a correrlo no descarga de nuevo.
    fuentes.main(catalogo=tmp_path / "catalogo.json", bajar=lambda url: pytest.fail("no debería descargar"))


def test_catalogo_real_tiene_al_menos_tres_fuentes_por_tema():
    from pathlib import Path
    from app.db import TEMAS
    cat = json.loads((Path(__file__).parent.parent / "fuentes" / "catalogo.json").read_text(encoding="utf-8"))
    assert set(cat["temas"]) == set(TEMAS)
    for tema, por_fuente in cat["temas"].items():
        assert len(por_fuente) >= 3, tema  # HU-003, CA3
        assert set(por_fuente) <= set(cat["fuentes"])
    assert len(cat["temas"]["Recursividad"]) == 10  # Tabla 32: F1, F2, F3, F4, F5, F7, F9, F10, F11 y F12


def test_el_servidor_retoma_el_material_pendiente_al_arrancar(client):
    """Simula un reinicio a mitad del procesamiento: el material queda "pendiente" sin que nadie lo suba de nuevo."""
    from app.main import _reprocesar_pendientes
    client.post("/api/auth/dev")
    plan = crear_plan(client)
    subir(client, plan, "apunte.docx", docx("Texto de prueba sobre el caso base de la recursión.", titulo="Caso base"))
    with Session(engine) as db:
        mat = db.exec(select(MaterialEstudio)).first()
        id_material = mat.id_material
        mat.estado = "pendiente"  # como si el reinicio hubiera cortado el procesamiento acá
        db.add(mat); db.commit()
    import asyncio
    asyncio.run(_reprocesar_pendientes())
    with Session(engine) as db:
        assert db.get(MaterialEstudio, id_material).estado == "procesado"
