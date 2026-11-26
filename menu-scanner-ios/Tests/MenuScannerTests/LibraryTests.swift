import MenuScannerCore
import SwiftData
import XCTest
@testable import MenuScanner

final class LibraryTests: XCTestCase {
    private var storeURL: URL!

    override func setUpWithError() throws {
        storeURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
            .appendingPathComponent("library.store")
        try FileManager.default.createDirectory(at: storeURL.deletingLastPathComponent(), withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: storeURL.deletingLastPathComponent())
    }

    private func draft(price: Int) -> MenuDraft {
        MenuDraft(
            metadata: MenuMetadata(storeName: "測試茶飲", branch: "一店", kind: .drink),
            result: ParseResult(entries: [
                MenuEntry(category: "茶", name: "紅茶", size: "中杯", price: price, status: .confirmed),
                MenuEntry(name: "綠茶", size: "", price: nil, candidatePrices: [30, 35], reasons: [.multiplePricesWithoutHeader]),
            ], excluded: [])
        )
    }

    /// 重開 App（重新建立資料庫容器）後仍能載入菜單與所有版本。
    @MainActor
    func testVersionsPersistAcrossContainerReopen() throws {
        let image = try XCTUnwrap(ImagePreparation.uprightCGImage(from: SampleMenu.image()))
        var storeID: UUID?
        do {
            let container = try MenuLibrary.makeContainer(inMemory: false, url: storeURL)
            let context = ModelContext(container)
            let v1 = try MenuLibrary.saveVersion(draft(price: 30), image: image, storeID: nil, in: context)
            storeID = v1.store?.id
            // 同店名＋分店再存一次 → 同一家店的第 2 版
            let v2 = try MenuLibrary.saveVersion(draft(price: 32), image: nil, storeID: nil, in: context)
            XCTAssertEqual(v1.number, 1)
            XCTAssertEqual(v2.number, 2)
            XCTAssertEqual(v2.store?.id, storeID)
        }

        let reopened = try MenuLibrary.makeContainer(inMemory: false, url: storeURL)
        let context = ModelContext(reopened)
        let stores = try context.fetch(FetchDescriptor<StoreMenu>())
        XCTAssertEqual(stores.count, 1)
        let store = try XCTUnwrap(stores.first)
        XCTAssertEqual(store.id, storeID)
        XCTAssertEqual(store.displayName, "測試茶飲・一店")
        XCTAssertEqual(store.sortedVersions.map(\.number), [2, 1])

        // 舊版仍可查看，內容沒被新版覆蓋
        let old = try XCTUnwrap(store.sortedVersions.last?.draft())
        XCTAssertEqual(old.entries.first?.price, 30)
        XCTAssertEqual(store.latest?.draft()?.entries.first?.price, 32)
        XCTAssertEqual(store.sortedVersions.last?.pendingCount, 1)
        XCTAssertEqual(store.sortedVersions.last?.image()?.width, image.width)
        XCTAssertNil(store.latest?.image())
    }

    @MainActor
    func testEditFromOldVersionSavesAsNewVersionOfSameStore() throws {
        let container = try MenuLibrary.makeContainer(inMemory: true)
        let context = ModelContext(container)
        let v1 = try MenuLibrary.saveVersion(draft(price: 30), image: nil, storeID: nil, in: context)

        let model = AppModel(isUITesting: true)
        model.editFromVersion(draft: try XCTUnwrap(v1.draft()), image: nil, storeID: v1.store?.id)
        let session = try XCTUnwrap(model.session)
        XCTAssertEqual(model.path, [.review])
        // 改了分店名稱，仍存回同一家店
        session.draft.metadata.branch = "一店（新址）"
        let v2 = try MenuLibrary.saveVersion(session.draft, image: nil, storeID: session.libraryStoreID, in: context)
        XCTAssertEqual(v2.number, 2)
        XCTAssertEqual(v2.store?.id, v1.store?.id)
        XCTAssertNotEqual(v2.draft()?.id, v1.draft()?.id)
        XCTAssertEqual(try context.fetch(FetchDescriptor<StoreMenu>()).count, 1)
    }

    @MainActor
    func testSaveRequiresStoreName() throws {
        let context = ModelContext(try MenuLibrary.makeContainer(inMemory: true))
        var d = draft(price: 30)
        d.metadata.storeName = "  "
        XCTAssertThrowsError(try MenuLibrary.saveVersion(d, image: nil, storeID: nil, in: context))
    }

    @MainActor
    func testDemoMenuSeededOnce() throws {
        let context = ModelContext(try MenuLibrary.makeContainer(inMemory: true))
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "LibraryTests-\(UUID().uuidString)"))
        MenuLibrary.seedDemoIfNeeded(in: context, defaults: defaults)
        MenuLibrary.seedDemoIfNeeded(in: context, defaults: defaults)
        let stores = try context.fetch(FetchDescriptor<StoreMenu>())
        XCTAssertEqual(stores.count, 1)
        XCTAssertTrue(stores[0].isDemo)
        XCTAssertTrue(stores[0].storeName.contains("示範"))
        XCTAssertEqual(stores[0].latest?.draft()?.entries.count, DemoMenu.items.count)

        // 使用者刪除示範菜單後不會再自動加回
        context.delete(stores[0])
        try context.save()
        MenuLibrary.seedDemoIfNeeded(in: context, defaults: defaults)
        XCTAssertEqual(try context.fetch(FetchDescriptor<StoreMenu>()).count, 0)
    }
}
