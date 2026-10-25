"""Medición de la recuperación (HU-003) con el conjunto de prueba de evaluacion/consultas.json.

Uso (desde backend/, con el entorno activado):
    python -m app.evaluar                mide con los parámetros actuales y muestra el resumen
    python -m app.evaluar linea-base     además guarda el detalle en evaluacion/resultados/linea-base.json

Cada consulta pasa por la misma búsqueda que usa la API (rag.recuperar, solo fuentes académicas) y el
resultado se compara con los fragmentos que cuentan como respuesta. Así cada cambio del RAG se mide con
la misma vara, en lugar de mirar a ojo dos o tres preguntas: los valores iniciales se calibran en las
pruebas de cada incremento (Herramientas Metodológicas) y quedan registrados con sus parámetros.

Métricas, sobre las consultas que tienen respuesta en las fuentes:
- acierto@k: proporción de consultas con al menos un fragmento relevante entre los k primeros devueltos.
- MRR (rango recíproco medio): 1 / posición del primer relevante (0 si no aparece). Premia que salga arriba.
- precisión: de los fragmentos devueltos, cuántos son relevantes.
- posición sin umbral: dónde queda el primer relevante si no se descarta nada. Separa un problema de orden
  (sale abajo) de uno de umbral (sale arriba, pero no llega a la similitud mínima).
- concentración: qué parte de lo devuelto viene de la fuente que más aparece.
Y sobre todas: si "suficiente" es correcto (true con respuesta, false sin ella, HU-003 CA5) y cuántos
fragmentos devueltos tienen restos de las páginas (ruido).
"""
import json
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

from .config import P
from .services import rag

CARPETA = Path("evaluacion")
CONSULTAS = CARPETA / "consultas.json"
CATALOGO = Path("fuentes") / "catalogo.json"
E = P["evaluacion"]


def titulos_del_catalogo(catalogo: Path = CATALOGO) -> dict[str, str]:
    """Id del catálogo (F1…F12) → título con el que se guardó la fuente en nombre_archivo."""
    return {id_cat: d["titulo"] for id_cat, d in json.loads(catalogo.read_text(encoding="utf-8"))["fuentes"].items()}


def es_relevante(fragmento: dict, criterios: list[dict], titulos: dict[str, str]) -> bool:
    """Cumple al menos un criterio; dentro de un criterio, todo lo que indica (fuente, sección y texto)."""
    def cumple(c: dict) -> bool:
        if "fuente" in c and fragmento["nombre_archivo"] != titulos[c["fuente"]]:
            return False
        if "seccion" in c and c["seccion"].lower() not in fragmento["pagina_o_seccion"].lower():
            return False
        return "texto" not in c or re.search(c["texto"], fragmento["texto_original"], re.IGNORECASE) is not None
    return any(cumple(c) for c in criterios)


def _primera(marcas: list[bool]) -> int | None:
    return next((i for i, m in enumerate(marcas, 1) if m), None)


def medir(consulta: dict, devueltos: list[dict], suficiente: bool, sin_umbral: list[dict],
          titulos: dict[str, str], ruido: re.Pattern | None) -> dict:
    """Resultado de una consulta: lo devuelto (con el umbral) y, para diagnosticar, el orden sin umbral."""
    criterios = consulta["relevantes"]
    marcas = [es_relevante(f, criterios, titulos) for f in devueltos]
    marcas_sin = [es_relevante(f, criterios, titulos) for f in sin_umbral]
    pos_sin = _primera(marcas_sin)
    fuentes = Counter(f["nombre_archivo"] for f in devueltos)
    return {
        "id": consulta["id"], "tema": consulta["tema"], "consulta": consulta["consulta"],
        "con_respuesta": bool(criterios),
        "suficiente": suficiente,
        "suficiencia_correcta": suficiente == bool(criterios),
        "devueltos": len(devueltos),
        "relevantes_devueltos": sum(marcas),
        "posicion": _primera(marcas),
        "posicion_sin_umbral": pos_sin,
        "similitud_primer_relevante": sin_umbral[pos_sin - 1]["similitud"] if pos_sin else None,
        "similitud_maxima": sin_umbral[0]["similitud"] if sin_umbral else None,
        "concentracion": round(fuentes.most_common(1)[0][1] / len(devueltos), 3) if devueltos else None,
        "con_ruido": sum(bool(ruido and ruido.search(f["texto_original"])) for f in devueltos),
        "fragmentos": [{"posicion": i, "similitud": f["similitud"], "relevante": m, "fuente": f["nombre_archivo"],
                        "seccion": f["pagina_o_seccion"], "texto": f["texto_original"][:160]}
                       for i, (f, m) in enumerate(zip(devueltos, marcas), 1)],
    }


def resumir(medidas: list[dict], aciertos_en: list[int] = E["aciertos_en"]) -> dict:
    con = [m for m in medidas if m["con_respuesta"]]
    sin = [m for m in medidas if not m["con_respuesta"]]
    media = lambda xs: round(statistics.mean(xs), 3) if xs else None
    con_devueltos = [m for m in con if m["devueltos"]]
    devueltos = sum(m["devueltos"] for m in medidas)
    r = {"consultas": len(medidas), "con_respuesta": len(con), "sin_respuesta": len(sin)}
    for k in aciertos_en:
        r[f"acierto@{k}"] = media([m["posicion"] is not None and m["posicion"] <= k for m in con])
    r.update({
        "mrr": media([1 / m["posicion"] if m["posicion"] else 0 for m in con]),
        "precision": media([m["relevantes_devueltos"] / m["devueltos"] for m in con_devueltos]),
        "suficiente_con_respuesta": media([m["suficiente"] for m in con]),     # debería ser 1
        "insuficiente_sin_respuesta": media([not m["suficiente"] for m in sin]),  # debería ser 1
        "sin_relevante_en_profundidad": sum(m["posicion_sin_umbral"] is None for m in con),
        "posicion_sin_umbral_mediana": statistics.median(p) if (p := [m["posicion_sin_umbral"] for m in con
                                                                      if m["posicion_sin_umbral"]]) else None,
        "concentracion": media([m["concentracion"] for m in medidas if m["concentracion"] is not None]),
        "fragmentos_devueltos": devueltos,
        "fragmentos_con_ruido": sum(m["con_ruido"] for m in medidas),
        # Para calibrar el umbral: cuánto se parece la primera respuesta en las consultas que la tienen,
        # y cuánto se parece lo mejor que hay en las que no la tienen.
        "similitud_primer_relevante": sorted(m["similitud_primer_relevante"] for m in con
                                             if m["similitud_primer_relevante"] is not None),
        "similitud_maxima_sin_respuesta": sorted(m["similitud_maxima"] for m in sin
                                                 if m["similitud_maxima"] is not None),
    })
    return r


def evaluar(conjunto: dict, temas: dict[str, int], titulos: dict[str, str]) -> tuple[list[dict], dict]:
    """Corre todas las consultas. `temas`: nombre del tema → id_tema."""
    ruido = re.compile("|".join(f"(?:{p})" for p in conjunto.get("ruido", []))) if conjunto.get("ruido") else None
    medidas = []
    for c in conjunto["consultas"]:
        id_tema = temas[c["tema"]]
        r = rag.recuperar(id_tema, c["consulta"], materiales_propios=[])
        sin_umbral = rag.buscar(id_tema, c["consulta"], [], k=E["profundidad"], minima=-1)
        medidas.append(medir(c, r["fragmentos"], r["suficiente"], sin_umbral, titulos, ruido))
    return medidas, resumir(medidas)


def _num(x) -> str:
    return "–" if x is None else f"{x:.2f}" if isinstance(x, float) else str(x)


def mostrar(medidas: list[dict], resumen: dict) -> None:
    print(f"{'id':4} {'pos':>4} {'sin umbral':>10} {'sim 1.º rel':>11} {'sim máx':>8} {'dev':>4} {'rel':>4} "
          f"{'conc':>5}  suficiente")
    for m in medidas:
        ok = "ok" if m["suficiencia_correcta"] else "MAL"
        print(f"{m['id']:4} {_num(m['posicion']):>4} {_num(m['posicion_sin_umbral']):>10} "
              f"{_num(m['similitud_primer_relevante']):>11} {_num(m['similitud_maxima']):>8} {m['devueltos']:>4} "
              f"{m['relevantes_devueltos']:>4} {_num(m['concentracion']):>5}  {m['suficiente']} ({ok})")
    print()
    for clave, valor in resumen.items():
        print(f"  {clave}: {valor}")


def main(etiqueta: str | None = None, consultas: Path = CONSULTAS) -> dict:
    from sqlmodel import Session, select
    from .db import engine
    from .models import Tema
    with Session(engine) as db:
        temas = {t.nombre: t.id_tema for t in db.exec(select(Tema)).all()}
    medidas, resumen = evaluar(json.loads(consultas.read_text(encoding="utf-8")), temas, titulos_del_catalogo())
    mostrar(medidas, resumen)
    if etiqueta:
        destino = CARPETA / "resultados" / f"{etiqueta}.json"
        destino.parent.mkdir(parents=True, exist_ok=True)
        # Se guardan los parámetros junto con el resultado: así cada medición se puede reproducir.
        destino.write_text(json.dumps({"parametros": {"rag": P["rag"], "evaluacion": E}, "resumen": resumen,
                                       "consultas": medidas}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"\nDetalle guardado en {destino}")
    return resumen


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else None)
