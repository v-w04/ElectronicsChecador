@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Subir a GitHub

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
echo   %AZUL%[1/3]%FIN%  Credenciales . . . . . . . . . . . .
call _seguro.bat
if errorlevel 1 goto FUGA
echo          limpio

call :BUSCARGIT
if errorlevel 1 goto NOGIT
REM Candados de git que quedan cuando un proceso muere a medias.
REM Antes solo se borraba index.lock, pero HEAD.lock tumbaba el commit.
del /f /q ".git\index.lock" ".git\HEAD.lock" ".git\config.lock" >nul 2>&1
del /f /q ".git\objects\maintenance.lock" >nul 2>&1
del /f /q ".git\refs\heads\*.lock" >nul 2>&1

echo   %AZUL%[2/3]%FIN%  GitHub . . . . . . . . . . . . . . .
"!GIT!" status --porcelain > "%TEMP%\chk_s.txt" 2>nul
set CAMBIOS=0
for /f %%C in ('find /c /v "" ^< "%TEMP%\chk_s.txt"') do set CAMBIOS=%%C
del "%TEMP%\chk_s.txt" >nul 2>&1

REM Commits ya hechos pero sin subir. Sin esto, con el arbol limpio el
REM bat decia "sin cambios" y se saltaba el push: la version se quedaba
REM en la compu y los celulares nunca la veian.
set PENDIENTES=0
"!GIT!" rev-list --count @{u}..HEAD > "%TEMP%\chk_p.txt" 2>nul
if exist "%TEMP%\chk_p.txt" set /p PENDIENTES=<"%TEMP%\chk_p.txt"
del "%TEMP%\chk_p.txt" >nul 2>&1
if not defined PENDIENTES set PENDIENTES=0

if "!CAMBIOS!"=="0" (
    if "!PENDIENTES!"=="0" (
        echo          sin cambios
        goto FIN
    )
    "!GIT!" push origin %GH_BRANCH% > "%TEMP%\chk_push.txt" 2>&1
    if errorlevel 1 goto PUSHFAIL
    goto VERIFICA
)
"!GIT!" status --short
echo.
set "MSG="
set /p "MSG=   Mensaje [Enter = automatico]: "
if "!MSG!"=="" set "MSG=%MSG_DEFAULT%"
"!GIT!" add -A
"!GIT!" commit -q -m "!MSG!"
if errorlevel 1 goto COMMITFAIL
"!GIT!" push origin %GH_BRANCH% > "%TEMP%\chk_push.txt" 2>&1
if errorlevel 1 goto PUSHFAIL

:VERIFICA
REM Verde solo si es verdad. Se compara lo que quedo en GitHub contra lo
REM que hay en esta carpeta. Antes el bat cantaba "subido" aunque el
REM commit hubiera tronado, y la version se quedaba sin publicar.
set LOCAL=
set REMOTO=
"!GIT!" rev-parse HEAD > "%TEMP%\chk_l.txt" 2>nul
if exist "%TEMP%\chk_l.txt" set /p LOCAL=<"%TEMP%\chk_l.txt"
del "%TEMP%\chk_l.txt" >nul 2>&1
"!GIT!" ls-remote origin %GH_BRANCH% > "%TEMP%\chk_r.txt" 2>nul
if exist "%TEMP%\chk_r.txt" set /p REMOTO=<"%TEMP%\chk_r.txt"
del "%TEMP%\chk_r.txt" >nul 2>&1
if not defined LOCAL goto NOCUADRA
if not defined REMOTO goto NOCUADRA
if /i not "!LOCAL:~0,10!"=="!REMOTO:~0,10!" goto NOCUADRA
echo          subido y verificado

:FIN
REM Clasp se cae solo cada tantos dias y nadie se entera hasta que el 5
REM muere a medias. Aqui se revisa SIEMPRE, aunque este bat no lo use:
REM mas vale enterarse ahora que cuando urge subir el backend.
echo   %AZUL%[3/3]%FIN%  Apps Script . . . . . . . . . . . .
set "CLASPMAL="
call clasp login --status > "%TEMP%\chk_cl.txt" 2>&1
if errorlevel 1 set "CLASPMAL=1"
findstr /I /C:"not logged" "%TEMP%\chk_cl.txt" >nul 2>&1 && set "CLASPMAL=1"
findstr /I /C:"no credential" "%TEMP%\chk_cl.txt" >nul 2>&1 && set "CLASPMAL=1"
del "%TEMP%\chk_cl.txt" >nul 2>&1
if defined CLASPMAL (echo          sesion caducada) else (echo          sesion viva)

echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
if defined CLASPMAL (
    echo   %ROJO%^^!  CLASP CADUCADO - el backend no se puede subir%FIN%
    echo      Corre 1-INSTALAR-CLASP.bat
) else (
    echo %VERDE%  Listo.%FIN%
)
echo.
call :LOGO
exit /b 0

:FUGA
echo.
echo   %ROJO%x  POSIBLE CREDENCIAL - no se subio nada%FIN%
echo.
pause
exit /b 1

:NOGIT
echo.
echo   %ROJO%x  NO ENCUENTRO GIT%FIN%
echo.
pause
exit /b 1

:PUSHFAIL
echo.
echo   %ROJO%x  FALLO EL PUSH A GITHUB%FIN%
echo.
REM Que diga POR QUE fallo. Antes siempre mandaba al 0-ACTUALIZAR, y para
REM un error 500 de GitHub eso es consejo malo: no hay nada que traer, el
REM commit ya esta hecho y un pull solo enreda el historial.
findstr /I /C:"Internal Server Error" /C:"HTTP 500" /C:"HTTP 502" /C:"HTTP 503" /C:"HTTP 504" "%TEMP%\chk_push.txt" >nul 2>&1
if not errorlevel 1 (
    echo      Es GitHub, no tu. Su servidor contesto con un error interno.
    echo      Tu commit YA quedo guardado aqui: solo falta subirlo.
    echo.
    echo      %VERDE%Espera unos minutos y vuelve a correr este mismo bat.%FIN%
    echo      NO corras el 0-ACTUALIZAR: no hay nada que bajar.
    goto PUSHFAIL_FIN
)
findstr /I /C:"non-fast-forward" /C:"fetch first" /C:"behind" "%TEMP%\chk_push.txt" >nul 2>&1
if not errorlevel 1 (
    echo      GitHub tiene cambios que no estan en esta computadora.
    echo.
    echo      %VERDE%Corre 0-ACTUALIZAR.bat y repite este bat.%FIN%
    goto PUSHFAIL_FIN
)
findstr /I /C:"Authentication failed" /C:"could not read Username" /C:"Permission denied" /C:"403" "%TEMP%\chk_push.txt" >nul 2>&1
if not errorlevel 1 (
    echo      GitHub no te reconocio ^(sesion o permisos^).
    echo.
    echo      %VERDE%Abre GitHub Desktop, vuelve a iniciar sesion y repite.%FIN%
    goto PUSHFAIL_FIN
)
findstr /I /C:"Could not resolve host" /C:"unable to access" /C:"timed out" "%TEMP%\chk_push.txt" >nul 2>&1
if not errorlevel 1 (
    echo      No se pudo llegar a GitHub ^(internet o proxy^).
    echo.
    echo      %VERDE%Revisa tu conexion y repite este bat.%FIN%
    goto PUSHFAIL_FIN
)
echo      Lo que contesto GitHub:
echo.
type "%TEMP%\chk_push.txt" 2>nul
echo.
echo      %VERDE%Manda este texto a Claude para que lo revise.%FIN%
:PUSHFAIL_FIN
echo.
pause
exit /b 1

:COMMITFAIL
echo.
echo   %ROJO%x  FALLO EL COMMIT - no se subio nada%FIN%
echo      Cierra otras ventanas de git y repite
echo.
pause
exit /b 1

:NOCUADRA
echo.
echo   %ROJO%x  GITHUB NO QUEDO IGUAL QUE TU CARPETA%FIN%
echo      Repite el bat; si sigue, corre 0-ACTUALIZAR.bat
echo.
pause
exit /b 1

:BUSCARGIT
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
where node >nul 2>&1
if errorlevel 1 goto SINLOGO
if not exist "%~dp0logo-animado.js" goto SINLOGO
node "%~dp0logo-animado.js" giro marca 0 12
goto :eof

:SINLOGO
pause
goto :eof
