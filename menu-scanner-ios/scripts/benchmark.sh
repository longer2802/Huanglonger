#!/usr/bin/env bash
# 菜單辨識基準測試（macOS，使用 Apple Vision）。
# 讀 Benchmarks/menus（圖片）與 Benchmarks/answers（同名 .csv 標準答案），
# 報告寫到 Benchmarks/results/（report-時間.md、report-時間.csv、latest.md）。
# 用法：scripts/benchmark.sh               全部
#       scripts/benchmark.sh --only 合成     只跑檔名含「合成」的圖
set -euo pipefail
cd "$(dirname "$0")/.."
swift run -c release --package-path Packages/MenuScannerKit menu-benchmark \
  --root "$PWD/Benchmarks" --out "$PWD/Benchmarks/results" "$@"
