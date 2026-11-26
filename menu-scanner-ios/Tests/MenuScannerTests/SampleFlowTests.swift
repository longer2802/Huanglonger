import MenuScannerCore
import XCTest
@testable import MenuScanner

/// 合成示範圖實際走 Vision＋解析（流程驗證，不代表真實菜單準確率）。
final class SampleFlowTests: XCTestCase {
    func testSampleMenuRecognizesAndParses() async throws {
        let cg = try XCTUnwrap(ImagePreparation.uprightCGImage(from: SampleMenu.image()))
        let doc: OCRDocument
        do {
            doc = try await VisionTextRecognizer().recognize(cg, region: nil, enhanceContrast: false)
        } catch {
            throw XCTSkip("此模擬器無法執行 Vision 文字辨識：\(error.localizedDescription)")
        }
        let result = MenuParser.parse(doc)
        let summary = result.entries.map { "\($0.name)|\($0.size)|\($0.price.map(String.init) ?? "-")" }
        print("示範圖辨識結果：", summary, "排除：", result.excluded.map(\.text))

        XCTAssertFalse(result.entries.isEmpty, "\(doc.lines.map(\.text))")
        // 價格不能是電話數字
        XCTAssertFalse(result.entries.contains { $0.price == 0 || $0.price == 2 })
        // 至少一筆標準品項完全正確（品名、規格、價格）
        XCTAssertTrue(result.entries.contains { $0.name == "紅茶" && $0.size == "中杯" && $0.price == 30 }, "\(summary)")
        XCTAssertTrue(result.entries.contains { $0.name == "紅茶" && $0.size == "大杯" && $0.price == 35 }, "\(summary)")
        // 「—」不產生鮮奶茶中杯
        XCTAssertFalse(result.entries.contains { $0.name == "鮮奶茶" && $0.size == "中杯" && $0.price != nil }, "\(summary)")
    }
}

final class DraftStoreTests: XCTestCase {
    func testSaveAndReloadDraftWithImage() throws {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = DraftStore(directory: dir)
        defer { store.clear() }
        XCTAssertFalse(store.hasDraft)

        var draft = MenuDraft(
            metadata: MenuMetadata(storeName: "測試店", branch: "一店"),
            result: MenuParser.parsePlainText("品名 中杯 大杯\n紅茶 30 35\n珍珠奶茶 50")
        )
        let first = try XCTUnwrap(draft.entries.first?.id)
        draft.apply(EntryEdit(category: "茶", name: "紅茶", size: "中杯", price: 32), to: first)
        let image = try XCTUnwrap(ImagePreparation.uprightCGImage(from: SampleMenu.image()))

        try store.save(draft, image: image)
        XCTAssertTrue(store.hasDraft)
        let (loaded, loadedImage) = try store.load()
        XCTAssertEqual(loaded, draft)
        XCTAssertEqual(loaded.entry(first)?.status, .edited)
        XCTAssertEqual(loadedImage?.width, image.width)
    }
}
