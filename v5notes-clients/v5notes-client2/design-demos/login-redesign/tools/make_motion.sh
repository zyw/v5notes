#!/bin/bash
# usage: ./tools/make_motion.sh <N> [frames]
set -euo pipefail
N=${1:?dir number}
FRAMES=${2:-18}
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="/tmp/v5login-frames-dir$N"
rm -rf "$TMP"; mkdir -p "$TMP"
for i in $(seq 0 $((FRAMES-1))); do
  T=$(python3 -c "print(0.4 + $i*0.6)")
  "$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars --no-first-run \
    --disable-crash-reporter --disable-breakpad --user-data-dir="$DIR/../../.tmp-chrome-gif$N" \
    --window-size=1440,900 --virtual-time-budget=2200 \
    --screenshot="$TMP/f$(printf '%03d' $i).png" \
    "file://$DIR/dir-$N.html?t=$T" 2>/dev/null
done
ffmpeg -y -loglevel error -framerate 6 -i "$TMP/f%03d.png" \
  -vf "scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer" \
  -loop 0 "$DIR/shots/dir-$N-motion.gif"
ls -lh "$DIR/shots/dir-$N-motion.gif"
