@echo off
setlocal
cd /d "%~dp0.."
title MBG STOP_CORE_PORT
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\stop-core-port.ps1"
echo.
pause
endlocal
