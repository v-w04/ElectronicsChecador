@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Mover el frontend a docs

echo.
echo  =======================================================
echo    MOVER EL FRONTEND A LA CARPETA docs
echo  =======================================================
echo.
echo  Deja el repo igual que Site Sheet y WM_Inv:
echo.
echo    docs\         la PWA del checador (GitHub Pages)
echo    apps-script\  el backend (clasp)
echo.
echo  Se mueve con "git mv", asi git sabe que son los mismos
echo  archivos y el historial de cada uno no se pierde.
echo.

if exist "docs\index.html" goto YAMOVIDO
if not exist "index.html" goto NOHAY

call :BUSCARGIT
if errorlevel 1 goto NOGIT
if not exist ".git" goto NOTREPO

echo  [0/4] Revisando que no haya credenciales...
call _seguro.bat
if errorlevel 1 goto FUGA
echo        Limpio.
echo.

echo  [1/4] Moviendo archivos...
if not exist "docs" mkdir "docs"
for %%F in (*.js *.html *.css *.png *.ico *.webmanifest) do (
    "!GIT!" mv "%%F" "docs\%%F" >nul 2>&1
    if errorlevel 1 move "%%F" "docs\%%F" >nul
    echo        %%F
)
echo.

echo  [2/4] Agregando todo
"!GIT!" add -A
if errorlevel 1 goto FAIL

echo  [3/4] Creando commit
"!GIT!" commit -m "Estructura clasp + frontend a docs/ (como Site Sheet)"
if errorlevel 1 goto FAIL

echo  [4/4] Subiendo a GitHub
"!GIT!" push origin %GH_BRANCH%
if errorlevel 1 goto FAIL

echo.
echo  =======================================================
echo    SUBIDO - FALTA UN CLICK EN GITHUB, HAZLO YA
echo  =======================================================
echo.
echo  Mientras no lo cambies, el checador de los empleados NO
echo  carga: GitHub sigue buscando el index.html en la raiz.
echo.
echo  Se va a abrir la pagina de GitHub Pages. Ahi:
echo.
echo    Branch: main    Carpeta: /docs    Save
echo.
echo  La URL no cambia. En 1-2 minutos vuelve a cargar.
echo.
pause
start "" "https://github.com/%GH_USER%/%GH_REPO%/settings/pages"
exit /b 0

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

:YAMOVIDO
echo  Ya esta hecho: docs\index.html existe. No hay nada que mover.
echo.
pause
exit /b 0

:NOHAY
echo  No encuentro index.html en la raiz ni en docs. Revisa la carpeta.
echo.
pause
exit /b 1

:FUGA
echo.
echo  DETENIDO: el seguro encontro una posible credencial.
echo  No se movio ni se subio nada. Revisa las alertas de arriba.
echo.
pause
exit /b 1

:NOGIT
echo  ERROR: no encuentro git. Instala Git o GitHub Desktop.
echo.
pause
exit /b 1

:NOTREPO
echo  ERROR: esta carpeta no es un repositorio de git.
echo.
pause
exit /b 1

:FAIL
echo.
echo  ERROR: revisa el mensaje de arriba. Si el push fallo por
echo  "non-fast-forward", corre 0-ACTUALIZAR.bat y vuelve a correr esto.
echo.
pause
exit /b 1
