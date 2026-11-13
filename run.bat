@echo off
title StegoDetect Server
echo ===============================================
echo   StegoDetect - Starting Flask Server...
echo ===============================================

cd /d "%~dp0"

call venv\Scripts\activate.bat

echo.
echo  Server running at: http://localhost:5000
echo  Press Ctrl+C to stop.
echo.

python app.py

pause
