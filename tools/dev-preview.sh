#!/usr/bin/env bash
#
# Prepara una copia navegable de la aplicación (contenido web del APK más la
# capa de mejoras) y la sirve en http://localhost:PUERTO para revisarla en el
# navegador sin tener que instalar el APK.
#
#   tools/dev-preview.sh [apk-base] [puerto]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_APK="${1:-$ROOT/tools/base/AVGUST-CARE-360-1.1.0-rc.5-Android.apk}"
PORT="${2:-8080}"
OUT="${CARE360_PREVIEW_DIR:-/tmp/care360-preview}"

rm -rf "$OUT"
mkdir -p "$OUT"
unzip -q "$BASE_APK" 'assets/public/*' -d "$OUT/.apk"
cp -r "$OUT/.apk/assets/public/." "$OUT/"
rm -rf "$OUT/.apk"

mkdir -p "$OUT/enhance"
cp "$ROOT"/enhance/src/* "$OUT/enhance/"
sed -i "s/__C360_VERSION__/preview/g" "$OUT/enhance/care360-presentation.js"

python3 - "$OUT" "${C360_DEBRAND:-0}" <<'PY'
import sys

root = sys.argv[1]
debrand = sys.argv[2] == "1"
path = root + "/index.html"
html = open(path, encoding="utf-8").read()
head = (
    '<link rel="icon" href="/favicon.svg">'
    '<link rel="stylesheet" href="/enhance/care360-enhance.css">'
    '<link rel="stylesheet" href="/enhance/care360-presentation.css">'
)
body = (
    '<script defer src="/enhance/colombia-geo.js"></script>'
    '<script defer src="/enhance/care360-experience.js"></script>'
    '<script defer src="/enhance/care360-import.js"></script>'
    '<script defer src="/enhance/care360-metrics.js"></script>'
    '<script defer src="/enhance/care360-presentation.js"></script>'
)
if debrand:
    head += '<link rel="stylesheet" href="/enhance/care360-debrand.css">'
    body = (
        '<script defer src="/enhance/care360-debrand.js"></script>'
        + body
    )
html = html.replace("</head>", head + "</head>", 1).replace("</body>", body + "</body>", 1)
if "interactive-widget=" not in html:
    html = html.replace(
        "viewport-fit=cover",
        "viewport-fit=cover, interactive-widget=resizes-content",
        1,
    )
open(path, "w", encoding="utf-8").write(html)
PY

if [[ "${C360_DEBRAND:-0}" == "1" ]]; then
  python3 "$ROOT/tools/debrand_web.py" "$OUT"
fi
python3 "$ROOT/tools/patch_measurements.py" "$OUT"
python3 "$ROOT/tools/patch_report.py" "$OUT"
python3 "$ROOT/tools/patch_import.py" "$OUT"
python3 "$ROOT/tools/patch_runtime.py" "$OUT"
python3 "$ROOT/tools/patch_crop.py" "$OUT"

echo "Vista previa lista en $OUT"
echo "Sirviendo en http://localhost:$PORT"
cd "$OUT"
exec python3 -m http.server "$PORT"
