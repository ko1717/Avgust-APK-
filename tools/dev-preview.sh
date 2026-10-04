#!/usr/bin/env bash
#
# Vista previa: usa exactamente la misma pipeline que el build web.
#
#   tools/dev-preview.sh [puerto]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8080}"
OUT="${CARE360_PREVIEW_DIR:-/tmp/care360-preview}"

node "$ROOT/build.js"

rm -rf "$OUT"
mkdir -p "$OUT"
cp -a "$ROOT/dist/." "$OUT/"

if [[ "${C360_DEBRAND:-0}" == "1" ]]; then
  python3 "$ROOT/tools/debrand_web.py" "$OUT"
fi

echo "Vista previa lista en $OUT"
echo "Sirviendo en http://localhost:$PORT"
cd "$OUT"
exec python3 -m http.server "$PORT"
