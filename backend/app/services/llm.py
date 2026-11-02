"""Acceso al modelo de lenguaje (Claude, de Anthropic) a través de LangChain (Diagrama de Arquitectura).

Criterio de asignación de modelos (Herramientas de Desarrollo): las tareas breves y frecuentes, como las
pistas mínimas, usan el modelo de menor costo (modelo_pistas); las que requieren mayor precisión, como el
contenido, las explicaciones elaboradas y la evaluación, el de mayor capacidad (modelo_contenido).

La clave de la API se lee del entorno del servidor (ANTHROPIC_API_KEY) y nunca llega al frontend. Si no
está configurada, o si el modelo no responde a tiempo, se lanza ModeloNoDisponible y quien llama usa su
texto de respaldo: la plataforma sigue funcionando sin el modelo.
"""
import logging

from ..config import P, settings

log = logging.getLogger(__name__)
L = P["llm"]

PISTAS = "pistas"
CONTENIDO = "contenido"


class ModeloNoDisponible(Exception):
    """Sin clave configurada, o el modelo no respondió (tiempo agotado, error de la API o respuesta vacía)."""


def configurado() -> bool:
    return bool(settings.anthropic_api_key)


def _crear(modelo: str, max_tokens: int, espera: float | None = None):
    from langchain_anthropic import ChatAnthropic
    return ChatAnthropic(model=modelo, api_key=settings.anthropic_api_key, max_tokens=max_tokens,
                         timeout=espera or L["espera_maxima_segundos"], max_retries=L["reintentos"])


crear = _crear  # los tests lo reemplazan por un modelo falso


def generar(tarea: str, sistema: str, usuario: str, max_tokens: int, espera: float | None = None) -> str:
    """Texto generado por el modelo asignado a la tarea (PISTAS o CONTENIDO).

    espera: segundos máximos de respuesta. Por defecto, los de las pistas (cortas); el contenido de Aprender,
    más largo, pasa una espera mayor.
    """
    if not configurado():
        raise ModeloNoDisponible("ANTHROPIC_API_KEY no está configurada")
    from langchain_core.messages import HumanMessage, SystemMessage
    modelo = L["modelo_pistas"] if tarea == PISTAS else L["modelo_contenido"]
    try:
        respuesta = crear(modelo, max_tokens, espera).invoke([SystemMessage(sistema), HumanMessage(usuario)])
    except Exception as e:  # red, tiempo agotado, clave inválida, límite de uso: se usa el respaldo
        log.warning("El modelo %s no respondió: %s", modelo, e)
        raise ModeloNoDisponible(str(e)) from e
    texto = (respuesta.text if isinstance(respuesta.text, str) else respuesta.text()).strip()
    if not texto:
        raise ModeloNoDisponible("respuesta vacía")
    return texto


def generar_json(tarea: str, sistema: str, usuario: str, max_tokens: int, intentos: int = 2, espera: float | None = None):
    """Como generar(), pero la respuesta tiene que ser un JSON. Si no se puede leer, se pide de nuevo una vez.

    Las respuestas en JSON permiten validar lo que devuelve el modelo antes de mostrarlo: que cada cita
    exista, que una pregunta tenga una sola respuesta correcta, que haya cinco preguntas, etc.
    """
    import json
    sistema = f"{sistema}\n\nRespondé únicamente con un objeto JSON válido, sin texto antes ni después y sin bloques ```."
    for _ in range(intentos):
        texto = generar(tarea, sistema, usuario, max_tokens, espera)
        inicio, fin = texto.find("{"), texto.rfind("}")
        if inicio != -1 and fin > inicio:
            try:
                return json.loads(texto[inicio:fin + 1])
            except json.JSONDecodeError as e:
                log.warning("El modelo no devolvió un JSON válido (%s). Final de la respuesta: %r", e, texto[-150:])
                continue
        log.warning("El modelo no devolvió un JSON (¿respuesta cortada?). Final: %r", texto[-150:])
    raise ModeloNoDisponible("respuesta sin un JSON válido")


if __name__ == "__main__":
    # Comprueba la clave y los dos modelos: python -m app.services.llm
    for tarea in (PISTAS, CONTENIDO):
        modelo = L["modelo_pistas"] if tarea == PISTAS else L["modelo_contenido"]
        try:
            print(f"{modelo}: {generar(tarea, 'Respondé en una oración breve.', 'Decí hola y qué modelo sos.', 60)}")
        except ModeloNoDisponible as e:
            print(f"{modelo}: no disponible ({e})")
