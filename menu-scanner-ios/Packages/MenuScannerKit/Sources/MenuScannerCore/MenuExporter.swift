import Foundation

public enum ExportFormat: String, CaseIterable, Codable, Sendable, Identifiable {
    case txt = "TXT"
    case csv = "CSV"
    /// 「辦公室揪訂」可匯入的店家模板（JSON 備份格式）。
    case officeOrder = "辦公室揪訂"

    public var id: String { rawValue }
    public var fileExtension: String {
        switch self {
        case .txt: return "txt"
        case .csv: return "csv"
        case .officeOrder: return "json"
        }
    }
}

/// TXT／CSV 匯出。只匯出「已確認或自動完成、且有品名與價格」的品項，絕不帶入待確認價格。
public enum MenuExporter {
    public static let csvHeader = ["店家", "分店", "分類", "品名", "規格", "價格"]
    /// UTF-8 BOM，讓 Excel 正確辨識繁體中文。
    public static let utf8BOM: [UInt8] = [0xEF, 0xBB, 0xBF]

    public static func isExportable(_ e: MenuEntry) -> Bool {
        !e.needsReview && e.price != nil && !e.name.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// TXT 一行一筆：欄位內的換行改成空白。
    static func oneLine(_ s: String) -> String {
        s.components(separatedBy: .newlines).filter { !$0.isEmpty }.joined(separator: " ")
    }

    static func displaySize(_ e: MenuEntry) -> String {
        e.size.isEmpty ? SizeLabel.single : e.size
    }

    /// 每行一筆，例如「蜜桃烏龍｜大杯｜65 元」。
    public static func txt(_ entries: [MenuEntry]) -> String {
        entries.filter(isExportable)
            .map { "\(oneLine($0.name))｜\(oneLine(displaySize($0)))｜\($0.price!) 元" }
            .joined(separator: "\n") + "\n"
    }

    /// CSV 文字（不含 BOM），換行用 CRLF（RFC 4180）。
    public static func csv(_ entries: [MenuEntry], metadata: MenuMetadata) -> String {
        var rows = [csvHeader]
        for e in entries where isExportable(e) {
            rows.append([metadata.storeName, metadata.branch, e.category, e.name, displaySize(e), String(e.price!)])
        }
        return rows.map { $0.map(csvField).joined(separator: ",") }.joined(separator: "\r\n") + "\r\n"
    }

    public static func data(_ format: ExportFormat, entries: [MenuEntry], metadata: MenuMetadata) -> Data {
        switch format {
        case .txt:
            return Data(txt(entries).utf8)
        case .csv:
            return Data(utf8BOM) + Data(csv(entries, metadata: metadata).utf8)
        case .officeOrder:
            return OfficeOrderExporter.backupJSON(entries: entries, metadata: metadata)
        }
    }

    public static func text(_ format: ExportFormat, entries: [MenuEntry], metadata: MenuMetadata) -> String {
        switch format {
        case .txt: return txt(entries)
        case .csv: return csv(entries, metadata: metadata)
        case .officeOrder:
            return String(data: OfficeOrderExporter.backupJSON(entries: entries, metadata: metadata), encoding: .utf8) ?? ""
        }
    }

    /// 欄位含逗號、雙引號或換行時加引號，內部雙引號改成兩個。
    public static func csvField(_ s: String) -> String {
        if s.contains(where: { $0 == "," || $0 == "\"" || $0 == "\n" || $0 == "\r" }) {
            return "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\""
        }
        return s
    }

    /// 檔名：店家_分店_校對日期.csv（去掉檔名不允許的字元）。
    public static func fileName(_ metadata: MenuMetadata, format: ExportFormat, timeZone: TimeZone = .current) -> String {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = timeZone
        f.dateFormat = "yyyy-MM-dd"
        let store = sanitize(metadata.storeName)
        let parts = [store.isEmpty ? "菜單" : store, sanitize(metadata.branch), f.string(from: metadata.reviewedAt)]
            .filter { !$0.isEmpty }
        let suffix = format == .officeOrder ? "_辦公室揪訂" : ""
        return parts.joined(separator: "_") + suffix + "." + format.fileExtension
    }

    static func sanitize(_ s: String) -> String {
        let illegal = CharacterSet(charactersIn: "/\\:*?\"<>|").union(.newlines).union(.controlCharacters)
        return s.components(separatedBy: illegal).joined()
            .trimmingCharacters(in: .whitespaces)
            .replacingOccurrences(of: " ", with: "-")
    }
}
