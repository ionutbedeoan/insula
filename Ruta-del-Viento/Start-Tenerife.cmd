@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Este nevoie de Node.js pentru a porni jocul in reteaua locala.
  pause
  exit /b 1
)
node scripts/drive-lan.mjs
pause
