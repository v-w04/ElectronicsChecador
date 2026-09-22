@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Verificar

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
echo   VERIFICAR                      estado de esta PC
echo   %AZUL%----------------------------------------------------%FIN%
echo.

set FALTA=0

echo   %AZUL%[1/6]%FIN%  Node.js . . . . . . . . . . . . . .
where node >nul 2>&1
if errorlevel 1 (
    echo          NO instalado
    set FALTA=1
) else (
    node --version > "%TEMP%\chk_v.txt" 2>nul
    set "V="
    if exist "%TEMP%\chk_v.txt" set /p V=<"%TEMP%\chk_v.txt"
    del "%TEMP%\chk_v.txt" >nul 2>&1
    echo          !V!
)
echo.

echo   %AZUL%[2/6]%FIN%  clasp . . . . . . . . . . . . . . .
where clasp >nul 2>&1
if errorlevel 1 (
    echo          NO instalado
    set FALTA=1
) else (
    echo          instalado
)
echo.

echo   %AZUL%[3/6]%FIN%  Sesion de Google . . . . . . . . . .
if exist "%USERPROFILE%\.clasprc.json" (
    echo          iniciada
) else (
    echo          NO iniciada
    set FALTA=1
)
echo.

echo   %AZUL%[4/6]%FIN%  Backend en apps-script . . . . . .
if not exist "apps-script\appsscript.json" (
    echo          VACIO
    set FALTA=1
    goto PASO5
)
set N=0
for %%F in (apps-script\*.gs) do set /a N+=1
echo          !N! archivos .gs
for %%F in (apps-script\*.gs) do echo            %%~nxF

:PASO5
echo.
echo   %AZUL%[5/6]%FIN%  Frontend en docs . . . . . . . . .
if exist "docs\index.html" (
    echo          app, tablero y juegos
) else (
    echo          NO existe docs\index.html
    set FALTA=1
)
echo.

echo   %AZUL%[6/6]%FIN%  Credenciales en el codigo . . . . .
call _seguro.bat
if errorlevel 1 (
    echo          ALERTA - revisa las lineas de arriba
    set FALTA=1
) else (
    echo          limpio
)

echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
if "!FALTA!"=="1" (
    echo   %ROJO%^^!  FALTA ALGO%FIN%
    echo.
    echo      Busca arriba lo que dice NO, VACIO o ALERTA.
    echo      Node, clasp o sesion: 1-INSTALAR-CLASP.bat
    echo      Backend vacio: UNA-VEZ-1-BAJAR-DE-APPSCRIPT.bat
) else (
    echo %VERDE%  Todo en orden. Puedes usar 5-SUBIR-TODO.bat%FIN%
)
echo.
call :LOGO
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
