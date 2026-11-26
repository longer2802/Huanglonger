import Foundation
import MenuScannerCore
#if canImport(Vision)
import MenuScannerVision
#endif

/// 菜單辨識基準測試（macOS，直接使用 Apple Vision）。
///
///     swift run -c release --package-path Packages/MenuScannerKit menu-benchmark --root Benchmarks
///
/// 讀 <root>/menus 的圖片與 <root>/answers 同名 .csv 標準答案，<root>/manifest.csv 標示版型、用途、來源，
/// 輸出每張圖的正確、漏抓、多抓、待確認筆數與處理時間，以及兩項指標，寫到 <root>/results/。
@main
struct BenchmarkCommand {
    static let imageExtensions: Set<String> = ["png", "jpg", "jpeg", "heic", "heif", "tif", "tiff"]

    static func main() async {
        #if canImport(Vision)
        var root = URL(fileURLWithPath: "Benchmarks")
        var out: URL?
        var only: String?
        var draft = false
        var dump = false
        var ocr = VisionTextRecognizer.Options()
        var args = CommandLine.arguments.dropFirst().makeIterator()
        while let a = args.next() {
            switch a {
            case "--root": if let v = args.next() { root = URL(fileURLWithPath: v) }
            case "--out": if let v = args.next() { out = URL(fileURLWithPath: v) }
            case "--only": only = args.next()
            case "--draft": draft = true
            case "--dump": dump = true
            case "--ocr-correction": ocr.languageCorrection = true
            case "--tiles": if let v = args.next(), let n = Int(v) { ocr.tiles = max(1, min(4, n)); ocr.autoTile = false }
            case "--no-auto-tile": ocr.autoTile = false
            case "-h", "--help":
                print("用法：menu-benchmark [--root Benchmarks] [--out Benchmarks/results] [--only 檔名關鍵字] [--draft]")
                print("  --ocr-correction：開啟 Vision 語言校正；--tiles N：切成 N×N 區塊辨識（OCR 實驗用）")
                print("  --dump：把原始 OCR 行（座標與文字）寫到 <out>/ocr/<檔名>.txt")
                print("  --draft：替還沒有標準答案的圖產生 answers/<檔名>.draft.csv，人工對照原圖修正後改名為 <檔名>.csv")
                return
            default:
                FileHandle.standardError.write(Data("未知參數：\(a)\n".utf8))
            }
        }
        let outDir = out ?? root.appendingPathComponent("results")
        let fm = FileManager.default
        let menusDir = root.appendingPathComponent("menus")
        let answersDir = root.appendingPathComponent("answers")
        let manifest = (try? String(contentsOf: root.appendingPathComponent("manifest.csv"), encoding: .utf8))
            .map(ManifestEntry.parse) ?? [:]

        let files = ((try? fm.contentsOfDirectory(atPath: menusDir.path)) ?? [])
            .filter { imageExtensions.contains(($0 as NSString).pathExtension.lowercased()) }
            .filter { only == nil || $0.contains(only!) }
            .sorted()
        if files.isEmpty {
            print("在 \(menusDir.path) 找不到圖片。")
        }

        var results: [BenchmarkImageResult] = []
        let recognizer = VisionTextRecognizer(options: ocr)
        print("OCR 設定：\(ocr.label)")
        for file in files {
            let base = (file as NSString).deletingPathExtension
            let m = manifest[file] ?? ManifestEntry.fallback(file: file)
            let answerURL = answersDir.appendingPathComponent(base + ".csv")
            guard let answerText = try? String(contentsOf: answerURL, encoding: .utf8) else {
                if draft {
                    await writeDraft(file: file, base: base, menusDir: menusDir, answersDir: answersDir, recognizer: recognizer)
                } else {
                    print("⚠︎ 略過 \(file)：找不到標準答案 answers/\(base).csv（可加 --draft 產生草稿）")
                }
                continue
            }
            let answers: [AnswerRow]
            do {
                answers = try AnswerCSV.parse(answerText, file: base + ".csv")
            } catch {
                print("⚠︎ 略過 \(file)：\(error.localizedDescription)")
                continue
            }
            let started = Date()
            var entries: [MenuEntry] = []
            var errorText: String?
            if let image = VisionImageTools.loadUpright(url: menusDir.appendingPathComponent(file)) {
                do {
                    let doc = try await recognizer.recognize(image, region: nil, enhanceContrast: false, lineIDOffset: 0)
                    entries = MenuParser.parse(doc).entries
                    print("  Vision revision \(doc.revision)，語言 \(doc.languages.joined(separator: ","))，\(doc.lines.count) 行")
                    if dump {
                        var t = "# \(file)  revision \(doc.revision)  \(doc.languages.joined(separator: ","))\n"
                        for l in doc.lines {
                            t += String(format: "%3ld  x%.3f y%.3f w%.3f h%.3f  ", l.id, l.box.x, l.box.y, l.box.width, l.box.height)
                            t += l.text + (l.wordBoxes == nil ? "" : "  [逐字框 \(l.wordBoxes!.count)]") + "\n"
                        }
                        let dir = outDir.appendingPathComponent("ocr")
                        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
                        try? Data(t.utf8).write(to: dir.appendingPathComponent(base + ".txt"))
                    }
                } catch {
                    errorText = error.localizedDescription
                }
            } else {
                errorText = "無法讀取圖片"
            }
            let seconds = Date().timeIntervalSince(started)
            let score = BenchmarkScorer.score(answers: answers, entries: entries)
            results.append(BenchmarkImageResult(manifest: m, score: score, seconds: seconds, error: errorText))
            print(String(format: "%@  正確 %d／標準答案 %d，自動完成 %d，待確認 %d（%.2f 秒）",
                         file, score.correct, score.answers, score.autoCompleted, score.pending, seconds))
        }

        if draft && results.isEmpty { return }
        let report = BenchmarkReport.markdown(results)
        do {
            try fm.createDirectory(at: outDir, withIntermediateDirectories: true)
            let stamp = { () -> String in
                let f = DateFormatter()
                f.locale = Locale(identifier: "en_US_POSIX")
                f.dateFormat = "yyyyMMdd-HHmmss"
                return f.string(from: Date())
            }()
            try Data(report.utf8).write(to: outDir.appendingPathComponent("report-\(stamp).md"))
            try BenchmarkReport.csv(results).write(to: outDir.appendingPathComponent("report-\(stamp).csv"))
            try Data(report.utf8).write(to: outDir.appendingPathComponent("latest.md"))
            print("\n報告：\(outDir.appendingPathComponent("report-\(stamp).md").path)\n")
        } catch {
            print("無法寫入報告：\(error.localizedDescription)")
        }
        print(report)
        #else
        print("menu-benchmark 需要 Apple Vision，請在 macOS 上執行。")
        #endif
    }

    #if canImport(Vision)
    /// 標準答案草稿：App 的辨識結果（含待確認），給人工逐筆對照原圖修正。
    static func writeDraft(file: String, base: String, menusDir: URL, answersDir: URL, recognizer: VisionTextRecognizer) async {
        guard let image = VisionImageTools.loadUpright(url: menusDir.appendingPathComponent(file)) else {
            print("⚠︎ \(file)：無法讀取圖片")
            return
        }
        do {
            let doc = try await recognizer.recognize(image, region: nil, enhanceContrast: false, lineIDOffset: 0)
            let entries = MenuParser.parse(doc).entries
            var rows = [["品名", "規格", "價格", "草稿備註（核對後整欄可刪）"]]
            for e in entries {
                let price = e.price.map(String.init) ?? e.candidatePrices.map(String.init).joined(separator: "/")
                let note = e.needsReview ? "待確認：" + e.reasons.map(\.message).joined(separator: "；") : ""
                rows.append([e.suggestedName ?? e.name, e.size.isEmpty ? SizeLabel.single : e.size, price, note])
            }
            let text = rows.map { $0.map(MenuExporter.csvField).joined(separator: ",") }.joined(separator: "\r\n") + "\r\n"
            try FileManager.default.createDirectory(at: answersDir, withIntermediateDirectories: true)
            let url = answersDir.appendingPathComponent(base + ".draft.csv")
            try (Data(MenuExporter.utf8BOM) + Data(text.utf8)).write(to: url)
            print("✎ \(file)：草稿 \(entries.count) 筆 → answers/\(base).draft.csv（請對照原圖修正，改名為 \(base).csv）")
        } catch {
            print("⚠︎ \(file)：\(error.localizedDescription)")
        }
    }
    #endif
}
