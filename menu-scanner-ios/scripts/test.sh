#!/usr/bin/env bash
# 產生 Xcode 專案並在 iOS 模擬器上編譯、跑全部測試（解析器單元測試＋Vision 測試）。
# 用法：scripts/test.sh            自動挑最新 iOS 的 iPhone 模擬器
#       DESTINATION='platform=iOS Simulator,name=iPhone 16' scripts/test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "需要 XcodeGen：brew install xcodegen" >&2
  exit 1
fi
xcodegen generate --quiet

DEST="${DESTINATION:-}"
if [ -z "$DEST" ]; then
  SIM_ID=$(xcrun simctl list devices available -j | /usr/bin/python3 -c '
import json, re, sys
devices = json.load(sys.stdin)["devices"]
def version(runtime):
    m = re.search(r"iOS-(\d+)-(\d+)", runtime)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
cands = [(version(r), d["udid"]) for r, ds in devices.items() if "iOS" in r for d in ds if d["name"].startswith("iPhone")]
cands.sort()
print(cands[-1][1] if cands else "")
')
  if [ -z "$SIM_ID" ]; then
    echo "找不到可用的 iPhone 模擬器，請在 Xcode › Settings › Platforms 安裝 iOS 模擬器" >&2
    exit 1
  fi
  DEST="platform=iOS Simulator,id=$SIM_ID"
fi

SHOTS="$PWD/build/screenshots"
RESULT="$PWD/build/TestResults.xcresult"
rm -rf "$SHOTS" "$RESULT"
mkdir -p "$SHOTS"

echo "▶︎ 目的地：$DEST"
# TEST_RUNNER_ 前綴的變數會傳給測試程序：UI 測試把每一步截圖存到 build/screenshots/
TEST_RUNNER_SCREENSHOT_DIR="$SHOTS" \
xcodebuild -project MenuScanner.xcodeproj -scheme MenuScanner -destination "$DEST" \
  -resultBundlePath "$RESULT" test

echo "✔︎ 測試結果：$RESULT"
echo "✔︎ 截圖：$SHOTS"
ls -1 "$SHOTS" 2>/dev/null || true
