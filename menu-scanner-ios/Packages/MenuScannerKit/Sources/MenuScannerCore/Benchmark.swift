import Foundation

// MARK: - 標準答案

/// 人工標準答案的一筆：一個品名＋一種規格＋一個價格。
public struct AnswerRow: Hashable, Sendable {
    public var name: String
    public var size: String
    public var price: Int

    public init(name: String, size: String, price: Int) {
        self.name = name
        self.size = size
        self.price = price
    }

    public var description: String { "\(name)｜\(size)｜\(price)" }
}

public enum BenchmarkError: LocalizedError, Equatable {
    case missingColumns(String)
    case badPrice(line: Int, value: String)

    public var errorDescription: String? {
        switch self {
        case .missingColumns(let file): return "\(file)：標準答案需要「品名、規格、價格」三個欄位"
        case .badPrice(let line, let value): return "第 \(line) 行價格不是整數：\(value)"
        }
    }
}

public enum CSVReader {
    /// RFC 4180：處理引號、跳脫雙引號、欄位內換行；接受 BOM 與 CRLF／LF。
    public static func rows(_ text: String) -> [[String]] {
        var s = text
        if s.hasPrefix("\u{FEFF}") { s.removeFirst() }
        var rows: [[String]] = []
        var row: [String] = []
        var field = ""
        var inQuotes = false
        var chars = Array(s)
        chars.append("\n")
        var i = 0
        while i < chars.count {
            let c = chars[i]
            if inQuotes {
                if c == "\"" {
                    if i + 1 < chars.count && chars[i + 1] == "\"" {
                        field.append("\"")
                        i += 1
                    } else {
                        inQuotes = false
                    }
                } else {
                    field.append(c)
                }
            } else {
                switch c {
                case "\"": inQuotes = true
                case ",":
                    row.append(field)
                    field = ""
                case "\n", "\r\n", "\r":
                    row.append(field)
                    field = ""
                    if !(row.count == 1 && row[0].isEmpty) { rows.append(row) }
                    row = []
                default:
                    field.append(c)
                }
            }
            i += 1
        }
        return rows
    }
}

public enum AnswerCSV {
    /// 讀標準答案 CSV。欄位依表頭名稱判斷（可直接用 App 匯出的 CSV：店家,分店,分類,品名,規格,價格）。
    public static func parse(_ text: String, file: String = "標準答案") throws -> [AnswerRow] {
        let rows = CSVReader.rows(text)
        guard let header = rows.first else { return [] }
        let h = header.map { $0.trimmingCharacters(in: .whitespaces) }
        guard let ni = h.firstIndex(of: "品名"), let si = h.firstIndex(of: "規格"), let pi = h.firstIndex(of: "價格") else {
            throw BenchmarkError.missingColumns(file)
        }
        var out: [AnswerRow] = []
        for (k, r) in rows.dropFirst().enumerated() {
            func col(_ i: Int) -> String { i < r.count ? r[i].trimmingCharacters(in: .whitespaces) : "" }
            let name = col(ni)
            if name.isEmpty || name.hasPrefix("#") { continue }
            guard let price = TextNormalizer.parsePrice(col(pi)) else {
                throw BenchmarkError.badPrice(line: k + 2, value: col(pi))
            }
            let size = col(si)
            out.append(AnswerRow(name: name, size: size.isEmpty ? SizeLabel.single : size, price: price))
        }
        return out
    }
}

// MARK: - 評分

public struct BenchmarkScore: Sendable {
    public var answers: Int
    /// 自動判定完成、且品名＋規格＋價格與標準答案完全相符（每筆答案只配對一次）。
    public var correct: Int
    /// App 自動判定完成的筆數（不含待確認）。
    public var autoCompleted: Int
    public var pending: Int
    public var missed: [AnswerRow]
    public var extra: [MenuEntry]

    public var recall: Double { answers == 0 ? 0 : Double(correct) / Double(answers) }
    public var precision: Double { autoCompleted == 0 ? 0 : Double(correct) / Double(autoCompleted) }
}

public enum BenchmarkScorer {
    public static func normalizeName(_ s: String) -> String {
        TextNormalizer.halfwidth(s).filter { !$0.isWhitespace }
    }

    public static func normalizeSize(_ s: String) -> String {
        let t = TextNormalizer.halfwidth(s).trimmingCharacters(in: .whitespaces)
        if t.isEmpty { return SizeLabel.single }
        return TextNormalizer.normalizeSize(t) ?? t
    }

    static func key(_ name: String, _ size: String, _ price: Int) -> String {
        "\(normalizeName(name))|\(normalizeSize(size))|\(price)"
    }

    /// 待確認的品項（含人工會改正的）一律不計入自動正確數。
    public static func score(answers: [AnswerRow], entries: [MenuEntry]) -> BenchmarkScore {
        var remaining: [String: Int] = [:]
        for a in answers { remaining[key(a.name, a.size, a.price), default: 0] += 1 }
        let auto = entries.filter { !$0.needsReview }
        var correct = 0
        var extra: [MenuEntry] = []
        for e in auto {
            guard let p = e.price else { extra.append(e); continue }
            let k = key(e.name, e.size, p)
            if let n = remaining[k], n > 0 {
                remaining[k] = n - 1
                correct += 1
            } else {
                extra.append(e)
            }
        }
        var missed: [AnswerRow] = []
        var left = remaining
        for a in answers {
            let k = key(a.name, a.size, a.price)
            if let n = left[k], n > 0 {
                missed.append(a)
                left[k] = n - 1
            }
        }
        return BenchmarkScore(
            answers: answers.count, correct: correct, autoCompleted: auto.count,
            pending: entries.count - auto.count, missed: missed, extra: extra
        )
    }
}

// MARK: - 清單與報告

/// Benchmarks/manifest.csv：檔名,版型,用途,來源
/// - 用途：「調整」（用來調規則）或「保留」（不可用來調規則的驗收組）
/// - 來源：「真實」或「合成」
public struct ManifestEntry: Hashable, Sendable {
    public var file: String
    public var layout: String
    public var split: String
    public var source: String

    public init(file: String, layout: String, split: String, source: String) {
        self.file = file
        self.layout = layout
        self.split = split
        self.source = source
    }

    public var isSynthetic: Bool { source.contains("合成") }

    public static func parse(_ text: String) -> [String: ManifestEntry] {
        let rows = CSVReader.rows(text)
        guard let header = rows.first else { return [:] }
        let h = header.map { $0.trimmingCharacters(in: .whitespaces) }
        func idx(_ n: String) -> Int? { h.firstIndex(of: n) }
        guard let fi = idx("檔名") else { return [:] }
        var out: [String: ManifestEntry] = [:]
        for r in rows.dropFirst() {
            func col(_ i: Int?) -> String { i.flatMap { $0 < r.count ? r[$0].trimmingCharacters(in: .whitespaces) : nil } ?? "" }
            let file = col(fi)
            if file.isEmpty || file.hasPrefix("#") { continue }
            out[file] = ManifestEntry(file: file, layout: col(idx("版型")), split: col(idx("用途")), source: col(idx("來源")))
        }
        return out
    }

    /// 清單沒寫時的預設：檔名以「合成」開頭視為合成資料。
    public static func fallback(file: String) -> ManifestEntry {
        ManifestEntry(file: file, layout: "未分類", split: "未標示", source: file.hasPrefix("合成") ? "合成" : "真實")
    }
}

public struct BenchmarkImageResult: Sendable {
    public var manifest: ManifestEntry
    public var score: BenchmarkScore
    public var seconds: Double
    public var error: String?

    public init(manifest: ManifestEntry, score: BenchmarkScore, seconds: Double, error: String? = nil) {
        self.manifest = manifest
        self.score = score
        self.seconds = seconds
        self.error = error
    }
}

public enum BenchmarkReport {
    public static let target = 0.9
    public static let syntheticBanner = "⚠️ 合成資料，非真實驗收：以下數字只驗證流程與規則，不可用來宣稱真實菜單準確率達到 90%。"

    struct Totals {
        var answers = 0, correct = 0, auto = 0, pending = 0, missed = 0, extra = 0, images = 0
        var seconds = 0.0
        mutating func add(_ r: BenchmarkImageResult) {
            images += 1
            answers += r.score.answers
            correct += r.score.correct
            auto += r.score.autoCompleted
            pending += r.score.pending
            missed += r.score.missed.count
            extra += r.score.extra.count
            seconds += r.seconds
        }
        var recall: Double { answers == 0 ? 0 : Double(correct) / Double(answers) }
        var precision: Double { auto == 0 ? 0 : Double(correct) / Double(auto) }
    }

    static func pct(_ x: Double) -> String { String(format: "%.1f%%", x * 100) }
    static func mark(_ x: Double, _ n: Int) -> String { n == 0 ? "—" : (x >= target ? "✅" : "❌") }

    static func totalsRow(_ label: String, _ t: Totals) -> String {
        "| \(label) | \(t.images) | \(t.answers) | \(t.correct) | \(t.missed) | \(t.extra) | \(t.pending) | \(pct(t.recall)) \(mark(t.recall, t.answers)) | \(pct(t.precision)) \(mark(t.precision, t.auto)) | \(String(format: "%.1f", t.seconds)) |"
    }

    static let totalsHeader = """
    | 分組 | 圖數 | 標準答案 | 正確 | 漏抓 | 多抓 | 待確認 | 正確÷標準答案 | 正確÷自動完成 | 秒 |
    |---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
    """

    public static func markdown(_ results: [BenchmarkImageResult], generatedAt: Date = Date()) -> String {
        var out: [String] = []
        let f = ISO8601DateFormatter()
        f.timeZone = .current
        out.append("# 菜單辨識基準測試報告")
        out.append("")
        out.append("產生時間：\(f.string(from: generatedAt))　目標：兩項指標皆 ≥ \(Int(target * 100))%")
        out.append("")
        out.append("- **正確÷標準答案**（漏抓越少越高）：自動完成且品名、規格、價格三欄完全相符的筆數 ÷ 標準答案筆數。")
        out.append("- **正確÷自動完成**（誤判越少越高）：同上正確數 ÷ App 自動判定完成（非待確認）的筆數。")
        out.append("- 待確認或需人工改正的筆數不計入正確數。")
        out.append("")

        let sources: [(String, [BenchmarkImageResult])] = [
            ("合成資料", results.filter { $0.manifest.isSynthetic }),
            ("真實菜單", results.filter { !$0.manifest.isSynthetic }),
        ].filter { !$0.1.isEmpty }

        for (sourceName, group) in sources {
            out.append("## \(sourceName)")
            out.append("")
            if sourceName == "合成資料" {
                out.append("> \(syntheticBanner)")
                out.append("")
            }
            out.append(totalsHeader)
            var all = Totals()
            group.forEach { all.add($0) }
            out.append(totalsRow("**全部**", all))
            for split in Set(group.map(\.manifest.split)).sorted() {
                var t = Totals()
                group.filter { $0.manifest.split == split }.forEach { t.add($0) }
                out.append(totalsRow("用途：\(split)", t))
            }
            for layout in Set(group.map(\.manifest.layout)).sorted() {
                var t = Totals()
                group.filter { $0.manifest.layout == layout }.forEach { t.add($0) }
                out.append(totalsRow("版型：\(layout)", t))
            }
            out.append("")
            out.append("### 每張圖")
            out.append("")
            out.append("| 檔名 | 版型 | 用途 | 標準答案 | 正確 | 漏抓 | 多抓 | 待確認 | 正確÷標準答案 | 正確÷自動完成 | 秒 |")
            out.append("|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|")
            for r in group {
                let s = r.score
                out.append("| \(r.manifest.file) | \(r.manifest.layout) | \(r.manifest.split) | \(s.answers) | \(s.correct) | \(s.missed.count) | \(s.extra.count) | \(s.pending) | \(pct(s.recall)) | \(pct(s.precision)) | \(String(format: "%.2f", r.seconds)) |")
            }
            out.append("")
            let details = group.filter { $0.error != nil || !$0.score.missed.isEmpty || !$0.score.extra.isEmpty }
            if !details.isEmpty {
                out.append("### 差異明細")
                out.append("")
                for r in details {
                    out.append("**\(r.manifest.file)**")
                    if let e = r.error { out.append("- 錯誤：\(e)") }
                    for a in r.score.missed { out.append("- 漏抓：\(a.description)") }
                    for e in r.score.extra {
                        out.append("- 多抓：\(e.name)｜\(e.size.isEmpty ? SizeLabel.single : e.size)｜\(e.price.map(String.init) ?? "—")")
                    }
                    out.append("")
                }
            }
        }
        if results.isEmpty {
            out.append("（沒有可評分的圖片：請把圖片放在 Benchmarks/menus/，同名標準答案放在 Benchmarks/answers/。）")
        }
        return out.joined(separator: "\n") + "\n"
    }

    /// 每張圖一列的 CSV（UTF-8 BOM），方便用 Excel 追蹤。
    public static func csv(_ results: [BenchmarkImageResult]) -> Data {
        var rows = [["檔名", "版型", "用途", "來源", "標準答案", "正確", "漏抓", "多抓", "待確認", "自動完成", "正確÷標準答案", "正確÷自動完成", "秒", "錯誤"]]
        for r in results {
            let s = r.score
            rows.append([
                r.manifest.file, r.manifest.layout, r.manifest.split, r.manifest.source,
                String(s.answers), String(s.correct), String(s.missed.count), String(s.extra.count),
                String(s.pending), String(s.autoCompleted),
                String(format: "%.4f", s.recall), String(format: "%.4f", s.precision),
                String(format: "%.2f", r.seconds), r.error ?? "",
            ])
        }
        let text = rows.map { $0.map(MenuExporter.csvField).joined(separator: ",") }.joined(separator: "\r\n") + "\r\n"
        return Data(MenuExporter.utf8BOM) + Data(text.utf8)
    }
}
