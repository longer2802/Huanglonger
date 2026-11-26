import XCTest
@testable import MenuScannerCore

/// 以固定座標組出 OCR 結果，讓解析器可以脫離 Vision 獨立測試。
struct MenuFixture {
    private(set) var lines: [OCRLine] = []

    /// 加入一行文字；未指定寬度時依字寬估算（中文字約 0.022，數字約 0.011）。
    mutating func add(_ text: String, x: Double, y: Double, h: Double = 0.03, w: Double? = nil) {
        let width = w ?? Tokenizer.weight(text) * 0.011
        lines.append(OCRLine(id: lines.count, text: text, box: NormRect(x: x, y: y, width: width, height: h)))
    }

    var document: OCRDocument { OCRDocument(lines: lines) }

    func parse() -> ParseResult { LayoutParser().parse(document) }
}

extension ParseResult {
    func entries(named name: String) -> [MenuEntry] { entries.filter { $0.name == name } }

    func price(_ name: String, _ size: String) -> Int? {
        entries.first { $0.name == name && $0.size == size }?.price
    }

    /// 以「品名|規格|價格」字串比對，方便一眼看出差異。
    var summary: [String] {
        entries.map { "\($0.name)|\($0.size)|\($0.price.map(String.init) ?? "-")" }
    }

    var allPrices: [Int] { entries.compactMap(\.price) + entries.flatMap(\.candidatePrices) }
}
