@echo off
setlocal
cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python not found. Please install Python 3.9+ and tick "Add to PATH".
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creating virtual environment .venv ...
  python -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Virtual environment already exists.
)

call ".venv\Scripts\activate.bat"

echo [2/3] Installing dependencies (fastapi / uvicorn / requests) ...
python -m pip install --disable-pip-version-check -q -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Failed to install dependencies. Check your network and retry.
  pause
  exit /b 1
)

echo [3/3] Starting MiMo TTS Studio: http://127.0.0.1:8000
echo The browser will open automatically. Close this window to stop the server.
python app.py

pause
