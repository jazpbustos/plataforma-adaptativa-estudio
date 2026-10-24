"""Recuperación aumentada (RAG) del material de estudio (HU-003).

LangChain orquesta el proceso y ChromaDB es la base vectorial (Entrega 3, Estructura de Datos).
El procesamiento tiene cinco etapas; aquí se implementan las cuatro primeras (el contraste entre
fuentes usa el modelo de lenguaje):

1. Extracción: PDF página por página, DOCX sección por sección y PPTX diapositiva por diapositiva,
   con la página, sección o diapositiva de origen en `pagina_o_seccion`.
2. Segmentación: fragmentos de hasta 400 caracteres con 60 de superposición.
3. Representación vectorial: paraphrase-multilingual-MiniLM-L12-v2, local (FastEmbed, sin costo por uso).
4. Recuperación: los seis fragmentos más similares de cada fuente (propia y académica), filtrados por
   tema, descartando los que no alcanzan una similitud coseno de 0,35.

Cada fragmento guarda los campos de FRAGMENTO_MATERIAL (Figura 6): id_fragmento, id_origen, id_tema,
texto_original, embedding, fuente, nombre_archivo y pagina_o_seccion. `id_origen` es el id del
material propio o de la fuente académica, según el valor de `fuente`. Los valores de cada etapa
están en parametros.toml.
"""
import io
import re
import threading
import zipfile
from dataclasses import dataclass
from pathlib import Path

from langchain_core.embeddings import Embeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

from ..config import P, settings

R = P["rag"]
COLECCION = "fragmento_material"
ACADEMICA, PROPIA = "académica", "propia"
TAM_FRAGMENTO = R["tam_fragmento"]
SOLAPAMIENTO = R["solapamiento"]


@dataclass
class Seccion:
    texto: str
    pagina_o_seccion: str  # "pág. 3", "diap. 2", el título de la sección o "" si el archivo no tiene partes


# ---------------- Validación del tipo por contenido ----------------

def tipo_real(contenido: bytes) -> str | None:
    """Tipo del archivo según su contenido, no su extensión (Seguridad: medidas complementarias).

    PDF empieza con "%PDF-". DOCX y PPTX son paquetes ZIP de Office: se distinguen por la carpeta
    principal que declaran (word/ o ppt/). Cualquier otra cosa devuelve None.
    """
    if contenido.startswith(b"%PDF-"):
        return "pdf"
    if not contenido.startswith(b"PK\x03\x04"):
        return None
    try:
        with zipfile.ZipFile(io.BytesIO(contenido)) as z:
            nombres = set(z.namelist())
    except zipfile.BadZipFile:
        return None
    if "[Content_Types].xml" not in nombres:
        return None
    if "word/document.xml" in nombres:
        return "docx"
    if "ppt/presentation.xml" in nombres:
        return "pptx"
    return None


# ---------------- Extracción de texto ----------------

def _titulo(linea: str) -> str | None:
    """Títulos del texto de las fuentes (== Título ==).

    No se reconoce "# Título" de Markdown: en los ejemplos de código un comentario de Python
    empieza igual y se confundía con un título de sección.
    """
    m = re.match(r"^\s*={2,}\s*(.+?)\s*={2,}\s*$", linea)
    return m.group(1).strip() if m else None


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


def _pptx(ruta: Path) -> list[Seccion]:
    from pptx import Presentation
    secciones = []
    for n, diapositiva in enumerate(Presentation(ruta).slides, 1):
        partes = []
        for forma in diapositiva.shapes:
            if forma.has_text_frame:
                partes.append(forma.text_frame.text)
            elif getattr(forma, "has_table", False) and forma.has_table:
                partes += [" | ".join(c.text for c in fila.cells) for fila in forma.table.rows]
        if diapositiva.has_notes_slide:  # las notas del orador suelen tener la explicación
            partes.append(diapositiva.notes_slide.notes_text_frame.text)
        secciones.append(Seccion("\n".join(p for p in partes if p.strip()), f"diap. {n}"))
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
    if tipo == "pptx":
        return _pptx(ruta)
    # Texto plano con títulos: lo usan las fuentes académicas precargadas (no se admite como material propio).
    return por_titulos(ruta.read_text(encoding="utf-8", errors="replace"))


# ---------------- Fragmentación ----------------

def fragmentar(texto: str, tam: int = TAM_FRAGMENTO, solape: int = SOLAPAMIENTO) -> list[str]:
    """Corta primero por párrafos, después por líneas, oraciones y palabras, hasta que cada fragmento entre en `tam`.

    El separador de oraciones queda al final del fragmento (keep_separator="end"): así ninguno empieza con
    el punto de la oración anterior.
    """
    divisor = RecursiveCharacterTextSplitter(chunk_size=tam, chunk_overlap=solape, keep_separator="end",
                                             separators=["\n\n", "\n", ". ", " ", ""])
    return [f.strip() for f in divisor.split_text(texto) if f.strip()]


# ---------------- Embeddings y ChromaDB ----------------

class _FastEmbed:
    def __init__(self):
        from fastembed import TextEmbedding
        self.modelo = TextEmbedding(R["modelo_embeddings"])  # se descarga la primera vez (~220 MB)

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
    """Vector store de LangChain sobre una colección persistente de ChromaDB, con distancia coseno."""
    global _almacen
    with _lock:
        if _almacen is None:
            import chromadb
            from langchain_chroma import Chroma
            _almacen = Chroma(collection_name=COLECCION, embedding_function=EmbeddingsLocales(),
                              client=chromadb.PersistentClient(path=settings.chroma_dir),
                              collection_configuration={"hnsw": {"space": "cosine"}})
    return _almacen


def vaciar() -> None:
    """Borra todos los fragmentos (al reiniciar una base local de prueba)."""
    col = almacen()
    if ids := col.get()["ids"]:
        col.delete(ids=ids)


def indexar(secciones: list[Seccion], *, id_origen: int, id_tema: int, fuente: str, nombre_archivo: str,
            prefijo: str) -> int:
    """Guarda los fragmentos en ChromaDB. Devuelve cuántos guardó (0 si el archivo no tenía texto).

    Los fragmentos muy cortos (un título o una frase suelta) no aportan contenido y, al ser cortos, se
    parecen a casi cualquier consulta: se descartan, salvo que sean todo lo que tiene el archivo.
    """
    docs, metas = [], []
    for s in secciones:
        for f in fragmentar(s.texto):
            docs.append(f)
            metas.append({"id_origen": id_origen, "id_tema": id_tema, "fuente": fuente,
                          "nombre_archivo": nombre_archivo, "pagina_o_seccion": s.pagina_o_seccion})
    if any(len(d) >= R["fragmento_minimo"] for d in docs):
        pares = [(d, m) for d, m in zip(docs, metas) if len(d) >= R["fragmento_minimo"]]
        docs, metas = [d for d, _ in pares], [m for _, m in pares]
    vs = almacen()
    vs.delete(where={"$and": [{"fuente": fuente}, {"id_origen": id_origen}]})  # reindexar no duplica
    if docs:
        vs.add_texts(docs, metadatas=metas, ids=[f"{prefijo}-{n}" for n in range(len(docs))])  # id_fragmento
    return len(docs)


def _de_una_fuente(consulta: str, filtro: dict, k: int) -> list[dict]:
    resultados = almacen().similarity_search_with_relevance_scores(consulta, k=k, filter=filtro)
    return [{"id_fragmento": doc.id, "texto_original": doc.page_content, "similitud": round(score, 3), **doc.metadata}
            for doc, score in resultados]


def buscar(id_tema: int, consulta: str, materiales_propios: list[int], k: int = R["k_por_fuente"],
           minima: float = R["similitud_minima"]) -> list[dict]:
    """Los k fragmentos más similares de cada fuente del tema, sin los que no alcanzan la similitud mínima.

    Solo fuentes académicas o material del propio estudiante: nunca el material que subió otra persona.
    """
    encontrados = _de_una_fuente(consulta, {"$and": [{"id_tema": id_tema}, {"fuente": ACADEMICA}]}, k)
    if materiales_propios:
        encontrados += _de_una_fuente(consulta, {"$and": [{"id_tema": id_tema}, {"fuente": PROPIA},
                                                          {"id_origen": {"$in": materiales_propios}}]}, k)
    encontrados = [f for f in encontrados if f["similitud"] >= minima]
    return sorted(encontrados, key=lambda f: f["similitud"], reverse=True)


def recuperar(id_tema: int, consulta: str, materiales_propios: list[int]) -> dict:
    """Fragmentos para generar contenido sobre un concepto, e indicación de si alcanzan (HU-003, CA5).

    Con menos de dos fragmentos sobre el umbral, el material es insuficiente: quien llama informa al
    estudiante y solo genera una respuesta del conocimiento general del modelo si él lo pide, marcada
    como no respaldada por las fuentes del tema.
    """
    fragmentos = buscar(id_tema, consulta, materiales_propios)
    return {"fragmentos": fragmentos, "suficiente": len(fragmentos) >= R["fragmentos_minimos"]}
