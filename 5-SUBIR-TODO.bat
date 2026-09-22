@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Subir todo

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
echo   SUBIR TODO                    Apps Script + GitHub
echo   %AZUL%----------------------------------------------------%FIN%
echo.

echo   %AZUL%[1/3]%FIN%  Credenciales en el codigo . . . . .
call _seguro.bat
if errorlevel 1 goto FUGADETECTADA
echo          limpio
echo.

REM ================= PARTE 1: APPS SCRIPT =================
echo   %AZUL%[2/3]%FIN%  Apps Script . . . . . . . . . . . .
set "CLASPOK="
if not exist ".clasp.json" (
    echo          sin .clasp.json - saltado
    goto GITPART
)
if not exist "apps-script\appsscript.json" (
    echo          apps-script vacia - saltado para no borrar
    echo          el codigo en linea
    goto GITPART
)
echo.
call clasp push --force
if errorlevel 1 goto CLASPFAIL
set "CLASPOK=1"
echo.
echo          subido
echo.
goto GITPART

:CLASPFAIL
echo.
echo   %ROJO%^^!  FALLO EL PUSH A APPS SCRIPT%FIN%
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
echo      Tus archivos NO se perdieron. Arregla eso y corre
echo      2-SUBIR-A-APPSCRIPT.bat. Sigo con GitHub.
echo.
pause
echo.

REM ================= PARTE 2: GITHUB =================
:GITPART
echo   %AZUL%[3/3]%FIN%  GitHub . . . . . . . . . . . . . .
call :BUSCARGIT
if errorlevel 1 goto NOGIT
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1

REM Se revisa QUE cambio antes del commit, para decidir si hay que
REM publicar version. Despues del commit git ya no lo diria.
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

"!GIT!" status --porcelain > "%TEMP%\chk_st.txt" 2>nul
set CAMBIOS=0
for /f %%C in ('find /c /v "" ^< "%TEMP%\chk_st.txt"') do set CAMBIOS=%%C
del "%TEMP%\chk_st.txt" >nul 2>&1
if "!CAMBIOS!"=="0" (
    echo          sin cambios
    goto FIN
)
echo.
echo.
"!GIT!" status --short
echo.

set "MSG="
set /p "MSG=   Mensaje del commit [Enter = automatico]: "
if "!MSG!"=="" set "MSG=%MSG_DEFAULT%"
echo.

"!GIT!" add -A
"!GIT!" commit -m "!MSG!"
"!GIT!" push origin %GH_BRANCH%
if errorlevel 1 goto PUSHFAIL
echo.
echo          subido

:FIN
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   Repo        github.com/%GH_USER%/%GH_REPO%
echo   Checador    %GH_USER%.github.io/%GH_REPO%/
echo   Tablero     %GH_USER%.github.io/%GH_REPO%/tablero.html
echo   Juegos      %GH_USER%.github.io/%GH_REPO%/juegos.html
echo.
echo %VERDE%  Subido. GitHub Pages tarda 1-2 min en publicar.%FIN%
echo.

REM Si el push a Apps Script fallo, no tiene caso hablar de publicar:
REM el aviso rojo de arriba ya dice que falta.
if not defined CLASPOK goto SINCLASP
if defined PUBLICAR goto SIPUBLICAR

echo %VERDE%  No hace falta publicar version.%FIN%
echo.
call :LOGO
exit /b 0

:SINCLASP
echo   %ROJO%^^!  APPS SCRIPT NO SE ACTUALIZO%FIN%
echo      Arregla el error de arriba y corre 2-SUBIR-A-APPSCRIPT.bat
echo.
pause
exit /b 1

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

:NOGIT
echo          NO encuentro git
echo.
echo   %ROJO%x  Usa GitHub Desktop para esta parte.%FIN%
echo.
pause
exit /b 1

:PUSHFAIL
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%x  FALLO EL PUSH A GITHUB%FIN%
echo.
echo      "Authentication failed"
echo         abre GitHub Desktop una vez para renovar sesion
echo      "rejected - non-fast-forward"
echo         hay cambios de otra PC: corre 0-ACTUALIZAR.bat
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
