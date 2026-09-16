from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db
from .routers import auth, plans


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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
