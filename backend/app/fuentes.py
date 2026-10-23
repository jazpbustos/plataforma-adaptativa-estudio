"""Fuentes académicas de cada tema: artículos de Wikipedia en español (licencia CC BY-SA 4.0).

Uso (desde backend/, con el entorno activado):
    python -m app.fuentes            descarga los artículos que falten y los indexa en ChromaDB
    python -m app.fuentes --forzar   vuelve a descargarlos todos

Los textos quedan en backend/fuentes/<tema>/<artículo>.txt, con la URL de origen en la primera línea.
Se indexan con fuente "académica" e id_material 0 (no pertenecen a ningún estudiante).
"""
import re
import sys
from pathlib import Path

import requests
from sqlmodel import Session, select

from .db import TEMAS, engine, init_db
from .models import Tema
from .services import rag

API = "https://es.wikipedia.org/w/api.php"
CARPETA = Path("fuentes")
# Wikipedia pide identificar a quien usa su API.
HEADERS = {"User-Agent": "PlataformaEstudioTFG/0.1 (prototipo academico; Universidad Siglo 21)"}

ARTICULOS = {
    "Sintaxis y estructuras de control": ["Estructuras de control", "Sentencia condicional", "Bucle for", "Bucle while"],
    "Arreglos, pilas y colas": ["Vector (informática)", "Pila (informática)", "Cola (informática)"],
    "Recursividad": ["Recursión (ciencias de computación)", "Pila de llamadas"],
    "Búsqueda y ordenamiento": ["Búsqueda binaria", "Algoritmo de ordenamiento", "Ordenamiento de burbuja"],
}
assert set(ARTICULOS) == set(TEMAS), "cada tema del alcance necesita sus artículos"

# Secciones sin contenido del tema.
DESCARTAR = re.compile(r"^={2,}\s*(Referencias|Notas|Véase también|Enlaces externos|Bibliografía|Fuentes)\s*={2,}",
                       re.MULTILINE)


def _slug(texto: str) -> str:
    return re.sub(r"[^\w]+", "_", texto, flags=re.UNICODE).strip("_").lower()


def descargar(titulo: str) -> tuple[str, str]:
    """Texto plano del artículo (con títulos de sección "== … ==") y su URL."""
    r = requests.get(API, headers=HEADERS, timeout=30, params={
        "action": "query", "prop": "extracts|info", "inprop": "url", "explaintext": 1,
        "redirects": 1, "titles": titulo, "format": "json", "formatversion": 2})
    r.raise_for_status()
    pagina = r.json()["query"]["pages"][0]
    if pagina.get("missing"):
        raise ValueError(f"No existe el artículo «{titulo}»")
    texto = pagina["extract"]
    corte = DESCARTAR.search(texto)
    return (texto[:corte.start()] if corte else texto).strip(), pagina["fullurl"]


def main(forzar: bool = False) -> None:
    init_db()
    with Session(engine) as db:
        temas = {t.nombre: t.id_tema for t in db.exec(select(Tema)).all()}
    total = 0
    for tema, titulos in ARTICULOS.items():
        carpeta = CARPETA / _slug(tema)
        carpeta.mkdir(parents=True, exist_ok=True)
        for titulo in titulos:
            archivo = carpeta / f"{_slug(titulo)}.txt"
            if forzar or not archivo.exists():
                texto, url = descargar(titulo)
                archivo.write_text(f"{url}\nLicencia: CC BY-SA 4.0\n\n{texto}", encoding="utf-8")
            url, _, texto = archivo.read_text(encoding="utf-8").split("\n", 2)
            n = rag.indexar(rag.por_titulos(texto), id_material=0, id_tema=temas[tema], fuente=rag.ACADEMICA,
                            nombre_archivo=titulo, prefijo=f"wiki-{temas[tema]}-{_slug(titulo)}")
            total += n
            print(f"  {tema} · {titulo}: {n} fragmentos")
    print(f"Listo: {total} fragmentos académicos en ChromaDB ({len(rag.almacen().get()['ids'])} en total).")


if __name__ == "__main__":
    main(forzar="--forzar" in sys.argv)
