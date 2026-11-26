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

    /// 截圖底部的搜尋列、英文副標等單一字塊跨過欄間空白時，左右欄仍要分開。
    func testStrayBridgingTextDoesNotMergeColumns() {
        var f = MenuFixture()
        let left = ["紅茶", "綠茶", "青茶", "烏龍", "奶茶", "可可", "多多", "梅綠", "檸紅", "柚綠", "桔茶", "麥茶", "冬瓜", "鐵觀音"]
        let right = ["拿鐵", "可可奶", "紅拿", "綠拿", "奶綠", "芋奶", "布丁奶", "椰奶", "仙草奶", "豆奶", "烏拿", "鐵拿", "玫拿", "蜜拿"]
        for (i, n) in left.enumerated() {
            f.add(n, x: 0.05, y: 0.05 + Double(i) * 0.05, h: 0.02)
            f.add("30", x: 0.30, y: 0.05 + Double(i) * 0.05, h: 0.02)
        }
        for (i, n) in right.enumerated() {
            f.add(n, x: 0.50, y: 0.05 + Double(i) * 0.05, h: 0.02)
            f.add("40", x: 0.80, y: 0.05 + Double(i) * 0.05, h: 0.02)
        }
        f.add("Q麻古茶坊 屏東林森", x: 0.20, y: 0.80, h: 0.02, w: 0.34)
        let r = f.parse()
        XCTAssertEqual(r.resolvedEntries.filter { $0.price == 30 }.map(\.name), left)
        XCTAssertEqual(r.resolvedEntries.filter { $0.price == 40 }.map(\.name), right)
    }

    func testIconPrefixesAreStripped() {
        XCTAssertEqual(NameCleaner.cleanName("@楊枝甘露2.0"), "楊枝甘露2.0")
        XCTAssertEqual(NameCleaner.cleanName("@ 紅茶拿鐵"), "紅茶拿鐵")
        XCTAssertEqual(NameCleaner.cleanName("a 柳橙芒果果粒茶"), "柳橙芒果果粒茶")
        XCTAssertEqual(NameCleaner.cleanName("Latte"), "Latte")
    }

    /// 分塊 OCR 實際讀到的品名尾巴（溫度標記、季節標籤、甜度附註、英文副標的各種讀法）。
    func testOCRSuffixVariantsAreStripped() {
        let cases: [(String, String)] = [
            ("楊枝甘露2.0 59月体冰沙", "楊枝甘露2.0"),
            ("芝芝芒果果粒 ⑤59月 s冰沙", "芝芝芒果果粒"),
            ("芒果果粒波波659月", "芒果果粒波波"),
            ("芝芝葡萄果粒 103月", "芝芝葡萄果粒"),
            ("濃厚芋泥鮮奶砵冰沙/熱", "濃厚芋泥鮮奶"),
            ("冰萃檸檬净/熱", "冰萃檸檬"),
            ("芝芝金萱雙Q 冷1熱", "芝芝金萱雙Q"),
            ("芝芝錫蘭奶茶冷1點", "芝芝錫蘭奶茶"),
            ("柳橙芒果果粒茶 (59月)", "柳橙芒果果粒茶"),
            ("梅子冰茶品甜固定冷)", "梅子冰茶"),
            ("阿華田拿鐵 Ovaltine Latte", "阿華田拿鐵"),
            ("玫瑰紅茶拿鐵/產品陷含甜座", "玫瑰紅茶拿鐵"),
            // 不能誤刪的真正品名
            ("芒果冰沙", "芒果冰沙"),
            ("熱可可", "熱可可"),
            ("金萱雙Q", "金萱雙Q"),
            ("蜂蜜檸檬", "蜂蜜檸檬"),
        ]
        for (raw, want) in cases {
            XCTAssertEqual(NameCleaner.cleanName(raw), want, raw)
        }
        XCTAssertEqual(NoiseFilter.noiseReason(for: "6 甜度冰量固定"), "附註說明")
        XCTAssertFalse(Tokenizer.tokens(for: OCRLine(id: 0, text: "紅茶 6", box: .unit)).contains { $0.kind == .price(6) })
    }

    /// 表頭只讀到「瓶」（圓圈 L 沒讀到）：只給 x 對得上的價格規格，其餘待確認，不能全部標成「瓶」。
    func testIncompleteHeaderRowOnlyAssignsAlignedPrices() {
        var f = MenuFixture()
        f.add("瓶", x: 0.46, y: 0.10, h: 0.02)
        f.add("芝芝芒果果粒", x: 0.05, y: 0.13, h: 0.02)
        f.add("90", x: 0.40, y: 0.13, h: 0.02)
        f.add("蕃茄梅蜜", x: 0.05, y: 0.16, h: 0.02)
        f.add("70", x: 0.40, y: 0.16, h: 0.02)
        f.add("100", x: 0.46, y: 0.16, h: 0.02)
        let r = f.parse()
        XCTAssertEqual(r.price("蕃茄梅蜜", "瓶"), 100)
        XCTAssertFalse(r.resolvedEntries.contains { $0.name == "芝芝芒果果粒" && $0.size == "瓶" }, "\(r.summary)")
        XCTAssertTrue(r.pendingEntries.contains { $0.name == "芝芝芒果果粒" && $0.candidatePrices == [90] })
        XCTAssertTrue(r.pendingEntries.contains { $0.name == "蕃茄梅蜜" && $0.candidatePrices == [70] })
    }

    /// 一行多組「品名$價格元」、逗號清單（照片格便當傳單常見）。
    func testInlineNamePricePairs() {
        var f = MenuFixture()
        f.add("水煮雞胸$125元", x: 0.25, y: 0.27, h: 0.04, w: 0.22)
        f.add("鮮蒸蛋$130元", x: 0.50, y: 0.27, h: 0.04, w: 0.19)
        f.add("香檸鯖魚$155元 日式烤鮭魚$175元蔬食餐盒$85元", x: 0.01, y: 0.58, h: 0.04, w: 0.71)
        f.add("菜飯便當60元，鯖魚70元，椒麻雞80元", x: 0.32, y: 0.68, h: 0.04, w: 0.6)
        f.add("115-11.2", x: 0.86, y: 0.80, h: 0.03)
        let r = f.parse()
        let got = Set(r.resolvedEntries.map { "\($0.name)|\($0.price!)" })
        XCTAssertEqual(got, ["水煮雞胸|125", "鮮蒸蛋|130", "香檸鯖魚|155", "日式烤鮭魚|175", "蔬食餐盒|85", "菜飯便當|60", "鯖魚|70", "椒麻雞|80"], "\(r.summary)")
        XCTAssertTrue(r.resolvedEntries.allSatisfy { $0.size == SizeLabel.single })
        XCTAssertFalse(r.entries.contains { $0.price == 115 }, "版本日期不能當售價")
    }

    /// 價格在品名正下方，中間隔一行英文小字（深色海報）。
    func testPriceBelowName() {
        var f = MenuFixture()
        for (i, (name, price)) in [("大爺排骨便當", "100"), ("日式豬排便當", "120"), ("燒肉便當", "120")].enumerated() {
            let y = 0.35 + Double(i) * 0.07
            f.add(name, x: 0.06, y: y, h: 0.02, w: 0.18)
            f.add("Pork Chop Bento", x: 0.08, y: y + 0.02, h: 0.011, w: 0.15)
            f.add(price, x: 0.13, y: y + 0.041, h: 0.013, w: 0.045)
        }
        for (i, (name, price)) in [("炸雞腿便當", "115"), ("炸雞排便當", "110")].enumerated() {
            let y = 0.35 + Double(i) * 0.07
            f.add(name, x: 0.31, y: y, h: 0.02, w: 0.15)
            f.add(price, x: 0.365, y: y + 0.041, h: 0.013, w: 0.045)
        }
        let r = f.parse()
        XCTAssertEqual(Set(r.resolvedEntries.map { "\($0.name)|\($0.price!)" }),
                       ["大爺排骨便當|100", "日式豬排便當|120", "燒肉便當|120", "炸雞腿便當|115", "炸雞排便當|110"], "\(r.summary)")
    }

    func testUnbalancedLeadingParenAndDateNoise() {
        XCTAssertEqual(NameCleaner.cleanName("（日式大雞腿"), "日式大雞腿")
        XCTAssertEqual(NameCleaner.cleanName("香茅雞腿排(烤)"), "香茅雞腿排(烤)")
        XCTAssertNotNil(NoiseFilter.noiseReason(for: "114.05.07製"))
        XCTAssertNil(NoiseFilter.noiseReason(for: "雞腿飯 110"))
    }
}
