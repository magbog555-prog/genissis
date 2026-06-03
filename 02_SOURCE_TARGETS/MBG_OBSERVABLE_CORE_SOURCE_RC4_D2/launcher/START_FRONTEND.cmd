@echo off
setlocal
cd /d "%~dp0.."
title MBG Frontend (5173)
echo [launcher] Starting frontend via start-frontend.ps1 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\start-frontend.ps1"
if errorlevel 1 echo [launcher] Exit code: %ERRORLEVEL%
echo.
pause
endlocal
