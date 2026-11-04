"""Conciliación después de restaurar un respaldo (Seguridad: procedimiento de restauración)."""
import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel

from archivos import docx
from app import conciliar
from app.config import settings
from app.db import engine
from app.main import app
from app.services import rag


@pytest.fixture()
def client():
    from app.db import init_db
    init_db()
    SQLModel.metadata.drop_all(engine)
    with TestClient(app) as c:
        yield c


def test_la_base_es_la_referencia_y_la_segunda_pasada_no_ajusta_nada(client):
    client.post("/api/auth/dev")
    body = dict(topic="Recursividad", days=7, level="intermedio", target_grade=8, language="java")
    pid = client.post("/api/plans", json=body).json()["id"]
    up = client.post(f"/api/plans/{pid}/materials",
                     files={"file": ("apunte.docx", io.BytesIO(docx("Toda función recursiva necesita un caso base.")))})
    mat = up.json()["id"]
    conciliar.conciliar()  # deja el estado de partida limpio (otros tests pueden dejar archivos sueltos)

    # Estado inconsistente, como el de una restauración: fragmentos y un archivo de un material que la base
    # no tiene, y un material procesado que perdió sus fragmentos.
    rag.indexar([rag.Seccion("Fragmento de un material que no está en la base.", "")], id_origen=999,
                id_tema=1, fuente=rag.PROPIA, nombre_archivo="x.docx", prefijo="mat999")
    suelto = Path(settings.upload_dir) / "suelto.pdf"
    suelto.parent.mkdir(parents=True, exist_ok=True)
    suelto.write_bytes(b"%PDF-1.4")
    rag.almacen().delete(where={"$and": [{"fuente": rag.PROPIA}, {"id_origen": mat}]})

    r = conciliar.conciliar()
    assert (r["fragmentos_huerfanos"], r["archivos_huerfanos"], r["reindexados"]) == (1, 1, 1)
    assert not suelto.exists()
    assert rag.almacen().get(where={"$and": [{"fuente": rag.PROPIA}, {"id_origen": mat}]})["ids"]
    assert conciliar.ajustes(conciliar.conciliar()) == 0  # criterio de verificación
