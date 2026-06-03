@echo off
setlocal
cd /d "%~dp0.."
echo [launcher] Starting core and frontend in separate windows...
start "MBG Core API" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -File "%CD%\start-core.ps1"
timeout /t 2 /nobreak >nul
start "MBG Frontend" powershell -NoProfile -NoExit -ExecutionPolicy Bypass -File "%CD%\start-frontend.ps1"
echo [launcher] Done. Close each window to stop that process.
echo.
pause
endlocal
