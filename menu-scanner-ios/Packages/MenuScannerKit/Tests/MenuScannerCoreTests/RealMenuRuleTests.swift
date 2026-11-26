import XCTest
@testable import MenuScannerCore

/// 依真實菜單（麻古茶坊手機截圖，屬「調整」組）觀察到的版面寫成的回歸測試：
/// L／瓶 表頭、冷/熱 與碎冰沙標記、季節標籤、手機狀態列、糖量冰量表、加料、促銷、品名附註。
final class RealMenuRuleTests: XCTestCase {
    func testTokenizerRulesFromRealMenu() {
        XCTAssertEqual(TextNormalizer.normalizeSize("瓶"), "瓶")
        let attached = Tokenizer.tokens(for: OCRLine(id: 0, text: "芝芝芒果果粒5-9月 90", box: .unit))
        XCTAssertEqual(attached.map(\.kind), [.text, .price(90)], "季節標籤不能被讀成價格 5")
        XCTAssertEqual(attached.first?.raw, "芝芝芒果果粒")
        XCTAssertEqual(Tokenizer.tokens(for: OCRLine(id: 0, text: "5-9月", box: .unit)).map(\.kind), [.note])
        XCTAssertEqual(Tokenizer.tokens(for: OCRLine(id: 0, text: "冷/熱", box: .unit)).map(\.kind), [.note])
        XCTAssertEqual(Tokenizer.tokens(for: OCRLine(id: 0, text: "碎冰沙/熱", box: .unit)).map(\.kind), [.note])
        XCTAssertEqual(Tokenizer.tokens(for: OCRLine(id: 0, text: "L瓶", box: .unit)).map(\.kind), [.multiHeader(["L", "瓶"])])
        XCTAssertEqual(NameCleaner.cleanName("波霸奶茶 (椰果/波波/綠茶凍)"), "波霸奶茶")
        XCTAssertEqual(NameCleaner.cleanName("玫瑰奶茶 產品略含甜度"), "玫瑰奶茶")
        XCTAssertEqual(NameCleaner.cleanName("珍珠奶茶(大)"), "珍珠奶茶(大)", "不含選項清單的括號保留")
        XCTAssertEqual(NoiseFilter.noiseReason(for: "糖量表 無糖 一分 三分 半糖 八分 正常"), "甜度冰量表")
        XCTAssertEqual(NoiseFilter.noiseReason(for: "冰量表 去冰 微冰 少冰 正常冰"), "甜度冰量表")
        XCTAssertEqual(NoiseFilter.noiseReason(for: "去冰 0% ICE 微冰 30% ICE"), "甜度冰量表")
        XCTAssertNotNil(NoiseFilter.noiseReason(for: "圖片可能受著作權保護"))
        XCTAssertTrue(NoiseFilter.isPromotion("買5送1"))
        XCTAssertTrue(NoiseFilter.isPromotion("回購瓶裝任一飲品 現折$10"))
        XCTAssertTrue(NoiseFilter.isPromotion("+$10 波霸 雙Q果 椰果 養樂多"))
    }

    func testTwoColumnScreenshotWithLAndBottleHeaders() {
        var f = MenuFixture()
        // 手機截圖的狀態列
        f.add("13:26", x: 0.10, y: 0.01)
        f.add("5G 74", x: 0.70, y: 0.01, w: 0.06)
        // 左欄
        f.add("飲中甜品", x: 0.05, y: 0.10, h: 0.025)
        f.add("L", x: 0.40, y: 0.13, h: 0.02)
        f.add("瓶", x: 0.46, y: 0.13, h: 0.02)
        f.add("芝芝芒果果粒 5-9月", x: 0.05, y: 0.16, h: 0.02)
        f.add("碎冰沙", x: 0.30, y: 0.16, h: 0.02)
        f.add("90", x: 0.40, y: 0.16, h: 0.02)
        f.add("-", x: 0.46, y: 0.16, h: 0.02)
        f.add("蕃茄梅蜜", x: 0.05, y: 0.19, h: 0.02)
        f.add("冰沙", x: 0.30, y: 0.19, h: 0.02)
        f.add("70", x: 0.40, y: 0.19, h: 0.02)
        f.add("100", x: 0.46, y: 0.19, h: 0.02)
        f.add("原味茶", x: 0.05, y: 0.23, h: 0.025)
        f.add("L", x: 0.40, y: 0.26, h: 0.02)
        f.add("瓶", x: 0.46, y: 0.26, h: 0.02)
        f.add("高山金萱茶", x: 0.05, y: 0.29, h: 0.02)
        f.add("冷/熱", x: 0.30, y: 0.29, h: 0.02)
        f.add("30", x: 0.40, y: 0.29, h: 0.02)
        f.add("45", x: 0.46, y: 0.29, h: 0.02)
        f.add("波霸奶茶 (椰果/波波/綠茶凍)", x: 0.05, y: 0.32, h: 0.02)
        f.add("冷/熱", x: 0.36, y: 0.32, h: 0.02, w: 0.03)
        f.add("50", x: 0.40, y: 0.32, h: 0.02)
        f.add("75", x: 0.46, y: 0.32, h: 0.02)
        f.add("玫瑰奶茶 / 產品略含甜度", x: 0.05, y: 0.35, h: 0.02)
        f.add("冷/熱", x: 0.33, y: 0.35, h: 0.02)
        f.add("60", x: 0.40, y: 0.35, h: 0.02)
        f.add("85", x: 0.46, y: 0.35, h: 0.02)
        // 右欄
        f.add("鮮奶系列", x: 0.55, y: 0.10, h: 0.025)
        f.add("L", x: 0.89, y: 0.13, h: 0.02)
        f.add("瓶", x: 0.95, y: 0.13, h: 0.02)
        f.add("紅茶拿鐵", x: 0.55, y: 0.16, h: 0.02)
        f.add("冷/熱", x: 0.80, y: 0.16, h: 0.02)
        f.add("65", x: 0.89, y: 0.16, h: 0.02)
        f.add("95", x: 0.95, y: 0.16, h: 0.02)
        f.add("玫瑰紅茶拿鐵", x: 0.55, y: 0.19, h: 0.02)
        f.add("70", x: 0.89, y: 0.19, h: 0.02)
        f.add("100", x: 0.95, y: 0.19, h: 0.02)
        // 下方：加料、糖量冰量表、促銷
        f.add("+$10 波霸 雙Q果 椰果 養樂多", x: 0.55, y: 0.60, w: 0.40)
        f.add("糖量表 無糖 一分 三分 半糖 八分 正常", x: 0.55, y: 0.70, w: 0.40)
        f.add("冰量表 去冰 微冰 少冰 正常冰", x: 0.05, y: 0.70, w: 0.40)
        f.add("買5送1", x: 0.05, y: 0.80)
        let r = f.parse()

        let expected: Set<String> = [
            "芝芝芒果果粒|L|90",
            "蕃茄梅蜜|L|70", "蕃茄梅蜜|瓶|100",
            "高山金萱茶|L|30", "高山金萱茶|瓶|45",
            "波霸奶茶|L|50", "波霸奶茶|瓶|75",
            "玫瑰奶茶|L|60", "玫瑰奶茶|瓶|85",
            "紅茶拿鐵|L|65", "紅茶拿鐵|瓶|95",
            "玫瑰紅茶拿鐵|L|70", "玫瑰紅茶拿鐵|瓶|100",
        ]
        let resolved = Set(r.resolvedEntries.map { "\($0.name)|\($0.size)|\($0.price.map(String.init) ?? "-")" })
        XCTAssertEqual(resolved, expected, "\nall: \(r.summary)\nexcluded: \(r.excluded.map { "\($0.reason):\($0.text)" })")
        XCTAssertFalse(r.entries.contains { $0.price == 74 || $0.price == 5 })
        XCTAssertEqual(r.entries.first { $0.name == "高山金萱茶" }?.category, "原味茶")
        XCTAssertEqual(r.entries.first { $0.name == "紅茶拿鐵" }?.category, "鮮奶系列")
        XCTAssertTrue(r.pendingEntries.allSatisfy { $0.reasons.contains(.addonOrPromotion) }, "\(r.pendingEntries.map(\.name))")
    }
}
