#!/usr/bin/env python3
"""把約 1/3 的真實菜單移到 Benchmarks/holdout/（正式驗收組，不得用來調整規則）。

規則：
- 只動 manifest 來源為「真實」、且用途不是「調整」的菜單；用途已標「調整」的（例如已經拿來調過規則的）永遠留在調整組。
- 依「版型」分層抽樣，每個版型約 1/3（四捨五入、至少 1 張，只有 1 張的版型留在調整組）。
- 抽樣以檔名雜湊排序，結果固定、可重現；不依賴亂數。
- holdout 已有內容時拒絕重新分割（避免看過結果後換一批）。

用法：python3 Benchmarks/tools/split_holdout.py [--dry-run]
"""
import argparse
import csv
import hashlib
import io
import os
import shutil
import sys
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOLD = os.path.join(ROOT, "holdout")
FIELDS = ["檔名", "版型", "用途", "來源"]


def read_manifest(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("檔名") or "").strip() and not r["檔名"].startswith("#")]
    for r in rows:
        for k in FIELDS:
            r[k] = (r.get(k) or "").strip()
    return rows


def write_manifest(path, rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=FIELDS, lineterminator="\r\n", extrasaction="ignore")
    w.writeheader()
    w.writerows(rows)
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        f.write(buf.getvalue())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if os.path.isdir(os.path.join(HOLD, "menus")) and os.listdir(os.path.join(HOLD, "menus")):
        sys.exit("Benchmarks/holdout/menus 已有菜單：不重新分割。要重來請先人工確認並移回。")

    manifest_path = os.path.join(ROOT, "manifest.csv")
    rows = read_manifest(manifest_path)
    listed = {r["檔名"] for r in rows}
    exts = {".png", ".jpg", ".jpeg", ".heic", ".heif", ".tif", ".tiff"}
    for name in sorted(os.listdir(os.path.join(ROOT, "menus"))):
        if os.path.splitext(name)[1].lower() in exts and name not in listed:
            rows.append({"檔名": name, "版型": "未分類", "用途": "", "來源": "合成" if name.startswith("合成") else "真實"})
            print(f"＋ manifest 沒有 {name}，以「未分類／真實」加入（請之後補版型）")

    candidates = [r for r in rows if "真實" in r["來源"] and r["用途"] != "調整"]
    if not candidates:
        sys.exit("沒有可分割的真實菜單（來源＝真實、用途不是「調整」）。")

    by_layout = defaultdict(list)
    for r in candidates:
        by_layout[r["版型"] or "未分類"].append(r)

    chosen = []
    for layout, items in sorted(by_layout.items()):
        items.sort(key=lambda r: hashlib.sha256(r["檔名"].encode()).hexdigest())
        k = round(len(items) / 3) if len(items) >= 2 else 0
        k = max(k, 1) if len(items) >= 2 else 0
        chosen += items[:k]
        print(f"版型「{layout}」：{len(items)} 張 → holdout {k} 張")

    chosen_names = {r["檔名"] for r in chosen}
    total_real = len([r for r in rows if "真實" in r["來源"]])
    print(f"\n真實菜單共 {total_real} 張；移到 holdout {len(chosen)} 張：")
    for r in chosen:
        print(f"  - {r['檔名']}（{r['版型']}）")

    missing_answers = [r["檔名"] for r in chosen
                       if not os.path.exists(os.path.join(ROOT, "answers", os.path.splitext(r["檔名"])[0] + ".csv"))]
    if missing_answers:
        sys.exit(f"\n以下菜單沒有標準答案，請先補齊：{missing_answers}")
    if args.dry_run:
        print("\n（--dry-run：沒有移動任何檔案）")
        return

    for sub in ("menus", "answers"):
        os.makedirs(os.path.join(HOLD, sub), exist_ok=True)
    for r in chosen:
        base = os.path.splitext(r["檔名"])[0]
        shutil.move(os.path.join(ROOT, "menus", r["檔名"]), os.path.join(HOLD, "menus", r["檔名"]))
        shutil.move(os.path.join(ROOT, "answers", base + ".csv"), os.path.join(HOLD, "answers", base + ".csv"))
        r["用途"] = "保留"
    for r in rows:
        if r["檔名"] not in chosen_names and "真實" in r["來源"] and not r["用途"]:
            r["用途"] = "調整"

    write_manifest(manifest_path, [r for r in rows if r["檔名"] not in chosen_names])
    write_manifest(os.path.join(HOLD, "manifest.csv"), chosen)
    print("\n完成。之後調規則只跑 scripts/benchmark.sh（不會讀 holdout）；"
          "規則定案後執行一次 scripts/benchmark.sh --holdout 作為正式驗收。")


if __name__ == "__main__":
    main()
