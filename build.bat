@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] .venv not found. Run start.bat first to initialize.
  pause
  exit /b 1
)
call ".venv\Scripts\activate.bat"

echo [1/2] Installing PyInstaller ...
python -m pip install --disable-pip-version-check -q pyinstaller
if errorlevel 1 (
  echo [ERROR] Failed to install PyInstaller. Check your network.
  pause
  exit /b 1
)

echo [2/2] Building single-file exe ...
python -m PyInstaller --noconfirm --onefile ^
  --name mimo-tts-studio ^
  --add-data "static;static" ^
  --hidden-import uvicorn.logging ^
  --hidden-import uvicorn.loops.auto ^
  --hidden-import uvicorn.protocols.http.auto ^
  --hidden-import uvicorn.protocols.websockets.auto ^
  --hidden-import uvicorn.lifespan.on ^
  app.py
if errorlevel 1 (
  echo [ERROR] Build failed. See the log above.
  pause
  exit /b 1
)

echo.
echo Done: dist\mimo-tts-studio.exe
echo First launch of the exe is slower (self-extract). config.json is created next to the exe.
pause
