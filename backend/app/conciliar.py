"""Conciliación después de restaurar un respaldo (Seguridad: procedimiento de restauración).

    python -m app.conciliar

La copia de SQLite, la de los archivos y la de ChromaDB se toman una después de otra, así que pueden no
quedar en el mismo estado lógico (por ejemplo, un archivo subido entre una copia y la siguiente). Después de
restaurar, la base relacional es la referencia y las otras dos se ajustan a ella:

1. Se borran de ChromaDB los fragmentos de material propio que no corresponden a ningún material de la base.
2. Se borran los archivos subidos que ningún material de la base referencia.
3. Se vuelven a indexar los materiales procesados que quedaron sin fragmentos (desde su archivo).
4. Se informan los materiales cuyo archivo falta y las fuentes académicas sin fragmentos
   (estas se recargan con python -m app.fuentes).

Al final informa cuántos ajustes hizo; una segunda ejecución sin ajustes es el criterio de verificación.
"""
from pathlib import Path

from sqlmodel import Session, select

from .config import settings
from .db import engine, init_db
from .models import FuenteAcademica, MaterialEstudio
from .services import rag


def conciliar() -> dict:
    init_db()
    r = {"fragmentos_huerfanos": 0, "archivos_huerfanos": 0, "reindexados": 0, "sin_archivo": [], "fuentes_sin_fragmentos": []}
    with Session(engine) as db:
        materiales = {m.id_material: m for m in db.exec(select(MaterialEstudio)).all()}
        fuentes = [f.id_fuente for f in db.exec(select(FuenteAcademica)).all()]

    col = rag.almacen()
    propios = col.get(where={"fuente": rag.PROPIA})
    con_fragmentos = set()
    for id_frag, meta in zip(propios["ids"], propios["metadatas"]):
        if meta["id_origen"] in materiales:
            con_fragmentos.add(meta["id_origen"])
        else:
            col.delete(ids=[id_frag])
            r["fragmentos_huerfanos"] += 1

    referenciados = {Path(m.ruta_archivo).resolve() for m in materiales.values()}
    carpeta = Path(settings.upload_dir)
    if carpeta.exists():
        for archivo in carpeta.rglob("*"):
            if archivo.is_file() and archivo.resolve() not in referenciados:
                archivo.unlink()
                r["archivos_huerfanos"] += 1

    from .routers.plans import procesar_material
    for m in materiales.values():
        if not Path(m.ruta_archivo).exists():
            r["sin_archivo"].append(m.id_material)
        elif m.estado == "procesado" and m.id_material not in con_fragmentos:
            procesar_material(m.id_material)
            r["reindexados"] += 1

    academicos = {meta["id_origen"] for meta in col.get(where={"fuente": rag.ACADEMICA})["metadatas"]}
    r["fuentes_sin_fragmentos"] = [f for f in fuentes if f not in academicos]
    return r


def ajustes(r: dict) -> int:
    return r["fragmentos_huerfanos"] + r["archivos_huerfanos"] + r["reindexados"]


if __name__ == "__main__":
    resultado = conciliar()
    for clave, valor in resultado.items():
        print(f"{clave}: {valor}")
    print("Sin inconsistencias." if not ajustes(resultado) and not resultado["sin_archivo"]
          and not resultado["fuentes_sin_fragmentos"] else "Se hicieron ajustes: volver a ejecutar para verificar.")
