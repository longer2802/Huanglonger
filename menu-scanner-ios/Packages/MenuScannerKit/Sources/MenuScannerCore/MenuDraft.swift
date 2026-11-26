import Foundation

/// 店家資訊（匯出與店家菜單庫共用）。
public struct MenuMetadata: Codable, Hashable, Sendable {
    public var storeName: String
    public var branch: String
    public var kind: MenuKind
    public var reviewedAt: Date

    public init(storeName: String = "", branch: String = "", kind: MenuKind = .drink, reviewedAt: Date = Date()) {
        self.storeName = storeName
        self.branch = branch
        self.kind = kind
        self.reviewedAt = reviewedAt
    }
}

/// 使用者在校對畫面送出的修改。
public struct EntryEdit: Equatable, Sendable {
    public var category: String
    public var name: String
    public var size: String
    public var price: Int?

    public init(category: String, name: String, size: String, price: Int?) {
        self.category = category
        self.name = name
        self.size = size
        self.price = price
    }

    public init(_ e: MenuEntry) {
        self.init(category: e.category, name: e.name, size: e.size, price: e.price)
    }
}

/// 一份校對中的菜單（草稿）。所有編輯規則集中在這裡，UI 只負責呼叫。
public struct MenuDraft: Codable, Hashable, Sendable, Identifiable {
    public var id: UUID
    public var metadata: MenuMetadata
    public var entries: [MenuEntry]
    public var excluded: [ExcludedLine]
    /// 照片辨識時的 OCR 結果（原文與座標）；貼上文字時為 nil。
    public var document: OCRDocument?
    /// 貼上的原始文字；照片辨識時為 nil。
    public var sourceText: String?
    public var updatedAt: Date

    public init(
        id: UUID = UUID(),
        metadata: MenuMetadata = MenuMetadata(),
        result: ParseResult,
        document: OCRDocument? = nil,
        sourceText: String? = nil,
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.metadata = metadata
        self.entries = result.entries
        self.excluded = result.excluded
        self.document = document
        self.sourceText = sourceText
        self.updatedAt = updatedAt
    }

    // MARK: 狀態

    /// 需要使用者處理的品項：待確認，或缺少品名／價格（不能匯出）。
    public static func needsAttention(_ e: MenuEntry) -> Bool {
        !MenuExporter.isExportable(e)
    }

    /// 顯示用的待處理原因。
    public static func attentionMessages(_ e: MenuEntry) -> [String] {
        var out = e.needsReview ? e.reasons.map(\.message) : []
        if e.needsReview && out.isEmpty { out.append("尚未確認") }
        if e.price == nil && !out.contains(where: { $0.contains("價格") }) { out.append("缺少價格") }
        if e.name.trimmingCharacters(in: .whitespaces).isEmpty { out.append("缺少品名") }
        return out
    }

    public var attentionEntries: [MenuEntry] { entries.filter(Self.needsAttention) }
    public var exportableEntries: [MenuEntry] { entries.filter(MenuExporter.isExportable) }

    public func entry(_ id: UUID) -> MenuEntry? { entries.first { $0.id == id } }

    // MARK: 編輯

    /// 套用使用者修改：內容有變為「已修改」，沒變為「已確認」；原因清空，OCR 原文保留。
    public mutating func apply(_ edit: EntryEdit, to id: UUID) {
        guard let i = entries.firstIndex(where: { $0.id == id }) else { return }
        var e = entries[i]
        let changed = EntryEdit(e) != edit
        e.category = edit.category.trimmingCharacters(in: .whitespaces)
        e.name = edit.name.trimmingCharacters(in: .whitespaces)
        e.size = edit.size.trimmingCharacters(in: .whitespaces)
        e.price = edit.price
        e.reasons = []
        e.status = changed ? .edited : .confirmed
        if e.price != nil { e.candidatePrices = [] }
        entries[i] = e
        touch()
    }

    /// 不修改內容，直接確認。
    public mutating func confirm(_ id: UUID) {
        guard let e = entry(id) else { return }
        apply(EntryEdit(e), to: id)
    }

    /// 採用詞庫建議的品名（originalName 仍保留 OCR 原文）。
    public mutating func acceptSuggestion(_ id: UUID) {
        guard let e = entry(id), let s = e.suggestedName else { return }
        var edit = EntryEdit(e)
        edit.name = s
        apply(edit, to: id)
    }

    public mutating func delete(_ id: UUID) {
        entries.removeAll { $0.id == id }
        touch()
    }

    /// 手動新增一筆（視為使用者輸入，狀態為已修改）。
    @discardableResult
    public mutating func addEntry(_ edit: EntryEdit, after id: UUID? = nil) -> UUID {
        let e = MenuEntry(
            category: edit.category, name: edit.name, size: edit.size, price: edit.price,
            status: .edited, source: nil, originalName: ""
        )
        if let id, let i = entries.firstIndex(where: { $0.id == id }) {
            entries.insert(e, at: i + 1)
        } else {
            entries.append(e)
        }
        touch()
        return e.id
    }

    /// 同一品名新增另一個規格，沿用原本的分類、品名與原圖位置。
    @discardableResult
    public mutating func addSize(to id: UUID, size: String, price: Int?) -> UUID? {
        guard let i = entries.firstIndex(where: { $0.id == id }) else { return nil }
        let base = entries[i]
        let e = MenuEntry(
            category: base.category, name: base.name, size: size, price: price,
            status: .edited, source: base.source, originalName: base.originalName
        )
        entries.insert(e, at: i + 1)
        touch()
        return e.id
    }

    private mutating func touch() { updatedAt = Date() }
}
