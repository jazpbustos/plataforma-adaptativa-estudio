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


class _Codigo(str):
    """Texto de un bloque <pre>: se distingue del resto para poder desenvolver los ejemplos interactivos."""


class _Texto(HTMLParser):
    """Texto de una página HTML con sus títulos marcados como "== Título ==" (los reconoce rag.por_titulos).

    Descarta scripts, estilos y la interfaz de la página, y conserva los bloques de código. En la documentación
    generada con Sphinx (Python), cada función se define en un <dt id="..."> y no en un título: esos <dt>
    también se marcan como título, para poder citar y filtrar por función (p. ej., sys.setrecursionlimit).

    La interfaz se reconoce con reglas generales, no página por página, porque lo que no es contenido se
    parece a casi cualquier consulta y ocupa lugares en la recuperación:
    - elementos de interfaz por etiqueta (nav, header, footer, button…), por rol de accesibilidad
      (navigation, banner, search…) o por clase o id (menús, barras laterales, índices, avisos, progreso);
    - elementos ocultos (hidden, aria-hidden, display:none o visibility:hidden): no los ve el lector o los
      arma un script, como las autoevaluaciones interactivas. Excepción: los editores de código (<textarea>,
      como ActiveCode en Runestone) también están ocultos hasta que el script los muestra, pero tienen los
      ejemplos del libro: se conservan como bloques de código;
    - bloques cuyo texto son solo enlaces (y separadores): "[ Next Section | Chapter Index | Main Index ]";
    - envoltorios de visualizadores de código: ver _desenvolver.
    """
    OMITIR = {"script", "style", "nav", "header", "footer", "aside", "noscript", "svg", "form", "button", "select"}
    CODIGO = {"pre", "textarea"}
    BLOQUES = {"p", "div", "li", "pre", "br", "tr", "td", "table", "section", "article", "dd", "dt", "blockquote"}
    TITULOS = {"h1", "h2", "h3", "h4"}
    VACIOS = {"br", "img", "hr", "input", "meta", "link", "wbr", "source", "col", "area", "base", "embed", "track"}
    CONTENEDORES = {"html", "body", "main", "article"}  # nunca se descartan: algunos sitios les ponen clases de menú
    ROLES = {"navigation", "banner", "contentinfo", "search", "complementary", "menu", "menubar", "toolbar"}
    INTERFAZ = re.compile(r"(?<![a-z])nav|menu|sidebar|(?<![a-z])toc(?![a-z])|breadcrumb|footer|dropdown|"
                          r"adcopy|onlyprint|visuallyhidden|sr-only|comments|notice|progress")
    OCULTO = re.compile(r"display\s*:\s*none|visibility\s*:\s*hidden")
    SEPARADORES = re.compile(r"[\s\[\]|·•,;:/()–—-]+")

    def __init__(self):
        super().__init__()
        self.partes, self.omitir, self.titulo, self.dt_titulo = [], 0, None, False
        self.oculto, self.nivel_oculto = None, 0  # etiqueta del elemento de interfaz que se está salteando
        self.bloques, self.enlaces, self.pre = [], 0, None

    def _es_interfaz(self, tag: str, attrs: dict) -> bool:
        if tag in self.CONTENEDORES:
            return False
        # El id de una <section> sale de su título (Jupyter Book: <section id="comments"> es "2.8. Comments"):
        # ahí solo cuenta la clase.
        ident = "" if tag == "section" else attrs.get("id") or ""
        clases = f"{attrs.get('class') or ''} {ident}".lower()
        return (attrs.get("role") in self.ROLES or bool(self.INTERFAZ.search(clases)) or "hidden" in attrs
                or attrs.get("aria-hidden") == "true" or bool(self.OCULTO.search(attrs.get("style") or "")))

    def handle_starttag(self, tag, attrs):
        if self.oculto:
            self.nivel_oculto += tag == self.oculto
            return
        attrs = dict(attrs)
        if tag in self.OMITIR:
            self.omitir += 1
        elif self.omitir:
            return
        elif tag not in self.VACIOS | self.CODIGO and self._es_interfaz(tag, attrs):
            self.oculto, self.nivel_oculto = tag, 1
        elif tag in self.TITULOS or (tag == "dt" and attrs.get("id")):
            self.titulo, self.dt_titulo = [], tag == "dt"
        elif tag in self.CODIGO:
            self.partes.append("\n")
            self.pre = []
        elif tag == "a" and attrs.get("href"):
            self.enlaces += 1
        elif tag in self.BLOQUES:
            self.partes.append("\n")
            if tag not in self.VACIOS:
                self.bloques.append({"tag": tag, "inicio": len(self.partes), "texto": 0, "enlaces": 0})

    def handle_endtag(self, tag):
        if self.oculto:
            if tag == self.oculto:
                self.nivel_oculto -= 1
                if not self.nivel_oculto:
                    self.oculto = None
            return
        if tag in self.OMITIR:
            self.omitir = max(self.omitir - 1, 0)
        elif self.omitir:
            return
        elif (tag in self.TITULOS or (tag == "dt" and self.dt_titulo)) and self.titulo is not None:
            texto = " ".join("".join(self.titulo).split()).strip("¶# ")
            if texto:
                self.partes.append(f"\n== {texto} ==\n")
            self.titulo, self.dt_titulo = None, False
        elif tag in self.CODIGO and self.pre is not None:
            self.partes += [_Codigo("".join(self.pre)), "\n"]
            self.pre = None
        elif tag == "a":
            self.enlaces = max(self.enlaces - 1, 0)
        elif tag in self.BLOQUES:
            self._cerrar_bloque(tag)
            self.partes.append("\n")

    def _cerrar_bloque(self, tag):
        """Si el bloque solo tenía enlaces, es navegación: se borra su texto (los títulos se conservan)."""
        for i in range(len(self.bloques) - 1, -1, -1):
            if self.bloques[i]["tag"] == tag:
                b = self.bloques[i]
                del self.bloques[i:]
                if b["texto"] and b["texto"] == b["enlaces"]:
                    self.partes[b["inicio"]:] = [p for p in self.partes[b["inicio"]:] if p.startswith("\n== ")]
                return

    def handle_data(self, data):
        if self.omitir or self.oculto:
            return
        if self.titulo is not None:  # el texto de los títulos no cuenta para los bloques: los títulos se conservan
            self.titulo.append(data)
            return
        (self.pre if self.pre is not None else self.partes).append(data)
        n = len(self.SEPARADORES.sub("", data))
        for b in self.bloques:
            b["texto"] += n
            b["enlaces"] += n if self.enlaces else 0

    # Texto de la interfaz de la página, no del contenido: el aviso de los ejemplos interactivos.
    RUIDO = re.compile(r"^\s*(Loading\.\.\.|Cargando\.\.\.)\s*$", re.MULTILINE)

    def texto(self) -> str:
        crudo = self.RUIDO.sub("", "".join(_desenvolver(self.partes)).replace("¶", ""))
        return re.sub(r"\n\s*\n\s*\n+", "\n\n", crudo).strip()


# Un bloque de código que solo llama a una función pasándole otro código entre comillas triples:
# env_diagram(r'''def f(n): ...''', step=0, cumulative=False)
ENVOLTORIO = re.compile(r"^\s*([A-Za-z_]\w*)\(\s*[rRuU]?('''|\"\"\")\n?(.*?)\2\s*(?:,[^()]*)?\)\s*$", re.DOTALL)
IMPORTACION = re.compile(r"^\s*(?:from\s+[\w.]+\s+)?import\s+([\w\s,]+)$")


def _desenvolver(partes: list[str]) -> list[str]:
    """Deja el código de los ejemplos interactivos sin el visualizador que lo envuelve.

    Algunos libros (Composing Programs) muestran cada ejemplo dentro de la llamada a un visualizador de
    entornos: el código real es el texto entre comillas triples. Se conserva ese texto y se descarta la
    llamada, y también el bloque que solo importa el visualizador (from pytutor import env_diagram).
    Para no confundir un visualizador con print('''…''') u otra función del ejemplo, la función tiene que
    importarse en un bloque propio de la misma página.
    """
    def importados(p: str) -> set[str] | None:
        """Nombres que importa un bloque formado solo por imports (None si tiene otro código)."""
        lineas = [l for l in p.strip().splitlines() if l.strip()]
        coincidencias = [IMPORTACION.match(l) for l in lineas]
        if not lineas or not all(coincidencias):
            return None
        return {n.strip() for m in coincidencias for n in m.group(1).split(",")}

    codigos = [p for p in partes if isinstance(p, _Codigo)]
    solo_importan = set().union(*(n for p in codigos if (n := importados(p))))
    envoltorios = {m.group(1) for p in codigos if (m := ENVOLTORIO.match(p))} & solo_importan
    salida = []
    for p in partes:
        if isinstance(p, _Codigo) and envoltorios:
            if (m := ENVOLTORIO.match(p)) and m.group(1) in envoltorios:
                p = m.group(3)
            elif (n := importados(p)) and n <= envoltorios:
                continue
        salida.append(p)
    return salida


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
        return "\n".join(f"== pág. {i} ==\n{rag.unir_guiones(p.extract_text() or '')}" for i, p in enumerate(paginas, 1))
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
