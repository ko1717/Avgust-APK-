# CARE 360 — Publicar portal en Firebase Hosting (camino facil Windows)
# Uso: clic derecho → "Ejecutar con PowerShell", o desde CMD:
#   powershell -NoProfile -ExecutionPolicy Bypass -File deploy-portal.ps1

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root

$PortalUrl = 'https://gen-lang-client-0175464290.web.app/'
$ProjectId = 'gen-lang-client-0175464290'

Write-Host ''
Write-Host '========================================'
Write-Host '  CARE 360 — Publicar portal Firebase'
Write-Host '========================================'
Write-Host ''
Write-Host "Proyecto: $ProjectId"
Write-Host "URL:      $PortalUrl"
Write-Host ''

function Fail([string]$Message) {
    Write-Host ''
    Write-Host "[ERROR] $Message" -ForegroundColor Red
    Write-Host ''
    Read-Host 'Pulsa Enter para cerrar'
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail 'No se encontro Node.js. Instala Node 22+ desde https://nodejs.org y vuelve a ejecutar.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail 'No se encontro npm. Reinstala Node.js (incluye npm) y vuelve a intentar.'
}

$nodeVer = (node -v).Trim()
Write-Host "Node: $nodeVer"
Write-Host ''

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Write-Host '[1/4] Instalando dependencias (npm install)...'
    npm install
    if ($LASTEXITCODE -ne 0) { Fail 'npm install fallo.' }
} else {
    Write-Host '[1/4] Dependencias OK (node_modules presente).'
}

Write-Host ''
Write-Host '[2/4] Inicio de sesion Firebase (se abre el navegador)...'
Write-Host "      Usa la cuenta de Google con acceso al proyecto $ProjectId (vixnine777@gmail.com)."
npx firebase login
if ($LASTEXITCODE -ne 0) { Fail 'firebase login fallo.' }

Write-Host ''
Write-Host "[3/4] Seleccionando proyecto $ProjectId..."
npx firebase use $ProjectId
if ($LASTEXITCODE -ne 0) {
    Fail "No se pudo seleccionar $ProjectId. Verifica acceso en Firebase Console."
}

Write-Host ''
Write-Host '[4/4] Build + deploy (hosting + firestore)...'
npm run deploy:firebase
if ($LASTEXITCODE -ne 0) { Fail 'El deploy fallo. Revisa el mensaje de arriba.' }

Write-Host ''
Write-Host '========================================' -ForegroundColor Green
Write-Host '  LISTO — portal publicado' -ForegroundColor Green
Write-Host '========================================' -ForegroundColor Green
Write-Host ''
Write-Host 'Abre en el navegador:'
Write-Host "  $PortalUrl"
Write-Host ''
Read-Host 'Pulsa Enter para cerrar'
