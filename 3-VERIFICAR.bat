@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Verificar

set "ESC="
for /f %%E in ('echo prompt $E ^| cmd') do set "ESC=%%E"
set "AZUL="
set "VERDE="
set "ROJO="
set "FIN="
if defined ESC set "AZUL=%ESC%[38;2;31;148;249m"
if defined ESC set "VERDE=%ESC%[38;2;63;185;80m"
if defined ESC set "ROJO=%ESC%[38;2;248;81;73m"
if defined ESC set "FIN=%ESC%[0m"

echo.
echo   VERIFICAR                      estado de esta PC
echo   %AZUL%----------------------------------------------------%FIN%
echo.
set FALTA=0
where node >nul 2>&1
if errorlevel 1 (echo   %ROJO%x  Node.js%FIN% & set FALTA=1) else (echo   ok Node.js)
where clasp >nul 2>&1
if errorlevel 1 (echo   %ROJO%x  clasp%FIN% & set FALTA=1) else (echo   ok clasp)
if exist "%USERPROFILE%\.clasprc.json" (echo   ok sesion de Google) else (echo   %ROJO%x  sesion de Google%FIN% & set FALTA=1)
if exist "apps-script\appsscript.json" (echo   ok backend) else (echo   %ROJO%x  backend vacio%FIN% & set FALTA=1)
if exist "docs\index.html" (echo   ok frontend) else (echo   %ROJO%x  frontend%FIN% & set FALTA=1)
call _seguro.bat >nul 2>&1
if errorlevel 1 (echo   %ROJO%x  credenciales en el codigo%FIN% & set FALTA=1) else (echo   ok sin credenciales)
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
if "!FALTA!"=="1" (
    echo   %ROJO%^^!  FALTA ALGO%FIN%
    echo.
    pause
    exit /b 1
)
echo %VERDE%  Todo en orden.%FIN%
echo.
call :LOGO
exit /b 0

:LOGO
where node >nul 2>&1
if errorlevel 1 goto SINLOGO
if not exist "%~dp0logo-animado.js" goto SINLOGO
node "%~dp0logo-animado.js" giro marca 0 12
goto :eof

:SINLOGO
pause
goto :eof
