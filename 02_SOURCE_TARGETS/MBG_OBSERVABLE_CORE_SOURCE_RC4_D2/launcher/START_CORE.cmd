@echo off
setlocal
cd /d "%~dp0.."
title MBG Core (3011)
echo [launcher] Starting core via start-core.ps1 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\start-core.ps1"
if errorlevel 1 echo [launcher] Exit code: %ERRORLEVEL%
echo.
pause
endlocal
