import json
import logging
from collections.abc import Iterator

from sqlalchemy import event, inspect, text
from sqlmodel import Session, SQLModel, create_engine, select

from .config import settings

log = logging.getLogger(__name__)

# check_same_thread=False: SQLite + FastAPI usan varios hilos.
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def _claves_foraneas(conexion, _):
    # SQLite no controla las claves foráneas salvo que se lo pida en cada conexión.
    conexion.execute("PRAGMA foreign_keys = ON")


# Contenidos del alcance del prototipo (Entrega 3, Alcances y Pantalla 1), con sus conceptos esperados
# (TEMA.conceptos_esperados: entre tres y cinco). Los de Recursividad son los del ejemplo de HU-008;
# los de los demás temas son una propuesta inicial que revisa el administrador.
AREA = "Algoritmos y estructuras de datos"
CONCEPTOS = {
    "Sintaxis y estructuras de control": [
        "variables y tipos de datos",
        "estructuras condicionales",
        "estructuras repetitivas (bucles)",
        "condición de corte de un bucle",
    ],
    "Estructuras de datos lineales": [
        "arreglo y acceso por índice",
        "pila: el último en entrar es el primero en salir",
        "cola: el primero en entrar es el primero en salir",
        "operaciones de inserción y eliminación",
    ],
    "Recursividad": [
        "caso base",
        "caso recursivo que se acerca al caso base",
        "pila de llamadas",
    ],
    "Búsqueda y ordenamiento": [
        "búsqueda binaria sobre un arreglo ordenado",
        "reducción del intervalo de búsqueda a la mitad",
        "ordenamiento por intercambio de elementos adyacentes (burbuja)",
    ],
}
TEMAS = list(CONCEPTOS)
# Nombres anteriores de un tema: se renombra en lugar de crear uno nuevo, así no se pierden sus objetivos.
RENOMBRADOS = {"Arreglos, pilas y colas": "Estructuras de datos lineales"}

# Tablas del modelo anterior al DER. Si aparecen en una base local, se borran (tenían solo datos de prueba).
TABLAS_VIEJAS = ["studysession", "material", "studyplan", "user"]


def init_db() -> None:
    from . import models  # noqa: F401  (registra las tablas)

    _borrar_tablas_viejas()
    _reiniciar_si_es_anterior_a_la_entrega_3()
    SQLModel.metadata.create_all(engine)  # crea las tablas que falten; a las que ya existen no les toca columnas
    _agregar_columnas_nuevas()  # por eso, un campo nuevo en un modelo existente se agrega acá, a mano
    _cargar_temas()


def _borrar_tablas_viejas() -> None:
    existentes = set(inspect(engine).get_table_names())
    with engine.begin() as conn:
        for tabla in TABLAS_VIEJAS:  # en este orden: primero las que dependen de otras
            if tabla in existentes:
                conn.execute(text(f'DROP TABLE "{tabla}"'))


def _reiniciar_si_es_anterior_a_la_entrega_3() -> None:
    """Una base local creada antes del DER de la Entrega 3 (sin FUENTE_ACADEMICA) solo tiene datos de prueba,
    y algunas de sus columnas cambiaron de obligatorias a opcionales: se borra y se vuelve a crear, junto con
    los fragmentos de ChromaDB, cuyos metadatos también cambiaron (id_material → id_origen)."""
    existentes = set(inspect(engine).get_table_names())
    if "objetivo_estudio" not in existentes or "fuente_academica" in existentes:
        return
    log.warning("Base de datos anterior a la Entrega 3: se reinicia (solo tenía datos de prueba).")
    SQLModel.metadata.drop_all(engine)
    from .services import rag
    rag.vaciar()


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
        for viejo, nuevo in RENOMBRADOS.items():
            tema = db.exec(select(Tema).where(Tema.nombre == viejo)).first()
            if tema and not db.exec(select(Tema).where(Tema.nombre == nuevo)).first():
                tema.nombre = nuevo
                db.add(tema)
        db.flush()
        cargados = {t.nombre: t for t in db.exec(select(Tema)).all()}
        for nombre, conceptos in CONCEPTOS.items():
            tema = cargados.get(nombre) or Tema(nombre=nombre, area=AREA)
            if tema.conceptos_esperados in (None, "", "[]"):  # no pisa lo que haya cargado el administrador
                tema.conceptos_esperados = json.dumps(conceptos, ensure_ascii=False)
            db.add(tema)
        db.commit()


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session
