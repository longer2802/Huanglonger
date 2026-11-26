import Foundation

/// 內建示範菜單（虛構店家，清楚標示「示範」）：涵蓋單一價格、中／大杯、缺某杯型。
public enum DemoMenu {
    public static let storeName = "【示範】小森林茶飲（虛構）"
    public static let branch = "示範店"
    /// 2026-11-26（固定日期，讓範例檔內容穩定）。
    public static let reviewedAt = Date(timeIntervalSince1970: 1_795_651_200)

    public static let items: [(category: String, name: String, size: String, price: Int)] = [
        ("醇茶", "紅茶", "中杯", 30),
        ("醇茶", "紅茶", "大杯", 35),
        ("醇茶", "綠茶", "中杯", 30),
        ("醇茶", "綠茶", "大杯", 35),
        ("醇茶", "蜜桃烏龍", "中杯", 50),
        ("醇茶", "蜜桃烏龍", "大杯", 60),
        ("奶茶", "珍珠奶茶", "中杯", 50),
        ("奶茶", "珍珠奶茶", "大杯", 60),
        ("奶茶", "鮮奶茶", "大杯", 65), // 只有大杯
        ("特調", "冬瓜檸檬", "中杯", 45),
        ("特調", "冬瓜檸檬", "大杯", 55),
        ("特調", "檸檬愛玉", SizeLabel.single, 50), // 單一價格
    ]

    public static var metadata: MenuMetadata {
        MenuMetadata(storeName: storeName, branch: branch, kind: .drink, reviewedAt: reviewedAt)
    }

    public static func draft() -> MenuDraft {
        let entries = items.map {
            MenuEntry(category: $0.category, name: $0.name, size: $0.size, price: $0.price, status: .confirmed, originalName: $0.name)
        }
        return MenuDraft(metadata: metadata, result: ParseResult(entries: entries, excluded: []), updatedAt: reviewedAt)
    }
}
