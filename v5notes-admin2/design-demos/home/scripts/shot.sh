#!/bin/bash
# 用本机 Chrome 无头截图：shot.sh <html 路径> <输出 png> [宽] [高] [等待毫秒]
# 说明：harness 沙箱下 Chrome 必须 --no-sandbox 且 --user-data-dir 指向工作区内
set -e
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$1"; OUT="$2"; W="${3:-1440}"; H="${4:-1024}"; WAIT="${5:-2200}"
"$CHROME" --headless=new --no-sandbox --disable-gpu --disable-crash-reporter --disable-dev-shm-usage \
  --hide-scrollbars --force-device-scale-factor=1 --user-data-dir="$ROOT/.chrome" \
  --window-size="$W,$H" --virtual-time-budget="$WAIT" --screenshot="$OUT" "file://$SRC" 2>/dev/null
echo "saved $OUT"
