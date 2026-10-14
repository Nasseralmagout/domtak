#!/usr/bin/env bash
# Export every Domtak screen as SVG into ../design/svg (repo root).
# Needs: node + playwright, python3 with pymupdf + pillow (requirements.txt), poppler-utils (pdftocairo).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$(cd "$HERE/../.." && pwd)"
OUT="${1:-$APP/../design/svg}"
WORK="$(mktemp -d)"
PY="${PYTHON:-python3}"

echo "1/4 web build"
(cd "$APP" && EXPO_OFFLINE=1 npx expo export --platform web --output-dir "$WORK/dist" >/dev/null)

echo "2/4 serve on :8099"
"$PY" "$HERE/serve.py" "$WORK/dist" &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1

echo "3/4 capture vector PDFs"
"$PY" "$HERE/shots.py" "$WORK/shots.json"
node "$HERE/capture.js" "$WORK/shots.json" "$WORK/pdf"

echo "4/4 convert to SVG"
"$PY" "$HERE/convert.py" "$WORK/pdf" "$OUT"
echo "done -> $OUT"
