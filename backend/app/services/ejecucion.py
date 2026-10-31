"""Ejecución del código del estudiante (HU-005, CA2; Diagrama de Arquitectura).

En producción el código se ejecuta en Judge0, nunca en el servidor de la aplicación: es código no
confiable. La ejecución es asíncrona: se envía el programa y se recibe un token, con el que se consulta
el resultado cada segundo. Cada envío fija 5 segundos de procesamiento y 128 MB de memoria. Si Judge0 no
responde en 30 segundos o informa un error interno, se reintenta una vez; si vuelve a fallar se lanza
EjecucionNoDisponible, y quien llama informa al estudiante sin registrar el intento como fallido ni
computarlo en el detector. Los valores están en parametros.toml.

EjecutorLocal ejecuta en la misma máquina y existe solo para desarrollar y para los tests, sin Judge0:
se habilita con EJECUCION_LOCAL=true y nunca debe usarse en producción.
"""
import base64
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import requests

from ..config import P, settings
from .codigo import Ejecucion

J = P["judge0"]


class EjecucionNoDisponible(Exception):
    """Judge0 no devolvió un resultado: el intento no se registra (Arquitectura)."""


def _b64(texto: str) -> str:
    return base64.b64encode(texto.encode()).decode()


def _desde_b64(texto: str | None) -> str:
    return base64.b64decode(texto).decode(errors="replace") if texto else ""


class Judge0:
    # Estados de Judge0: 1 y 2 en cola o en proceso; 3 aceptado (el programa terminó); 4 respuesta incorrecta
    # (no se usa: la plataforma compara las salidas); 5 tiempo límite; 6 error de compilación; 7 a 12 error de
    # ejecución; 13 error interno; 14 error de formato.
    EN_CURSO, TIEMPO, COMPILACION, INTERNO = {1, 2}, 5, 6, {13, 14}

    def __init__(self, url: str | None = None, clave: str | None = None, http=requests, dormir=time.sleep):
        self.url = (url or settings.judge0_url).rstrip("/")
        self.clave, self.http, self.dormir = clave if clave is not None else settings.judge0_api_key, http, dormir

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.clave:  # Judge0 hosteado (RapidAPI); una instancia propia puede no pedir clave
            h.update({"X-RapidAPI-Key": self.clave, "X-RapidAPI-Host": self.url.split("://")[-1].split("/")[0]})
        return h

    def _una_vez(self, lenguaje: str, fuente: str) -> Ejecucion:
        cuerpo = {"language_id": J["lenguajes"][lenguaje], "source_code": _b64(fuente),
                  "cpu_time_limit": J["cpu_segundos"], "memory_limit": J["memoria_mb"] * 1024}
        r = self.http.post(f"{self.url}/submissions?base64_encoded=true&wait=false", json=cuerpo,
                           headers=self._headers(), timeout=10)
        r.raise_for_status()
        token = r.json()["token"]
        limite = time.monotonic() + J["espera_maxima_segundos"]
        while time.monotonic() < limite:
            self.dormir(J["consulta_cada_segundos"])
            r = self.http.get(f"{self.url}/submissions/{token}?base64_encoded=true", headers=self._headers(), timeout=10)
            r.raise_for_status()
            d = r.json()
            estado = d["status"]["id"]
            if estado in self.EN_CURSO:
                continue
            if estado in self.INTERNO:
                raise EjecucionNoDisponible(d["status"].get("description", "error interno"))
            ejec = Ejecucion("terminado", _desde_b64(d.get("stdout")), _desde_b64(d.get("stderr")),
                             _desde_b64(d.get("compile_output")))
            ejec.estado = ("tiempo límite" if estado == self.TIEMPO else "error de compilación" if estado == self.COMPILACION
                           else "error de ejecución" if estado >= 7 else "terminado")
            return ejec
        raise EjecucionNoDisponible("sin respuesta en el tiempo máximo")

    def ejecutar(self, lenguaje: str, fuente: str) -> Ejecucion:
        ultimo = None
        for _ in range(1 + J["reintentos"]):
            try:
                return self._una_vez(lenguaje, fuente)
            except (EjecucionNoDisponible, requests.RequestException) as e:
                ultimo = e
        raise EjecucionNoDisponible(str(ultimo))


class EjecutorLocal:
    """Solo para desarrollo y tests: ejecuta en esta máquina con el mismo límite de tiempo que Judge0."""

    def ejecutar(self, lenguaje: str, fuente: str) -> Ejecucion:
        with tempfile.TemporaryDirectory() as d:
            if lenguaje == "python":
                archivo = Path(d) / "main.py"
                archivo.write_text(fuente, encoding="utf-8")
                comando = [sys.executable, "-I", str(archivo)]
            else:
                archivo = Path(d) / "Main.java"
                archivo.write_text(fuente, encoding="utf-8")
                c = subprocess.run(["javac", "-encoding", "UTF-8", str(archivo)], capture_output=True, text=True,
                                   timeout=60, cwd=d)
                if c.returncode:
                    mensajes = "\n".join(l for l in c.stderr.splitlines() if not l.startswith("Picked up "))
                    return Ejecucion("error de compilación", compilacion=mensajes.replace(str(archivo), "Main.java"))
                comando = ["java", "-Dfile.encoding=UTF-8", "-cp", d, "Main"]
            try:
                r = subprocess.run(comando, capture_output=True, text=True, timeout=J["cpu_segundos"], cwd=d)
            except subprocess.TimeoutExpired as e:
                salida = e.stdout.decode(errors="replace") if isinstance(e.stdout, bytes) else (e.stdout or "")
                return Ejecucion("tiempo límite", salida)
            return Ejecucion("error de ejecución" if r.returncode else "terminado", r.stdout,
                             r.stderr.replace(str(archivo), "main.py" if lenguaje == "python" else "Main.java"))


def ejecutor():
    """Judge0 en producción; el local solo si se habilitó explícitamente para desarrollo."""
    return EjecutorLocal() if settings.ejecucion_local else Judge0()
