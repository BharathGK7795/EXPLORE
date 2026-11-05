@echo off
title DigitalHub Launcher
cd /d "%~dp0"
echo ===================================================
echo   Launching DigitalHub Web Ecosystem...
echo ===================================================
start http://localhost:8000/
python run.py
pause
