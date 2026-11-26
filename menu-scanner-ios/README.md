# 菜單掃描器（Menu Scanner）

iOS 17+ 原生 App：拍攝或選擇台灣飲料店、便當店菜單照片，在裝置上用 Apple Vision 辨識，整理成「品名＋規格＋價格」表格，校對後匯出 TXT／CSV。不連網、無帳號、無雲端。完整需求見 [SPEC.md](SPEC.md)。

> 目前進度：**階段二**（首頁、辨識流程、校對畫面、TXT／CSV 匯出）。完整 README（真機安裝、基準測試、匯入辦公室揪訂）會在階段四補齊。

## 專案結構

```
project.yml                     XcodeGen 設定（.xcodeproj 由它產生，不進版控）
App/                            SwiftUI App
  OCR/VisionTextRecognizer.swift  Vision 文字辨識（accurate、語言依 revision 檢查）
  OCR/ImagePreparation.swift      照片轉正、縮放、裁切、對比增強
  Model/AppModel.swift            導航、辨識狀態（處理中／成功／找不到文字／錯誤、可取消重試）、草稿存檔
  Model/SampleMenu.swift          合成示範測試圖（虛構店家，模擬器沒有相機時使用）
  Views/HomeView.swift            首頁：拍攝菜單、選擇照片、貼上文字、店家菜單庫、示範測試圖
  Views/PrepareView.swift         預覽、旋轉、裁切、開始辨識；原圖高亮元件
  Views/ReviewView.swift          校對：原圖／表格切換、只看待確認、新增／刪除／確認
  Views/EntryEditorView.swift     單筆校對：原圖片段、原文、詞庫建議、候選價格、同品名新增規格
  Views/ExportView.swift          匯出：待確認清單、只匯出已確認、TXT／CSV 預覽、複製、分享面板
Packages/MenuScannerKit/        解析規則（只依賴 Foundation，與 UI／Vision 解耦）
  Sources/MenuScannerCore/
    Models.swift                  OCR 結果、MenuEntry（一品名＋一規格＋一價格）、待確認原因
    Geometry.swift                正規化座標、Vision 座標換算、語言選擇
    TextRules.swift               全形／價格／規格正規化、雜訊過濾、誤字詞庫
    Tokenizer.swift               一行文字切成品名、價格、表頭、容量
    LayoutParser.swift            有座標的版面解析（分欄、列配對、表頭對應）
    PlainTextParser.swift         貼上純文字的解析
    PriceAssignment.swift         價格 → 杯型對應（對不上就留空待確認）
  Tests/MenuScannerCoreTests/   解析器單元測試（用固定 OCR 座標，不需要 Vision）
Tests/MenuScannerTests/         App 測試（模擬器上實際跑 Vision、方向與裁切座標、示範圖流程、草稿存取）
Tests/MenuScannerUITests/       UI 流程測試：選測試圖 → 辨識 → 修正一筆 → 匯出 CSV（每步截圖）
Benchmarks/menus, answers/      基準測試圖片與標準答案（階段四）
```

## 編譯與測試（需要 macOS＋Xcode 15 以上）

```bash
brew install xcodegen          # 第一次
scripts/test.sh                # 產生專案，在最新的 iPhone 模擬器上編譯並跑全部測試
```

`scripts/test.sh` 會把 UI 流程測試每一步的截圖存到 `build/screenshots/`（01-首頁 … 09-分享面板），完整結果在 `build/TestResults.xcresult`（可用 Xcode 開啟）。

也可以只跑解析器測試（不用模擬器）：

```bash
cd Packages/MenuScannerKit && swift test
```

在 Xcode 開啟：`xcodegen generate && open MenuScanner.xcodeproj`，選 MenuScanner scheme 與 iPhone 模擬器後按 ⌘R 執行、⌘U 測試。

## 解析規則重點

- 排除整行：電話、地址、日期／營業時間、網址社群、著作權、獨立的甜度冰量表（「無糖綠茶」等品名不會被誤刪）。
- 加料、買一送一、第二杯、加價等：放待確認，不覆蓋基本價格。
- 以「所有字塊都沒覆蓋的垂直空白帶」切欄，價格只配對同一區塊內左側、垂直位置最近的品名，隔壁欄的數字不會跨欄。
- 規格依該列上方最近的表頭（中杯／大杯／M／L／容量）與 x 座標決定，支援表頭從大杯排到中杯、「—」表示未供應、某杯型空白。
- 兩個價格（或「55/65」）但沒有表頭：保留候選價格、規格留空、待確認，不猜。
- 看不清楚的價格（如「6O」）：價格留空、待確認，不補 0。
- 誤字詞庫（`TypoLexicon.standard`）只提供建議，`originalName` 永遠保留 OCR 原文。

## 匯出格式

- **TXT**：UTF-8，每行一筆，例如 `蜜桃烏龍｜大杯｜65 元`；單一價格的規格寫「單一」。
- **CSV**：UTF-8 with BOM、CRLF 換行，欄位 `店家,分店,分類,品名,規格,價格`；價格只輸出整數；含逗號、雙引號、換行的欄位依 RFC 4180 加引號。
- **檔名**：`店家_分店_校對日期.csv`（沒有分店就省略）。
- 只匯出「自動完成／已確認／已修改，且有品名與價格」的品項。仍有待確認時會先列出清單，讓你回去修正，或明確選「只匯出已確認品項」。
