"""Carga de las fuentes académicas precargadas por el administrador (HU-003, CA3; Anexo 6).

Uso (desde backend/, con el entorno activado):
    python -m app.fuentes            descarga las secciones que falten, registra las fuentes y las indexa
    python -m app.fuentes --forzar   vuelve a descargarlas todas

Lee fuentes/catalogo.json, que asigna a cada tema las fuentes de la Tabla 30 con las secciones de la
Tabla 31 (y, para Recursividad, de la Tabla 32). Por cada tema y fuente:
1. Descarga cada sección (HTML o PDF) y guarda su texto en fuentes/<tema>/<id>-<n>.txt, con la URL
   en la primera línea: así el contenido indexado no cambia si la página se modifica después.
2. Registra la fuente en FUENTE_ACADEMICA con su título, tipo y licencia.
3. Indexa sus fragmentos con fuente "académica" e id_origen = id_fuente.

La descarga corre en la computadora del administrador: solo se usan fuentes con licencia que permite
almacenarlas y procesarlas (Anexo 6).
"""
import io
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

import requests
from sqlmodel import Session, select

from .db import TEMAS, engine, init_db
from .models import FuenteAcademica, Tema
from .services import rag

CARPETA = Path("fuentes")
CATALOGO = CARPETA / "catalogo.json"
HEADERS = {"User-Agent": "PlataformaEstudioTFG/0.2 (prototipo academico; Universidad Siglo 21)"}


def _slug(texto: str) -> str:
    return re.sub(r"[^\w]+", "_", texto, flags=re.UNICODE).strip("_").lower()


class _Texto(HTMLParser):
    """Texto de una página HTML con sus títulos marcados como "== Título ==" (los reconoce rag.por_titulos).

    Descarta menús, encabezados, pies, scripts y estilos; conserva los bloques de código. En la documentación
    generada con Sphinx (Python), cada función se define en un <dt id="..."> y no en un título: esos <dt>
    también se marcan como título, para poder citar y filtrar por función (p. ej., sys.setrecursionlimit).
    """
    OMITIR = {"script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "form", "button"}
    BLOQUES = {"p", "div", "li", "pre", "br", "tr", "table", "section", "article", "dd", "dt", "blockquote"}
    TITULOS = {"h1", "h2", "h3", "h4"}

    def __init__(self):
        super().__init__()
        self.partes, self.omitir, self.titulo, self.dt_titulo = [], 0, None, False

    def handle_starttag(self, tag, attrs):
        if tag in self.OMITIR:
            self.omitir += 1
        elif (tag in self.TITULOS or (tag == "dt" and dict(attrs).get("id"))) and not self.omitir:
            self.titulo, self.dt_titulo = [], tag == "dt"
        elif tag in self.BLOQUES:
            self.partes.append("\n")

    def handle_endtag(self, tag):
        if tag in self.OMITIR and self.omitir:
            self.omitir -= 1
        elif (tag in self.TITULOS or (tag == "dt" and self.dt_titulo)) and self.titulo is not None:
            texto = " ".join("".join(self.titulo).split()).strip("¶# ")
            if texto:
                self.partes.append(f"\n== {texto} ==\n")
            self.titulo, self.dt_titulo = None, False
        elif tag in self.BLOQUES:
            self.partes.append("\n")

    def handle_data(self, data):
        if self.omitir:
            return
        (self.titulo if self.titulo is not None else self.partes).append(data)

    # Texto de la interfaz de la página, no del contenido: el aviso de los ejemplos interactivos.
    RUIDO = re.compile(r"^\s*(Loading\.\.\.|Cargando\.\.\.)\s*$", re.MULTILINE)

    def texto(self) -> str:
        crudo = self.RUIDO.sub("", "".join(self.partes).replace("¶", ""))
        return re.sub(r"\n\s*\n\s*\n+", "\n\n", crudo).strip()


def html_a_texto(html: str) -> str:
    p = _Texto()
    p.feed(html)
    return p.texto()


def descargar(url: str) -> str:
    """Texto de una sección: las páginas HTML se convierten a texto con títulos; los PDF, página por página."""
    r = requests.get(url, headers=HEADERS, timeout=60)
    r.raise_for_status()
    if r.content.startswith(b"%PDF-"):
        from pypdf import PdfReader
        paginas = PdfReader(io.BytesIO(r.content)).pages
        return "\n".join(f"== pág. {i} ==\n{p.extract_text() or ''}" for i, p in enumerate(paginas, 1))
    # Si el servidor no declara la codificación, requests asume ISO-8859-1 y rompe los acentos ("Ã³"):
    # en ese caso se usa UTF-8, la de todas las fuentes del catálogo.
    if "charset" not in r.headers.get("content-type", "").lower():
        r.encoding = "utf-8"
    return html_a_texto(r.text)


def _secciones(seccion: str, texto: str, solo: list[str] | None = None) -> list[rag.Seccion]:
    """Divide por títulos y antepone el nombre de la sección del catálogo, para citar "4.4 … · Caso base".

    `solo`: si el catálogo lo indica, se conservan solo las partes cuyo título contiene alguno de esos
    términos (por ejemplo, de la página del módulo sys, solo lo relativo al límite de recursión).
    """
    partes = rag.por_titulos(texto)
    if solo:
        partes = [s for s in partes if any(t.lower() in s.pagina_o_seccion.lower() for t in solo)]
    return [rag.Seccion(s.texto, f"{seccion} · {s.pagina_o_seccion}" if s.pagina_o_seccion else seccion)
            for s in partes]


def _fuente(db: Session, id_tema: int, datos: dict, url: str) -> FuenteAcademica:
    f = db.exec(select(FuenteAcademica).where(FuenteAcademica.id_tema == id_tema,
                                              FuenteAcademica.titulo == datos["titulo"])).first()
    f = f or FuenteAcademica(id_tema=id_tema, titulo=datos["titulo"], tipo=datos["tipo"], licencia=datos["licencia"])
    f.tipo, f.licencia, f.url = datos["tipo"], datos["licencia"], url
    db.add(f)
    db.commit()
    db.refresh(f)
    return f


def main(forzar: bool = False, catalogo: Path = CATALOGO, bajar=descargar) -> None:
    init_db()
    cat = json.loads(catalogo.read_text(encoding="utf-8"))
    faltan = set(TEMAS) - set(cat["temas"])
    if faltan:
        sys.exit(f"El catálogo no tiene fuentes para: {', '.join(sorted(faltan))}")
    total = 0
    with Session(engine) as db:
        temas = {t.nombre: t.id_tema for t in db.exec(select(Tema)).all()}
        for tema, por_fuente in cat["temas"].items():
            carpeta = CARPETA / _slug(tema)
            carpeta.mkdir(parents=True, exist_ok=True)
            for id_cat, secciones in por_fuente.items():
                secs = []
                for n, (nombre, url, *solo) in enumerate(secciones, 1):
                    archivo = carpeta / f"{id_cat.lower()}-{n}.txt"
                    if forzar or not archivo.exists():
                        archivo.write_text(f"{url}\n\n{bajar(url)}", encoding="utf-8")
                    _, _, texto = archivo.read_text(encoding="utf-8").partition("\n\n")
                    secs += _secciones(nombre, texto, solo[0] if solo else None)
                f = _fuente(db, temas[tema], cat["fuentes"][id_cat], secciones[0][1])
                n = rag.indexar(secs, id_origen=f.id_fuente, id_tema=temas[tema], fuente=rag.ACADEMICA,
                                nombre_archivo=f.titulo, prefijo=f"fuente{f.id_fuente}")
                total += n
                print(f"  {tema} · {id_cat} {f.titulo}: {n} fragmentos")
    print(f"Listo: {total} fragmentos académicos en ChromaDB ({len(rag.almacen().get()['ids'])} en total).")


if __name__ == "__main__":
    main(forzar="--forzar" in sys.argv)
