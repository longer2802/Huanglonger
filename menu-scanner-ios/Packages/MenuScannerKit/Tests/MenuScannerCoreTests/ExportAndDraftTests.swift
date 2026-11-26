import XCTest
@testable import MenuScannerCore

final class ExportTests: XCTestCase {
    private let meta = MenuMetadata(
        storeName: "小森林茶飲", branch: "信義店", kind: .drink,
        reviewedAt: Date(timeIntervalSince1970: 1_795_651_200) // 2026-11-26 00:00 UTC
    )

    private var entries: [MenuEntry] {
        [
            MenuEntry(category: "醇茶", name: "蜜桃烏龍", size: "大杯", price: 65),
            MenuEntry(category: "醇茶", name: "紅茶", size: SizeLabel.single, price: 30, status: .confirmed),
            MenuEntry(category: "特調", name: "草莓, \"多多\"", size: "中杯", price: 55, status: .edited),
            MenuEntry(category: "", name: "多行\n品名", size: "", price: 40),
            // 不能匯出：待確認、缺價格
            MenuEntry(name: "珍珠奶茶", size: "", price: nil, candidatePrices: [55, 65], reasons: [.multiplePricesWithoutHeader]),
            MenuEntry(name: "芒果綠", size: "中杯", price: 50, reasons: [.priceOverlapsAdjacentRow]),
            MenuEntry(name: "檸檬綠", size: "大杯", price: nil, status: .confirmed),
        ]
    }

    func testTXTTraditionalChineseOneLinePerEntry() {
        let txt = MenuExporter.txt(entries)
        XCTAssertEqual(txt, "蜜桃烏龍｜大杯｜65 元\n紅茶｜單一｜30 元\n草莓, \"多多\"｜中杯｜55 元\n多行 品名｜單一｜40 元\n")
        XCTAssertFalse(txt.contains("珍珠奶茶"))
        XCTAssertFalse(txt.contains("芒果綠"), "待確認價格不能默默帶入")
    }

    func testCSVEscapingAndHeader() {
        let csv = MenuExporter.csv(entries, metadata: meta)
        let expected = [
            "店家,分店,分類,品名,規格,價格",
            "小森林茶飲,信義店,醇茶,蜜桃烏龍,大杯,65",
            "小森林茶飲,信義店,醇茶,紅茶,單一,30",
            "小森林茶飲,信義店,特調,\"草莓, \"\"多多\"\"\",中杯,55",
            "小森林茶飲,信義店,,\"多行\n品名\",單一,40",
        ].joined(separator: "\r\n") + "\r\n"
        XCTAssertEqual(csv, expected)
    }

    func testCSVDataHasBOMAndUTF8() throws {
        let data = MenuExporter.data(.csv, entries: entries, metadata: meta)
        XCTAssertEqual(Array(data.prefix(3)), [0xEF, 0xBB, 0xBF])
        let body = try XCTUnwrap(String(data: data.dropFirst(3), encoding: .utf8))
        XCTAssertTrue(body.hasPrefix("店家,分店,分類,品名,規格,價格"))
        let txt = MenuExporter.data(.txt, entries: entries, metadata: meta)
        XCTAssertNotEqual(Array(txt.prefix(3)), [0xEF, 0xBB, 0xBF], "TXT 為一般 UTF-8")
        XCTAssertEqual(String(data: txt, encoding: .utf8), MenuExporter.txt(entries))
    }

    func testPriceIsIntegerOnly() {
        let csv = MenuExporter.csv([MenuEntry(name: "A", size: "M", price: 120)], metadata: meta)
        XCTAssertTrue(csv.contains(",120\r\n"))
        XCTAssertFalse(csv.contains("120.0"))
    }

    func testFileNameContainsStoreBranchDate() {
        let utc = TimeZone(identifier: "UTC")!
        XCTAssertEqual(MenuExporter.fileName(meta, format: .csv, timeZone: utc), "小森林茶飲_信義店_2026-11-26.csv")
        var m = meta
        m.storeName = "茶/飲:店"
        m.branch = ""
        XCTAssertEqual(MenuExporter.fileName(m, format: .txt, timeZone: utc), "茶飲店_2026-11-26.txt")
        m.storeName = ""
        XCTAssertEqual(MenuExporter.fileName(m, format: .txt, timeZone: utc), "菜單_2026-11-26.txt")
    }
}

final class MenuDraftTests: XCTestCase {
    private func draft() -> MenuDraft {
        MenuDraft(result: ParseResult(entries: [
            MenuEntry(name: "憲桃烏龍", size: "大杯", price: 65, reasons: [.possibleTypo(suggestion: "蜜桃烏龍")], suggestedName: "蜜桃烏龍"),
            MenuEntry(name: "珍珠奶茶", size: "", price: nil, candidatePrices: [55, 65], reasons: [.multiplePricesWithoutHeader]),
            MenuEntry(name: "紅茶", size: "中杯", price: 30),
        ], excluded: []))
    }

    func testAcceptSuggestionKeepsOriginal() {
        var d = draft()
        let id = d.entries[0].id
        d.acceptSuggestion(id)
        let e = d.entry(id)!
        XCTAssertEqual(e.name, "蜜桃烏龍")
        XCTAssertEqual(e.originalName, "憲桃烏龍")
        XCTAssertEqual(e.status, .edited)
        XCTAssertTrue(MenuExporter.isExportable(e))
    }

    func testConfirmWithoutChangeAndEditStatus() {
        var d = draft()
        let red = d.entries[2].id
        d.confirm(red)
        XCTAssertEqual(d.entry(red)?.status, .confirmed)

        let milk = d.entries[1].id
        XCTAssertTrue(MenuDraft.needsAttention(d.entry(milk)!))
        d.apply(EntryEdit(category: "", name: "珍珠奶茶", size: "大杯", price: 65), to: milk)
        XCTAssertEqual(d.entry(milk)?.status, .edited)
        XCTAssertEqual(d.entry(milk)?.reasons, [])
        XCTAssertEqual(d.entry(milk)?.candidatePrices, [])
        XCTAssertFalse(MenuDraft.needsAttention(d.entry(milk)!))
    }

    func testConfirmedWithoutPriceStillBlocksExport() {
        var d = draft()
        let milk = d.entries[1].id
        d.apply(EntryEdit(category: "", name: "珍珠奶茶", size: "中杯", price: nil), to: milk)
        XCTAssertTrue(MenuDraft.needsAttention(d.entry(milk)!))
        XCTAssertEqual(MenuDraft.attentionMessages(d.entry(milk)!), ["缺少價格"])
        XCTAssertFalse(MenuExporter.txt(d.entries).contains("珍珠奶茶"))
    }

    func testAddSizeAndDelete() throws {
        var d = draft()
        let red = d.entries[2].id
        let large = try XCTUnwrap(d.addSize(to: red, size: "大杯", price: 35))
        XCTAssertEqual(d.entries.map(\.name), ["憲桃烏龍", "珍珠奶茶", "紅茶", "紅茶"])
        XCTAssertEqual(d.entry(large)?.size, "大杯")
        XCTAssertEqual(d.entry(large)?.status, .edited)
        d.delete(large)
        XCTAssertEqual(d.entries.count, 3)
        d.addEntry(EntryEdit(category: "鬆餅", name: "原味鬆餅", size: "", price: 60))
        XCTAssertEqual(d.entries.last?.name, "原味鬆餅")
        XCTAssertEqual(d.attentionEntries.map(\.name), ["憲桃烏龍", "珍珠奶茶"])
    }

    func testDraftCodableRoundTrip() throws {
        let d = draft()
        let back = try JSONDecoder().decode(MenuDraft.self, from: JSONEncoder().encode(d))
        XCTAssertEqual(back, d)
    }
}
