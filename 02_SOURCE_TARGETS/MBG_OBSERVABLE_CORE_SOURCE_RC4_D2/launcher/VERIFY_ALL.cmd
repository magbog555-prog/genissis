@echo off
setlocal
cd /d "%~dp0.."
title MBG VERIFY_ALL (rc4-d)
call npm run verify:rc4-d
echo.
pause
endlocal
