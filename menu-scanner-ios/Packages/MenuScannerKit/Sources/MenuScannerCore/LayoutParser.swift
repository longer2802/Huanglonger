import Foundation

/// 有座標的 OCR 結果 → 菜單品項。
///
/// 步驟：
/// 1. 排除電話、地址、日期、甜度冰量表等整行雜訊；加料／促銷行放待確認。
/// 2. 每行切成文字、價格、表頭、容量片段。
/// 3. 找出所有字塊都沒覆蓋的垂直空白帶，切出直欄；以「品名欄＋右側價格欄」組成一個區塊，
///    價格只會配對到同一區塊內的品名（隔壁欄的數字不會跨欄）。
/// 4. 區塊內依垂直位置配對品名與價格，處理品名換行、分類標題。
/// 5. 依該列上方最近的表頭（中杯／大杯／M／L／容量）以 x 座標決定規格；對不上就留空標待確認。
public struct LayoutParser: Sendable {
    public var lexicon: TypoLexicon
    /// 直欄之間的最小空白寬度（佔整張圖寬的比例）。
    public var minGutter: Double

    public init(lexicon: TypoLexicon = .standard, minGutter: Double = 0.012) {
        self.lexicon = lexicon
        self.minGutter = minGutter
    }

    enum Role { case name, price, header, category, ignored }

    struct Tok {
        var token: Token
        var role: Role
        var raw: String { token.raw }
        var kind: TokenKind { token.kind }
        var box: NormRect { token.box }
        var lineID: Int { token.lineID }
    }

    struct Row {
        var parts: [(x: Double, text: String)]
        var box: NormRect
        var lineIDs: [Int]
        var extra: [String] = []
        var prices: [Tok] = []
        var flags: [ReviewReason] = []
        var absorbNext = false

        var mainText: String { parts.sorted { $0.x < $1.x }.map(\.text).joined(separator: " ") }
        var fullText: String { ([mainText] + extra).joined(separator: " ") }

        mutating func absorb(_ other: Row) {
            extra.append(other.fullText)
            box = box.union(other.box)
            lineIDs += other.lineIDs
        }
    }

    public func parse(_ document: OCRDocument) -> ParseResult {
        var excluded: [ExcludedLine] = []
        var entries: [MenuEntry] = []
        var toks: [Tok] = []
        var lineVolume: [Int: String] = [:]

        // 1–2. 整行過濾與切片
        for line in document.lines {
            let normText = TextNormalizer.normalizedLine(line.text)
            if normText.isEmpty { continue }
            if let reason = NoiseFilter.noiseReason(for: normText) {
                excluded.append(ExcludedLine(text: line.text, reason: reason, box: line.box))
                continue
            }
            if NoiseFilter.isPromotion(normText) {
                entries.append(EntryFactory.promotionEntry(text: normText, rawText: line.text, box: line.box, lineIDs: [line.id], lexicon: lexicon))
                continue
            }
            let lineToks = Tokenizer.tokens(for: line)
            let hasPrice = lineToks.contains { $0.kind.isPriceLike }
            let hasHeader = lineToks.contains { $0.kind.isHeaderLike }
            let isHeaderLine = hasHeader && !hasPrice
            for t in lineToks {
                let role: Role
                switch t.kind {
                case .text:
                    if isHeaderLine {
                        role = NameCleaner.isHeaderFiller(t.raw) ? .ignored : .category
                    } else {
                        // 截圖狀態列「5G」之類不是品名；不讓它影響分欄
                        role = NameCleaner.isPlausibleName(t.raw) ? .name : .ignored
                    }
                case .note:
                    role = .ignored
                case .header, .multiHeader:
                    role = isHeaderLine ? .header : .ignored
                case .volume(let v):
                    if isHeaderLine {
                        role = .header
                    } else {
                        lineVolume[line.id] = v
                        role = .ignored
                    }
                default:
                    role = .price
                }
                toks.append(Tok(token: t, role: role))
            }
        }

        let nameHeights = toks.filter { $0.role == .name }.map { $0.box.height }
        let h = Stats.median(nameHeights) ?? Stats.median(toks.map { $0.box.height }) ?? 0.02

        // 3. 直欄
        let spans = toks.filter { $0.role != .ignored && $0.box.width < 0.35 }.map { ($0.box.minX, $0.box.maxX) }
        let bands = Gutters.bands(from: spans, minGap: minGutter)
        var nameCount = [Int](repeating: 0, count: bands.count)
        var priceCount = [Int](repeating: 0, count: bands.count)
        for t in toks {
            let b = Gutters.index(of: t.box.midX, in: bands)
            switch t.role {
            case .name, .category: nameCount[b] += 1
            case .price, .header: priceCount[b] += 1
            case .ignored: break
            }
        }
        var isNameBand = [Bool](repeating: false, count: bands.count)
        var sectionOfBand = [Int](repeating: -1, count: bands.count)
        var sections: [(lo: Double, hi: Double)] = []
        for b in bands.indices {
            isNameBand[b] = nameCount[b] > 0 && Double(nameCount[b]) >= 0.5 * Double(priceCount[b])
            if isNameBand[b] {
                sections.append((lo: bands[b].lo, hi: bands[b].hi))
            } else if !sections.isEmpty {
                sections[sections.count - 1].hi = bands[b].hi
            }
            sectionOfBand[b] = sections.count - 1
        }

        var perSection = [[Tok]](repeating: [], count: max(sections.count, 1))
        for t in toks where t.role != .ignored {
            if t.role == .name || t.role == .category, t.box.width >= 0.35, sections.count >= 2 {
                let covered = sections.filter { min($0.hi, t.box.maxX) - max($0.lo, t.box.minX) > 0.03 }.count
                if covered >= 2 {
                    excluded.append(ExcludedLine(text: t.raw, reason: "跨欄標題或說明文字", box: t.box))
                    continue
                }
            }
            let b = Gutters.index(of: t.box.midX, in: bands)
            let s = sectionOfBand[b]
            if s < 0 {
                if t.role == .price {
                    excluded.append(ExcludedLine(text: t.raw, reason: "價格左側找不到品名欄", box: t.box))
                }
                continue
            }
            if t.role == .name && !isNameBand[b] { continue }
            perSection[s].append(t)
        }

        // 4–5. 區塊內配對
        for sectionToks in perSection where !sectionToks.isEmpty {
            entries += parseSection(sectionToks, h: h, lineVolume: lineVolume, excluded: &excluded)
        }
        return ParseResult(entries: entries, excluded: excluded)
    }

    func parseSection(_ toks: [Tok], h: Double, lineVolume: [Int: String], excluded: inout [ExcludedLine]) -> [MenuEntry] {
        let headerToks = toks.filter { $0.role == .header }
        var categories: [(text: String, y: Double)] = toks
            .filter { $0.role == .category }
            .map { (text: NameCleaner.cleanCategory($0.raw), y: $0.box.midY) }
        let priceToks = toks.filter { $0.role == .price }.sorted { $0.box.midY < $1.box.midY }

        // 同一高度的文字合併成一列
        var rows: [Row] = []
        for t in toks.filter({ $0.role == .name }).sorted(by: { $0.box.midY < $1.box.midY }) {
            if let i = rows.indices.last(where: { rows[$0].box.verticalOverlapRatio(with: t.box) >= 0.5 }) {
                rows[i].parts.append((x: t.box.minX, text: t.raw))
                rows[i].box = rows[i].box.union(t.box)
                rows[i].lineIDs.append(t.lineID)
            } else {
                rows.append(Row(parts: [(x: t.box.minX, text: t.raw)], box: t.box, lineIDs: [t.lineID]))
            }
        }
        rows.sort { $0.box.midY < $1.box.midY }
        // 明顯較小的字（英文副標、描述）不當品名
        rows = rows.filter { r in
            if r.box.height < 0.75 * h {
                excluded.append(ExcludedLine(text: r.fullText, reason: "小字說明或副標", box: r.box))
                return false
            }
            return true
        }

        // 價格配對到垂直位置最近、且位於價格左側的品名
        var unpaired: [Tok] = []
        for p in priceToks {
            let tol = 0.6 * max(h, p.box.height)
            let cands = rows.indices
                .filter { rows[$0].box.minX < p.box.minX }
                .map { (index: $0, d: abs(rows[$0].box.midY - p.box.midY)) }
                .sorted { $0.d < $1.d }
            guard let best = cands.first, best.d <= tol else {
                unpaired.append(p)
                continue
            }
            if cands.count > 1, cands[1].d <= tol, cands[1].d - best.d < 0.2 * h {
                rows[best.index].flags.append(.priceOverlapsAdjacentRow)
            }
            rows[best.index].prices.append(p)
        }
        // 價格落在兩行之間：視為兩行品名（換行）
        for p in unpaired {
            if let i = rows.indices.dropLast().first(where: {
                rows[$0].box.midY < p.box.midY && rows[$0 + 1].box.midY > p.box.midY && rows[$0].box.minX < p.box.minX
            }), rows[i + 1].box.minY - rows[i].box.maxY < 0.6 * h, rows[i + 1].prices.isEmpty {
                rows[i].prices.append(p)
                rows[i].absorbNext = true
            } else {
                excluded.append(ExcludedLine(text: p.raw, reason: "價格找不到同一列的品名", box: p.box))
            }
        }

        var merged: [Row] = []
        var i = 0
        while i < rows.count {
            var r = rows[i]
            if r.absorbNext, i + 1 < rows.count {
                r.absorb(rows[i + 1])
                i += 2
            } else {
                i += 1
            }
            merged.append(r)
        }

        // 品名換行：緊接在有價格那列下方、字高相同、左緣對齊、沒有價格的一行
        var final: [Row] = []
        for r in merged {
            if r.prices.isEmpty, var prev = final.last, !prev.prices.isEmpty,
               r.box.minY > prev.box.midY,
               r.box.minY - prev.box.maxY < 0.5 * h,
               abs(r.box.height - h) < 0.3 * h,
               abs(r.box.minX - prev.box.minX) < 0.08,
               !NameCleaner.looksLikeCategory(r.fullText) {
                if NameCleaner.isLatinOnly(r.fullText) && !NameCleaner.isLatinOnly(prev.fullText) {
                    excluded.append(ExcludedLine(text: r.fullText, reason: "英文副標", box: r.box))
                } else {
                    prev.absorb(r)
                    final[final.count - 1] = prev
                }
                continue
            }
            final.append(r)
        }

        var entries: [MenuEntry] = []
        // 沒有價格的列：分類標題、缺價格的品項或說明文字
        for (idx, r) in final.enumerated() where r.prices.isEmpty {
            let text = NameCleaner.cleanName(r.fullText)
            if text.isEmpty { continue }
            let next: Row? = idx + 1 < final.count ? final[idx + 1] : nil
            let prev: Row? = idx > 0 ? final[idx - 1] : nil
            let nextIsPricedRightBelow = next.map { !$0.prices.isEmpty && $0.box.minY - r.box.maxY < 2.5 * h } ?? false
            let separatedFromAbove = prev.map { r.box.minY - $0.box.maxY > 0.8 * h } ?? true
            if NameCleaner.looksLikeCategory(r.fullText) || r.box.height >= 1.25 * h || (nextIsPricedRightBelow && separatedFromAbove) {
                categories.append((text: NameCleaner.cleanCategory(r.fullText), y: r.box.midY))
            } else if text.count <= 12 && NameCleaner.containsHan(text) {
                entries.append(EntryFactory.make(
                    category: "", name: text, size: "", price: nil, candidates: [],
                    reasons: [.priceNotFound],
                    source: EntrySource(box: r.box, rawText: r.fullText, lineIDs: r.lineIDs),
                    lexicon: lexicon
                ))
            } else {
                excluded.append(ExcludedLine(text: r.fullText, reason: "說明文字", box: r.box))
            }
        }
        categories.sort { $0.y < $1.y }
        func category(at y: Double) -> String {
            categories.last(where: { $0.y < y })?.text ?? ""
        }
        for k in entries.indices {
            if let box = entries[k].source?.box { entries[k].category = category(at: box.midY) }
        }

        for r in final where !r.prices.isEmpty {
            let name = NameCleaner.cleanName(r.fullText)
            let box = r.prices.reduce(r.box) { $0.union($1.box) }
            let raw = ([r.fullText] + r.prices.sorted { $0.box.minX < $1.box.minX }.map(\.raw)).joined(separator: " ")
            guard !name.isEmpty else {
                excluded.append(ExcludedLine(text: raw, reason: "找不到品名", box: box))
                continue
            }
            let headers = headerRow(above: r.box, in: headerToks, h: h)
            let slots = SlotAssigner.slots(from: r.prices.map(\.token), useCoordinates: true)
            let volumeHint = r.lineIDs.compactMap { lineVolume[$0] }.first
            let assigned = SlotAssigner.assign(slots: slots, headers: headers, hasCoordinates: true, volumeHint: volumeHint)
            let cat = category(at: r.box.midY)
            for a in assigned {
                entries.append(EntryFactory.make(
                    category: cat, name: name, size: a.size, price: a.price, candidates: a.candidates,
                    reasons: r.flags + a.reasons,
                    source: EntrySource(box: box, rawText: raw, lineIDs: r.lineIDs),
                    lexicon: lexicon
                ))
            }
        }
        // 依原圖由上到下排序；同一列維持表頭順序（明確 tie-break，不依賴排序穩定性）
        return entries.enumerated()
            .sorted { a, b in
                let ya = a.element.source?.box?.midY ?? 0, yb = b.element.source?.box?.midY ?? 0
                return ya != yb ? ya < yb : a.offset < b.offset
            }
            .map(\.element)
    }

    /// 這一列上方最近的一排表頭（依 x 排序）。
    func headerRow(above box: NormRect, in headers: [Tok], h: Double) -> [HeaderLabel] {
        let above = headers.filter { $0.box.midY < box.minY + 0.1 * h }
        guard let nearestY = above.map({ $0.box.midY }).max() else { return [] }
        return above
            .filter { abs($0.box.midY - nearestY) < 0.6 * max(h, $0.box.height) }
            .flatMap { labels(of: $0) }
            .sorted { ($0.x ?? 0) < ($1.x ?? 0) }
    }

    func labels(of t: Tok) -> [HeaderLabel] {
        switch t.kind {
        case .header(let l), .volume(let l):
            return [HeaderLabel(label: l, x: t.box.midX)]
        case .multiHeader(let ls):
            return ls.enumerated().map { k, l in
                HeaderLabel(label: l, x: t.box.minX + t.box.width * (Double(k) + 0.5) / Double(ls.count))
            }
        default:
            return []
        }
    }
}
