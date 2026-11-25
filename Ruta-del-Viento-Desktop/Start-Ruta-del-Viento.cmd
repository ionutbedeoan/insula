@echo off
setlocal
set "GAME=%~dp0Builds\Windows-Daylight\Ruta-del-Viento.exe"
if not exist "%GAME%" (
  echo Executabilul Windows lipseste. Vezi README.md pentru compilare.
  pause
  exit /b 1
)
start "Ruta del Viento" "%GAME%"
