@echo off
cd /d "%~dp0"
echo Ouvre http://localhost:8000 dans Chrome ou Edge (Ctrl+C pour arreter)
start "" http://localhost:8000
python -m http.server 8000
