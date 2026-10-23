import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from .config import settings
from .db import engine, init_db
from .models import MaterialEstudio
from .routers import auth, plans


async def _reprocesar_pendientes() -> None:
    """Retoma el material que quedó "pendiente" si el servidor se reinició a mitad del procesamiento."""
    with Session(engine) as db:
        ids = db.exec(select(MaterialEstudio.id_material).where(MaterialEstudio.estado == "pendiente")).all()
    for id_material in ids:
        await asyncio.to_thread(plans.procesar_material, id_material)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # No se espera: el servidor arranca mientras retoma en segundo plano. Se guarda la referencia
    # para que el recolector de basura de Python no la descarte a mitad de camino.
    app.state.tarea_pendientes = asyncio.create_task(_reprocesar_pendientes())
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


@app.get("/api/health")
def health():
    return {"ok": True}
