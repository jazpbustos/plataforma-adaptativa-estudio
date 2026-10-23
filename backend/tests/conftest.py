import os

# Antes de importar la app: base, archivos y ChromaDB de prueba, separados de los reales.
os.environ.update(DATABASE_URL="sqlite:///./test.db", DEV_LOGIN="true", UPLOAD_DIR="./test_uploads",
                  CHROMA_DIR="./test_chroma")

import hashlib
import math
import re

import pytest


def embedding_falso(textos):
    """Reemplaza al modelo real (~220 MB): un vector por palabras, normalizado. Alcanza para ordenar por parecido."""
    vectores = []
    for t in textos:
        v = [0.0] * 256
        for palabra in re.findall(r"\w+", t.lower()):
            v[int(hashlib.md5(palabra.encode()).hexdigest(), 16) % 256] += 1
        norma = math.sqrt(sum(x * x for x in v)) or 1
        vectores.append([x / norma for x in v])
    return vectores


@pytest.fixture(autouse=True)
def sin_modelo_real(monkeypatch):
    from app.services import rag
    monkeypatch.setattr(rag, "embedder", embedding_falso)
    col = rag.almacen()
    if ids := col.get()["ids"]:
        col.delete(ids=ids)
