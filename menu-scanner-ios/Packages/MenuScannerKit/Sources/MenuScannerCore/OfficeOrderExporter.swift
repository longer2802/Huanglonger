import Foundation

/// 「辦公室揪訂」相容匯出。
///
/// 依 office-order-app 的「匯入還原」格式（src/lib/db.ts 的 BackupFile、src/lib/types.ts 的 VendorTemplate）
/// 產生只含一個「店家模板」的備份檔：不含訂單與照片，匯入時只會新增或更新這個模板，不影響其他資料。
/// 同一品名的不同規格合併成一個品項的多個 variants；單一價格的規格標籤為空字串（與揪訂相同）。
public enum OfficeOrderExporter {
    struct BackupFile: Encodable {
        let app = "office-group-order"
        let version = 1
        let exportedAt: String
        let orders: [String] = []
        let templates: [Template]
        let photos: [String] = []
    }

    struct Template: Encodable {
        let id: String
        let kind: String
        let vendorName: String
        let menu: Menu
        let savedAt: Int64
    }

    struct Menu: Encodable {
        let items: [Item]
        let addons: [String] = []
    }

    struct Item: Encodable {
        let id: String
        let category: String
        let name: String
        let variants: [Variant]
        let flags: [String] = []
    }

    struct Variant: Encodable {
        let id: String
        let label: String
        let price: Int
    }

    /// 揪訂的店家名稱：「店名（分店）」。
    public static func vendorName(_ m: MenuMetadata) -> String {
        let store = m.storeName.trimmingCharacters(in: .whitespaces)
        let branch = m.branch.trimmingCharacters(in: .whitespaces)
        return branch.isEmpty ? store : "\(store)（\(branch)）"
    }

    /// 模板 ID 由店名＋分店決定：同一家店再次匯入會更新同一個模板。
    public static func templateID(_ m: MenuMetadata) -> String {
        let base = vendorName(m)
        let hex = base.utf8.reduce(UInt64(1_469_598_103_934_665_603)) { ($0 ^ UInt64($1)) &* 1_099_511_628_211 }
        return "menu-scanner-" + String(hex, radix: 16)
    }

    public static func backupJSON(entries: [MenuEntry], metadata: MenuMetadata, exportedAt: Date = Date()) -> Data {
        let tid = templateID(metadata)
        var order: [String] = []
        var grouped: [String: (category: String, name: String, variants: [(String, Int)])] = [:]
        for e in entries where MenuExporter.isExportable(e) {
            let k = e.category + "\u{1F}" + e.name
            if grouped[k] == nil {
                order.append(k)
                grouped[k] = (e.category, e.name, [])
            }
            let label = (e.size == SizeLabel.single) ? "" : e.size
            grouped[k]!.variants.append((label, e.price!))
        }
        let items: [Item] = order.enumerated().map { i, k in
            let g = grouped[k]!
            return Item(
                id: "\(tid)-i\(i + 1)",
                category: g.category,
                name: g.name,
                variants: g.variants.enumerated().map { j, v in Variant(id: "\(tid)-i\(i + 1)-v\(j + 1)", label: v.0, price: v.1) }
            )
        }
        let iso = ISO8601DateFormatter()
        let file = BackupFile(
            exportedAt: iso.string(from: exportedAt),
            templates: [Template(
                id: tid,
                kind: metadata.kind == .drink ? "drink" : "meal",
                vendorName: vendorName(metadata),
                menu: Menu(items: items),
                savedAt: Int64((metadata.reviewedAt.timeIntervalSince1970 * 1000).rounded())
            )]
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(file)) ?? Data()
    }
}
