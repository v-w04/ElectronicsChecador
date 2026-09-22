@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Mover frontend a docs

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
echo   MOVER FRONTEND A docs                  una sola vez
echo   %AZUL%----------------------------------------------------%FIN%
echo.

if exist "docs\index.html" goto YAMOVIDO
if not exist "index.html" goto NOHAY

call :BUSCARGIT
if errorlevel 1 goto NOGIT
if not exist ".git" goto NOTREPO
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1

echo   %AZUL%[1/4]%FIN%  Credenciales en el codigo . . . . .
call _seguro.bat
if errorlevel 1 goto FUGA2
echo          limpio
echo.

echo   %AZUL%[2/4]%FIN%  Moviendo archivos . . . . . . . . .
if not exist "docs" mkdir "docs"
for %%F in (*.js *.html *.css *.png *.ico *.webmanifest) do (
    if /I not "%%F"=="logo-animado.js" (
        "!GIT!" mv "%%F" "docs\%%F" >nul 2>&1
        if errorlevel 1 move "%%F" "docs\%%F" >nul
    )
)
echo          listo
echo.

echo   %AZUL%[3/4]%FIN%  Commit . . . . . . . . . . . . . . .
"!GIT!" add -A
"!GIT!" commit -m "Frontend a docs/ (como Site Sheet)" >nul
if errorlevel 1 goto FAIL
echo          listo
echo.

echo   %AZUL%[4/4]%FIN%  Subiendo a origin . . . . . . . . .
"!GIT!" push origin %GH_BRANCH%
if errorlevel 1 goto FAIL

echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo   %ROJO%^^!  CAMBIA GITHUB PAGES A /docs AHORA%FIN%
echo.
echo      Mientras no lo cambies, la app NO carga.
echo      Settings, Pages, Branch main, carpeta /docs, Save.
echo      La URL no cambia.
echo.
call :LOGO
exit /b 0

:YAMOVIDO
echo %VERDE%  Ya esta hecho: la app vive en docs. Nada que mover.%FIN%
echo.
call :LOGO
exit /b 0

:NOHAY
echo   %ROJO%x  NO ENCUENTRO index.html NI EN LA RAIZ NI EN docs%FIN%
echo.
pause
exit /b 1

:NOGIT
echo   %ROJO%x  NO ENCUENTRO GIT%FIN%
echo.
pause
exit /b 1

:NOTREPO
echo   %ROJO%x  ESTA CARPETA NO ES UN REPO DE GIT%FIN%
echo.
pause
exit /b 1

:FUGA2
echo          ALERTA
echo.
echo   %ROJO%x  POSIBLE CREDENCIAL - NO SE MOVIO NADA%FIN%
echo.
pause
exit /b 1

:FAIL
echo.
echo   %ROJO%x  Revisa el mensaje de arriba.%FIN%
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
