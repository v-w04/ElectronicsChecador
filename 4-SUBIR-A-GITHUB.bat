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
echo   %AZUL%[1/2]%FIN%  Credenciales . . . . . . . . . . . .
call _seguro.bat
if errorlevel 1 goto FUGA
echo          limpio

call :BUSCARGIT
if errorlevel 1 goto NOGIT
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1

echo   %AZUL%[2/2]%FIN%  GitHub . . . . . . . . . . . . . . .
"!GIT!" status --porcelain > "%TEMP%\chk_s.txt" 2>nul
set CAMBIOS=0
for /f %%C in ('find /c /v "" ^< "%TEMP%\chk_s.txt"') do set CAMBIOS=%%C
del "%TEMP%\chk_s.txt" >nul 2>&1

if "!CAMBIOS!"=="0" (
    echo          sin cambios
    goto FIN
)
"!GIT!" status --short
echo.
set "MSG="
set /p "MSG=   Mensaje [Enter = automatico]: "
if "!MSG!"=="" set "MSG=%MSG_DEFAULT%"
"!GIT!" add -A
"!GIT!" commit -q -m "!MSG!"
"!GIT!" push -q origin %GH_BRANCH%
if errorlevel 1 goto PUSHFAIL
echo          subido

:FIN
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo %VERDE%  Listo.%FIN%
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
echo   %ROJO%x  FALLO EL PUSH%FIN%
echo      Corre 0-ACTUALIZAR.bat y repite
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
