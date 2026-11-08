import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .config import settings
from .db import engine, init_db
from .models import MaterialEstudio
from .routers import aprender, auth, consolidar, plans, practicar, progreso
from .services import llm, rag

log = logging.getLogger(__name__)


async def _reprocesar_pendientes() -> None:
    """Retoma el material que quedó "pendiente" si el servidor se reinició a mitad del procesamiento."""
    with Session(engine) as db:
        ids = db.exec(select(MaterialEstudio.id_material).where(MaterialEstudio.estado == "pendiente")).all()
    for id_material in ids:
        await asyncio.to_thread(plans.procesar_material, id_material)


def _precargar_modelos() -> None:
    try:
        rag.precargar()
    except Exception as e:  # sin los modelos, la explicación se genera igual, sin fragmentos del material
        log.warning("No se pudieron precargar los modelos del RAG: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # No se espera: el servidor arranca mientras retoma en segundo plano. Se guarda la referencia
    # para que el recolector de basura de Python no la descarte a mitad de camino.
    app.state.tarea_pendientes = asyncio.create_task(_reprocesar_pendientes())
    if llm.configurado():
        # Los modelos de embeddings y re-ranking se cargan en segundo plano: la explicación elaborada los usa.
        app.state.tarea_precarga = asyncio.create_task(asyncio.to_thread(_precargar_modelos))
    yield


app = FastAPI(title="Plataforma de estudio · API", version="0.1.0", lifespan=lifespan)

# En desarrollo el front usa el proxy de Vite (mismo origen), pero dejamos CORS
# configurado para cuando front y back se desplieguen en dominios distintos.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(plans.router, prefix="/api")
app.include_router(practicar.router, prefix="/api")
app.include_router(aprender.router, prefix="/api")
app.include_router(consolidar.router, prefix="/api")
app.include_router(progreso.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"ok": True}


# Producción: el mismo servidor entrega el frontend compilado, así front y back comparten dominio y la
# cookie de sesión funciona igual que en desarrollo. Las rutas del front (/app/practicar, etc.) las
# resuelve React: cualquier ruta que no sea un archivo devuelve index.html.
if settings.frontend_dir and (FRONT := Path(settings.frontend_dir).resolve()).is_dir():
    @app.get("/{ruta:path}", include_in_schema=False)
    def frontend(ruta: str):
        if ruta.startswith("api/"):
            raise HTTPException(404)
        archivo = (FRONT / ruta).resolve()
        if ruta and archivo.is_file() and archivo.is_relative_to(FRONT):
            return FileResponse(archivo)
        return FileResponse(FRONT / "index.html")
