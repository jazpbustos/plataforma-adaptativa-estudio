from collections.abc import Iterator

from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel, create_engine

from .config import settings

# check_same_thread=False: SQLite + FastAPI usan varios hilos.
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


def init_db() -> None:
    from . import models  # noqa: F401  (registra las tablas)

    SQLModel.metadata.create_all(engine)
    _add_missing_columns()


# create_all no modifica tablas que ya existen. Para no tener que borrar la base local cada vez
# que se suma un campo, se agregan las columnas nuevas con su valor por defecto.
NEW_COLUMNS = {
    "studyplan": {"target_grade": "INTEGER NOT NULL DEFAULT 8", "required_mastery": "INTEGER NOT NULL DEFAULT 80"},
}


def _add_missing_columns() -> None:
    insp = inspect(engine)
    with engine.begin() as conn:
        for table, cols in NEW_COLUMNS.items():
            if not insp.has_table(table):
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in cols.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
