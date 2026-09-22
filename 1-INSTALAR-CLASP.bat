@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Instalar clasp

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
echo   INSTALAR CLASP                 una sola vez por PC
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %AZUL%[1/3]%FIN%  Node.js . . . . . . . . . . . . . .
where node >nul 2>&1
if errorlevel 1 goto NONODE
echo          ok
echo   %AZUL%[2/3]%FIN%  clasp . . . . . . . . . . . . . . .
call npm install -g @google/clasp >nul 2>&1
if errorlevel 1 goto NPMFAIL
echo          ok
echo   %AZUL%[3/3]%FIN%  Sesion  ^(entra con victor.walmart.04^)
call clasp login
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo %VERDE%  Listo.%FIN%
echo.
call :LOGO
exit /b 0

:NONODE
echo.
echo   %ROJO%x  FALTA NODE.JS%FIN%
echo      nodejs.org, version LTS
echo.
pause
exit /b 1

:NPMFAIL
echo.
echo   %ROJO%x  FALLO LA INSTALACION%FIN%
echo      Ejecutar como administrador
echo.
pause
exit /b 1

:LOGO
where node >nul 2>&1
if errorlevel 1 goto SINLOGO
if not exist "%~dp0logo-animado.js" goto SINLOGO
node "%~dp0logo-animado.js" giro marca 0 12
goto :eof

:SINLOGO
pause
goto :eof
