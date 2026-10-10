@echo off
setlocal EnableExtensions
chcp 65001 >nul
title CARE 360 — Deploy portal Firebase

REM Ir a la raiz del repo (donde esta este .bat)
cd /d "%~dp0"

echo.
echo ========================================
echo   CARE 360 — Publicar portal Firebase
echo ========================================
echo.
echo Proyecto: avgustscare360
echo URL:      https://avgustscare360.web.app/?portal=finca
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js.
  echo Instala Node 22+ desde https://nodejs.org y vuelve a ejecutar este archivo.
  goto :end
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro npm.
  echo Reinstala Node.js ^(incluye npm^) y vuelve a intentar.
  goto :end
)

for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_VER=%%v
echo Node: %NODE_VER%
echo.

if not exist "node_modules\" (
  echo [1/4] Instalando dependencias ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install fallo.
    goto :end
  )
) else (
  echo [1/4] Dependencias OK ^(node_modules presente^).
)

echo.
echo [2/4] Inicio de sesion Firebase ^(se abre el navegador^)...
echo       Usa la cuenta de Google con acceso al proyecto avgustscare360.
call npx firebase login
if errorlevel 1 (
  echo [ERROR] firebase login fallo.
  goto :end
)

echo.
echo [3/4] Seleccionando proyecto avgustscare360...
call npx firebase use avgustscare360
if errorlevel 1 (
  echo [ERROR] No se pudo seleccionar avgustscare360.
  echo Verifica que tu cuenta tenga acceso al proyecto en Firebase Console.
  goto :end
)

echo.
echo [4/4] Build + deploy ^(hosting + firestore^)...
call npm run deploy:firebase
if errorlevel 1 (
  echo.
  echo [ERROR] El deploy fallo. Revisa el mensaje de arriba.
  goto :end
)

echo.
echo ========================================
echo   LISTO — portal publicado
echo ========================================
echo.
echo Abre en el navegador:
echo   https://avgustscare360.web.app/?portal=finca
echo.

:end
echo.
pause
endlocal
