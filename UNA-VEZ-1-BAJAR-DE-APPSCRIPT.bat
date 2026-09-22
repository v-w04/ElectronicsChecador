@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Bajar codigo de Apps Script

REM ---- Color de marca ----
REM CMD de Windows 10+ entiende color de 24 bits, pero necesita el
REM caracter ESC y no hay forma de escribirlo literal en un .bat sin
REM romper el ASCII puro. Este truco lo saca de la variable de prompt.
REM Si falla, las variables quedan vacias y todo sale en texto normal:
REM nunca se imprimen codigos sueltos en pantalla.
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
echo   BAJAR DE APPS SCRIPT        lo que corre en linea
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   Trae a apps-script el codigo que hoy vive en el editor.
echo   Ya se uso una vez para arrancar. Solo vuelve a correrlo
echo   si alguien edito directo en el editor de Apps Script.
echo.

where clasp >nul 2>&1
if errorlevel 1 goto NOCLASP
if not exist ".clasp.json" goto NOCONFIG

if exist "apps-script\appsscript.json" (
    echo   %ROJO%^^!  YA HAY CODIGO EN apps-script%FIN%
    echo      Si sigues, se REEMPLAZA con lo que esta en linea
    echo      y pierdes lo que no hayas subido.
    echo.
    choice /c SN /m "     Continuar"
    if errorlevel 2 goto CANCELADO
    echo.
)
if not exist "apps-script" mkdir "apps-script"

echo   %AZUL%[1/2]%FIN%  Bajando con clasp pull . . . . . .
echo.
call clasp pull
if errorlevel 1 goto PULLFAIL
echo.

echo   %AZUL%[2/2]%FIN%  Credenciales en el codigo . . . . .
call _seguro.bat
if errorlevel 1 goto FUGA1
echo          limpio

echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo %VERDE%  Codigo bajado. Revisalo y subelo con 5-SUBIR-TODO.bat%FIN%
echo.
call :LOGO
exit /b 0

:CANCELADO
echo.
echo %VERDE%  Cancelado. No se toco nada.%FIN%
echo.
call :LOGO
exit /b 0

:FUGA1
echo          ALERTA
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%x  EL CODIGO EN LINEA TRAE UNA CREDENCIAL%FIN%
echo.
echo      NO hagas commit: el repo es publico.
echo      Si es la llave privada de Firebase:
echo        1  Firebase, Configuracion, Cuentas de servicio
echo        2  genera llave nueva y BORRA la vieja
echo        3  en el editor corre configurarFirebase^(^)
echo        4  quita la llave del codigo y vuelve a correr esto
echo.
pause
exit /b 1

:NOCLASP
echo   %ROJO%x  NO ENCUENTRO CLASP%FIN%
echo.
echo      Corre primero 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:NOCONFIG
echo   %ROJO%x  NO ENCUENTRO .clasp.json%FIN%
echo.
pause
exit /b 1

:PULLFAIL
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%x  FALLO EL PULL%FIN%
echo.
echo      "User has not enabled the Apps Script API"
echo         script.google.com/home/usersettings
echo         prende "Google Apps Script API"
echo.
echo      "Invalid credentials" o "not logged in"
echo         corre 1-INSTALAR-CLASP.bat
echo.
echo      "access_token" o "invalid_grant" - caduco tu sesion:
echo         borra %%USERPROFILE%%\.clasprc.json
echo         corre 1-INSTALAR-CLASP.bat
echo         entra con la cuenta victor.walmart.04
echo.
echo      "Requested entity was not found"
echo         clasp esta con otra cuenta: mismo remedio de arriba
echo.
pause
exit /b 1

:LOGO
REM --- Logo animado ---
REM Va ANTES del pause: se dibuja solo, al terminar el trabajo.
REM La tecla queda libre para cerrar la ventana.
REM Solo en salidas exitosas.
REM Si falta node o el .js, no pasa nada: se salta en silencio.
where node >nul 2>&1
if errorlevel 1 goto SINLOGO
if not exist "%~dp0logo-animado.js" goto SINLOGO
REM SIN cls: el logo se dibuja DEBAJO del reporte, no encima.
REM Argumentos: movimiento color segundos alto-en-filas
REM   segundos 0 = gira hasta que se presione una tecla.
REM   El propio .js imprime el aviso y espera la tecla, por eso
REM   aqui ya NO hay pause: haria falta presionar dos veces.
node "%~dp0logo-animado.js" giro marca 0 12
goto :eof

:SINLOGO
REM Sin node o sin el .js, el pause de siempre.
pause
goto :eof
