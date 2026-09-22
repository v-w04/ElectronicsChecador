@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Mover a docs

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
if exist "docs\index.html" goto YA
if not exist "index.html" goto NOHAY
call :BUSCARGIT
if errorlevel 1 goto NOGIT
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1
call _seguro.bat >nul 2>&1
if errorlevel 1 goto FUGA
if not exist "docs" mkdir "docs"
for %%F in (*.js *.html *.css *.png *.ico *.webmanifest) do (
    if /I not "%%F"=="logo-animado.js" (
        "!GIT!" mv "%%F" "docs\%%F" >nul 2>&1
        if errorlevel 1 move "%%F" "docs\%%F" >nul
    )
)
"!GIT!" add -A
"!GIT!" commit -q -m "Frontend a docs/"
"!GIT!" push -q origin %GH_BRANCH%
if errorlevel 1 goto PUSHFAIL
echo.
echo   %ROJO%^^!  CAMBIA GITHUB PAGES A /docs%FIN%
echo.
call :LOGO
exit /b 0

:YA
echo %VERDE%  Ya esta en docs.%FIN%
echo.
call :LOGO
exit /b 0

:NOHAY
echo.
echo   %ROJO%x  NO ENCUENTRO index.html%FIN%
echo.
pause
exit /b 1

:NOGIT
echo.
echo   %ROJO%x  NO ENCUENTRO GIT%FIN%
echo.
pause
exit /b 1

:FUGA
echo.
echo   %ROJO%x  POSIBLE CREDENCIAL - no se movio nada%FIN%
echo.
pause
exit /b 1

:PUSHFAIL
echo.
echo   %ROJO%x  FALLO EL PUSH%FIN%
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
