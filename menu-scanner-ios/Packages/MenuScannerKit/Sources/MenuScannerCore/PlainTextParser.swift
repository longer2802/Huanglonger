import Foundation

/// 貼上的純文字（例如從 LINE、網頁複製）→ 菜單品項。
/// 沒有座標，只能依文字順序對應表頭；價格數量與表頭數量對不上時一律待確認。
public struct PlainTextParser: Sendable {
    public var lexicon: TypoLexicon

    public init(lexicon: TypoLexicon = .standard) {
        self.lexicon = lexicon
    }

    public func parse(_ text: String) -> ParseResult {
        var entries: [MenuEntry] = []
        var excluded: [ExcludedLine] = []
        var headers: [HeaderLabel] = []
        var category = ""
        /// 上一行沒有價格的文字（可能是下一行價格的品名）。
        var pending: (id: Int, text: String, previousCategory: String, previousHeaders: [HeaderLabel])?

        let lines: [(id: Int, text: String)] = text
            .components(separatedBy: .newlines)
            .enumerated()
            .map { (id: $0.offset, text: TextNormalizer.normalizedLine($0.element)) }
            .filter { !$0.text.isEmpty }

        func tokens(_ s: String, id: Int) -> [Token] {
            Tokenizer.tokens(for: OCRLine(id: id, text: s, box: .unit))
        }

        for (k, line) in lines.enumerated() {
            if let reason = NoiseFilter.noiseReason(for: line.text) {
                excluded.append(ExcludedLine(text: line.text, reason: reason, box: nil))
                pending = nil
                continue
            }
            if NoiseFilter.isPromotion(line.text) {
                entries.append(EntryFactory.promotionEntry(text: line.text, rawText: line.text, box: nil, lineIDs: [line.id], lexicon: lexicon))
                pending = nil
                continue
            }
            let toks = tokens(line.text, id: line.id)
            let hasPrice = toks.contains { $0.kind.isPriceLike }
            let hasHeader = toks.contains { $0.kind.isHeaderLike }
            let textParts = toks.filter { $0.kind == .text }.map(\.raw)

            if hasHeader && !hasPrice {
                headers = toks.flatMap { t -> [HeaderLabel] in
                    switch t.kind {
                    case .header(let l), .volume(let l): return [HeaderLabel(label: l, x: nil)]
                    case .multiHeader(let ls): return ls.map { HeaderLabel(label: $0, x: nil) }
                    default: return []
                    }
                }
                let cat = textParts.filter { !NameCleaner.isHeaderFiller($0) }.joined(separator: " ")
                if !cat.isEmpty { category = NameCleaner.cleanCategory(cat) }
                pending = nil
                continue
            }

            if !hasPrice {
                let joined = textParts.joined(separator: " ")
                let nextHasPrice = k + 1 < lines.count
                    && tokens(lines[k + 1].text, id: lines[k + 1].id).contains { $0.kind.isPriceLike }
                if NameCleaner.looksLikeCategory(joined) || nextHasPrice {
                    pending = (line.id, joined, category, headers)
                    category = NameCleaner.cleanCategory(joined)
                    if NameCleaner.looksLikeCategory(joined) { headers = [] }
                } else if NameCleaner.containsHan(joined), NameCleaner.cleanName(joined).count <= 12 {
                    entries.append(EntryFactory.make(
                        category: category, name: NameCleaner.cleanName(joined), size: "", price: nil, candidates: [],
                        reasons: [.priceNotFound],
                        source: EntrySource(box: nil, rawText: line.text, lineIDs: [line.id]),
                        lexicon: lexicon
                    ))
                    pending = nil
                } else {
                    excluded.append(ExcludedLine(text: line.text, reason: "說明文字", box: nil))
                    pending = nil
                }
                continue
            }

            var name = NameCleaner.cleanName(textParts.joined(separator: " "))
            var lineIDs = [line.id]
            var rawText = line.text
            // 「珍珠奶茶」換行「55 65」：上一行才是品名，不是分類
            if name.isEmpty, let p = pending, !NameCleaner.looksLikeCategory(p.text) {
                name = NameCleaner.cleanName(p.text)
                category = p.previousCategory
                headers = p.previousHeaders
                lineIDs.insert(p.id, at: 0)
                rawText = p.text + " " + line.text
            }
            pending = nil
            guard !name.isEmpty else {
                excluded.append(ExcludedLine(text: line.text, reason: "找不到品名", box: nil))
                continue
            }
            let volumeHint: String? = toks.compactMap { t -> String? in
                if case .volume(let v) = t.kind { return v }
                return nil
            }.first
            let slots = SlotAssigner.slots(from: toks, useCoordinates: false)
            let assigned = SlotAssigner.assign(slots: slots, headers: headers, hasCoordinates: false, volumeHint: volumeHint)
            for a in assigned {
                entries.append(EntryFactory.make(
                    category: category, name: name, size: a.size, price: a.price, candidates: a.candidates,
                    reasons: a.reasons,
                    source: EntrySource(box: nil, rawText: rawText, lineIDs: lineIDs),
                    lexicon: lexicon
                ))
            }
        }
        return ParseResult(entries: entries, excluded: excluded)
    }
}

/// 解析入口。
public enum MenuParser {
    public static func parse(_ document: OCRDocument, lexicon: TypoLexicon = .standard) -> ParseResult {
        LayoutParser(lexicon: lexicon).parse(document)
    }

    public static func parsePlainText(_ text: String, lexicon: TypoLexicon = .standard) -> ParseResult {
        PlainTextParser(lexicon: lexicon).parse(text)
    }
}
