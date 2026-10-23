"""Tablas de la base relacional, una por entidad del DER (Entrega 2, Ilustración 5).

Los nombres de tablas y campos son los del diagrama y el diccionario de datos. Los únicos campos
que no figuran en el DER están marcados con "fuera del DER" y explican por qué hacen falta.
Las fechas guardan también la hora: los indicadores de bloqueo miden tiempo entre eventos.
"""
from datetime import datetime, timezone

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


def ahora() -> datetime:
    return datetime.now(timezone.utc)


class Tema(SQLModel, table=True):
    """Contenidos del alcance del prototipo. Se cargan al iniciar (ver db.TEMAS)."""
    __tablename__ = "tema"
    id_tema: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(unique=True)
    area: str


class Estudiante(SQLModel, table=True):
    __tablename__ = "estudiante"
    id_estudiante: int | None = Field(default=None, primary_key=True)
    id_google: str = Field(index=True, unique=True)  # "sub" del token de Google: evita guardar contraseñas
    nombre: str
    correo_electronico: str
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
    dias_disponibles: int
    nivel_inicial: str  # principiante | intermedio | avanzado
    nota_objetivo: int  # 6 a 10; define el dominio requerido (60, 80 o 90 %)
    lenguaje: str  # el del material de la cátedra o el que elige el estudiante ("material": a detectar)
    plan_estudio: str  # JSON: lista de sesiones planificadas día por día; se reescribe al reajustar el plan
    fecha_creacion: datetime = Field(default_factory=ahora)


class MaterialEstudio(SQLModel, table=True):
    __tablename__ = "material_estudio"
    id_material: int | None = Field(default=None, primary_key=True)
    id_objetivo: int = Field(foreign_key="objetivo_estudio.id_objetivo", index=True)
    nombre_archivo: str
    tipo_archivo: str  # extensión: pdf, docx, txt, md, py
    fecha_carga: datetime = Field(default_factory=ahora)
    ruta_archivo: str  # fuera del DER: dónde quedó guardado el archivo en el servidor
    tamano_bytes: int  # fuera del DER: se muestra en Mi material
    estado: str = "pendiente"  # fuera del DER: pendiente | procesado | con error | no corresponde al tema


class NivelDominio(SQLModel, table=True):
    __tablename__ = "nivel_dominio"
    id_nivel: int | None = Field(default=None, primary_key=True)
    id_objetivo: int = Field(foreign_key="objetivo_estudio.id_objetivo", index=True)
    porcentaje: float = 0  # 0 a 100
    fecha_actualizacion: datetime = Field(default_factory=ahora)


class Ejercicio(SQLModel, table=True):
    __tablename__ = "ejercicio"
    id_ejercicio: int | None = Field(default=None, primary_key=True)
    id_tema: int = Field(foreign_key="tema.id_tema", index=True)
    enunciado: str
    tiempo_esperado: int  # minutos; la regla de bloqueo usa 2,5 veces este valor
    casos_prueba: str  # JSON con entradas y salidas esperadas


class SesionEstudio(SQLModel, table=True):
    """Una sesión realizada (no planificada) de Aprender, Practicar o Consolidar."""
    __tablename__ = "sesion_estudio"
    id_sesion: int | None = Field(default=None, primary_key=True)
    id_objetivo: int = Field(foreign_key="objetivo_estudio.id_objetivo", index=True)
    modulo: str  # aprender | practicar | consolidar
    fecha_hora_inicio: datetime = Field(default_factory=ahora)
    duracion_minutos: int = 0


class Intento(SQLModel, table=True):
    __tablename__ = "intento"
    id_intento: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    id_ejercicio: int = Field(foreign_key="ejercicio.id_ejercicio", index=True)
    codigo: str
    resultado: str  # correcto | error de sintaxis | error de ejecución | error lógico
    tipo_error: str | None = None
    fecha_hora: datetime = Field(default_factory=ahora)


class DificultadDetectada(SQLModel, table=True):
    __tablename__ = "dificultad_detectada"
    id_dificultad: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    id_intento: int | None = Field(default=None, foreign_key="intento.id_intento")  # vacío si surge en Consolidar
    tipo_patron: str  # intentos fallidos repetidos | tiempo excedido | explicación incompleta
    nivel_intervencion: int  # 1: pista mínima, 2: explicación elaborada
    intervencion_generada: str
    hubo_avance_posterior: bool = False
    fecha_hora: datetime = Field(default_factory=ahora)


class Explicacion(SQLModel, table=True):
    __tablename__ = "explicacion"
    id_explicacion: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    texto: str
    resultado: str  # correcta | incompleta | incorrecta
    fecha_hora: datetime = Field(default_factory=ahora)


class Punto(SQLModel, table=True):
    __tablename__ = "punto"
    id_punto: int | None = Field(default=None, primary_key=True)
    id_sesion: int = Field(foreign_key="sesion_estudio.id_sesion", index=True)
    cantidad: int  # 10 sin ayuda, 7 con pista mínima, 4 con explicación elaborada
    motivo: str
    fecha_hora: datetime = Field(default_factory=ahora)
