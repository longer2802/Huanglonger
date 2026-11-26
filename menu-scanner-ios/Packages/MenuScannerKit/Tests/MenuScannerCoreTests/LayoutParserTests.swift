import XCTest
@testable import MenuScannerCore

final class LayoutParserTests: XCTestCase {
    // 單價格便當菜單：每行「品名 價格」為同一個 OCR 行
    func testSinglePriceBentoMenu() {
        var f = MenuFixture()
        f.add("雞腿便當 100", x: 0.05, y: 0.20, w: 0.40)
        f.add("排骨便當 95", x: 0.05, y: 0.25, w: 0.40)
        f.add("滷肉飯 45", x: 0.05, y: 0.30, w: 0.40)
        f.add("電話 02-2345-6789", x: 0.05, y: 0.90, w: 0.40)
        let r = f.parse()

        XCTAssertEqual(r.summary, ["雞腿便當|單一|100", "排骨便當|單一|95", "滷肉飯|單一|45"])
        XCTAssertTrue(r.entries.allSatisfy { $0.status == .auto })
        XCTAssertFalse(r.allPrices.contains(2345))
        XCTAssertTrue(r.excluded.contains { $0.reason.contains("電話") })
    }

    // 左右兩欄相鄰，而且出現相同價格：價格不能跨欄配對
    func testTwoAdjacentColumnsWithSamePrices() {
        var f = MenuFixture()
        // 左欄
        f.add("中杯", x: 0.30, y: 0.10)
        f.add("大杯", x: 0.38, y: 0.10)
        f.add("紅茶", x: 0.05, y: 0.15)
        f.add("30", x: 0.30, y: 0.15)
        f.add("35", x: 0.38, y: 0.15)
        f.add("綠茶", x: 0.05, y: 0.20)
        f.add("30", x: 0.30, y: 0.20)
        f.add("35", x: 0.38, y: 0.20)
        // 右欄
        f.add("中杯", x: 0.75, y: 0.10)
        f.add("大杯", x: 0.83, y: 0.10)
        f.add("奶茶", x: 0.50, y: 0.15)
        f.add("30", x: 0.75, y: 0.15)
        f.add("35", x: 0.83, y: 0.15)
        f.add("鮮奶茶", x: 0.50, y: 0.20)
        f.add("45", x: 0.75, y: 0.20)
        f.add("55", x: 0.83, y: 0.20)
        let r = f.parse()

        XCTAssertEqual(r.entries.count, 8, "\(r.summary)")
        XCTAssertEqual(r.price("紅茶", "中杯"), 30)
        XCTAssertEqual(r.price("紅茶", "大杯"), 35)
        XCTAssertEqual(r.price("綠茶", "大杯"), 35)
        XCTAssertEqual(r.price("奶茶", "中杯"), 30)
        XCTAssertEqual(r.price("鮮奶茶", "中杯"), 45)
        XCTAssertEqual(r.price("鮮奶茶", "大杯"), 55)
        XCTAssertTrue(r.entries.allSatisfy { $0.status == .auto }, "\(r.entries.map(\.reasons))")
        // 左欄品名不能拿到右欄的價格
        XCTAssertEqual(r.entries(named: "綠茶").count, 2)
        XCTAssertFalse(r.entries(named: "綠茶").contains { $0.price == 45 || $0.price == 55 })
    }

    // 表頭從大杯排到中杯；「—」表示未供應；某杯型空白
    func testReversedHeaderDashAndMissingSize() {
        var f = MenuFixture()
        f.add("鮮果系列", x: 0.05, y: 0.02)
        f.add("大杯", x: 0.40, y: 0.06)
        f.add("中杯", x: 0.55, y: 0.06)
        f.add("芒果冰沙", x: 0.05, y: 0.10)
        f.add("—", x: 0.40, y: 0.10)
        f.add("60", x: 0.55, y: 0.10)
        f.add("紅茶", x: 0.05, y: 0.15)
        f.add("40", x: 0.40, y: 0.15)
        f.add("35", x: 0.55, y: 0.15)
        f.add("檸檬綠", x: 0.05, y: 0.20)
        f.add("45", x: 0.55, y: 0.20)
        let r = f.parse()

        XCTAssertEqual(r.price("紅茶", "大杯"), 40)
        XCTAssertEqual(r.price("紅茶", "中杯"), 35)
        XCTAssertEqual(r.price("芒果冰沙", "中杯"), 60)
        XCTAssertEqual(r.entries(named: "芒果冰沙").count, 1, "「—」不應產生一筆資料")
        XCTAssertEqual(r.price("檸檬綠", "中杯"), 45)
        XCTAssertEqual(r.entries(named: "檸檬綠").count, 1)
        XCTAssertTrue(r.entries.allSatisfy { $0.category == "鮮果" || $0.category == "鮮果系列" }, "\(r.entries.map(\.category))")
        XCTAssertTrue(r.entries.allSatisfy { $0.status == .auto }, "\(r.entries.map(\.reasons))")
    }

    // 品名換行：第二行接在品名後面
    func testWrappedItemName() {
        var f = MenuFixture()
        f.add("冬瓜檸檬", x: 0.05, y: 0.300)
        f.add("55", x: 0.50, y: 0.300)
        f.add("愛玉", x: 0.05, y: 0.335)
        f.add("紅茶", x: 0.05, y: 0.400)
        f.add("30", x: 0.50, y: 0.400)
        let r = f.parse()

        XCTAssertEqual(r.summary, ["冬瓜檸檬愛玉|單一|55", "紅茶|單一|30"])
    }

    // 英文副標（較小字）不併入品名
    func testSmallEnglishSubtitleIsNotPartOfName() {
        var f = MenuFixture()
        f.add("蜜桃烏龍", x: 0.05, y: 0.30)
        f.add("55", x: 0.50, y: 0.30)
        f.add("Peach Oolong", x: 0.05, y: 0.333, h: 0.015)
        f.add("紅茶", x: 0.05, y: 0.40)
        f.add("30", x: 0.50, y: 0.40)
        let r = f.parse()

        XCTAssertEqual(r.summary, ["蜜桃烏龍|單一|55", "紅茶|單一|30"])
    }

    // 價格看不清楚：保持空白、不補 0、標待確認
    func testUnreadablePriceStaysEmpty() {
        var f = MenuFixture()
        f.add("芒果綠", x: 0.05, y: 0.10)
        f.add("6O", x: 0.40, y: 0.10)
        let r = f.parse()

        XCTAssertEqual(r.entries.count, 1)
        let e = r.entries[0]
        XCTAssertNil(e.price)
        XCTAssertEqual(e.status, .needsReview)
        XCTAssertTrue(e.reasons.contains(.unreadablePrice(raw: "6O")))
    }

    // 兩個價格又沒有表頭：保留候選、不猜杯型
    func testTwoPricesWithoutHeaderKeepsCandidates() {
        var f = MenuFixture()
        f.add("珍珠奶茶", x: 0.05, y: 0.10)
        f.add("55", x: 0.40, y: 0.10)
        f.add("65", x: 0.50, y: 0.10)
        f.add("烏龍綠 55/65", x: 0.05, y: 0.20, w: 0.30)
        let r = f.parse()

        for name in ["珍珠奶茶", "烏龍綠"] {
            let es = r.entries(named: name)
            XCTAssertEqual(es.count, 1, name)
            XCTAssertNil(es.first?.price)
            XCTAssertEqual(es.first?.candidatePrices, [55, 65])
            XCTAssertEqual(es.first?.reasons.contains(.multiplePricesWithoutHeader), true)
        }
    }

    // 行內規格：M55 L65
    func testInlineSizedPrices() {
        var f = MenuFixture()
        f.add("蜂蜜檸檬 M55 L65", x: 0.05, y: 0.10, w: 0.40)
        let r = f.parse()
        XCTAssertEqual(r.price("蜂蜜檸檬", "M"), 55)
        XCTAssertEqual(r.price("蜂蜜檸檬", "L"), 65)
    }

    // 價格夾在兩列中間且距離相同：標「價格與上一列重疊」
    func testPriceOverlappingTwoRowsIsFlagged() {
        var f = MenuFixture()
        f.add("紅茶", x: 0.05, y: 0.10)
        f.add("綠茶", x: 0.05, y: 0.13)
        f.add("30", x: 0.50, y: 0.115)
        let r = f.parse()
        XCTAssertTrue(r.entries.contains { $0.reasons.contains(.priceOverlapsAdjacentRow) && $0.status == .needsReview }, "\(r.entries)")
    }

    // 電話、容量、促銷、甜度冰量表、地址、日期、著作權都不能當售價；「無糖綠茶」不能被誤刪
    func testNoiseIsNotTreatedAsPrice() {
        var f = MenuFixture()
        f.add("鮮奶茶 700ml 60", x: 0.05, y: 0.10, w: 0.40)
        f.add("無糖綠茶", x: 0.05, y: 0.15)
        f.add("30", x: 0.40, y: 0.15)
        f.add("甜度：正常 少糖 半糖 微糖 無糖", x: 0.05, y: 0.60, w: 0.60)
        f.add("冰塊：正常冰 少冰 去冰 熱", x: 0.05, y: 0.65, w: 0.60)
        f.add("買一送一 珍奶 50", x: 0.05, y: 0.70, w: 0.40)
        f.add("加珍珠 +10", x: 0.05, y: 0.73, w: 0.30)
        f.add("活動期間 11/1~11/30", x: 0.05, y: 0.76, w: 0.40)
        f.add("電話：02-2345-6789", x: 0.05, y: 0.80, w: 0.40)
        f.add("台北市大安區復興南路一段100號", x: 0.05, y: 0.85, w: 0.60)
        f.add("©2024 茶飲小舖 版權所有", x: 0.05, y: 0.90, w: 0.50)
        let r = f.parse()

        XCTAssertEqual(r.price("鮮奶茶", "700ml"), 60)
        XCTAssertEqual(r.price("無糖綠茶", SizeLabel.single), 30)
        for bad in [700, 2345, 6789, 100, 2024, 11, 30_000] where bad != 30 {
            XCTAssertFalse(r.resolvedEntries.contains { $0.price == bad }, "誤把 \(bad) 當售價：\(r.summary)")
        }
        // 促銷與加料進待確認，不會變成自動完成的品項
        let promos = r.entries.filter { $0.reasons.contains(.addonOrPromotion) }
        XCTAssertEqual(promos.count, 2, "\(r.summary)")
        XCTAssertTrue(promos.allSatisfy { $0.status == .needsReview })
        XCTAssertEqual(r.resolvedEntries.count, 2, "\(r.summary)")
        XCTAssertEqual(Set(r.excluded.map(\.reason)), ["甜度冰量表", "日期或營業時間", "電話或聯絡資訊", "地址", "著作權"])
    }

    // 詞庫：只給建議，原文保留
    func testLexiconSuggestsButKeepsOriginal() {
        var f = MenuFixture()
        f.add("憲桃烏龍", x: 0.05, y: 0.10)
        f.add("55", x: 0.40, y: 0.10)
        f.add("拿錢", x: 0.05, y: 0.15)
        f.add("60", x: 0.40, y: 0.15)
        let r = f.parse()

        let peach = try? XCTUnwrap(r.entries.first { $0.originalName == "憲桃烏龍" })
        XCTAssertEqual(peach?.name, "憲桃烏龍")
        XCTAssertEqual(peach?.suggestedName, "蜜桃烏龍")
        XCTAssertEqual(peach?.price, 55)
        XCTAssertEqual(peach?.status, .needsReview)
        XCTAssertEqual(peach?.reasons, [.possibleTypo(suggestion: "蜜桃烏龍")])
        XCTAssertEqual(r.entries.first { $0.originalName == "拿錢" }?.suggestedName, "拿鐵")
    }

    // Vision 提供逐字框時使用實際位置
    func testUsesWordBoxesWhenProvided() {
        let line = OCRLine(
            id: 0, text: "紅茶 30 35",
            box: NormRect(x: 0.05, y: 0.2, width: 0.6, height: 0.03),
            wordBoxes: [
                NormRect(x: 0.05, y: 0.2, width: 0.05, height: 0.03),
                NormRect(x: 0.40, y: 0.2, width: 0.03, height: 0.03),
                NormRect(x: 0.60, y: 0.2, width: 0.03, height: 0.03),
            ]
        )
        let headers = [
            OCRLine(id: 1, text: "中杯", box: NormRect(x: 0.40, y: 0.15, width: 0.04, height: 0.03)),
            OCRLine(id: 2, text: "大杯", box: NormRect(x: 0.60, y: 0.15, width: 0.04, height: 0.03)),
        ]
        let r = LayoutParser().parse(OCRDocument(lines: headers + [line]))
        XCTAssertEqual(r.price("紅茶", "中杯"), 30)
        XCTAssertEqual(r.price("紅茶", "大杯"), 35)
    }

    // 標準答案格式：每個規格獨立一筆、同名不同杯型區分
    func testEachSizeIsSeparateEntryWithSource() {
        var f = MenuFixture()
        f.add("M", x: 0.40, y: 0.05)
        f.add("L", x: 0.50, y: 0.05)
        f.add("紅茶", x: 0.05, y: 0.10)
        f.add("30", x: 0.40, y: 0.10)
        f.add("35", x: 0.50, y: 0.10)
        let r = f.parse()
        XCTAssertEqual(r.summary, ["紅茶|M|30", "紅茶|L|35"])
        XCTAssertNotEqual(r.entries[0].id, r.entries[1].id)
        XCTAssertNotNil(r.entries[0].source?.box)
        XCTAssertEqual(r.entries[0].source?.lineIDs.contains(2), true)
    }
}
