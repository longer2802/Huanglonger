# 菜單掃描器（Menu Scanner）

iOS 17 以上的原生 App。拍攝或選擇台灣飲料店、便當店的菜單照片，在手機上用 Apple Vision 辨識，整理成「品名＋規格＋價格」表格；校對後可複製文字、匯出 TXT／CSV、匯出「辦公室揪訂」店家模板，並存進本機的店家菜單庫。

- 照片、辨識、解析、儲存、匯出都在裝置上完成，**不連網**；沒有帳號、API Key、雲端 AI、遙測或訂閱。
- 點餐、收款、多人協作仍在「辦公室揪訂」App（本 repo 的 `office-order-app/`）。
- 完整需求見 [SPEC.md](SPEC.md)。

## 功能

| 畫面 | 內容 |
|---|---|
| 首頁 | 拍攝菜單（裝置沒有相機時停用並說明）、選擇照片、貼上文字、店家菜單庫、繼續上次草稿、合成示範測試圖 |
| 確認照片 | 預覽、左右旋轉、拖曳四角裁切；提示把價格表頭拍清楚 |
| 辨識 | 背景執行；處理中／找不到可讀文字／錯誤；可取消、重試 |
| 校對 | 原圖／表格切換、原圖高亮來源位置、「只看待確認」與原因、單筆編輯（原圖片段、原文、詞庫建議與原文二選一、候選價格）、新增／刪除／確認、同品名新增規格、儲存草稿 |
| 單欄重掃 | 框選一欄（可選局部對比增強、顯示目前使用的影像範圍）→ 只比對範圍內品項 → 差異清單（新增／更新／衝突／沒讀到）勾選後套用；範圍外與已確認、手動修改的內容不會被自動改動 |
| 店家菜單庫 | SwiftData 本機儲存；搜尋店名或分店；每次存檔另存新版；舊版可查看、匯出，或「從這版編輯新稿」；內建標示「示範」的虛構飲料菜單 |
| 匯出 | 仍有待確認時先列清單（回去修正，或明確選擇只匯出已確認）；TXT、CSV、辦公室揪訂 JSON；預覽、複製、iOS 分享面板 |

## 在 Xcode 開啟與執行

需要 macOS、Xcode 15 以上（iOS 17 SDK）與 [XcodeGen](https://github.com/yonaskolb/XcodeGen)。`.xcodeproj` 由 `project.yml` 產生，不進版控。

```bash
brew install xcodegen
cd menu-scanner-ios
xcodegen generate
open MenuScanner.xcodeproj
```

### 在模擬器執行

1. Xcode 上方選 **MenuScanner** scheme 與任一 iPhone 模擬器（iOS 17 以上），按 ⌘R。
2. 模擬器沒有相機：用「選擇照片」（可先把菜單圖片拖進模擬器視窗存進相簿），或首頁最下方的「使用示範測試圖（合成・虛構店家）」。
3. 流程：示範測試圖 → 開始辨識 → 校對（點一列修改、或右上角選單「存入店家菜單庫」「框選單欄重掃」）→ 下方「匯出 TXT／CSV」。

### 安裝到 iPhone

1. iPhone 用線接上 Mac，在 iPhone 上開啟「設定 › 隱私權與安全性 › 開發者模式」（第一次需要重新開機）。
2. Xcode 點 MenuScanner target › **Signing & Capabilities**，Team 選你的 Apple ID（免費帳號也可以；Bundle ID 若衝突，把 `project.yml` 的 `PRODUCT_BUNDLE_IDENTIFIER` 改成自己的再 `xcodegen generate`）。
3. 上方裝置選你的 iPhone，按 ⌘R。第一次執行時到 iPhone「設定 › 一般 › VPN 與裝置管理」信任開發者。
4. 免費帳號安裝的 App 7 天後需要重新從 Xcode 安裝一次。

## 測試

```bash
scripts/test.sh                                  # 產生專案，在最新的 iPhone 模擬器上編譯並跑全部測試
cd Packages/MenuScannerKit && swift test         # 只跑解析器等核心測試（macOS，不需要模擬器）
```

- `MenuScannerCoreTests`：解析器（單價便當、雙欄同價、大杯在前、品名換行、缺杯型、價格模糊、無表頭雙價、雜訊不當售價、詞庫保留原文）、TXT／CSV（繁體、逗號與雙引號、BOM）、草稿編輯、單欄重掃合併、示範菜單與範例檔、辦公室揪訂格式、基準評分。
- `MenuScannerTests`：模擬器上實際跑 Vision（方向、裁切座標、示範圖）、草稿存取、店家菜單庫（重開資料庫後仍能載入、版本、示範菜單）。
- `MenuScannerUITests`：選測試圖 → 辨識 → 修正一筆 → 匯出 CSV（每步截圖）；店家菜單庫示範菜單 → 從舊版編輯 → 另存新版。
- `scripts/test.sh` 會把 UI 測試截圖存到 `build/screenshots/`，完整結果在 `build/TestResults.xcresult`。

## 基準測試（準確率驗收）

```bash
scripts/benchmark.sh                 # 全部圖片
scripts/benchmark.sh --only 合成     # 只跑檔名含「合成」的圖
```

在 macOS 上用 Apple Vision 辨識 `Benchmarks/menus/` 的每張圖、套用與 App 相同的解析器，和 `Benchmarks/answers/` 的標準答案比對，報告寫到 `Benchmarks/results/`（`latest.md`、`report-時間.md`、`report-時間.csv`）。

> macOS 與 iOS 的 Vision 模型版本可能略有差異；正式驗收數字以 macOS 工具為準即可，若要確認手機上的結果，可用 App 辨識同一張圖後匯出 CSV 對照。

### 放入真實菜單

1. 圖片放在 `Benchmarks/menus/`（png、jpg、heic 皆可），例如 `五十嵐-信義店-實拍.jpg`。
2. 標準答案放在 `Benchmarks/answers/`，**檔名相同、副檔名 .csv**，例如 `五十嵐-信義店-實拍.csv`。
3. 在 `Benchmarks/manifest.csv` 加一列：`檔名,版型,用途,來源`。

**標準答案 CSV 格式**（UTF-8，可含 BOM；欄位依表頭名稱判斷，順序不拘，多餘欄位忽略）：

```csv
品名,規格,價格
紅茶,中杯,30
紅茶,大杯,35
雞腿便當,單一,110
```

- 每個規格一列；單一價格寫「單一」（或留空）。規格會正規化：「中」＝「中杯」、「m」＝「M」、「700ML」＝「700ml」。
- 未供應的杯型、看不出價格的品項不要寫進答案。
- 也可以直接用 App 匯出的 CSV（`店家,分店,分類,品名,規格,價格`）當標準答案，再人工修正。
- 以 `#` 開頭的品名視為註解。

**manifest.csv**：

| 欄位 | 說明 |
|---|---|
| 檔名 | `menus/` 裡的檔名（含副檔名） |
| 版型 | 自由分組，例如「截圖」「手機實拍」「多欄」「大小杯分欄」，報告會分版型列出 |
| 用途 | 「調整」＝用來調規則；「保留」＝**不可用來調規則**的驗收組 |
| 來源 | 「真實」或「合成」 |

沒寫在 manifest 的圖：檔名以「合成」開頭視為合成，其餘視為真實。

### 兩項指標怎麼看

每個規格獨立算一筆；**品名、規格、價格三欄完全相符**才算正確；同一筆標準答案只配對一次；待確認的筆數不算正確（因為需要人工處理）。

| 指標 | 算法 | 低的時候代表 |
|---|---|---|
| **正確 ÷ 標準答案** | 自動完成且正確 ÷ 標準答案筆數 | 漏抓多，或太多筆被標成待確認 |
| **正確 ÷ 自動完成** | 自動完成且正確 ÷ App 自動判定完成（非待確認）的筆數 | App「很有把握」卻填錯——最需要避免，因為使用者可能不會再檢查 |

驗收目標：用 20～30 張實際菜單（截圖、手機實拍、多欄、大小杯分欄），**兩項都 ≥ 90%**，並分版型列出。請保留一批「用途＝保留」的菜單不用來調規則，以它的數字作為最終驗收。

報告同時列出漏抓、多抓明細，方便調整 `Packages/MenuScannerKit/Sources/MenuScannerCore/` 的規則後重跑。

### 合成資料

`Benchmarks/menus/合成-*.png` 是用 `Benchmarks/tools/make_synthetic.py` 產生的虛構菜單（單價便當、雙欄同價、大杯在前與缺杯型與品名換行、行內 M／L 與容量欄、雜訊與促銷、模糊傾斜），只用來驗證工具與規則。報告的「合成資料」區塊會標示 **「合成資料，非真實驗收」**，**不可用來宣稱達到 90%**。

## 匯出格式

| 格式 | 內容 |
|---|---|
| TXT | UTF-8，每行一筆：`蜜桃烏龍｜大杯｜65 元`；單一價格規格寫「單一」 |
| CSV | UTF-8 with BOM（Excel 直接開不亂碼）、CRLF；欄位 `店家,分店,分類,品名,規格,價格`；價格只輸出整數；含逗號、雙引號、換行的欄位依 RFC 4180 加引號 |
| 辦公室揪訂 | JSON，辦公室揪訂「匯入還原」格式，只含一個店家模板 |

- 檔名：`店家_分店_校對日期.csv`（沒有分店就省略），辦公室揪訂為 `店家_分店_日期_辦公室揪訂.json`。
- 只匯出「自動完成／已確認／已修改，且有品名與價格」的品項，絕不帶入待確認價格。
- 範例檔：[`Samples/示範菜單.csv`](Samples/示範菜單.csv)、[`Samples/示範菜單.txt`](Samples/示範菜單.txt)、[`Samples/示範菜單_辦公室揪訂.json`](Samples/示範菜單_辦公室揪訂.json)（內建示範菜單的匯出結果，測試會檢查它們與程式輸出一致）。

## 匯入「辦公室揪訂」

辦公室揪訂（`office-order-app/`）沒有 CSV 匯入功能；它的「資料備份 › 匯入還原」讀 JSON 備份檔，其中的店家模板就是菜單。所以：

1. 在菜單掃描器匯出時選 **「辦公室揪訂」** 格式，用分享面板存到「檔案」或 AirDrop 到電腦。
2. 開啟辦公室揪訂，首頁「資料備份」按 **「匯入還原」**，選這個 JSON 檔。
3. 匯入後在「店家模板」會出現 `店名（分店）`，揪團時直接載入。

這個檔案只含一個模板、沒有訂單與照片；辦公室揪訂匯入時只會新增或更新這個模板（同一家店再次匯入會更新同一個模板），其他訂單和模板不受影響。

欄位對應：

| 菜單掃描器 | 辦公室揪訂 |
|---|---|
| 店家＋分店 | `vendorName`（`店名（分店）`） |
| 分類（飲料／餐點） | `kind`（`drink`／`meal`） |
| 分類（品項分類） | `items[].category` |
| 品名 | `items[].name`（同品名多規格合併成一個品項） |
| 規格 | `items[].variants[].label`（「單一」→ 空字串） |
| 價格 | `items[].variants[].price` |
| 校對日期 | `savedAt` |

若要人工整理或匯入其他系統，CSV 欄位 `店家,分店,分類,品名,規格,價格` 可直接對應上表。

## 專案結構

```
project.yml                       XcodeGen 設定
App/
  MenuScannerApp.swift            進入點、SwiftData 容器、導航
  Model/AppModel.swift            導航、辨識狀態、草稿存檔、從舊版編輯
  Model/SampleMenu.swift          合成示範測試圖
  Library/                        店家菜單庫（SwiftData 模型、畫面）
  OCR/ImagePreparation.swift      照片轉正、旋轉（裁切／對比增強在 MenuScannerVision）
  Views/                          首頁、確認照片、校對、單筆編輯、單欄重掃、匯出
Packages/MenuScannerKit/
  Sources/MenuScannerCore/        解析規則與資料模型（只依賴 Foundation，與 UI／Vision 解耦）
    LayoutParser / PlainTextParser / Tokenizer / TextRules / PriceAssignment
    MenuDraft（編輯規則）/ MenuExporter / OfficeOrderExporter / RescanMerger / DemoMenu / Benchmark
  Sources/MenuScannerVision/      Apple Vision 辨識（App 與基準工具共用）
  Sources/MenuBenchmark/          menu-benchmark 命令列工具
  Tests/MenuScannerCoreTests/     核心單元測試（固定 OCR 座標，不需要 Vision）
Tests/MenuScannerTests/           App 測試
Tests/MenuScannerUITests/         UI 流程測試
Benchmarks/                       menus/、answers/、manifest.csv、tools/make_synthetic.py
Samples/                          範例 CSV／TXT／辦公室揪訂 JSON
scripts/test.sh, benchmark.sh
```

## 解析規則重點

- 排除整行：電話、地址、日期／營業時間、網址社群、著作權、獨立的甜度冰量表（「無糖綠茶」等品名不會被誤刪）。
- 加料、買一送一、第二杯、加價等：放待確認，不覆蓋基本價格。
- 以「所有字塊都沒覆蓋的垂直空白帶」切欄，價格只配對同一區塊內左側、垂直位置最近的品名，隔壁欄的數字不會跨欄。
- 規格依該列上方最近的表頭（中杯／大杯／M／L／容量）與 x 座標決定，支援表頭從大杯排到中杯、「—」未供應、某杯型空白；容量不當售價。
- 兩個價格（或「55/65」）但沒有表頭：保留候選價格、規格留空、待確認，不猜。
- 看不清楚的價格（如「6O」）：價格留空、待確認，不補 0。
- 誤字詞庫（`TypoLexicon.standard`）只提供建議，`originalName` 永遠保留 OCR 原文。

## 尚待實機確認

- 真機相機拍照、相簿權限提示與大尺寸照片（4800 萬畫素）的辨識速度與記憶體。
- 真實菜單（反光、手寫、直書、海報字體）的準確率：目前只有合成資料，**尚未以真實菜單驗收 90%**。
- iOS 與 macOS 的 Vision 辨識結果差異。
- 分享面板存檔、AirDrop 到辦公室揪訂的實際匯入。
