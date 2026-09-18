#!/usr/bin/env bash
#
# Genera la edición Windows de AVGUST CARE 360 con la misma UI y capa de
# mejoras que el APK (versión alineada).
#
#   tools/build-windows.sh [apk-base] [version-name]
#
# Produce:
#   dist/AVGUST-CARE-360-<ver>-Windows-x64.zip   (Electron, si la build corre)
#   dist/AVGUST-CARE-360-<ver>-Windows-portable.zip  (UI + lanzador Edge/Chrome)
#
# Requiere: python3, unzip, zip, node, npm.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_APK="${1:-$ROOT/tools/base/AVGUST-CARE-360-1.1.0-rc.5-Android.apk}"
VERSION_NAME="${2:-1.5.13}"
WIN_DIR="$ROOT/tools/windows"
UI_DIR="$WIN_DIR/ui"
OUT_DIR="$ROOT/dist"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [[ "$BASE_APK" != /* ]]; then
  BASE_APK="$(cd "$(dirname "$BASE_APK")" && pwd)/$(basename "$BASE_APK")"
fi

[[ -f "$BASE_APK" ]] || { echo "No existe el APK base: $BASE_APK" >&2; exit 1; }

echo "==> Base:    $BASE_APK"
echo "==> Versión: $VERSION_NAME (Windows)"

# --------------------------------------------------------------------------
# 1. Extraer UI del APK base
# --------------------------------------------------------------------------
rm -rf "$UI_DIR"
mkdir -p "$UI_DIR"
unzip -q "$BASE_APK" "assets/public/*" -d "$WORK/apk"
cp -a "$WORK/apk/assets/public/." "$UI_DIR/"

# --------------------------------------------------------------------------
# 2. Capa de mejoras + versión sellada
# --------------------------------------------------------------------------
mkdir -p "$UI_DIR/enhance"
cp "$ROOT"/enhance/src/* "$UI_DIR/enhance/"
sed -i "s/__C360_VERSION__/$VERSION_NAME/g" "$UI_DIR/enhance/care360-presentation.js"
# Alinear la píldora de versión de la capa pro
sed -i "s/var PRO_VERSION = \"[^\"]*\"/var PRO_VERSION = \"$VERSION_NAME\"/" \
  "$UI_DIR/enhance/care360-pro.js"

python3 - "$UI_DIR" "$VERSION_NAME" <<'PY'
import sys

root, version = sys.argv[1], sys.argv[2]
path = root + "/index.html"
html = open(path, encoding="utf-8").read()
if "care360-enhance.css" not in html:
    head = (
        '<link rel="icon" href="/favicon.svg">'
        '<link rel="manifest" href="/manifest.webmanifest">'
        '<link rel="stylesheet" href="/enhance/care360-enhance.css?v=%s">'
        '<link rel="stylesheet" href="/enhance/care360-presentation.css?v=%s">'
        '<link rel="stylesheet" href="/enhance/care360-pro.css?v=%s">'
        % (version, version, version)
    )
    body = (
        '<script defer src="/enhance/colombia-geo.js?v=%s"></script>'
        '<script defer src="/enhance/care360-experience.js?v=%s"></script>'
        '<script defer src="/enhance/care360-ops.js?v=%s"></script>'
        '<script defer src="/enhance/care360-import.js?v=%s"></script>'
        '<script defer src="/enhance/care360-metrics.js?v=%s"></script>'
        '<script defer src="/enhance/care360-pro.js?v=%s"></script>'
        '<script defer src="/enhance/care360-presentation.js?v=%s"></script>'
        % (version, version, version, version, version, version, version)
    )
    html = html.replace("</head>", head + "</head>", 1).replace(
        "</body>", body + "</body>", 1
    )
if "interactive-widget=" not in html:
    html = html.replace(
        "viewport-fit=cover",
        "viewport-fit=cover, interactive-widget=resizes-content",
        1,
    )
open(path, "w", encoding="utf-8").write(html)
print("index.html listo")
PY

python3 - "$UI_DIR" "$VERSION_NAME" <<'PY'
import re, sys
root, version = sys.argv[1], sys.argv[2]
path = root + "/sw.js"
source = open(path, encoding="utf-8").read()
source = re.sub(
    r"const CACHE='[^']+'",
    "const CACHE='avgust-care-shell-%s'" % version,
    source,
    count=1,
)
open(path, "w", encoding="utf-8").write(source)
PY

python3 "$ROOT/tools/patch_measurements.py" "$UI_DIR"
python3 "$ROOT/tools/patch_report.py" "$UI_DIR"
python3 "$ROOT/tools/patch_import.py" "$UI_DIR"
python3 "$ROOT/tools/patch_runtime.py" "$UI_DIR"
python3 "$ROOT/tools/patch_followup.py" "$UI_DIR"
python3 "$ROOT/tools/patch_draft.py" "$UI_DIR"
python3 "$ROOT/tools/patch_crop.py" "$UI_DIR"

# --------------------------------------------------------------------------
# 3. Lanzador portable (Edge/Chrome en modo app) — liviano, siempre
# --------------------------------------------------------------------------
mkdir -p "$OUT_DIR" "$WORK/portable"
cp -a "$UI_DIR/." "$WORK/portable/ui"

cat > "$WORK/portable/Iniciar-AVGUST-CARE-360.bat" <<BAT
@echo off
setlocal
cd /d "%~dp0"
title AVGUST CARE 360 v${VERSION_NAME}
echo Iniciando AVGUST CARE 360 v${VERSION_NAME}...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar.ps1"
BAT

cat > "$WORK/portable/iniciar.ps1" <<'PS1'
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Ui = Join-Path $Root "ui"
$Data = Join-Path $Root "data"
New-Item -ItemType Directory -Force -Path $Data | Out-Null

$listener = [System.Net.HttpListener]::new()
$port = 17895
$bound = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add("http://127.0.0.1:$port/")
    $listener.Start()
    $bound = $true
    break
  } catch {
    $port++
  }
}
if (-not $bound) { throw "No se pudo abrir un puerto local." }

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".webp" = "image/webp"
  ".woff2" = "font/woff2"
  ".wasm" = "application/wasm"
  ".json" = "application/json"
  ".webmanifest" = "application/manifest+json"
}

$browsers = @(
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw "Instala Microsoft Edge o Google Chrome." }

$url = "http://127.0.0.1:$port/"
$args = @("--app=$url", "--user-data-dir=$Data", "--no-first-run", "--disable-extensions")
Start-Process -FilePath $browser -ArgumentList $args | Out-Null
Write-Host "AVGUST CARE 360 listo en $url"
Write-Host "Cierra esta ventana para detener el servidor local."

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $file = Join-Path $Ui ($rel -replace "/", [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path $file) -or (Get-Item $file).PSIsContainer) {
      $file = Join-Path $Ui "index.html"
    }
    $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
    $bytes = [IO.File]::ReadAllBytes($file)
    $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
    $ctx.Response.Headers["Cache-Control"] = "no-cache"
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $ctx.Response.StatusCode = 500
  } finally {
    $ctx.Response.Close()
  }
}
PS1

cat > "$WORK/portable/LEEME.txt" <<TXT
AVGUST CARE 360 — Windows v${VERSION_NAME}
==========================================

Misma versión y funcionalidad que el APK Android ${VERSION_NAME}.

Cómo abrir
----------
1. Descomprime este ZIP en cualquier carpeta.
2. Doble clic en Iniciar-AVGUST-CARE-360.bat
3. Se abre en Microsoft Edge (o Chrome) en modo aplicación.

Requisitos
----------
- Windows 10 u 11
- Microsoft Edge o Google Chrome

Datos
-----
Se guardan en la carpeta "data" junto al lanzador (perfil del navegador).
Para respaldar visitas usa la función de respaldo .care360 dentro de la app.

TXT

PORTABLE_ZIP="$OUT_DIR/AVGUST-CARE-360-$VERSION_NAME-Windows-portable.zip"
rm -f "$PORTABLE_ZIP"
(
  cd "$WORK/portable"
  zip -qr "$PORTABLE_ZIP" .
)
echo "==> Portable: $PORTABLE_ZIP"
ls -lh "$PORTABLE_ZIP" | awk '{print "    tamaño: " $5}'

# --------------------------------------------------------------------------
# 4. Empaquetado Electron (exe/zip nativo) si npm está disponible
# --------------------------------------------------------------------------
# Sincronizar versión del package.json
python3 - "$WIN_DIR/package.json" "$VERSION_NAME" <<'PY'
import json, sys
path, ver = sys.argv[1], sys.argv[2]
data = json.load(open(path, encoding="utf-8"))
data["version"] = ver
json.dump(data, open(path, "w", encoding="utf-8"), indent=2)
open(path, "a", encoding="utf-8").write("\n")
PY

echo "==> Instalando dependencias Electron..."
(
  cd "$WIN_DIR"
  npm install --no-fund --no-audit
)

echo "==> Empaquetando Electron para Windows x64..."
set +e
(
  cd "$WIN_DIR"
  # En Linux, electron-builder puede generar el zip de Windows sin Wine
  # cuando signAndEditExecutable=false.
  npx electron-builder --win zip --x64 --publish never
)
BUILD_RC=$?
set -e

if [[ "$BUILD_RC" -eq 0 ]]; then
  ARTIFACT=$(find "$WIN_DIR/out" -name "AVGUST-CARE-360-*-Windows-*.zip" | head -n 1)
  if [[ -z "$ARTIFACT" ]]; then
    ARTIFACT=$(find "$WIN_DIR/out" -name "*.zip" | head -n 1)
  fi
  if [[ -n "$ARTIFACT" ]]; then
    FINAL_E="$OUT_DIR/AVGUST-CARE-360-$VERSION_NAME-Windows-x64.zip"
    cp -f "$ARTIFACT" "$FINAL_E"
    echo "==> Electron: $FINAL_E"
    ls -lh "$FINAL_E" | awk '{print "    tamaño: " $5}'
  else
    echo "!! Build Electron OK pero no se encontró el ZIP en tools/windows/out" >&2
  fi
else
  echo "!! No se pudo generar el paquete Electron (código $BUILD_RC)." >&2
  echo "   Queda disponible el portable liviano para Windows." >&2
fi

# Limpiar APKs viejos de Windows en dist no aplica; limpiar portables viejos
find "$OUT_DIR" -maxdepth 1 -name 'AVGUST-CARE-360-*-Windows-portable.zip' \
  ! -name "AVGUST-CARE-360-$VERSION_NAME-Windows-portable.zip" -delete 2>/dev/null || true
find "$OUT_DIR" -maxdepth 1 -name 'AVGUST-CARE-360-*-Windows-x64.zip' \
  ! -name "AVGUST-CARE-360-$VERSION_NAME-Windows-x64.zip" -delete 2>/dev/null || true

echo
echo "==> Windows v$VERSION_NAME listo (alineado con el APK)."
