import Foundation

/// 單欄重掃的一項差異。
public struct RescanChange: Identifiable, Hashable, Sendable {
    public enum Kind: String, Codable, Sendable {
        /// 重掃讀到、原本沒有的品項。
        case add
        /// 範圍內尚未人工確認的品項，重掃後內容不同。
        case update
        /// 範圍內已確認或手動修改過的品項，重掃讀到不同內容（預設保留使用者的版本）。
        case conflict
        /// 範圍內尚未確認、但重掃沒讀到的品項（預設保留）。
        case remove
    }

    public var id: UUID
    public var kind: Kind
    public var existing: MenuEntry?
    public var incoming: MenuEntry?
    /// 使用者是否套用這項差異。
    public var accepted: Bool

    public init(id: UUID = UUID(), kind: Kind, existing: MenuEntry?, incoming: MenuEntry?, accepted: Bool) {
        self.id = id
        self.kind = kind
        self.existing = existing
        self.incoming = incoming
        self.accepted = accepted
    }

    public var title: String {
        switch kind {
        case .add: return "新增"
        case .update: return "更新（尚未確認的品項）"
        case .conflict: return "衝突（你已確認或修改過）"
        case .remove: return "重掃沒讀到"
        }
    }
}

public struct RescanPlan: Sendable {
    public var region: NormRect
    public var changes: [RescanChange]
    /// 範圍內內容相同、不需變動的筆數。
    public var unchangedCount: Int

    public var isEmpty: Bool { changes.isEmpty }
}

/// 單欄重掃合併規則：
/// - 只處理來源位置在框選範圍內的品項，範圍外完全不動。
/// - 已確認或手動修改的品項不會被自動覆蓋；內容不同時列為衝突，由使用者決定。
/// - 尚未確認的品項：內容不同就更新（預設套用）；重掃沒讀到的預設保留。
public enum RescanMerger {
    public static func key(name: String, size: String) -> String {
        let n = TextNormalizer.halfwidth(name).filter { !$0.isWhitespace }
        let s = TextNormalizer.normalizeSize(size) ?? TextNormalizer.halfwidth(size).trimmingCharacters(in: .whitespaces)
        return n + "|" + (s.isEmpty ? SizeLabel.single : s)
    }

    public static func key(_ e: MenuEntry) -> String { key(name: e.name, size: e.size) }

    static func isProtected(_ e: MenuEntry) -> Bool {
        e.status == .confirmed || e.status == .edited
    }

    static func isInside(_ e: MenuEntry, _ region: NormRect) -> Bool {
        e.source?.box?.isCentered(in: region) ?? false
    }

    static func sameContent(_ a: MenuEntry, _ b: MenuEntry) -> Bool {
        a.price == b.price && a.candidatePrices == b.candidatePrices && a.reasons == b.reasons && a.category == b.category
    }

    public static func plan(draft: MenuDraft, region: NormRect, rescanned: [MenuEntry]) -> RescanPlan {
        let inside = draft.entries.filter { isInside($0, region) }
        var used = Set<UUID>()
        var changes: [RescanChange] = []
        var unchanged = 0

        for n in rescanned {
            // 也比對原始 OCR 品名與詞庫建議，避免使用者改過字後被當成新品項
            let keys: Set<String> = [key(n), key(name: n.originalName, size: n.size)]
            let match = inside.first { e in
                !used.contains(e.id) && (
                    keys.contains(key(e))
                    || keys.contains(key(name: e.originalName, size: e.size))
                    || (e.suggestedName.map { keys.contains(key(name: $0, size: e.size)) } ?? false)
                )
            }
            guard let m = match else {
                changes.append(RescanChange(kind: .add, existing: nil, incoming: n, accepted: true))
                continue
            }
            used.insert(m.id)
            if isProtected(m) {
                if m.price == n.price {
                    unchanged += 1
                } else {
                    changes.append(RescanChange(kind: .conflict, existing: m, incoming: n, accepted: false))
                }
            } else if sameContent(m, n) {
                unchanged += 1
            } else {
                changes.append(RescanChange(kind: .update, existing: m, incoming: n, accepted: true))
            }
        }

        for e in inside where !used.contains(e.id) {
            if isProtected(e) {
                unchanged += 1
            } else {
                changes.append(RescanChange(kind: .remove, existing: e, incoming: nil, accepted: false))
            }
        }
        return RescanPlan(region: region, changes: changes, unchangedCount: unchanged)
    }

    /// 套用使用者勾選的差異；`newLines` 為重掃的 OCR 行（加入草稿的 OCR 結果以保留原文）。
    public static func apply(_ plan: RescanPlan, to draft: inout MenuDraft, newLines: [OCRLine] = []) {
        for c in plan.changes where c.accepted {
            switch c.kind {
            case .add:
                guard let n = c.incoming else { continue }
                // 插在原圖位置相近的地方
                let y = n.source?.box?.midY ?? .infinity
                if let i = draft.entries.firstIndex(where: { ($0.source?.box?.midY ?? -1) > y && isInside($0, plan.region) }) {
                    draft.entries.insert(n, at: i)
                } else if let last = draft.entries.lastIndex(where: { isInside($0, plan.region) }) {
                    draft.entries.insert(n, at: last + 1)
                } else {
                    draft.entries.append(n)
                }
            case .update:
                guard let old = c.existing, let n = c.incoming,
                      let i = draft.entries.firstIndex(where: { $0.id == old.id }) else { continue }
                var e = n
                e.id = old.id
                draft.entries[i] = e
            case .conflict:
                guard let old = c.existing, let n = c.incoming,
                      let i = draft.entries.firstIndex(where: { $0.id == old.id }) else { continue }
                // 使用者明確選了重掃的版本
                var e = n
                e.id = old.id
                e.reasons = []
                e.status = .confirmed
                draft.entries[i] = e
            case .remove:
                guard let old = c.existing else { continue }
                draft.entries.removeAll { $0.id == old.id }
            }
        }
        if !newLines.isEmpty {
            draft.document?.lines += newLines
        }
        draft.updatedAt = Date()
    }
}
