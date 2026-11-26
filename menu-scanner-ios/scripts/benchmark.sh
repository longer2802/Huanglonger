#!/usr/bin/env bash
# 菜單辨識基準測試（macOS，使用 Apple Vision）。
#
# 調整規則時：scripts/benchmark.sh [--only 關鍵字]
#   讀 Benchmarks/menus＋answers（不含 holdout），報告寫到 Benchmarks/results/。
#
# 正式驗收（只跑一次）：scripts/benchmark.sh --holdout
#   讀 Benchmarks/holdout/menus＋answers，報告寫到 Benchmarks/results/holdout/，
#   並在 Benchmarks/holdout/RUNS.md 記錄時間與規則版本（git commit）。
#   已經跑過時會拒絕，除非加 --force（會在紀錄中註明重跑）。
set -euo pipefail
cd "$(dirname "$0")/.."

HOLDOUT=0
FORCE=0
ARGS=()
for a in "$@"; do
  case "$a" in
    --holdout) HOLDOUT=1 ;;
    --force) FORCE=1 ;;
    *) ARGS+=("$a") ;;
  esac
done

if [ "$HOLDOUT" = 1 ]; then
  ROOT="$PWD/Benchmarks/holdout"
  OUT="$PWD/Benchmarks/results/holdout"
  LOG="$ROOT/RUNS.md"
  if [ ! -d "$ROOT/menus" ] || [ -z "$(ls -A "$ROOT/menus" 2>/dev/null)" ]; then
    echo "Benchmarks/holdout/menus 是空的：請先執行 python3 Benchmarks/tools/split_holdout.py" >&2
    exit 1
  fi
  if [ -f "$LOG" ] && grep -q "正式驗收" "$LOG" && [ "$FORCE" != 1 ]; then
    echo "holdout 已經正式驗收過（見 $LOG）。holdout 只應跑一次；確定要重跑請加 --force。" >&2
    exit 1
  fi
  if ! git diff --quiet -- Packages/MenuScannerKit/Sources 2>/dev/null; then
    echo "解析規則有未提交的修改：請先 commit，讓驗收紀錄對得上規則版本。" >&2
    exit 1
  fi
  COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
  {
    [ -f "$LOG" ] || printf '# holdout 正式驗收紀錄\n\n'
    printf -- '- %s　正式驗收%s　規則版本 %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$([ "$FORCE" = 1 ] && echo '（重跑）')" "$COMMIT"
  } >> "$LOG"
else
  ROOT="$PWD/Benchmarks"
  OUT="$PWD/Benchmarks/results"
fi

swift run -c release --package-path Packages/MenuScannerKit menu-benchmark \
  --root "$ROOT" --out "$OUT" ${ARGS[@]+"${ARGS[@]}"}
