from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

from .config import settings

# check_same_thread=False: SQLite + FastAPI usan varios hilos.
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


def init_db() -> None:
    from . import models  # noqa: F401  (registra las tablas)

    SQLModel.metadata.create_all(engine)


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
