"""Configuración del servidor (variables de entorno, .env) y parámetros del prototipo (parametros.toml).

Las variables de entorno guardan lo que cambia entre entornos o es secreto (claves, rutas, dominios).
parametros.toml guarda las reglas de diseño y los umbrales: son iguales en todos los entornos y
se versionan en el repositorio para que las pruebas sean reproducibles.
"""
import tomllib
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PARAMETROS_PATH = Path(__file__).resolve().parent.parent / "parametros.toml"
with PARAMETROS_PATH.open("rb") as f:
    P = tomllib.load(f)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_client_id: str = ""
    jwt_secret: str = "dev-secret-cambiar"
    jwt_expire_minutes: int = P["sesion"]["jwt_horas"] * 60  # Seguridad: validez de ocho horas
    database_url: str = "sqlite:///./plataforma.db"
    frontend_origin: str = "http://localhost:5173"
    dev_login: bool = False
    cookie_secure: bool = False  # en producción (HTTPS) va en true: atributo Secure de la cookie
    upload_dir: str = "./uploads"
    chroma_dir: str = "./chroma"  # base vectorial (ChromaDB) con los fragmentos del material
    anthropic_api_key: str = ""  # Claude (Anthropic); nunca va al repositorio ni al frontend
    judge0_url: str = ""  # ejecución aislada del código del estudiante
    judge0_api_key: str = ""


settings = Settings()
