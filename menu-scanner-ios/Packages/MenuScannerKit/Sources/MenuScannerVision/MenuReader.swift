#if canImport(Vision)
import CoreGraphics
import Foundation
import MenuScannerCore

/// 照片 → OCR → 解析的完整流程（App 與基準測試工具共用）。
///
/// 除了一般解析，另外處理「直書」菜單：Vision 讀不了直排中文，整張只會讀到價格。
/// 若有一排找不到品名的價格（至少 3 個），就把每個價格正上方的細長條單獨裁下來再辨識，
/// 由上往下拼成品名（窄條裡一個個疊起來的字，Vision 讀得到）。
public enum MenuReader {
    static let orphanReasons: Set<String> = ["價格左側找不到品名欄", "價格找不到同一列的品名"]

    public static func read(_ image: CGImage, recognizer: TextRecognizing, lexicon: TypoLexicon = .standard) async throws -> (OCRDocument, ParseResult) {
        let doc = try await recognizer.recognize(image, region: nil, enhanceContrast: false, lineIDOffset: 0)
        var result = MenuParser.parse(doc, lexicon: lexicon)
        try Task.checkCancellation()

        let orphans: [(index: Int, line: ExcludedLine, box: NormRect, price: Int)] = result.excluded.enumerated().compactMap { i, x in
            guard orphanReasons.contains(x.reason), let b = x.box, let p = TextNormalizer.parsePrice(x.text) else { return nil }
            return (i, x, b, p)
        }
        guard orphans.count >= 3 else { return (doc, result) }

        // 欄寬：同一排相鄰價格的水平距離（中位數）
        var gaps: [Double] = []
        for o in orphans {
            let right = orphans.filter { abs($0.box.midY - o.box.midY) < o.box.height && $0.box.midX > o.box.midX }
            if let d = right.map({ $0.box.midX - o.box.midX }).min() { gaps.append(d) }
        }
        let column = gaps.sorted().dropFirst(gaps.count / 2).first ?? (orphans.map(\.box.width).max() ?? 0.05) * 1.6

        var nextID = (doc.lines.map(\.id).max() ?? 0) + 1
        var recovered = Set<Int>()
        var entries: [MenuEntry] = []
        for o in orphans {
            let b = o.box
            let x0 = max(0, b.midX - column * 0.45), x1 = min(1, b.midX + column * 0.45)
            // 往上找到第一個擋住這一欄的東西（上一排價格、標題）為止
            let top = doc.lines
                .filter { $0.box.maxY <= b.minY + 0.001 && $0.box.maxX > x0 && $0.box.minX < x1 }
                .map(\.box.maxY).max() ?? 0
            let height = b.minY - top - 0.006
            guard height > b.height * 1.5 else { continue }
            let strip = NormRect(x: x0, y: top + 0.003, width: x1 - x0, height: height)
            let part = (try? await recognizer.recognize(image, region: strip, enhanceContrast: false, lineIDOffset: nextID))
                ?? OCRDocument(lines: [])
            nextID += part.lines.count + 1
            var text = part.lines.sorted { $0.box.minY < $1.box.minY }.map(\.text).joined().filter { !$0.isWhitespace }
            var han = text.unicodeScalars.filter { $0.properties.isIdeographic }.count
            // 直接讀不到：把直排的字切開、橫向排成一行再讀
            if han < 2, let row = VerticalText.horizontalize(image, strip: strip),
               let horiz = try? await recognizer.recognize(row, region: nil, enhanceContrast: false, lineIDOffset: nextID) {
                nextID += horiz.lines.count + 1
                text = horiz.lines.sorted { $0.box.minX < $1.box.minX }.map(\.text).joined().filter { !$0.isWhitespace }
                han = text.unicodeScalars.filter { $0.properties.isIdeographic }.count
                if ProcessInfo.processInfo.environment["MENU_READER_DEBUG"] != nil {
                    print("    橫排後：\(text)")
                }
            }
            if ProcessInfo.processInfo.environment["MENU_READER_DEBUG"] != nil {
                print(String(format: "  直書補讀 價格 %ld 範圍 x%.3f y%.3f w%.3f h%.3f → %ld 行：", o.price, strip.x, strip.y, strip.width, strip.height, part.lines.count)
                      + part.lines.map(\.text).joined(separator: " | "))
            }
            guard han >= 2 else { continue }
            entries.append(MenuParser.makeEntry(
                name: text, price: o.price, box: strip.union(b), rawText: "\(text) \(o.line.text)",
                lineIDs: part.lines.map(\.id), lexicon: lexicon
            ))
            recovered.insert(o.index)
        }
        guard !entries.isEmpty else { return (doc, result) }
        result.excluded = result.excluded.enumerated().filter { !recovered.contains($0.offset) }.map(\.element)
        result.entries += entries.sorted {
            let a = $0.source?.box, b = $1.source?.box
            return ((a?.maxY ?? 0), (a?.minX ?? 0)) < ((b?.maxY ?? 0), (b?.minX ?? 0))
        }
        return (doc, result)
    }
}
#endif
