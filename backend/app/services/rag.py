"""Recuperación aumentada (RAG) del material de estudio (HU-003).

Como plantea la Entrega 2, LangChain orquesta el proceso y ChromaDB es la base vectorial.
Flujo: el texto de cada archivo se extrae, se divide en fragmentos y cada fragmento se guarda en
ChromaDB con su embedding y los metadatos de FRAGMENTO_MATERIAL (Entrega 2, Ilustración 6):
id_fragmento, id_material, id_tema, texto_original, embedding, fuente, nombre_archivo y
pagina_o_seccion. Las búsquedas filtran por tema y devuelven solo fuentes académicas o material
del propio estudiante.

Los embeddings los calcula un modelo local y multilingüe (FastEmbed, sin GPU ni servicios pagos):
el material está en español y el modelo por defecto de ChromaDB solo fue entrenado en inglés.
"""
import re
import threading
from dataclasses import dataclass
from pathlib import Path

from langchain_core.embeddings import Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..config import settings

COLECCION = "fragmento_material"
ACADEMICA, PROPIA = "académica", "propia"
TAM_FRAGMENTO = 800  # caracteres: entra un concepto completo sin mezclar temas
SOLAPAMIENTO = 150  # se repite el final del fragmento anterior para no cortar ideas al medio


@dataclass
class Seccion:
    texto: str
    pagina_o_seccion: str  # "pág. 3", el título de la sección o "" si el archivo no tiene partes


# ---------------- Extracción de texto ----------------

def _titulo(linea: str) -> str | None:
    """Títulos de Markdown (# Título) y de los artículos de Wikipedia (== Título ==)."""
    m = re.match(r"^\s*(#{1,6}\s+(.+)|={2,}\s*(.+?)\s*={2,})\s*$", linea)
    return (m.group(2) or m.group(3)).strip() if m else None


def por_titulos(texto: str) -> list[Seccion]:
    secciones, actual, lineas = [], "", []
    for linea in texto.splitlines():
        t = _titulo(linea)
        if t is None:
            lineas.append(linea)
            continue
        secciones.append(Seccion("\n".join(lineas), actual))
        actual, lineas = t, []
    secciones.append(Seccion("\n".join(lineas), actual))
    return secciones


def extraer(ruta: Path, tipo: str) -> list[Seccion]:
    if tipo == "pdf":
        from pypdf import PdfReader
        return [Seccion(p.extract_text() or "", f"pág. {i}") for i, p in enumerate(PdfReader(ruta).pages, 1)]
    if tipo == "docx":
        from docx import Document
        secciones, actual, parrafos = [], "", []
        for p in Document(ruta).paragraphs:
            if p.style.name.lower().startswith(("heading", "título")) and p.text.strip():
                secciones.append(Seccion("\n".join(parrafos), actual))
                actual, parrafos = p.text.strip(), []
            else:
                parrafos.append(p.text)
        secciones.append(Seccion("\n".join(parrafos), actual))
        return secciones
    texto = ruta.read_text(encoding="utf-8", errors="replace")
    if tipo == "md":
        return por_titulos(texto)
    return [Seccion(texto, "código" if tipo == "py" else "")]


# ---------------- Fragmentación ----------------

def fragmentar(texto: str, tam: int = TAM_FRAGMENTO, solape: int = SOLAPAMIENTO) -> list[str]:
    """Corta primero por párrafos, después por líneas, oraciones y palabras, hasta que cada fragmento entre en `tam`."""
    divisor = RecursiveCharacterTextSplitter(chunk_size=tam, chunk_overlap=solape,
                                             separators=["\n\n", "\n", ". ", " ", ""])
    return [f for f in divisor.split_text(texto) if f.strip()]


# ---------------- Embeddings y ChromaDB ----------------

class _FastEmbed:
    def __init__(self):
        from fastembed import TextEmbedding
        self.modelo = TextEmbedding(settings.embedding_model)  # se descarga la primera vez (~220 MB)

    def __call__(self, textos: list[str]) -> list[list[float]]:
        return [v.tolist() for v in self.modelo.embed(textos)]


embedder = None  # se crea al primer uso; los tests lo reemplazan por uno falso
_almacen = None
_lock = threading.Lock()  # dos archivos subidos juntos se procesan en hilos distintos: se crean una sola vez


def _embed(textos: list[str]) -> list[list[float]]:
    global embedder
    with _lock:
        if embedder is None:
            embedder = _FastEmbed()
    return embedder(textos)


class EmbeddingsLocales(Embeddings):
    """Adapta el modelo local a la interfaz de embeddings de LangChain."""

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return _embed(texts)

    def embed_query(self, text: str) -> list[float]:
        return _embed([text])[0]


def almacen():
    """Vector store de LangChain sobre una colección persistente de ChromaDB."""
    global _almacen
    with _lock:
        if _almacen is None:
            import chromadb
            from langchain_chroma import Chroma
            _almacen = Chroma(collection_name=COLECCION, embedding_function=EmbeddingsLocales(),
                              client=chromadb.PersistentClient(path=settings.chroma_dir),
                              collection_configuration={"hnsw": {"space": "cosine"}})
    return _almacen


def indexar(secciones: list[Seccion], *, id_material: int, id_tema: int, fuente: str, nombre_archivo: str,
            prefijo: str) -> int:
    """Guarda los fragmentos en ChromaDB. Devuelve cuántos guardó (0 si el archivo no tenía texto)."""
    docs, metas = [], []
    for s in secciones:
        for f in fragmentar(s.texto):
            docs.append(f)
            metas.append({"id_material": id_material, "id_tema": id_tema, "fuente": fuente,
                          "nombre_archivo": nombre_archivo, "pagina_o_seccion": s.pagina_o_seccion})
    vs = almacen()
    vs.delete(where={"$and": [{"id_tema": id_tema}, {"nombre_archivo": nombre_archivo}, {"fuente": fuente}]}
              if fuente == ACADEMICA else {"id_material": id_material})  # reindexar no duplica
    if docs:
        vs.add_texts(docs, metadatas=metas, ids=[f"{prefijo}-{n}" for n in range(len(docs))])  # id_fragmento
    return len(docs)


def buscar(id_tema: int, consulta: str, materiales_propios: list[int], k: int = 4) -> list[dict]:
    """Los k fragmentos más parecidos a la consulta, del tema pedido.

    Solo fuentes académicas o material del propio estudiante: nunca el material que subió otra persona.
    """
    permitido = {"fuente": ACADEMICA}
    if materiales_propios:
        permitido = {"$or": [permitido, {"id_material": {"$in": materiales_propios}}]}
    resultados = almacen().similarity_search_with_relevance_scores(
        consulta, k=k, filter={"$and": [{"id_tema": id_tema}, permitido]})
    return [{"id_fragmento": doc.id, "texto_original": doc.page_content, "similitud": round(score, 3), **doc.metadata}
            for doc, score in resultados]
