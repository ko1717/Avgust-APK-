#!/usr/bin/env bash
#
# Genera el APK de AVGUST CARE 360 con la capa de interfaz y experiencia
# aplicada sobre el paquete base.
#
#   tools/build-apk.sh [apk-base] [version-name] [version-code]
#
# Requiere zipalign y apksigner (Android build-tools).
# Se puede indicar la ruta de las build-tools con ANDROID_BUILD_TOOLS.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_APK="${1:-$ROOT/tools/base/capacitor-seed.apk}"
# Resolve before cd into the temp workdir (relative paths break after that).
if [[ "$BASE_APK" != /* ]]; then
  BASE_APK="$(cd "$(dirname "$BASE_APK")" && pwd)/$(basename "$BASE_APK")"
fi
DEBRAND="${C360_DEBRAND:-0}"

# The release version is centralized in version.json. CLI arguments may override it
# deliberately for a release build, but the default can no longer drift to 1.5.13.
readarray -t VERSION_CONFIG < <(python3 - "$ROOT/version.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    cfg = json.load(f)
print(str(cfg.get("name", "")).strip())
print(str(cfg.get("code", "")).strip())
PY
)
DEFAULT_VERSION_NAME="${VERSION_CONFIG[0]:-}"
DEFAULT_VERSION_CODE="${VERSION_CONFIG[1]:-}"
[[ "$DEFAULT_VERSION_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "version.json: nombre de versión inválido" >&2; exit 1; }
[[ "$DEFAULT_VERSION_CODE" =~ ^[0-9]+$ ]] || { echo "version.json: version code inválido" >&2; exit 1; }

VERSION_NAME="${2:-$DEFAULT_VERSION_NAME}"
VERSION_CODE="${3:-$DEFAULT_VERSION_CODE}"
BASE_VERSION_NAME="1.1.0-rc.5"

# Sin valor por defecto: la contraseña no vive en el guion ni se imprime.
: "${CARE360_KEYSTORE_PASS:?Define CARE360_KEYSTORE_PASS (contraseña del almacén).}"
: "${CARE360_KEY_PASS:?Define CARE360_KEY_PASS (contraseña de la clave).}"

OUT_DIR="$ROOT/dist"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

find_tool() {
  local name="$1"
  if [[ -n "${ANDROID_BUILD_TOOLS:-}" && -x "$ANDROID_BUILD_TOOLS/$name" ]]; then
    echo "$ANDROID_BUILD_TOOLS/$name"
    return 0
  fi
  if command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
    return 0
  fi
  echo "No se encontró '$name'. Instala las Android build-tools o define ANDROID_BUILD_TOOLS." >&2
  return 1
}

ZIPALIGN="$(find_tool zipalign)"
APKSIGNER="$(find_tool apksigner)"

[[ -f "$BASE_APK" ]] || { echo "No existe el APK base: $BASE_APK" >&2; exit 1; }

echo "==> APK base:  $BASE_APK"
echo "==> Versión:   $VERSION_NAME (código $VERSION_CODE)"
if [[ "$DEBRAND" == "1" ]]; then
  echo "==> Marca:      sin Avgust (CARE 360 / verde agro)"
else
  echo "==> Marca:      AVGUST CARE 360 (logos visibles)"
fi

# --------------------------------------------------------------------------
# 1. Extraer del paquete base solo lo que se va a modificar
# --------------------------------------------------------------------------
cd "$WORK"
if [[ "$DEBRAND" == "1" ]]; then
  unzip -q "$BASE_APK" \
    "assets/public/*" \
    "assets/capacitor.config.json" \
    "resources.arsc" \
    "AndroidManifest.xml"
else
  unzip -q "$BASE_APK" \
    "assets/public/index.html" \
    "assets/public/sw.js" \
    "assets/public/assets/index-*.js" \
    "assets/public/assets/device-runtime-*.js" \
    "AndroidManifest.xml"
fi

# --------------------------------------------------------------------------
# 2. Copiar la capa de mejoras y sellar la versión
# --------------------------------------------------------------------------
mkdir -p assets/public/enhance
cp "$ROOT"/enhance/src/*.css assets/public/enhance/
cp "$ROOT"/enhance/src/*.js assets/public/enhance/
sed -i "s/__C360_VERSION__/$VERSION_NAME/g" assets/public/enhance/care360-presentation.js

# --------------------------------------------------------------------------
# 3. Enlazar la capa desde index.html
# --------------------------------------------------------------------------
python3 - "$VERSION_NAME" <<'PY'
import sys

version = sys.argv[1]
path = "assets/public/index.html"
html = open(path, encoding="utf-8").read()

if "care360-enhance.css" in html:
    raise SystemExit("index.html ya contiene la capa de mejoras")

head = (
    '<link rel="icon" href="/favicon.svg">'
    '<link rel="manifest" href="/manifest.webmanifest">'
    '<link rel="stylesheet" href="/enhance/care360-enhance.css?v=%s">'
    '<link rel="stylesheet" href="/enhance/care360-presentation.css?v=%s">'
    '<link rel="stylesheet" href="/enhance/care360-pro.css?v=%s">' % (version, version, version)
)
body = (
    '<script defer src="/enhance/colombia-geo.js?v=%s"></script>'
    '<script defer src="/enhance/care360-experience.js?v=%s"></script>'
    '<script defer src="/enhance/care360-ops.js?v=%s"></script>'
    '<script defer src="/enhance/care360-import.js?v=%s"></script>'
    '<script defer src="/enhance/care360-metrics.js?v=%s"></script>'
    '<script defer src="/enhance/care360-pro.js?v=%s"></script>'
    '<script defer src="/enhance/care360-presentation.js?v=%s"></script>' % (version, version, version, version, version, version, version)
)
if __import__("os").environ.get("C360_DEBRAND") == "1":
    head += '<link rel="stylesheet" href="/enhance/care360-debrand.css?v=%s">' % version
    body = (
        '<script defer src="/enhance/care360-debrand.js?v=%s"></script>' % version
        + body
    )

html = html.replace("</head>", head + "</head>", 1)
html = html.replace("</body>", body + "</body>", 1)
if "interactive-widget=" not in html:
    html = html.replace(
        "viewport-fit=cover",
        "viewport-fit=cover, interactive-widget=resizes-content",
        1,
    )
open(path, "w", encoding="utf-8").write(html)
print("index.html actualizado")
PY

# --------------------------------------------------------------------------
# 4. Renovar la caché del service worker para que la versión nueva se aplique
# --------------------------------------------------------------------------
python3 - "$VERSION_NAME" "${DEBRAND}" <<'PY'
import re
import sys

version = sys.argv[1]
debrand = sys.argv[2] == "1"
path = "assets/public/sw.js"
source = open(path, encoding="utf-8").read()
prefix = "care360-shell" if debrand else "avgust-care-shell"
source = re.sub(
    r"const CACHE='[^']+'",
    "const CACHE='%s-%s'" % (prefix, version),
    source,
    count=1,
)
open(path, "w", encoding="utf-8").write(source)
print("service worker apuntando a la caché de la versión %s" % version)
PY

if [[ "$DEBRAND" == "1" ]]; then
  python3 "$ROOT/tools/debrand_web.py" "$WORK"
fi
python3 "$ROOT/tools/patch_measurements.py" "$WORK"
python3 "$ROOT/tools/patch_report.py" "$WORK"
python3 "$ROOT/tools/patch_import.py" "$WORK"
python3 "$ROOT/tools/patch_runtime.py" "$WORK"
python3 "$ROOT/tools/patch_followup.py" "$WORK"
python3 "$ROOT/tools/patch_draft.py" "$WORK"
python3 "$ROOT/tools/patch_crop.py" "$WORK"

# --------------------------------------------------------------------------
# 5. Manifiesto de la semilla: versión de campo y flags de release.
#    debuggable y allowBackup se apagan aquí; la semilla original no se toca.
# --------------------------------------------------------------------------
python3 "$ROOT/tools/patch_manifest.py" AndroidManifest.xml AndroidManifest.patched.xml \
  --old-version-name "$BASE_VERSION_NAME" \
  --version-name "$VERSION_NAME" \
  --version-code "$VERSION_CODE"
mv AndroidManifest.patched.xml AndroidManifest.xml

# --------------------------------------------------------------------------
# 6. Rearmar el APK
# --------------------------------------------------------------------------
mkdir -p "$OUT_DIR"
STAGED="$WORK/staged.apk"
cp "$BASE_APK" "$STAGED"
chmod u+w "$STAGED"

# La firma anterior deja de ser válida en cuanto cambia el contenido.
zip -q -d "$STAGED" 'META-INF/*.RSA' 'META-INF/*.SF' 'META-INF/*.DSA' 'META-INF/MANIFEST.MF' >/dev/null 2>&1 || true
if [[ "$DEBRAND" == "1" ]]; then
  # resources.arsc tiene que ir SIN comprimir: Samsung (y el instalador de
  # Android) mapea ese archivo en memoria y rechaza el paquete si va deflate.
  zip -q -X "$STAGED" \
    AndroidManifest.xml \
    assets/capacitor.config.json \
    assets/public/index.html \
    assets/public/sw.js \
    assets/public/avgust-logo.svg \
    assets/public/favicon.svg \
    assets/public/manifest.webmanifest \
    assets/public/assets/* \
    assets/public/enhance/*
  zip -q -X -0 "$STAGED" resources.arsc
else
  zip -q -X "$STAGED" AndroidManifest.xml assets/public/index.html assets/public/sw.js assets/public/enhance/* assets/public/assets/index-*.js assets/public/assets/device-runtime-*.js
fi

ALIGNED="$WORK/aligned.apk"
"$ZIPALIGN" -f -p 4 "$STAGED" "$ALIGNED"

# --------------------------------------------------------------------------
# 7. Firmar
# --------------------------------------------------------------------------
KEYSTORE="${CARE360_KEYSTORE:-$ROOT/tools/signing/care360-release.keystore}"
ALIAS="${CARE360_KEY_ALIAS:-care360}"

if [[ ! -f "$KEYSTORE" ]]; then
  echo "No se encontró el almacén de claves: $KEYSTORE" >&2
  echo "No se genera una clave nueva: otra identidad impediría actualizar sin desinstalar." >&2
  exit 1
fi

if [[ "$DEBRAND" == "1" ]]; then
  FINAL="$OUT_DIR/CARE-360-$VERSION_NAME-sin-marca-Android.apk"
else
  FINAL="$OUT_DIR/AVGUST-CARE-360-$VERSION_NAME-Android.apk"
fi
"$APKSIGNER" sign \
  --ks "$KEYSTORE" --ks-key-alias "$ALIAS" \
  --ks-pass env:CARE360_KEYSTORE_PASS --key-pass env:CARE360_KEY_PASS \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$FINAL" "$ALIGNED"

"$APKSIGNER" verify --print-certs "$FINAL" | head -n 6
python3 "$ROOT/tools/patch_manifest.py" --verify "$FINAL"

python3 - "$FINAL" <<'PY'
import sys
import zipfile

path = sys.argv[1]
info = zipfile.ZipFile(path).getinfo("resources.arsc")
if info.compress_type != zipfile.ZIP_STORED:
    raise SystemExit(
        "resources.arsc quedó comprimido (%d); Samsung no podrá instalar el APK" % info.compress_type
    )
print("resources.arsc sin comprimir (%d bytes)" % info.file_size)
PY

find "$OUT_DIR" -maxdepth 1 -name '*.idsig' -delete
# En dist/ queda una sola APK: la que se acaba de generar (versión actual).
if [[ "$DEBRAND" == "1" ]]; then
  find "$OUT_DIR" -maxdepth 1 -name 'CARE-360-*-sin-marca-Android.apk' ! -name "CARE-360-$VERSION_NAME-sin-marca-Android.apk" -delete
  find "$OUT_DIR" -maxdepth 1 -name 'AVGUST-CARE-360-*-Android.apk' -delete
  find "$ROOT" -maxdepth 1 -name 'CARE-360-*-sin-marca-Android.apk' -delete
  find "$ROOT" -maxdepth 1 -name 'AVGUST-CARE-360-*-Android.apk' -delete
else
  find "$OUT_DIR" -maxdepth 1 -name 'AVGUST-CARE-360-*-Android.apk' ! -name "AVGUST-CARE-360-$VERSION_NAME-Android.apk" -delete
  find "$OUT_DIR" -maxdepth 1 -name 'CARE-360-*-sin-marca-Android.apk' -delete
  find "$ROOT" -maxdepth 1 -name 'AVGUST-CARE-360-*-Android.apk' -delete
  find "$ROOT" -maxdepth 1 -name 'CARE-360-*-sin-marca-Android.apk' -delete
fi
find "$ROOT" -maxdepth 1 -name '*.idsig' -delete

apk_count="$(find "$OUT_DIR" -maxdepth 1 -name '*.apk' | wc -l)"
if [[ "$apk_count" -ne 1 ]]; then
  echo "ERROR: dist/ debe quedar con una sola APK (hay $apk_count)." >&2
  find "$OUT_DIR" -maxdepth 1 -name '*.apk' -print >&2
  exit 1
fi

echo
echo "==> APK generado: $FINAL"
ls -lh "$FINAL" | awk '{print "    tamaño: " $5}'
