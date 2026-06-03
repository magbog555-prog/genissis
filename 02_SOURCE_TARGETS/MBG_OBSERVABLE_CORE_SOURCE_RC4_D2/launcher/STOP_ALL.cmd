@echo off
setlocal
cd /d "%~dp0.."
title MBG STOP_ALL
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\stop-all.ps1"
echo.
pause
endlocal
