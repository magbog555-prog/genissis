@echo off
setlocal
cd /d "%~dp0"
title MBG RC4-D2 START_APP
echo [RC4-D2] START_APP — запуск core + frontend + браузер...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-app.ps1"
echo.
pause
endlocal
