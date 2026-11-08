@echo off
rem Inicia la plataforma con doble clic: compila el frontend, levanta el backend
rem (que entrega tambien el frontend) y abre el navegador en http://localhost:8000.
rem Para cerrarla, cerrar esta ventana o presionar Ctrl+C.
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Plataforma de estudio

if not exist "backend\.venv\Scripts\python.exe" (
  echo [1/3] Primera vez: creando el entorno de Python e instalando dependencias...
  python -m venv backend\.venv || goto :sin_python
  "backend\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt || goto :error
)

if not exist "backend\.env" (
  echo Falta el archivo backend\.env con la clave de Anthropic. Ver el instructivo.
  goto :error
)

where npm >nul 2>nul
if %errorlevel%==0 (
  echo [2/3] Compilando el frontend...
  pushd frontend
  if not exist "node_modules" call npm install || (popd & goto :error)
  call npm run build || (popd & goto :error)
  popd
) else (
  if not exist "frontend\dist\index.html" (
    echo No se encontro Node.js ni un frontend ya compilado. Instalar Node.js desde https://nodejs.org
    goto :error
  )
  echo [2/3] Node.js no esta instalado: se usa el frontend ya compilado.
)

echo [3/3] Iniciando el servidor. La plataforma se abre sola en el navegador.
echo       Direccion: http://localhost:8000   (para cerrarla, cerrar esta ventana)
set "FRONTEND_DIR=%~dp0frontend\dist"
set "FRONTEND_ORIGIN=http://localhost:8000"
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 120;$i++){try{Invoke-WebRequest -UseBasicParsing http://localhost:8000/api/health | Out-Null; Start-Process 'http://localhost:8000'; break}catch{Start-Sleep 1}}"
cd backend
".venv\Scripts\python.exe" -m uvicorn app.main:app --port 8000
goto :fin

:sin_python
echo No se encontro Python. Instalar Python 3.11 o superior desde https://www.python.org
:error
echo.
echo No se pudo iniciar la plataforma. Revisar el mensaje de arriba.
pause
:fin
endlocal
