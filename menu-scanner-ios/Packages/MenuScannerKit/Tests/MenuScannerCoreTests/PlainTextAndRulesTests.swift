import XCTest
@testable import MenuScannerCore

final class PlainTextParserTests: XCTestCase {
    func testPlainTextWithHeader() {
        let text = """
        醇茶系列
        品名 中杯 大杯
        紅茶 30 35
        綠茶 — 35
        珍珠奶茶 50
        烏龍茶 40 45 50
        """
        let r = MenuParser.parsePlainText(text)

        XCTAssertEqual(r.price("紅茶", "中杯"), 30)
        XCTAssertEqual(r.price("紅茶", "大杯"), 35)
        XCTAssertEqual(r.entries(named: "綠茶").count, 1)
        XCTAssertEqual(r.price("綠茶", "大杯"), 35)
        XCTAssertTrue(r.entries(named: "紅茶").allSatisfy { $0.status == .auto && $0.category == "醇茶系列" })

        // 沒有座標，價格數量和表頭不同：不猜
        let milk = r.entries(named: "珍珠奶茶")
        XCTAssertEqual(milk.count, 1)
        XCTAssertNil(milk.first?.price)
        XCTAssertEqual(milk.first?.candidatePrices, [50])
        XCTAssertEqual(milk.first?.reasons, [.sizeMappingUncertain])
        XCTAssertEqual(r.entries(named: "烏龍茶").first?.status, .needsReview)
    }

    func testPlainTextSinglePriceAndNameOnPreviousLine() {
        let text = """
        雞腿飯 100
        排骨飯 NT$95
        控肉飯 ９０元
        珍珠奶茶
        55/65
        """
        let r = MenuParser.parsePlainText(text)
        XCTAssertEqual(r.price("雞腿飯", SizeLabel.single), 100)
        XCTAssertEqual(r.price("排骨飯", SizeLabel.single), 95)
        XCTAssertEqual(r.price("控肉飯", SizeLabel.single), 90)
        let milk = r.entries(named: "珍珠奶茶")
        XCTAssertEqual(milk.count, 1, "\(r.summary)")
        XCTAssertEqual(milk.first?.candidatePrices, [55, 65])
        XCTAssertEqual(milk.first?.reasons, [.multiplePricesWithoutHeader])
    }
}

final class TextRulesTests: XCTestCase {
    func testPriceNormalization() {
        XCTAssertEqual(TextNormalizer.parsePrice("65"), 65)
        XCTAssertEqual(TextNormalizer.parsePrice("６５"), 65)
        XCTAssertEqual(TextNormalizer.parsePrice("６５元"), 65)
        XCTAssertEqual(TextNormalizer.parsePrice("NT$65"), 65)
        XCTAssertEqual(TextNormalizer.parsePrice("ＮＴ＄１２０"), 120)
        XCTAssertEqual(TextNormalizer.parsePrice("$ 45"), 45)
        XCTAssertNil(TextNormalizer.parsePrice("12.5"))
        XCTAssertNil(TextNormalizer.parsePrice("6O"))
        XCTAssertNil(TextNormalizer.parsePrice(""))
    }

    func testSizeNormalization() {
        XCTAssertEqual(TextNormalizer.normalizeSize("中"), "中杯")
        XCTAssertEqual(TextNormalizer.normalizeSize("大杯"), "大杯")
        XCTAssertEqual(TextNormalizer.normalizeSize("ｍ"), "M")
        XCTAssertEqual(TextNormalizer.normalizeSize("700ML"), "700ml")
        XCTAssertEqual(TextNormalizer.normalizeSize("500 cc"), "500cc")
        XCTAssertNil(TextNormalizer.normalizeSize("紅茶"))
        XCTAssertNil(TextNormalizer.normalizeSize("55"))
    }

    func testTokenizerSplitsNameAndPrices() {
        let toks = Tokenizer.tokens(for: OCRLine(id: 0, text: "烏龍55 第2杯 3Q 500ml ６5元", box: .unit))
        let kinds = toks.map(\.kind)
        XCTAssertTrue(kinds.contains(.price(55)))
        XCTAssertTrue(kinds.contains(.price(65)))
        XCTAssertTrue(kinds.contains(.volume("500ml")))
        XCTAssertFalse(kinds.contains(.price(2)))
        XCTAssertFalse(kinds.contains(.price(3)))
        XCTAssertFalse(kinds.contains(.price(500)))
    }

    func testNoiseFilterKeepsItemNames() {
        XCTAssertNil(NoiseFilter.noiseReason(for: "無糖綠茶 30"))
        XCTAssertNil(NoiseFilter.noiseReason(for: "冰淇淋紅茶 50"))
        XCTAssertNil(NoiseFilter.noiseReason(for: "熱可可 45"))
        XCTAssertNil(NoiseFilter.noiseReason(for: "1號餐 雞腿 100"))
        XCTAssertNil(NoiseFilter.noiseReason(for: "紅茶 55/65/75"))
        XCTAssertEqual(NoiseFilter.noiseReason(for: "甜度: 正常 少糖 半糖 微糖 無糖"), "甜度冰量表")
        XCTAssertEqual(NoiseFilter.noiseReason(for: "訂購專線 0912-345-678"), "電話或聯絡資訊")
        XCTAssertEqual(NoiseFilter.noiseReason(for: "營業時間 10:00-21:00"), "日期或營業時間")
        XCTAssertTrue(NoiseFilter.isPromotion("珍珠 +10"))
        XCTAssertTrue(NoiseFilter.isPromotion("第二杯半價"))
        XCTAssertFalse(NoiseFilter.isPromotion("雞腿套餐 120"))
    }

    func testLexicon() {
        let lex = TypoLexicon.standard
        XCTAssertEqual(lex.suggestion(for: "憲桃烏龍"), "蜜桃烏龍")
        XCTAssertEqual(lex.suggestion(for: "拿錢"), "拿鐵")
        XCTAssertNil(lex.suggestion(for: "蜜桃烏龍"))
    }
}

final class GeometryTests: XCTestCase {
    func testVisionBoxToImageSpace() {
        let v = NormRect(x: 0.1, y: 0.2, width: 0.3, height: 0.1)
        let full = VisionGeometry.toImageSpace(visionBox: v)
        XCTAssertEqual(full.x, 0.1, accuracy: 1e-9)
        XCTAssertEqual(full.y, 0.7, accuracy: 1e-9)
        XCTAssertEqual(full.width, 0.3, accuracy: 1e-9)
        XCTAssertEqual(full.height, 0.1, accuracy: 1e-9)

        // 局部重掃：裁切範圍為右上四分之一
        let crop = NormRect(x: 0.5, y: 0.0, width: 0.5, height: 0.5)
        let mapped = VisionGeometry.toImageSpace(visionBox: v, crop: crop)
        XCTAssertEqual(mapped.x, 0.55, accuracy: 1e-9)
        XCTAssertEqual(mapped.y, 0.35, accuracy: 1e-9)
        XCTAssertEqual(mapped.width, 0.15, accuracy: 1e-9)
        XCTAssertEqual(mapped.height, 0.05, accuracy: 1e-9)
    }

    func testPixelRectRoundTrip() {
        let p = VisionGeometry.pixelRect(NormRect(x: 0.25, y: 0.5, width: 0.5, height: 0.25), imageWidth: 400, imageHeight: 800)
        XCTAssertEqual(p.x, 100)
        XCTAssertEqual(p.y, 400)
        XCTAssertEqual(p.width, 200)
        XCTAssertEqual(p.height, 200)
        let back = VisionGeometry.normRect(pixelX: p.x, pixelY: p.y, width: p.width, height: p.height, imageWidth: 400, imageHeight: 800)
        XCTAssertEqual(back, NormRect(x: 0.25, y: 0.5, width: 0.5, height: 0.25))
    }

    func testLanguageSelection() {
        XCTAssertEqual(OCRLanguagePolicy.select(from: ["en-US", "zh-Hans", "zh-Hant"]), ["zh-Hant", "en-US"])
        XCTAssertEqual(OCRLanguagePolicy.select(from: ["en-US", "zh-Hans"]), ["zh-Hans", "en-US"])
        XCTAssertEqual(OCRLanguagePolicy.select(from: ["fr-FR"]), ["fr-FR"])
    }

    func testCodableRoundTrip() throws {
        let e = MenuEntry(category: "茶", name: "紅茶", size: "中杯", price: nil, candidatePrices: [30], reasons: [.possibleTypo(suggestion: "x"), .priceNotFound])
        let data = try JSONEncoder().encode(e)
        XCTAssertEqual(try JSONDecoder().decode(MenuEntry.self, from: data), e)
    }
}
