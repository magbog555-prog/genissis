@echo off
setlocal
cd /d "%~dp0"
title MBG RC4-D2 STOP_APP
echo [RC4-D2] STOP_APP — остановка core и frontend...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-app.ps1"
echo.
pause
endlocal
