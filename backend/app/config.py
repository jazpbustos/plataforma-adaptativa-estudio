"""Configuración leída de variables de entorno (.env)."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    google_client_id: str = ""
    jwt_secret: str = "dev-secret-cambiar"
    jwt_expire_minutes: int = 60 * 24 * 7
    database_url: str = "sqlite:///./plataforma.db"
    frontend_origin: str = "http://localhost:5173"
    dev_login: bool = False
    cookie_secure: bool = False
    upload_dir: str = "./uploads"
    max_upload_mb: int = 10


settings = Settings()
