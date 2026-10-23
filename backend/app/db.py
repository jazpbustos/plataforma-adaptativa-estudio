from collections.abc import Iterator

from sqlalchemy import event, inspect, text
from sqlmodel import Session, SQLModel, create_engine, select

from .config import settings

# check_same_thread=False: SQLite + FastAPI usan varios hilos.
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _claves_foraneas(conexion, _):
    # SQLite no controla las claves foráneas salvo que se lo pida en cada conexión.
    conexion.execute("PRAGMA foreign_keys = ON")


# Contenidos del alcance del prototipo (Entrega 2, Alcances).
AREA = "Algoritmos y estructuras de datos"
TEMAS = ["Sintaxis y estructuras de control", "Arreglos, pilas y colas", "Recursividad", "Búsqueda y ordenamiento"]

# Tablas del modelo anterior al DER. Si aparecen en una base local, se borran (tenían solo datos de prueba).
TABLAS_VIEJAS = ["studysession", "material", "studyplan", "user"]


def init_db() -> None:
    from . import models  # noqa: F401  (registra las tablas)

    _borrar_tablas_viejas()
    SQLModel.metadata.create_all(engine)  # crea las tablas que falten; a las que ya existen no les toca columnas
    _agregar_columnas_nuevas()  # por eso, un campo nuevo en un modelo existente se agrega acá, a mano
    _cargar_temas()


def _borrar_tablas_viejas() -> None:
    existentes = set(inspect(engine).get_table_names())
    with engine.begin() as conn:
        for tabla in TABLAS_VIEJAS:  # en este orden: primero las que dependen de otras
            if tabla in existentes:
                conn.execute(text(f'DROP TABLE "{tabla}"'))


def _agregar_columnas_nuevas() -> None:
    """Agrega a una base ya creada las columnas que se sumaron después (siempre nullable, sin migraciones)."""
    insp = inspect(engine)
    with engine.begin() as conn:
        for tabla in SQLModel.metadata.tables.values():
            existentes = {c["name"] for c in insp.get_columns(tabla.name)}
            for columna in tabla.columns:
                if columna.name not in existentes:
                    tipo = columna.type.compile(dialect=engine.dialect)
                    conn.execute(text(f'ALTER TABLE "{tabla.name}" ADD COLUMN "{columna.name}" {tipo}'))


def _cargar_temas() -> None:
    from .models import Tema

    with Session(engine) as db:
        cargados = set(db.exec(select(Tema.nombre)).all())
        for nombre in TEMAS:
            if nombre not in cargados:
                db.add(Tema(nombre=nombre, area=AREA))
        db.commit()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
