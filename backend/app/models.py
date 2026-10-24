"""Tablas de la base relacional, una por entidad del DER (Entrega 3, Figura 5).

Los nombres de tablas y campos son los del diagrama y el diccionario de datos. Los únicos campos
que no figuran en el DER están marcados con "fuera del DER" y explican por qué hacen falta.
Las fechas guardan también la hora: los indicadores de bloqueo miden tiempo entre eventos.
"""
from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def ahora() -> datetime:
    return datetime.now(timezone.utc)


ROL_ESTUDIANTE, ROL_ADMIN = "estudiante", "administrador"


class Tema(SQLModel, table=True):
    """Contenidos del alcance del prototipo. Se cargan al iniciar (ver db.TEMAS)."""
    __tablename__ = "tema"
    id_tema: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(unique=True)
    area: str
    # JSON: lista de 3 a 5 conceptos. Define el plan del tema en Aprender, la evaluación de comprensión
    # y la corrección de la explicación de Consolidar. Lo carga el administrador.
    conceptos_esperados: str = "[]"


class FuenteAcademica(SQLModel, table=True):
    """Fuente precargada por el administrador para un tema (Anexo 6, Tabla 30)."""
    __tablename__ = "fuente_academica"
    id_fuente: int | None = Field(default=None, primary_key=True)
    id_tema: int = Field(foreign_key="tema.id_tema", index=True)
    titulo: str
    tipo: str  # libro o apunte de acceso abierto | curso universitario abierto | documentación técnica oficial | material de cátedra autorizado
    licencia: str  # licencia de acceso abierto o autorización del titular
    fecha_carga: datetime = Field(default_factory=ahora)
    url: str | None = None  # fuera del DER: de dónde se tomó el texto, para citarlo


class Estudiante(SQLModel, table=True):
    __tablename__ = "estudiante"
    id_estudiante: int | None = Field(default=None, primary_key=True)
    id_google: str = Field(index=True, unique=True)  # "sub" de Google: evita guardar contraseñas
    nombre: str
    correo_electronico: str
    rol: str = ROL_ESTUDIANTE  # estudiante | administrador; el rol de administrador se asigna a mano
    fecha_registro: datetime = Field(default_factory=ahora)
    foto_url: str | None = None  # fuera del DER: la foto de perfil de Google que se muestra en el panel
    lenguaje_preferido: str | None = None  # fuera del DER: precompleta el lenguaje al crear un objetivo nuevo


class ObjetivoEstudio(SQLModel, table=True):
    """Un tema que el estudiante decidió estudiar. Agrupa su plan, su material, sus sesiones y su dominio."""
    __tablename__ = "objetivo_estudio"
    __table_args__ = (UniqueConstraint("id_estudiante", "id_tema"),)  # un solo objetivo por tema
    id_objetivo: int | None = Field(default=None, primary_key=True)
    id_estudiante: int = Field(foreign_key="estudiante.id_estudiante", index=True)
    id_tema: int = Field(foreign_key="tema.id_tema")
    dias_disponibles: int  # 1 a 14, con un mínimo de 3, 4 o 5 según la nota objetivo
    nivel_inicial: str  # principiante | intermedio | avanzado
    nota_objetivo: int  # 6 a 10; define el dominio requerido (60, 80 o 90 %)
    lenguaje: str  # java | python
    plan_estudio: str  # JSON: arreglo de versiones del plan; la vigente es la última (ver services/planner.py)
    fecha_creacion: datetime = Field(default_factory=ahora)


class MaterialEstudio(SQLModel, table=True):
    __tablename__ = "material_estudio"
    id_material: int | None = Field(default=None, primary_key=True)
    id_objetivo: int = Field(foreign_key="objetivo_estudio.id_objetivo", index=True)
    nombre_archivo: str
    tipo_archivo: str  # extensión: pdf, docx o pptx
    fecha_carga: datetime = Field(default_factory=ahora)
    ruta_archivo: str  # fuera del DER: dónde quedó guardado el archivo en el servidor
    tamano_bytes: int  # fuera del DER: controla la cuota de 200 MB y se muestra en Mi material
    estado: str = "pendiente"  # fuera del DER: pendiente | procesado | sin texto | con error


class NivelDominio(SQLModel, table=True):
    __tablename__ = "nivel_dominio"
    id_nivel: int | None = Field(default=None, primary_key=True)
    id_objetivo: int = Field(foreign_key="objetivo_estudio.id_objetivo", index=True)
    porcentaje: float = 0  # 0 a 100, según la fórmula de HU-010
    fecha_actualizacion: datetime = Field(default_factory=ahora)


class Ejercicio(SQLModel, table=True):
    __tablename__ = "ejercicio"
    id_ejercicio: int | None = Field(default=None, primary_key=True)
    id_tema: int = Field(foreign_key="tema.id_tema", index=True)
    enunciado: str
    dificultad: str = "básico"  # básico | intermedio | avanzado
    tiempo_esperado: int  # minutos (1 a 60); la regla de bloqueo usa 2,5 veces este valor
    casos_prueba: str  # JSON: al menos tres casos con entradas y salidas, válidos para Java y Python


class SesionEstudio(SQLModel, table=True):
    """Una sesión realizada (no planificada) de Aprender, Practicar o Consolidar."""
    __tablename__ = "sesion_estudio"
    id_sesion: int | None = Field(default=None, primary_key=True)
    id_objetivo: int = Field(foreign_key="objetivo_estudio.id_objetivo", index=True)
    modulo: str  # aprender | practicar | consolidar
    # Solo en Aprender: lección guiada | tarjetas | cuestionario | repetición | evaluación.
    modo: str | None = None
    # Solo en Aprender, JSON: conceptos recorridos y tarjetas o preguntas falladas (las retoma el modo repetición).
    detalle_aprender: str | None = None
    resultado_evaluacion: float | None = None  # 0 a 100, solo en el modo evaluación; el mejor es A en HU-010
    fecha_hora_inicio: datetime = Field(default_factory=ahora)
    duracion_minutos: int = 0


class Intento(SQLModel, table=True):
    __tablename__ = "intento"
    id_intento: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    id_ejercicio: int = Field(foreign_key="ejercicio.id_ejercicio", index=True)
    lenguaje: str = "python"  # java | python: en el que se ejecutó el intento
    codigo: str
    resultado: str  # correcto | error de sintaxis | error de ejecución | error lógico
    # Categoría y mensaje normalizado del compilador o intérprete, o el caso de prueba que falla. Nulo si es correcto.
    tipo_error: str | None = None
    fecha_hora: datetime = Field(default_factory=ahora)


class DificultadDetectada(SQLModel, table=True):
    __tablename__ = "dificultad_detectada"
    id_dificultad: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    id_intento: int | None = Field(default=None, foreign_key="intento.id_intento")  # vacío si surge en Consolidar
    tipo_patron: str  # intentos fallidos repetidos | tiempo excedido | explicación incompleta | explicación incorrecta
    nivel_intervencion: int | None = None  # 1: pista mínima, 2: explicación elaborada; nulo en Consolidar
    intervencion_generada: str
    hubo_avance_posterior: bool | None = None  # nulo hasta que se registra el intento siguiente
    fecha_hora: datetime = Field(default_factory=ahora)


class Explicacion(SQLModel, table=True):
    __tablename__ = "explicacion"
    id_explicacion: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    texto: str
    resultado: str  # correcta | incompleta | incorrecta | no concluyente
    fecha_hora: datetime = Field(default_factory=ahora)


class Punto(SQLModel, table=True):
    __tablename__ = "punto"
    id_punto: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    # Ejercicio que originó los puntos: permite verificar que solo la primera resolución correcta sume.
    id_ejercicio: int = Field(foreign_key="ejercicio.id_ejercicio", index=True)
    cantidad: int  # 10 sin ayuda, 7 con pista mínima, 4 con explicación elaborada
    motivo: str
    fecha_hora: datetime = Field(default_factory=ahora)
