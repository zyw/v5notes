#!/bin/bash
# usage: ./shot.sh <html> <out.png> [mobile]
set -euo pipefail
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FILE="$1"; OUT="$2"; MODE="${3:-desktop}"
SIZE="1440,900"; [ "$MODE" = "mobile" ] && SIZE="375,812"
PROFILE=$(mktemp -d /tmp/dsh-chrome-XXXXXX)
HOME="$PROFILE" TMPDIR="$PROFILE" "$CHROME" \
  --headless=new --no-sandbox --disable-gpu --disable-gpu-sandbox --use-gl=swiftshader \
  --disable-breakpad --user-data-dir="$PROFILE/prof" --hide-scrollbars \
  --no-first-run --no-default-browser-check --force-device-scale-factor=1 \
  --window-size="$SIZE" --virtual-time-budget=4000 \
  --screenshot="$OUT" "file://$FILE" >/dev/null 2>&1
ls -la "$OUT"
