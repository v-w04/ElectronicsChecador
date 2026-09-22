@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Subir a Apps Script

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
echo   SUBIR A APPS SCRIPT                 solo el backend
echo   %AZUL%----------------------------------------------------%FIN%
echo.
if not exist "apps-script\appsscript.json" goto VACIO

echo   %AZUL%[1/3]%FIN%  Credenciales . . . . . . . . . . . .
call _seguro.bat
if errorlevel 1 goto FUGA
echo          limpio

echo   %AZUL%[2/3]%FIN%  Subiendo . . . . . . . . . . . . . .
call clasp push --force >nul 2>"%TEMP%\chk_e.txt"
if errorlevel 1 goto PUSHFAIL
del "%TEMP%\chk_e.txt" >nul 2>&1
echo          ok

echo   %AZUL%[3/3]%FIN%  Publicando version . . . . . . . . .
if not defined DEPLOY_ID goto SINDEPLOY
call clasp deploy -i %DEPLOY_ID% -d auto >nul 2>"%TEMP%\chk_d.txt"
if errorlevel 1 goto DEPLOYFAIL
del "%TEMP%\chk_d.txt" >nul 2>&1
echo          publicada
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo %VERDE%  Listo. Los celulares ya tienen el backend nuevo.%FIN%
echo.
call :LOGO
exit /b 0

:SINDEPLOY
echo          sin DEPLOY_ID
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%^^!  FALTA PUBLICAR VERSION%FIN%
echo.
call :LOGO
exit /b 0

:DEPLOYFAIL
type "%TEMP%\chk_d.txt"
del "%TEMP%\chk_d.txt" >nul 2>&1
echo.
echo   %ROJO%x  NO SE PUBLICO LA VERSION%FIN%
echo      Revisa DEPLOY_ID en _config.bat
echo.
pause
exit /b 1

:PUSHFAIL
type "%TEMP%\chk_e.txt"
del "%TEMP%\chk_e.txt" >nul 2>&1
echo.
echo   %ROJO%x  FALLO EL PUSH%FIN%
echo      API apagada o sesion caducada: 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:VACIO
echo.
echo   %ROJO%x  apps-script VACIA - no se subio nada%FIN%
echo.
pause
exit /b 1

:FUGA
echo.
echo   %ROJO%x  POSIBLE CREDENCIAL - no se subio nada%FIN%
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
