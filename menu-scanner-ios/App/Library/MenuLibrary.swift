import Foundation
import MenuScannerCore
import SwiftData
import UIKit

/// 一家店（店名＋分店）。每次「存入店家菜單庫」都新增一個不可變的版本。
@Model
final class StoreMenu {
    @Attribute(.unique) var id: UUID
    var storeName: String
    var branch: String
    var kindRaw: String
    var isDemo: Bool
    var createdAt: Date
    var updatedAt: Date
    @Relationship(deleteRule: .cascade, inverse: \MenuVersion.store)
    var versions: [MenuVersion] = []

    init(id: UUID = UUID(), storeName: String, branch: String, kind: MenuKind, isDemo: Bool = false, now: Date = Date()) {
        self.id = id
        self.storeName = storeName
        self.branch = branch
        self.kindRaw = kind.rawValue
        self.isDemo = isDemo
        self.createdAt = now
        self.updatedAt = now
    }

    var kind: MenuKind { MenuKind(rawValue: kindRaw) ?? .drink }
    var sortedVersions: [MenuVersion] { versions.sorted { $0.number > $1.number } }
    var latest: MenuVersion? { sortedVersions.first }
    var displayName: String { branch.isEmpty ? storeName : "\(storeName)・\(branch)" }
}

/// 一個已儲存的版本：完整草稿（品項、原文、座標）＋原圖。儲存後不再修改；要調整就「從這版編輯新稿」。
@Model
final class MenuVersion {
    @Attribute(.unique) var id: UUID
    var number: Int
    var savedAt: Date
    var reviewedAt: Date
    var entryCount: Int
    var pendingCount: Int
    var draftData: Data
    @Attribute(.externalStorage) var imageData: Data?
    var store: StoreMenu?

    init(id: UUID = UUID(), number: Int, savedAt: Date, draft: MenuDraft, imageData: Data?) {
        self.id = id
        self.number = number
        self.savedAt = savedAt
        self.reviewedAt = draft.metadata.reviewedAt
        self.entryCount = draft.entries.count
        self.pendingCount = draft.attentionEntries.count
        self.draftData = (try? JSONEncoder().encode(draft)) ?? Data()
        self.imageData = imageData
    }

    func draft() -> MenuDraft? {
        try? JSONDecoder().decode(MenuDraft.self, from: draftData)
    }

    func image() -> CGImage? {
        imageData.flatMap { UIImage(data: $0)?.cgImage }
    }
}

enum MenuLibraryError: LocalizedError {
    case missingStoreName

    var errorDescription: String? { "請先填寫店名" }
}

/// 不標 @MainActor：呼叫端都在主執行緒（SwiftUI 畫面與 App 啟動），避免 Swift 5 模式下的隔離錯誤。
enum MenuLibrary {
    static let schema: [any PersistentModel.Type] = [StoreMenu.self, MenuVersion.self]
    static let demoSeededKey = "demoMenuSeeded"

    static func makeContainer(inMemory: Bool, url: URL? = nil) throws -> ModelContainer {
        let config: ModelConfiguration
        if let url {
            config = ModelConfiguration(url: url)
        } else {
            config = ModelConfiguration(isStoredInMemoryOnly: inMemory)
        }
        return try ModelContainer(for: Schema(schema), configurations: config)
    }

    /// 另存新版。`storeID` 指定時存到那家店（例如從舊版編輯的新稿）；否則依店名＋分店找，找不到就新增。
    @discardableResult
    static func saveVersion(_ draft: MenuDraft, image: CGImage?, storeID: UUID?, in context: ModelContext, now: Date = Date()) throws -> MenuVersion {
        let name = draft.metadata.storeName.trimmingCharacters(in: .whitespacesAndNewlines)
        let branch = draft.metadata.branch.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty else { throw MenuLibraryError.missingStoreName }

        let all = try context.fetch(FetchDescriptor<StoreMenu>())
        let store: StoreMenu
        if let storeID, let s = all.first(where: { $0.id == storeID }) {
            store = s
        } else if let s = all.first(where: { $0.storeName == name && $0.branch == branch }) {
            store = s
        } else {
            store = StoreMenu(storeName: name, branch: branch, kind: draft.metadata.kind, now: now)
            context.insert(store)
        }
        store.storeName = name
        store.branch = branch
        store.kindRaw = draft.metadata.kind.rawValue
        store.updatedAt = now

        var saved = draft
        saved.metadata.storeName = name
        saved.metadata.branch = branch
        saved.updatedAt = now
        let number = (store.versions.map(\.number).max() ?? 0) + 1
        let jpeg = image.flatMap { UIImage(cgImage: $0).jpegData(compressionQuality: 0.85) }
        let version = MenuVersion(number: number, savedAt: now, draft: saved, imageData: jpeg)
        context.insert(version)
        version.store = store
        try context.save()
        return version
    }

    /// 第一次啟動時放入內建示範菜單（使用者刪掉後不會再自動加回；`defaults` 為 nil 時只看資料庫）。
    static func seedDemoIfNeeded(in context: ModelContext, defaults: UserDefaults?) {
        if let defaults, defaults.bool(forKey: demoSeededKey) { return }
        let existing = (try? context.fetch(FetchDescriptor<StoreMenu>(predicate: #Predicate { $0.isDemo == true }))) ?? []
        if existing.isEmpty, let v = try? saveVersion(DemoMenu.draft(), image: nil, storeID: nil, in: context, now: DemoMenu.reviewedAt) {
            v.store?.isDemo = true
            try? context.save()
        }
        defaults?.set(true, forKey: demoSeededKey)
    }
}
