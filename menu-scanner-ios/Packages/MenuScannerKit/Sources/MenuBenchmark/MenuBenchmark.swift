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
        var args = CommandLine.arguments.dropFirst().makeIterator()
        while let a = args.next() {
            switch a {
            case "--root": if let v = args.next() { root = URL(fileURLWithPath: v) }
            case "--out": if let v = args.next() { out = URL(fileURLWithPath: v) }
            case "--only": only = args.next()
            case "-h", "--help":
                print("用法：menu-benchmark [--root Benchmarks] [--out Benchmarks/results] [--only 檔名關鍵字]")
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
        let recognizer = VisionTextRecognizer()
        for file in files {
            let base = (file as NSString).deletingPathExtension
            let m = manifest[file] ?? ManifestEntry.fallback(file: file)
            let answerURL = answersDir.appendingPathComponent(base + ".csv")
            guard let answerText = try? String(contentsOf: answerURL, encoding: .utf8) else {
                print("⚠︎ 略過 \(file)：找不到標準答案 answers/\(base).csv")
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
}
