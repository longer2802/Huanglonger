import Foundation

// MARK: - OCR 結果（與解析器之間的唯一介面）

public struct OCRCandidate: Codable, Hashable, Sendable {
    public var text: String
    public var confidence: Double

    public init(text: String, confidence: Double) {
        self.text = text
        self.confidence = confidence
    }
}

/// 一行 OCR 文字。`box` 為整張原圖的左上原點正規化座標。
public struct OCRLine: Codable, Hashable, Sendable, Identifiable {
    public var id: Int
    /// 最高信心的原始文字（未經任何正規化）。
    public var text: String
    public var confidence: Double
    /// Vision 的其他候選文字（含第一名）。
    public var candidates: [OCRCandidate]
    public var box: NormRect
    /// 依空白切開的每個字詞的框（數量需等於 `Tokenizer.words(in: text).count`，否則忽略並改用估算）。
    public var wordBoxes: [NormRect]?

    public init(id: Int, text: String, confidence: Double = 1, candidates: [OCRCandidate] = [], box: NormRect, wordBoxes: [NormRect]? = nil) {
        self.id = id
        self.text = text
        self.confidence = confidence
        self.candidates = candidates.isEmpty ? [OCRCandidate(text: text, confidence: confidence)] : candidates
        self.box = box
        self.wordBoxes = wordBoxes
    }
}

public struct OCRDocument: Codable, Hashable, Sendable {
    public var lines: [OCRLine]
    public var imageWidth: Int
    public var imageHeight: Int
    /// 本次辨識使用的影像範圍（整張辨識為 nil）。
    public var region: NormRect?
    public var languages: [String]
    public var revision: Int
    public var processingSeconds: Double

    public init(lines: [OCRLine], imageWidth: Int = 0, imageHeight: Int = 0, region: NormRect? = nil, languages: [String] = [], revision: Int = 0, processingSeconds: Double = 0) {
        self.lines = lines
        self.imageWidth = imageWidth
        self.imageHeight = imageHeight
        self.region = region
        self.languages = languages
        self.revision = revision
        self.processingSeconds = processingSeconds
    }
}

// MARK: - 菜單資料：一個品名＋一種規格＋一個價格 = 一筆

public enum SizeLabel {
    /// 單一價格品項的規格欄位值。
    public static let single = "單一"
}

public enum MenuKind: String, Codable, CaseIterable, Sendable {
    case drink = "飲料"
    case meal = "餐點"
}

/// 待確認原因。`message` 直接顯示在校對畫面。
public enum ReviewReason: Codable, Hashable, Sendable {
    case priceOverlapsAdjacentRow
    case multiplePricesWithoutHeader
    case possibleTypo(suggestion: String)
    case unreadablePrice(raw: String)
    case priceNotFound
    case sizeMappingUncertain
    case headerCountMismatch
    case addonOrPromotion
    case rescanConflict

    public var message: String {
        switch self {
        case .priceOverlapsAdjacentRow: return "價格與上一列重疊"
        case .multiplePricesWithoutHeader: return "有兩個以上價格但找不到杯型表頭"
        case .possibleTypo(let s): return "品名疑似錯字（建議：\(s)）"
        case .unreadablePrice(let raw): return "價格看不清楚（原文：\(raw)），請對照原圖填寫"
        case .priceNotFound: return "找不到這個品項的價格"
        case .sizeMappingUncertain: return "沒有座標，無法確定價格對應哪個杯型"
        case .headerCountMismatch: return "價格數量與表頭杯型數量不一致"
        case .addonOrPromotion: return "加料／套餐／促銷價，適用範圍不明"
        case .rescanConflict: return "重掃結果與原本內容不同"
        }
    }
}

public enum EntryStatus: String, Codable, Sendable {
    /// 解析器自動判定完成。
    case auto
    /// 需要人工確認。
    case needsReview
    /// 使用者已確認（未修改內容）。
    case confirmed
    /// 使用者修改過。
    case edited

    public var isResolved: Bool { self != .needsReview }
}

/// 一筆資料在原圖上的來源。
public struct EntrySource: Codable, Hashable, Sendable {
    public var box: NormRect?
    public var rawText: String
    public var lineIDs: [Int]

    public init(box: NormRect?, rawText: String, lineIDs: [Int]) {
        self.box = box
        self.rawText = rawText
        self.lineIDs = lineIDs
    }
}

public struct MenuEntry: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var category: String
    public var name: String
    /// 規格，例如「中杯」「大杯」「M」「700ml」；單一價格為「單一」；無法判斷時為空字串。
    public var size: String
    /// 價格（整數元）。看不清楚或無法配對時為 nil，絕不補 0。
    public var price: Int?
    /// 無法確定時保留的候選價格。
    public var candidatePrices: [Int]
    public var reasons: [ReviewReason]
    public var status: EntryStatus
    public var source: EntrySource?
    /// OCR 讀到的原始品名（詞庫建議與使用者修改都不會覆蓋它）。
    public var originalName: String
    /// 詞庫建議的品名，由使用者決定是否採用。
    public var suggestedName: String?

    public init(
        id: UUID = UUID(),
        category: String = "",
        name: String,
        size: String,
        price: Int?,
        candidatePrices: [Int] = [],
        reasons: [ReviewReason] = [],
        status: EntryStatus? = nil,
        source: EntrySource? = nil,
        originalName: String? = nil,
        suggestedName: String? = nil
    ) {
        self.id = id
        self.category = category
        self.name = name
        self.size = size
        self.price = price
        self.candidatePrices = candidatePrices
        self.reasons = reasons
        self.status = status ?? (reasons.isEmpty ? .auto : .needsReview)
        self.source = source
        self.originalName = originalName ?? name
        self.suggestedName = suggestedName
    }

    public var needsReview: Bool { status == .needsReview }
}

/// 被排除、不當作品項的文字（電話、地址、甜度表…），保留以便除錯與校對。
public struct ExcludedLine: Codable, Hashable, Sendable {
    public var text: String
    public var reason: String
    public var box: NormRect?

    public init(text: String, reason: String, box: NormRect?) {
        self.text = text
        self.reason = reason
        self.box = box
    }
}

public struct ParseResult: Codable, Hashable, Sendable {
    public var entries: [MenuEntry]
    public var excluded: [ExcludedLine]

    public init(entries: [MenuEntry], excluded: [ExcludedLine]) {
        self.entries = entries
        self.excluded = excluded
    }

    public var pendingEntries: [MenuEntry] { entries.filter(\.needsReview) }
    public var resolvedEntries: [MenuEntry] { entries.filter { !$0.needsReview } }
}
