@echo off
cd /d "%~dp0"
call _config.bat
title Subir a Apps Script

echo.
echo  =======================================================
echo    SUBIENDO CODIGO A APPS SCRIPT
echo  =======================================================
echo.

if not exist ".clasp.json" goto NOCONFIG

findstr /C:"PON_AQUI" .clasp.json >nul 2>&1
if not errorlevel 1 goto NOSCRIPTID

REM ---- Seguro contra borrar el proyecto en linea ----
REM clasp push --force deja Apps Script IGUAL a la carpeta apps-script.
REM Si la carpeta esta vacia o incompleta, borra el codigo que esta
REM corriendo. Por eso no se sube nada si falta el appsscript.json o
REM no hay un solo .gs.
if not exist "apps-script\appsscript.json" goto NOCODIGO
dir /b "apps-script\*.gs" >nul 2>&1
if errorlevel 1 goto NOCODIGO

echo  Archivos a subir desde la carpeta apps-script:
echo.
dir /b apps-script\*.gs
dir /b apps-script\appsscript.json
echo.
echo  -------------------------------------------------------
echo.

call clasp push --force
if errorlevel 1 goto PUSHFAIL

echo.
echo  =======================================================
echo    CODIGO ACTUALIZADO EN APPS SCRIPT
echo  =======================================================
echo.
echo  Si solo vas a usar el menu del Sheet o correr funciones
echo  desde el editor, ya puedes cerrar esta ventana.
echo.
echo  Si quieres que la URL del checador use el codigo nuevo,
echo  falta publicar la version. En el editor de Apps Script:
echo.
echo    Implementar
echo    Administrar implementaciones
echo    icono de lapiz
echo    Version: Nueva version
echo    Implementar
echo.
echo  OJO: "Nueva implementacion" NO es lo mismo. Esa genera otra
echo  URL y deja la anterior huerfana. Siempre editar la existente.
echo.
pause
exit /b 0

:NOCONFIG
echo  ERROR: No encuentro el archivo .clasp.json
echo.
echo  Corre primero 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:NOSCRIPTID
echo  FALTA: el scriptId en .clasp.json sigue en placeholder.
echo.
echo  Abrelo con el Bloc de notas y pon el ID de tu proyecto.
echo  Sale de la URL del editor, entre /projects/ y /edit
echo.
pause
exit /b 1

:PUSHFAIL
echo.
echo  ERROR: fallo el push. Revisa el mensaje de arriba.
echo.
echo  Errores comunes:
echo.
echo  - "User has not enabled the Apps Script API"
echo    Ve a script.google.com/home/usersettings
echo    y prende el switch de Google Apps Script API
echo.
echo  - "Invalid credentials" o "not logged in"
echo    Vuelve a correr 1-INSTALAR-CLASP.bat
echo.
echo  - "script not found" o "Requested entity was not found"
echo    Revisa que el scriptId en .clasp.json este correcto,
echo    y que hayas entrado con la cuenta duena del proyecto
echo.
pause
exit /b 1

:NOCODIGO
echo.
echo  =======================================================
echo    DETENIDO - LA CARPETA apps-script ESTA VACIA
echo  =======================================================
echo.
echo  Subir ahora borraria el codigo que esta corriendo en
echo  Apps Script. Primero baja el codigo real con:
echo.
echo    UNA-VEZ-1-BAJAR-DE-APPSCRIPT.bat
echo.
pause
exit /b 1
