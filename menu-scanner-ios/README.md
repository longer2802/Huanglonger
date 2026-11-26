# 菜單掃描器（Menu Scanner）

iOS 17+ 原生 App：拍攝或選擇台灣飲料店、便當店菜單照片，在裝置上用 Apple Vision 辨識，整理成「品名＋規格＋價格」表格，校對後匯出 TXT／CSV。不連網、無帳號、無雲端。完整需求見 [SPEC.md](SPEC.md)。

> 目前進度：**階段一**（專案骨架、資料模型、OCR 服務、解析器與單元測試）。完整 README（模擬器操作、真機安裝、基準測試、匯入辦公室揪訂）會在階段四補齊。

## 專案結構

```
project.yml                     XcodeGen 設定（.xcodeproj 由它產生，不進版控）
App/                            SwiftUI App
  OCR/VisionTextRecognizer.swift  Vision 文字辨識（accurate、語言依 revision 檢查）
  OCR/ImagePreparation.swift      照片轉正、縮放、裁切、對比增強
  Views/ScanDebugView.swift       階段一驗證畫面（選照片 → 辨識 → 列出解析結果）
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
Tests/MenuScannerTests/         App 測試（模擬器上實際跑 Vision、方向與裁切座標）
Benchmarks/menus, answers/      基準測試圖片與標準答案（階段四）
```

## 編譯與測試（需要 macOS＋Xcode 15 以上）

```bash
brew install xcodegen          # 第一次
scripts/test.sh                # 產生專案，在最新的 iPhone 模擬器上編譯並跑全部測試
```

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
