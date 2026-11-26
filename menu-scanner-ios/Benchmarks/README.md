# 真實菜單收集與驗收指南

目標：20～30 張實際菜單，**正確÷標準答案 ≥ 90%** 且 **正確÷自動完成 ≥ 90%**，用不曾拿來調規則的 holdout 組驗收。

## 你需要做的事（每張菜單約 10 分鐘）

### 1. 收集照片：照下表湊齊版型

| 版型（manifest 的「版型」欄照抄） | 建議張數 | 例子 |
|---|---:|---|
| 截圖 | 6 | Google 地圖、Uber Eats、LINE 官方帳號、店家 IG 的菜單圖（像麻古那張） |
| 手機實拍 | 8 | 店門口或櫃檯的紙本／燈箱菜單，正面拍、不要太斜 |
| 多欄 | 5 | 一張圖有 2～3 欄品項 |
| 大小杯分欄 | 5 | 中杯／大杯、M／L、L／瓶 分兩欄價格 |
| 單價餐點 | 4 | 便當、麵店、早餐店，一個品項一個價格 |

- 一家店可以有多張（例如同一家的截圖和實拍），但同一張圖不要放兩次。
- 拍攝時把整張菜單拍進去，尤其價格表頭（中杯／大杯）要清楚。故意拍一些反光、角度歪的也沒關係，那才是真實情況。

### 2. 放檔案

公開 repo 不適合放別人有著作權的菜單照片，所以真實菜單請放在 **`Benchmarks/private/`**（已設為不進 git），結構跟 `Benchmarks/` 一樣：

```
Benchmarks/private/
  menus/    五十嵐-信義店-截圖.jpg
  answers/  五十嵐-信義店-截圖.csv
  manifest.csv
```

`manifest.csv`（UTF-8，可用 Excel 存成「CSV UTF-8」）：

```csv
檔名,版型,用途,來源
五十嵐-信義店-截圖.jpg,截圖,,真實
```

「用途」先留空，分 holdout 時腳本會自動填。

### 3. 做標準答案：先產生草稿，再對照照片修正

```bash
BENCH_ROOT=Benchmarks/private scripts/benchmark.sh --draft
```

這會替每張還沒有答案的圖產生 `answers/<檔名>.draft.csv`（App 的辨識結果）。用 Excel 或 Numbers 打開，**一列一列對照照片**：

- 每個規格一列：`品名,規格,價格`。單一價格的規格寫「單一」。
- 刪掉多抓的（電話、加料、促銷、甜度表），補上漏抓的，改正錯字、錯價。
- 沒供應的杯型（「-」或空白）不要寫；看不清楚的價格整列刪掉。
- 「草稿備註」欄可以整欄刪掉（不刪也不影響）。
- 存成 `answers/<檔名>.csv`（拿掉 `.draft`）。

> 草稿只是省打字。標準答案一定要以**照片為準**，不能因為草稿這樣寫就照抄，否則會把 App 的錯誤當成正確答案。holdout 組尤其要仔細。

### 4. 分出 holdout（只做一次）

```bash
python3 Benchmarks/tools/split_holdout.py --root Benchmarks/private --dry-run
python3 Benchmarks/tools/split_holdout.py --root Benchmarks/private
```

約 1/3 會移到 `Benchmarks/private/holdout/`，之後調規則都不會讀它。

### 5. 跑調整組，把報告交給 Claude

```bash
BENCH_ROOT=Benchmarks/private scripts/benchmark.sh
```

把 `Benchmarks/private/results/latest.md` 的內容貼給 Claude（只有文字：品名、價格、漏抓／多抓明細，不含照片）。Claude 依明細改規則、推到 GitHub，CI 會自動編譯測試；你 `git pull` 後再跑一次，重複到調整組穩定。

### 6. 正式驗收（只跑一次）

規則定案後：

```bash
BENCH_ROOT=Benchmarks/private scripts/benchmark.sh --holdout
```

`Benchmarks/private/holdout/RUNS.md` 會記錄時間與規則版本。報告分版型列出兩項指標，就是正式驗收結果。

## 如果想讓 Claude 全自動處理

把真實菜單直接放在 `Benchmarks/menus/` 與 `answers/` 並推上 GitHub，GitHub Actions（macOS）會自動跑基準，Claude 可以直接讀結果、改規則、再跑，你只需要做標準答案。代價是這些照片會公開在 repo 上，所以有兩種做法：

1. 把 repo 改成私有（GitHub › Settings › Danger Zone › Change visibility）。私有 repo 的 macOS runner 會用到免費額度（每月 2,000 分鐘、macOS 以 10 倍計，約可跑 15～20 次），超過要付費。
2. 只放你自己拍、自己有權使用的照片。

正式驗收：在 commit 訊息加上 `[holdout]`，CI 會另外跑一次 holdout 並列出結果。

## 合成資料

`Benchmarks/menus/合成-*.png` 由 `tools/make_synthetic.py` 產生，只驗證工具與規則，報告會標示「合成資料，非真實驗收」，不能拿來宣稱達到 90%。
