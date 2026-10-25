"""Medición de la recuperación (HU-003) con el conjunto de prueba de evaluacion/consultas.json.

Uso (desde backend/, con el entorno activado):
    python -m app.evaluar                                   mide con el umbral actual
    python -m app.evaluar --umbrales 0.4,0.45,0.5,0.55,0.6  recalcula las métricas para cada umbral
    python -m app.evaluar --etiqueta "inicial"              además agrega el resultado a evaluacion/informe.md

Cada consulta pasa por la misma búsqueda que usa la plataforma (rag.buscar sobre las fuentes académicas
del tema, con el modelo de embeddings real) y el resultado se compara con las secciones que la responden.
Así cada cambio del RAG se mide con la misma vara, en lugar de mirar a ojo dos o tres preguntas: el umbral
es un valor inicial sujeto a calibración (Estructura de Datos) y la recuperación entre idiomas se evalúa
con consultas propias de la materia (Anexo 6).

Métricas:
- acierto@1: en las consultas positivas, la primera sección devuelta es una de las esperadas.
- acierto@6: alguna sección esperada aparece entre los fragmentos devueltos (hasta k_por_fuente = 6).
- MRR (rango recíproco medio): promedio de 1 / posición del primer acierto (0 si no hay). Premia que salga arriba.
- positivas suficientes: consultas con respuesta que alcanzan los fragmentos mínimos (CA5). Si el umbral es
  muy alto, la plataforma diría "material insuficiente" aunque la respuesta esté en las fuentes.
- rechazo de negativas: consultas sin respuesta que quedan "insuficientes", como corresponde.
- concentración: qué parte de lo devuelto viene de la fuente que más aparece (una sola fuente acaparando).
- distribución de similitudes: la del fragmento más parecido, en positivas y en negativas. Si se superponen,
  ningún umbral separa bien las dos clases.
"""
import argparse
import json
import re
import statistics
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path

from .config import P
from .services import rag

R = P["rag"]
CARPETA = Path("evaluacion")
CONSULTAS = CARPETA / "consultas.json"
INFORME = CARPETA / "informe.md"
SIN_UMBRAL = -1.0  # la similitud coseno va de -1 a 1: con este mínimo no se descarta nada


# ---------------- Secciones esperadas ----------------

def coincide(esperada: str, pagina_o_seccion: str) -> bool:
    """La sección esperada aparece en pagina_o_seccion, sin distinguir mayúsculas.

    Si a la subcadena le sigue un dígito no cuenta: "pág. 3" no es "pág. 30" ni "5.1" es "5.10".
    """
    return re.search(re.escape(esperada) + r"(?!\d)", pagina_o_seccion, re.IGNORECASE) is not None


def secciones_reales(tema: str) -> list[str] | None:
    """Los pagina_o_seccion que produce la indexación de las fuentes del tema, leídos de sus .txt.

    None si los textos no están descargados (se generan con python -m app.fuentes y no se versionan).
    """
    from .fuentes import CARPETA as FUENTES, CATALOGO, _secciones, _slug
    cat = json.loads(CATALOGO.read_text(encoding="utf-8"))
    secciones = []
    for id_cat, partes in cat["temas"][tema].items():
        for n, (nombre, _url, *solo) in enumerate(partes, 1):
            archivo = FUENTES / _slug(tema) / f"{id_cat.lower()}-{n}.txt"
            if not archivo.exists():
                return None
            _, _, texto = archivo.read_text(encoding="utf-8").partition("\n\n")
            secciones += [s.pagina_o_seccion for s in _secciones(nombre, texto, solo[0] if solo else None)
                          if s.texto.strip()]
    return secciones


def verificar(conjunto: dict) -> list[str]:
    """Problemas del conjunto de prueba: temas inexistentes o secciones esperadas que no están en los textos."""
    from .db import TEMAS
    problemas, reales = [], {}
    for c in conjunto["consultas"]:
        if c["tema"] not in TEMAS:
            problemas.append(f"{c['id']}: el tema {c['tema']!r} no existe")
            continue
        if c["tema"] not in reales:
            reales[c["tema"]] = secciones_reales(c["tema"])
        if reales[c["tema"]] is None:
            continue
        for esperada in c["secciones"]:
            if not any(coincide(esperada, s) for s in reales[c["tema"]]):
                problemas.append(f"{c['id']}: la sección {esperada!r} no está en las fuentes de {c['tema']}")
    return problemas


# ---------------- Métricas ----------------

def medir(consulta: dict, fragmentos: list[dict], todos: list[dict]) -> dict:
    """Resultado de una consulta con un umbral: `fragmentos` es lo devuelto y `todos`, lo mismo sin umbral."""
    aciertos = [i for i, f in enumerate(fragmentos, 1)
                if any(coincide(e, f["pagina_o_seccion"]) for e in consulta["secciones"])]
    fuentes = Counter(f["nombre_archivo"] for f in fragmentos)
    return {
        "id": consulta["id"],
        "positiva": bool(consulta["secciones"]),
        "posicion": aciertos[0] if aciertos else None,
        # Como en rag.recuperar: cuentan los fragmentos sobre el umbral, aunque dos vecinos se hayan fusionado.
        "suficiente": sum(len(f.get("recuperados", [None])) for f in fragmentos) >= R["fragmentos_minimos"],
        "devueltos": len(fragmentos),
        "concentracion": fuentes.most_common(1)[0][1] / len(fragmentos) if fragmentos else None,
        "similitud_maxima": todos[0]["similitud"] if todos else None,
    }


def _media(xs: list) -> float | None:
    return round(statistics.mean(xs), 3) if xs else None


def resumir(medidas: list[dict]) -> dict:
    pos = [m for m in medidas if m["positiva"]]
    neg = [m for m in medidas if not m["positiva"]]
    return {
        "acierto@1": _media([m["posicion"] == 1 for m in pos]),
        f"acierto@{R['k_por_fuente']}": _media([m["posicion"] is not None for m in pos]),
        "mrr": _media([1 / m["posicion"] if m["posicion"] else 0 for m in pos]),
        "positivas suficientes": _media([m["suficiente"] for m in pos]),
        "rechazo de negativas": _media([not m["suficiente"] for m in neg]),
        "concentración": _media([m["concentracion"] for m in medidas if m["concentracion"] is not None]),
    }


def distribucion(valores: list[float]) -> dict:
    v = [x for x in valores if x is not None]
    return {"n": len(v), "mínimo": min(v), "máximo": max(v), "promedio": _media(v)} if v else {"n": 0}


def evaluar(conjunto: dict, temas: dict[str, int], umbrales: list[float]) -> dict:
    """Corre todas las consultas para cada umbral. `temas`: nombre del tema → id_tema."""
    por_umbral = {u: [] for u in umbrales}
    detalle = []
    for c in conjunto["consultas"]:
        id_tema = temas[c["tema"]]
        todos = rag.buscar(id_tema, c["consulta"], [], minima=SIN_UMBRAL)
        for u in umbrales:
            por_umbral[u].append(medir(c, rag.buscar(id_tema, c["consulta"], [], minima=u), todos))
        sin = medir(c, todos, todos)
        detalle.append({**c, "posicion_sin_umbral": sin["posicion"], "similitud_maxima": sin["similitud_maxima"],
                        "similitud_primer_acierto": todos[sin["posicion"] - 1]["similitud"] if sin["posicion"] else None,
                        "primero": todos[0] if todos else None})
    return {
        "umbrales": {u: resumir(m) for u, m in por_umbral.items()},
        "medidas": por_umbral,
        "detalle": detalle,
        "distribucion": {
            "positivas": distribucion([d["similitud_maxima"] for d in detalle if d["secciones"]]),
            "negativas": distribucion([d["similitud_maxima"] for d in detalle if not d["secciones"]]),
        },
    }


# ---------------- Informe ----------------

def _num(x) -> str:
    if x is None:
        return "–"
    if isinstance(x, bool):
        return "sí" if x else "no"
    return f"{x:.3f}".rstrip("0").rstrip(".") if isinstance(x, float) else str(x)


def tablas(r: dict, actual: float) -> str:
    """El resultado en Markdown: métricas por umbral, distribución de similitudes y detalle por consulta."""
    cols = list(next(iter(r["umbrales"].values())))
    lineas = ["| umbral | " + " | ".join(cols) + " |", "|---" * (len(cols) + 1) + "|"]
    for u, res in r["umbrales"].items():
        nombre = f"**{_num(u)}** (actual)" if u == actual else _num(u)
        lineas.append(f"| {nombre} | " + " | ".join(_num(res[c]) for c in cols) + " |")
    lineas += ["", "Similitud del fragmento más parecido (sin umbral):", "",
               "| consultas | n | mínimo | máximo | promedio |", "|---|---|---|---|---|"]
    for clase, d in r["distribucion"].items():
        lineas.append(f"| {clase} | {d['n']} | {_num(d.get('mínimo'))} | {_num(d.get('máximo'))} | {_num(d.get('promedio'))} |")
    medidas = {m["id"]: m for m in r["medidas"][actual]} if actual in r["medidas"] else {}
    lineas += ["", f"Detalle por consulta (posición del primer acierto con el umbral {_num(actual)} y sin umbral):", "",
               "| id | consulta | pos. | pos. sin umbral | sim. máx. | sim. 1.er acierto | suficiente | primer fragmento |",
               "|---|---|---|---|---|---|---|---|"]
    for d in r["detalle"]:
        m = medidas.get(d["id"], {})
        primero = f"{d['primero']['nombre_archivo'].split(',')[0]} · {d['primero']['pagina_o_seccion'][-45:]}" if d["primero"] else "–"
        ok = "" if m.get("suficiente") == bool(d["secciones"]) else " ✗"
        lineas.append(f"| {d['id']} | {d['consulta']} | {_num(m.get('posicion'))} | {_num(d['posicion_sin_umbral'])} | "
                      f"{_num(d['similitud_maxima'])} | {_num(d['similitud_primer_acierto'])} | "
                      f"{_num(m.get('suficiente'))}{ok} | {primero.replace('|', '/')} |")
    return "\n".join(lineas)


def agregar_al_informe(etiqueta: str, contenido: str, informe: Path = INFORME) -> None:
    if not informe.exists():
        informe.write_text("# Evaluación de la recuperación (HU-003)\n\n"
                           "Cada sección es una medición de `python -m app.evaluar` sobre `evaluacion/consultas.json`, "
                           "con los parámetros de `parametros.toml` vigentes en ese momento.\n", encoding="utf-8")
    fecha = datetime.now().strftime("%Y-%m-%d %H:%M")
    parametros = ", ".join(f"{k} = {R[k]}" for k in ("tam_fragmento", "solapamiento", "k_por_fuente",
                                                      "similitud_minima", "fragmentos_minimos"))
    with informe.open("a", encoding="utf-8") as f:
        f.write(f"\n## {etiqueta} · {fecha}\n\nParámetros: {parametros}; modelo {R['modelo_embeddings']}; "
                f"{len(rag.almacen().get(where={'fuente': rag.ACADEMICA})['ids'])} fragmentos académicos.\n\n"
                f"{contenido}\n")


def main(argv: list[str] | None = None) -> dict:
    a = argparse.ArgumentParser(description="Mide la recuperación con evaluacion/consultas.json.")
    a.add_argument("--umbrales", help="similitudes mínimas a comparar, separadas por coma (por defecto, la actual)")
    a.add_argument("--etiqueta", help="agrega el resultado a evaluacion/informe.md con esta etiqueta")
    args = a.parse_args(argv)
    actual = R["similitud_minima"]
    umbrales = sorted({float(u) for u in args.umbrales.split(",")} | {actual}) if args.umbrales else [actual]

    conjunto = json.loads(CONSULTAS.read_text(encoding="utf-8"))
    if problemas := verificar(conjunto):
        sys.exit("El conjunto de prueba tiene errores:\n" + "\n".join(problemas))
    from sqlmodel import Session, select
    from .db import engine
    from .models import Tema
    with Session(engine) as db:
        temas = {t.nombre: t.id_tema for t in db.exec(select(Tema)).all()}
    r = evaluar(conjunto, temas, umbrales)
    contenido = tablas(r, actual)
    print(contenido)
    if args.etiqueta:
        agregar_al_informe(args.etiqueta, contenido)
        print(f"\nAgregado a {INFORME} como «{args.etiqueta}».")
    return r


if __name__ == "__main__":
    main()
