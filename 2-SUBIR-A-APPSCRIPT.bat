@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Subir a Apps Script

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
echo   SUBIR A APPS SCRIPT                 solo el backend
echo   %AZUL%----------------------------------------------------%FIN%
echo.

if not exist ".clasp.json" goto NOCONFIG
findstr /C:"PON_AQUI" .clasp.json >nul 2>&1
if not errorlevel 1 goto NOSCRIPTID

REM ---- Seguro contra borrar el proyecto en linea ----
REM clasp push --force deja Apps Script IGUAL a la carpeta apps-script.
REM Si esta vacia o incompleta, borra el codigo que esta corriendo.
if not exist "apps-script\appsscript.json" goto NOCODIGO
dir /b "apps-script\*.gs" >nul 2>&1
if errorlevel 1 goto NOCODIGO

echo   %AZUL%[1/2]%FIN%  Credenciales en el codigo . . . . .
call _seguro.bat
if errorlevel 1 goto FUGADETECTADA
echo          limpio
echo.

set N=0
for %%F in (apps-script\*.gs) do set /a N+=1
echo   %AZUL%[2/2]%FIN%  Subiendo !N! archivos .gs . . . . . .
echo.
call clasp push --force
if errorlevel 1 goto PUSHFAIL

echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.

call :BUSCARGIT
if errorlevel 1 goto NOSEQUE
REM El Web App corre la version PUBLICADA; el trigger de alertas corre
REM el ultimo codigo subido. En este proyecto el Web App usa casi todo
REM el backend: lo unico que usa SOLO el trigger es Mensajes.gs.
REM Asi que: cualquier cambio en apps-script, salvo Mensajes.gs, obliga
REM a publicar version.
set "PUBLICAR="
"!GIT!" status --porcelain > "%TEMP%\chk_cambios.txt" 2>nul
if exist "%TEMP%\chk_cambios.txt" (
    findstr /I /C:"apps-script/" "%TEMP%\chk_cambios.txt" | findstr /V /I /C:"Mensajes.gs" >nul 2>&1 && set "PUBLICAR=1"
)
del "%TEMP%\chk_cambios.txt" >nul 2>&1

if defined PUBLICAR goto SIPUBLICAR
echo %VERDE%  Codigo arriba. No hace falta publicar version:%FIN%
echo %VERDE%  solo cambiaron los textos de las alertas.%FIN%
echo.
call :LOGO
exit /b 0

:NOSEQUE
echo %VERDE%  Codigo arriba.%FIN%
echo.
echo   No pude revisar que archivos cambiaron ^(no hay git^).
echo   Regla: publica version siempre que toques algo de
echo   apps-script, menos Mensajes.gs.
echo.
call :LOGO
exit /b 0

:SIPUBLICAR
echo   %ROJO%^^!  FALTA PUBLICAR VERSION%FIN%
echo.
echo      Cambiaste codigo que usan los celulares, el tablero
echo      y los juegos. Mientras no publiques, la URL sirve
echo      el codigo viejo.
echo.
echo      En el editor de Apps Script:
echo      Implementar
echo      Administrar implementaciones
echo      icono de lapiz
echo      Version: Nueva version
echo      Implementar
echo.
echo      Edita la que YA existe. "Nueva implementacion"
echo      genera otra URL y deja huerfanos a los celulares.
echo.
call :LOGO
exit /b 0

:NOCONFIG
echo   %ROJO%x  NO ENCUENTRO .clasp.json%FIN%
echo.
echo      Corre primero 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:NOSCRIPTID
echo   %ROJO%x  FALTA EL SCRIPT ID EN .clasp.json%FIN%
echo.
echo      Sale de la URL del editor, entre /projects/ y /edit
echo.
pause
exit /b 1

:PUSHFAIL
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%x  FALLO EL PUSH%FIN%
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

:NOCODIGO
echo   %ROJO%x  LA CARPETA apps-script ESTA VACIA%FIN%
echo.
echo      Subir ahora borraria el codigo que esta corriendo
echo      en Apps Script. Baja primero el codigo real con
echo      UNA-VEZ-1-BAJAR-DE-APPSCRIPT.bat
echo.
pause
exit /b 1

:FUGADETECTADA
echo          ALERTA
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%x  DETENIDO - POSIBLE CREDENCIAL EN EL CODIGO%FIN%
echo.
echo      No se subio nada. Arriba dice que archivo y que linea.
echo.
echo      En este proyecto ninguna credencial vive en un
echo      archivo: la llave de Firebase y los passwords estan
echo      en PropertiesService. Quita el valor y vuelve a correr.
echo.
echo      Si ese valor YA se subio antes, borrarlo no lo saca del
echo      historial. En Firebase: Configuracion, Cuentas de
echo      servicio, genera llave nueva y borra la vieja.
echo.
pause
exit /b 1

:BUSCARGIT
REM git normal, o el que trae GitHub Desktop, o el de Program Files.
set "GIT=git"
where git >nul 2>&1
if not errorlevel 1 exit /b 0
for /d %%D in ("%LOCALAPPDATA%\GitHubDesktop\app-*") do (
    if exist "%%D\resources\app\git\cmd\git.exe" set "GIT=%%D\resources\app\git\cmd\git.exe"
)
if exist "%ProgramFiles%\Git\cmd\git.exe" set "GIT=%ProgramFiles%\Git\cmd\git.exe"
if "!GIT!"=="git" exit /b 1
exit /b 0

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
