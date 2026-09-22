@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Subir a Apps Script

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
if not exist "apps-script\appsscript.json" goto VACIO

echo   %AZUL%[1/2]%FIN%  Credenciales . . . . . . . . . . . .
call _seguro.bat
if errorlevel 1 goto FUGA
echo          limpio

echo   %AZUL%[2/2]%FIN%  Subiendo . . . . . . . . . . . . . .
call clasp push --force >nul 2>"%TEMP%\chk_e.txt"
if errorlevel 1 goto PUSHFAIL
del "%TEMP%\chk_e.txt" >nul 2>&1
echo          ok
echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
call :BUSCARGIT
if errorlevel 1 goto SINGIT
set "PUBLICAR="
"!GIT!" status --porcelain > "%TEMP%\chk_c.txt" 2>nul
if exist "%TEMP%\chk_c.txt" (
    findstr /I /C:"apps-script/" "%TEMP%\chk_c.txt" | findstr /V /I /C:"Mensajes.gs" >nul 2>&1 && set "PUBLICAR=1"
)
del "%TEMP%\chk_c.txt" >nul 2>&1
if defined PUBLICAR (
    echo   %ROJO%^^!  FALTA PUBLICAR VERSION%FIN%
) else (
    echo %VERDE%  No hace falta publicar version.%FIN%
)
echo.
call :LOGO
exit /b 0

:SINGIT
echo %VERDE%  Subido.%FIN%
echo.
call :LOGO
exit /b 0

:PUSHFAIL
type "%TEMP%\chk_e.txt"
del "%TEMP%\chk_e.txt" >nul 2>&1
echo.
echo   %ROJO%x  FALLO EL PUSH%FIN%
echo      API apagada o sesion caducada: 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:VACIO
echo.
echo   %ROJO%x  apps-script VACIA - no se subio nada%FIN%
echo.
pause
exit /b 1

:FUGA
echo.
echo   %ROJO%x  POSIBLE CREDENCIAL - no se subio nada%FIN%
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
