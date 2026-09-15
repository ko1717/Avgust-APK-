#!/usr/bin/env bash
#
# Genera el APK de AVGUST CARE 360 con la capa de interfaz y experiencia
# aplicada sobre el paquete base.
#
#   tools/build-apk.sh [apk-base] [version-name] [version-code]
#
# Requiere zipalign y apksigner (Android build-tools) y keytool (JDK).
# Se puede indicar la ruta de las build-tools con ANDROID_BUILD_TOOLS.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_APK="${1:-$ROOT/tools/base/AVGUST-CARE-360-1.1.0-rc.5-Android.apk}"
VERSION_NAME="${2:-1.4.0}"
VERSION_CODE="${3:-12}"
BASE_VERSION_NAME="1.1.0-rc.5"

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

# --------------------------------------------------------------------------
# 1. Extraer del paquete base solo lo que se va a modificar
# --------------------------------------------------------------------------
cd "$WORK"
unzip -q "$BASE_APK" "assets/public/index.html" "assets/public/sw.js" "AndroidManifest.xml"

# --------------------------------------------------------------------------
# 2. Copiar la capa de mejoras y sellar la versión
# --------------------------------------------------------------------------
mkdir -p assets/public/enhance
cp "$ROOT/enhance/src/care360-enhance.css" assets/public/enhance/
cp "$ROOT/enhance/src/care360-presentation.css" assets/public/enhance/
cp "$ROOT/enhance/src/care360-presentation.js" assets/public/enhance/
cp "$ROOT/enhance/src/care360-experience.js" assets/public/enhance/
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
    '<link rel="stylesheet" href="/enhance/care360-presentation.css?v=%s">' % (version, version)
)
body = (
    '<script defer src="/enhance/care360-experience.js?v=%s"></script>'
    '<script defer src="/enhance/care360-presentation.js?v=%s"></script>' % (version, version)
)

html = html.replace("</head>", head + "</head>", 1)
html = html.replace("</body>", body + "</body>", 1)
open(path, "w", encoding="utf-8").write(html)
print("index.html actualizado")
PY

# --------------------------------------------------------------------------
# 4. Renovar la caché del service worker para que la versión nueva se aplique
# --------------------------------------------------------------------------
python3 - "$VERSION_NAME" <<'PY'
import re
import sys

version = sys.argv[1]
path = "assets/public/sw.js"
source = open(path, encoding="utf-8").read()
source = re.sub(
    r"const CACHE='[^']+'",
    "const CACHE='avgust-care-shell-%s'" % version,
    source,
    count=1,
)
open(path, "w", encoding="utf-8").write(source)
print("service worker apuntando a la caché de la versión %s" % version)
PY

# --------------------------------------------------------------------------
# 5. Actualizar versionName y versionCode del manifiesto binario
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
zip -q -X "$STAGED" AndroidManifest.xml assets/public/index.html assets/public/sw.js assets/public/enhance/*

ALIGNED="$WORK/aligned.apk"
"$ZIPALIGN" -f -p 4 "$STAGED" "$ALIGNED"

# --------------------------------------------------------------------------
# 7. Firmar
# --------------------------------------------------------------------------
KEYSTORE="${CARE360_KEYSTORE:-$ROOT/tools/signing/care360-release.keystore}"
STOREPASS="${CARE360_KEYSTORE_PASS:-care360avgust}"
ALIAS="${CARE360_KEY_ALIAS:-care360}"

if [[ ! -f "$KEYSTORE" ]]; then
  echo "==> Creando almacén de claves en $KEYSTORE"
  mkdir -p "$(dirname "$KEYSTORE")"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE" \
    -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10950 \
    -storepass "$STOREPASS" -keypass "$STOREPASS" \
    -dname "CN=AVGUST CARE 360, OU=Acompanamiento en campo, O=Avgust Crop Protection, L=Bogota, C=CO" \
    >/dev/null
fi

FINAL="$OUT_DIR/AVGUST-CARE-360-$VERSION_NAME-Android.apk"
"$APKSIGNER" sign \
  --ks "$KEYSTORE" --ks-key-alias "$ALIAS" \
  --ks-pass "pass:$STOREPASS" --key-pass "pass:$STOREPASS" \
  --v1-signing-enabled true --v2-signing-enabled true --v3-signing-enabled true \
  --out "$FINAL" "$ALIGNED"

"$APKSIGNER" verify --print-certs "$FINAL" | head -n 6

# Una sola versión en dist/: se retiran los APK intermedios.
find "$OUT_DIR" -maxdepth 1 -name 'AVGUST-CARE-360-*-Android.apk' ! -name "AVGUST-CARE-360-$VERSION_NAME-Android.apk" -delete
find "$OUT_DIR" -maxdepth 1 -name '*.idsig' -delete

echo
echo "==> APK generado: $FINAL"
ls -lh "$FINAL" | awk '{print "    tamaño: " $5}'
