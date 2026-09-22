@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Subir a GitHub

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
echo   SUBIR A GITHUB                     solo el frontend
echo   %AZUL%----------------------------------------------------%FIN%
echo.

echo   %AZUL%[1/4]%FIN%  Credenciales en el codigo . . . . .
call _seguro.bat
if errorlevel 1 goto FUGADETECTADA
echo          limpio
echo.

call :BUSCARGIT
if errorlevel 1 goto NOGIT
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1

echo   %AZUL%[2/4]%FIN%  Cambios . . . . . . . . . . . . . .
"!GIT!" status --porcelain > "%TEMP%\chk_st.txt" 2>nul
set CAMBIOS=0
for /f %%C in ('find /c /v "" ^< "%TEMP%\chk_st.txt"') do set CAMBIOS=%%C
del "%TEMP%\chk_st.txt" >nul 2>&1
if "!CAMBIOS!"=="0" goto SINCAMBIOS
echo          !CAMBIOS! archivos
echo.
"!GIT!" status --short
echo.

echo   %AZUL%[3/4]%FIN%  Commit
echo.
set "MSG="
set /p "MSG=   Mensaje [Enter = automatico]: "
if "!MSG!"=="" set "MSG=%MSG_DEFAULT%"
echo.
"!GIT!" add -A
if errorlevel 1 goto FAIL
"!GIT!" commit -m "!MSG!"
if errorlevel 1 goto FAIL
echo.

echo   %AZUL%[4/4]%FIN%  Subiendo a origin . . . . . . . . .
echo.
"!GIT!" push origin %GH_BRANCH%
if errorlevel 1 goto PUSHFAIL

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
call :LOGO
exit /b 0

:SINCAMBIOS
echo          ninguno
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo %VERDE%  Todo esta al dia. Nada que subir.%FIN%
echo.
call :LOGO
exit /b 0

:NOGIT
echo   %ROJO%x  NO ENCUENTRO GIT%FIN%
echo.
echo      Instalalo de git-scm.com/download/win
echo      o usa GitHub Desktop.
echo.
pause
exit /b 1

:PUSHFAIL
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%x  FALLO EL PUSH%FIN%
echo.
echo      "Authentication failed"
echo         abre GitHub Desktop una vez para renovar sesion
echo      "rejected - non-fast-forward"
echo         hay cambios de otra PC: corre 0-ACTUALIZAR.bat
echo.
pause
exit /b 1

:FAIL
echo.
echo   %ROJO%x  Revisa el mensaje de arriba.%FIN%
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
