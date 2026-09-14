@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Bajar el codigo real de Apps Script

echo.
echo  =======================================================
echo    BAJAR EL CODIGO QUE ESTA CORRIENDO EN APPS SCRIPT
echo  =======================================================
echo.
echo  Trae a la carpeta apps-script lo que hoy vive en el editor
echo  de Apps Script del Checador 7.0. Asi el backend queda en git
echo  y se trabaja sobre la version real, no sobre una copia.
echo.
echo  OJO: clasp tiene que tener la sesion de la cuenta DUENA del
echo  Sheet (victor.walmart.04). Si 1-INSTALAR-CLASP.bat se corrio
echo  con otra cuenta, corre "clasp logout" y luego "clasp login".
echo.

where clasp >nul 2>&1
if errorlevel 1 goto NOCLASP
if not exist ".clasp.json" goto NOCONFIG

if exist "apps-script\appsscript.json" (
    echo  Ya hay codigo en apps-script. Si sigues, se REEMPLAZA
    echo  con lo que esta en linea y pierdes cambios locales sin subir.
    echo.
    choice /c SN /m "  Continuar"
    if errorlevel 2 exit /b 0
    echo.
)

if not exist "apps-script" mkdir "apps-script"

echo  [1/2] Bajando con clasp pull...
echo.
call clasp pull
if errorlevel 1 goto PULLFAIL

echo.
echo  Archivos que llegaron:
dir /b apps-script
echo.

echo  [2/2] Revisando que el codigo no traiga credenciales...
call _seguro.bat
if errorlevel 1 goto FUGA
echo        Limpio.

echo.
echo  =======================================================
echo    LISTO - EL BACKEND YA ESTA EN LA CARPETA
echo  =======================================================
echo.
echo  Siguiente paso: UNA-VEZ-2-MOVER-FRONTEND-A-DOCS.bat
echo  (ese hace el commit de todo y lo sube a GitHub).
echo.
echo  NO corras 2- ni 5- todavia: no hace falta subir nada a
echo  Apps Script, el codigo en linea ya es este.
echo.
pause
exit /b 0

:FUGA
echo.
echo  =======================================================
echo    CUIDADO - EL CODIGO EN LINEA TRAE UNA CREDENCIAL
echo  =======================================================
echo.
echo  NO hagas commit ni push de esto: el repo es publico.
echo.
echo  Si es la llave privada de Firebase (private_key):
echo    1. Consola de Firebase - Configuracion - Cuentas de servicio
echo    2. Genera una llave nueva y BORRA la vieja
echo    3. En el editor de Apps Script corre configurarFirebase()
echo       con la nueva, y quita la llave del codigo
echo    4. Vuelve a correr este archivo
echo.
echo  Mientras tanto avisale a Claude: lo quitamos del codigo antes
echo  de que toque git.
echo.
pause
exit /b 1

:NOCLASP
echo  ERROR: no encuentro clasp. Corre primero 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:NOCONFIG
echo  ERROR: no encuentro .clasp.json en esta carpeta.
echo.
pause
exit /b 1

:PULLFAIL
echo.
echo  ERROR: fallo el pull. Errores comunes:
echo.
echo  - "User has not enabled the Apps Script API"
echo    script.google.com/home/usersettings - prende el switch
echo.
echo  - "Requested entity was not found" / "permission"
echo    clasp esta con otra cuenta. Corre "clasp logout" y luego
echo    "clasp login" con victor.walmart.04
echo.
pause
exit /b 1
