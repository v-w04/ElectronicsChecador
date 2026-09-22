@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Bajar de Apps Script

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
echo   BAJAR DE APPS SCRIPT        reemplaza apps-script
echo   %AZUL%----------------------------------------------------%FIN%
echo.
where clasp >nul 2>&1
if errorlevel 1 goto NOCLASP
if exist "apps-script\appsscript.json" (
    choice /c SN /m "   Ya hay codigo local y se va a reemplazar. Seguir"
    if errorlevel 2 goto CANCELADO
)
if not exist "apps-script" mkdir "apps-script"

echo   %AZUL%[1/2]%FIN%  Bajando . . . . . . . . . . . . . .
call clasp pull >nul 2>"%TEMP%\chk_e.txt"
if errorlevel 1 goto PULLFAIL
del "%TEMP%\chk_e.txt" >nul 2>&1
echo          ok
echo   %AZUL%[2/2]%FIN%  Credenciales . . . . . . . . . . . .
call _seguro.bat
if errorlevel 1 goto FUGA
echo          limpio
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo %VERDE%  Listo.%FIN%
echo.
call :LOGO
exit /b 0

:CANCELADO
echo.
echo %VERDE%  Cancelado. No se toco nada.%FIN%
echo.
call :LOGO
exit /b 0

:PULLFAIL
type "%TEMP%\chk_e.txt"
del "%TEMP%\chk_e.txt" >nul 2>&1
echo.
echo   %ROJO%x  FALLO EL PULL%FIN%
echo      API apagada o sesion caducada: 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:NOCLASP
echo.
echo   %ROJO%x  FALTA CLASP%FIN%
echo      Corre 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:FUGA
echo.
echo   %ROJO%x  EL CODIGO EN LINEA TRAE UNA CREDENCIAL - no hagas commit%FIN%
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
