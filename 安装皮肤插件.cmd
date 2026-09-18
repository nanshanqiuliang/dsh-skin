@echo off
setlocal
echo ==========================================
echo   dsh-skin plugin : install / update
echo ==========================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
echo.
pause