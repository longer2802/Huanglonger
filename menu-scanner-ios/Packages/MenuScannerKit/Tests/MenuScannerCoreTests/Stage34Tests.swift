import XCTest
@testable import MenuScannerCore

/// menu-scanner-ios/Samples（由測試檔位置推算）。
private let samplesDir = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent() // MenuScannerCoreTests
    .deletingLastPathComponent() // Tests
    .deletingLastPathComponent() // MenuScannerKit
    .deletingLastPathComponent() // Packages
    .deletingLastPathComponent() // menu-scanner-ios
    .appendingPathComponent("Samples")

final class RescanMergerTests: XCTestCase {
    private func box(_ x: Double, _ y: Double) -> EntrySource {
        EntrySource(box: NormRect(x: x, y: y, width: 0.3, height: 0.03), rawText: "", lineIDs: [])
    }

    /// 左欄（x 0.05）與右欄（x 0.55）各兩筆；重掃右欄。
    private func draft() -> (MenuDraft, [UUID]) {
        let entries = [
            MenuEntry(name: "紅茶", size: "中杯", price: 30, source: box(0.05, 0.1)),
            MenuEntry(name: "綠茶", size: "中杯", price: 30, status: .confirmed, source: box(0.05, 0.2)),
            MenuEntry(name: "奶茶", size: "中杯", price: 40, status: .edited, source: box(0.55, 0.1)),          // 手動修改過
            MenuEntry(name: "鮮奶茶", size: "中杯", price: nil, reasons: [.unreadablePrice(raw: "5O")], source: box(0.55, 0.2)),
            MenuEntry(name: "可可", size: "中杯", price: 45, source: box(0.55, 0.3)),                            // 重掃沒讀到
        ]
        return (MenuDraft(result: ParseResult(entries: entries, excluded: [])), entries.map(\.id))
    }

    private let rightColumn = NormRect(x: 0.5, y: 0, width: 0.5, height: 1)

    func testRescanKeepsOtherColumnAndManualEdits() {
        var (d, ids) = draft()
        let rescanned = [
            MenuEntry(name: "奶茶", size: "中杯", price: 45, source: box(0.55, 0.1)),   // 與手動修改衝突
            MenuEntry(name: "鮮奶茶", size: "中杯", price: 50, source: box(0.55, 0.2)), // 更新待確認品項
            MenuEntry(name: "紅茶", size: "中杯", price: 99, source: box(0.55, 0.25)),  // 範圍內新讀到（不可動到左欄的紅茶）
        ]
        let plan = RescanMerger.plan(draft: d, region: rightColumn, rescanned: rescanned)
        XCTAssertEqual(plan.changes.map(\.kind), [.conflict, .update, .add, .remove])
        XCTAssertEqual(plan.changes.map(\.accepted), [false, true, true, false], "衝突與移除預設保留原內容")

        RescanMerger.apply(plan, to: &d)
        // 範圍外：左欄完全不動
        XCTAssertEqual(d.entry(ids[0])?.price, 30)
        XCTAssertEqual(d.entry(ids[1])?.status, .confirmed)
        // 手動修改的品項保留
        XCTAssertEqual(d.entry(ids[2])?.price, 40)
        XCTAssertEqual(d.entry(ids[2])?.status, .edited)
        // 待確認的品項更新為重掃結果，id 不變
        XCTAssertEqual(d.entry(ids[3])?.price, 50)
        XCTAssertEqual(d.entry(ids[3])?.status, .auto)
        // 沒讀到的預設保留
        XCTAssertEqual(d.entry(ids[4])?.price, 45)
        // 新增一筆
        XCTAssertEqual(d.entries.count, 6)
        XCTAssertEqual(d.entries.filter { $0.name == "紅茶" }.map(\.price), [30, 99])
    }

    func testUserCanChooseRescanVersionOnConflict() {
        var (d, ids) = draft()
        var plan = RescanMerger.plan(
            draft: d, region: rightColumn,
            rescanned: [MenuEntry(name: "奶茶", size: "中杯", price: 45, source: box(0.55, 0.1))]
        )
        let i = plan.changes.firstIndex { $0.kind == .conflict }!
        plan.changes[i].accepted = true
        RescanMerger.apply(plan, to: &d)
        XCTAssertEqual(d.entry(ids[2])?.price, 45)
        XCTAssertEqual(d.entry(ids[2])?.status, .confirmed)
    }

    func testIdenticalRescanHasNoChanges() {
        let (d, _) = draft()
        let same = d.entries.filter { RescanMerger.isInside($0, rightColumn) }
        let plan = RescanMerger.plan(draft: d, region: rightColumn, rescanned: same)
        XCTAssertTrue(plan.isEmpty)
        XCTAssertEqual(plan.unchangedCount, 3)
    }

    func testMatchesEditedNameByOriginalOCRName() {
        var d = MenuDraft(result: ParseResult(entries: [
            MenuEntry(name: "憲桃烏龍", size: "大杯", price: 60, source: box(0.55, 0.1), suggestedName: "蜜桃烏龍"),
        ], excluded: []))
        d.acceptSuggestion(d.entries[0].id)
        let plan = RescanMerger.plan(draft: d, region: rightColumn, rescanned: [
            MenuEntry(name: "憲桃烏龍", size: "大杯", price: 60, source: box(0.55, 0.1)),
        ])
        XCTAssertTrue(plan.isEmpty, "使用者採用建議後，重掃讀到原文不應變成新增：\(plan.changes.map(\.kind))")
    }
}

final class DemoAndSampleFileTests: XCTestCase {
    func testDemoMenuCoversRequiredCases() {
        let d = DemoMenu.draft()
        XCTAssertTrue(d.metadata.storeName.contains("示範"))
        XCTAssertTrue(d.entries.contains { $0.size == SizeLabel.single })
        XCTAssertTrue(d.entries.contains { $0.size == "中杯" } && d.entries.contains { $0.size == "大杯" })
        // 缺某杯型：鮮奶茶只有大杯
        XCTAssertEqual(d.entries.filter { $0.name == "鮮奶茶" }.map(\.size), ["大杯"])
        XCTAssertTrue(d.attentionEntries.isEmpty)
    }

    func testSampleCSVAndTXTMatchExporter() throws {
        let d = DemoMenu.draft()
        let csv = try Data(contentsOf: samplesDir.appendingPathComponent("示範菜單.csv"))
        XCTAssertEqual(csv, MenuExporter.data(.csv, entries: d.entries, metadata: d.metadata), "Samples/示範菜單.csv 與匯出結果不同")
        let txt = try Data(contentsOf: samplesDir.appendingPathComponent("示範菜單.txt"))
        XCTAssertEqual(txt, MenuExporter.data(.txt, entries: d.entries, metadata: d.metadata))
    }

    func testOfficeOrderJSONMatchesSampleAndFormat() throws {
        let d = DemoMenu.draft()
        let data = OfficeOrderExporter.backupJSON(entries: d.entries, metadata: d.metadata, exportedAt: DemoMenu.reviewedAt)
        let produced = try JSONSerialization.jsonObject(with: data) as? NSDictionary
        let sample = try JSONSerialization.jsonObject(with: Data(contentsOf: samplesDir.appendingPathComponent("示範菜單_辦公室揪訂.json"))) as? NSDictionary
        XCTAssertEqual(produced, sample)

        let obj = try XCTUnwrap(produced as? [String: Any])
        XCTAssertEqual(obj["app"] as? String, "office-group-order")
        XCTAssertEqual((obj["orders"] as? [Any])?.count, 0)
        let template = try XCTUnwrap((obj["templates"] as? [[String: Any]])?.first)
        XCTAssertEqual(template["vendorName"] as? String, "【示範】小森林茶飲（虛構）（示範店）")
        XCTAssertEqual(template["kind"] as? String, "drink")
        let items = try XCTUnwrap((template["menu"] as? [String: Any])?["items"] as? [[String: Any]])
        XCTAssertEqual(items.count, 7, "同品名多規格合併成一個品項")
        let milk = try XCTUnwrap(items.first { $0["name"] as? String == "鮮奶茶" })
        XCTAssertEqual((milk["variants"] as? [[String: Any]])?.count, 1)
        let aiyu = try XCTUnwrap(items.first { $0["name"] as? String == "檸檬愛玉" })
        XCTAssertEqual((aiyu["variants"] as? [[String: Any]])?.first?["label"] as? String, "", "單一價格標籤為空字串")
    }

    func testOfficeOrderSkipsPendingEntries() throws {
        var entries = DemoMenu.draft().entries
        entries.append(MenuEntry(name: "待確認品", size: "中杯", price: 10, reasons: [.priceOverlapsAdjacentRow]))
        let text = String(decoding: OfficeOrderExporter.backupJSON(entries: entries, metadata: DemoMenu.metadata), as: UTF8.self)
        XCTAssertFalse(text.contains("待確認品"))
    }
}

final class BenchmarkTests: XCTestCase {
    func testCSVReaderHandlesQuotesAndBOM() {
        let rows = CSVReader.rows("\u{FEFF}品名,規格,價格\r\n\"草莓, \"\"多多\"\"\",中杯,55\r\n\"多行\n品名\",,40\n")
        XCTAssertEqual(rows, [["品名", "規格", "價格"], ["草莓, \"多多\"", "中杯", "55"], ["多行\n品名", "", "40"]])
    }

    func testAnswerCSVAcceptsAppExportFormat() throws {
        let d = DemoMenu.draft()
        let text = MenuExporter.csv(d.entries, metadata: d.metadata)
        let answers = try AnswerCSV.parse(text)
        XCTAssertEqual(answers.count, d.entries.count)
        XCTAssertEqual(answers.last, AnswerRow(name: "檸檬愛玉", size: SizeLabel.single, price: 50))
        XCTAssertThrowsError(try AnswerCSV.parse("品名,價格\n紅茶,30"))
        XCTAssertThrowsError(try AnswerCSV.parse("品名,規格,價格\n紅茶,中杯,三十"))
    }

    func testScoringRules() {
        let answers = [
            AnswerRow(name: "紅茶", size: "中杯", price: 30),
            AnswerRow(name: "紅茶", size: "大杯", price: 35),
            AnswerRow(name: "綠茶", size: "中杯", price: 30),
            AnswerRow(name: "綠茶", size: "中杯", price: 30), // 重複答案各算一筆
            AnswerRow(name: "雞腿便當", size: "", price: 100),
        ]
        let entries = [
            MenuEntry(name: "紅茶", size: "中", price: 30),                 // 規格正規化後相符 → 正確
            MenuEntry(name: "紅茶", size: "大杯", price: 36),               // 價格不符 → 多抓
            MenuEntry(name: "綠 茶", size: "中杯", price: 30),              // 空白忽略 → 正確
            MenuEntry(name: "綠茶", size: "中杯", price: 30),               // 第二筆答案 → 正確
            MenuEntry(name: "綠茶", size: "中杯", price: 30),               // 答案已用完 → 多抓
            MenuEntry(name: "雞腿便當", size: SizeLabel.single, price: 100, reasons: [.possibleTypo(suggestion: "x")]), // 待確認 → 不計
        ]
        let s = BenchmarkScorer.score(answers: answers, entries: entries)
        XCTAssertEqual(s.answers, 5)
        XCTAssertEqual(s.correct, 3)
        XCTAssertEqual(s.autoCompleted, 5)
        XCTAssertEqual(s.pending, 1)
        XCTAssertEqual(s.extra.count, 2)
        XCTAssertEqual(s.missed, [AnswerRow(name: "紅茶", size: "大杯", price: 35), AnswerRow(name: "雞腿便當", size: "", price: 100)])
        XCTAssertEqual(s.recall, 0.6, accuracy: 1e-9)
        XCTAssertEqual(s.precision, 0.6, accuracy: 1e-9)
    }

    func testReportLabelsSyntheticData() {
        let score = BenchmarkScorer.score(answers: [AnswerRow(name: "紅茶", size: "中杯", price: 30)], entries: [MenuEntry(name: "紅茶", size: "中杯", price: 30)])
        let synthetic = BenchmarkImageResult(manifest: ManifestEntry(file: "合成-a.png", layout: "單欄", split: "調整", source: "合成"), score: score, seconds: 0.5)
        let md = BenchmarkReport.markdown([synthetic])
        XCTAssertTrue(md.contains("合成資料，非真實驗收"))
        XCTAssertFalse(md.contains("## 真實菜單"))

        let real = BenchmarkImageResult(manifest: ManifestEntry(file: "a.jpg", layout: "多欄", split: "保留", source: "真實"), score: score, seconds: 0.5)
        let both = BenchmarkReport.markdown([synthetic, real])
        XCTAssertTrue(both.contains("## 真實菜單"))
        XCTAssertTrue(both.contains("用途：保留"))
        XCTAssertEqual(Array(BenchmarkReport.csv([real]).prefix(3)), [0xEF, 0xBB, 0xBF])
    }

    func testManifestParsingAndFallback() {
        let m = ManifestEntry.parse("檔名,版型,用途,來源\n合成-01.png,單欄單價,調整,合成\nshop.jpg,多欄,保留,真實\n# 註解,,,\n")
        XCTAssertEqual(m.count, 2)
        XCTAssertEqual(m["shop.jpg"]?.split, "保留")
        XCTAssertTrue(m["合成-01.png"]!.isSynthetic)
        XCTAssertTrue(ManifestEntry.fallback(file: "合成-x.png").isSynthetic)
        XCTAssertFalse(ManifestEntry.fallback(file: "real.jpg").isSynthetic)
    }
}
