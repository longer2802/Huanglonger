import Foundation

struct HeaderLabel: Equatable {
    var label: String
    /// 表頭中心的 x 座標；純文字貼上時為 nil。
    var x: Double?
}

struct Slot: Equatable {
    enum Value: Equatable {
        case price(Int)
        case unavailable
        case unreadable(String)
    }

    var value: Value
    var x: Double?
    var explicitSize: String?
}

struct AssignedPrice: Equatable {
    var size: String
    var price: Int?
    var candidates: [Int]
    var reasons: [ReviewReason]
}

/// 把一列的價格對應到杯型。規則：寧可留空標待確認，也不猜。
enum SlotAssigner {
    static func slots(from tokens: [Token], useCoordinates: Bool) -> [Slot] {
        var out: [Slot] = []
        let ordered = useCoordinates ? tokens.sorted { $0.box.minX < $1.box.minX } : tokens
        for t in ordered {
            let x: Double? = useCoordinates ? t.box.midX : nil
            switch t.kind {
            case .price(let v):
                out.append(Slot(value: .price(v), x: x))
            case .sizedPrice(let size, let v):
                out.append(Slot(value: .price(v), x: x, explicitSize: size))
            case .multiPrice(let values):
                for (k, v) in values.enumerated() {
                    let sx: Double? = useCoordinates ? t.box.minX + t.box.width * (Double(k) + 0.5) / Double(values.count) : nil
                    out.append(Slot(value: .price(v), x: sx))
                }
            case .unavailable:
                out.append(Slot(value: .unavailable, x: x))
            case .unreadable:
                out.append(Slot(value: .unreadable(t.raw), x: x))
            default:
                break
            }
        }
        return out
    }

    static func assign(slots: [Slot], headers: [HeaderLabel], hasCoordinates: Bool, volumeHint: String?) -> [AssignedPrice] {
        var out: [AssignedPrice] = []
        for s in slots {
            if let size = s.explicitSize, let a = resolve(s.value, size: size) { out.append(a) }
        }
        let rest = slots.filter { $0.explicitSize == nil }
        guard !rest.isEmpty else { return out }
        let readable: [Int] = rest.compactMap { s -> Int? in
            if case .price(let v) = s.value { return v }
            return nil
        }

        if headers.isEmpty {
            if rest.count == 1 {
                let size = volumeHint ?? (out.isEmpty ? SizeLabel.single : "")
                if rest[0].value == .unavailable {
                    out.append(AssignedPrice(size: size, price: nil, candidates: [], reasons: [.priceNotFound]))
                } else if var a = resolve(rest[0].value, size: size) {
                    if size.isEmpty { a.reasons.append(.sizeMappingUncertain) }
                    out.append(a)
                }
            } else {
                var reasons: [ReviewReason] = [.multiplePricesWithoutHeader]
                for s in rest {
                    if case .unreadable(let raw) = s.value { reasons.append(.unreadablePrice(raw: raw)) }
                }
                out.append(AssignedPrice(size: "", price: nil, candidates: readable, reasons: reasons))
            }
            return out
        }

        if rest.count == headers.count {
            for (s, h) in zip(rest, headers) {
                if let a = resolve(s.value, size: h.label) { out.append(a) }
            }
            return out
        }

        // 有座標且價格比表頭少（某杯型空白）：依 x 找最近的表頭，且順序必須一致。
        if hasCoordinates, rest.count < headers.count,
           rest.allSatisfy({ $0.x != nil }), headers.allSatisfy({ $0.x != nil }) {
            var used = Set<Int>()
            var mapping: [(slot: Slot, header: Int)] = []
            for s in rest {
                let order = headers.indices.sorted { abs(headers[$0].x! - s.x!) < abs(headers[$1].x! - s.x!) }
                guard let j = order.first(where: { !used.contains($0) }) else { break }
                used.insert(j)
                mapping.append((s, j))
            }
            let monotonic = zip(mapping, mapping.dropFirst()).allSatisfy { $0.header < $1.header }
            if mapping.count == rest.count, monotonic {
                for m in mapping {
                    if let a = resolve(m.slot.value, size: headers[m.header].label) { out.append(a) }
                }
                return out
            }
        }

        out.append(AssignedPrice(
            size: "",
            price: nil,
            candidates: readable,
            reasons: [hasCoordinates ? .headerCountMismatch : .sizeMappingUncertain]
        ))
        return out
    }

    static func resolve(_ value: Slot.Value, size: String) -> AssignedPrice? {
        switch value {
        case .price(let p):
            return AssignedPrice(size: size, price: p, candidates: [], reasons: [])
        case .unavailable:
            return nil
        case .unreadable(let raw):
            return AssignedPrice(size: size, price: nil, candidates: [], reasons: [.unreadablePrice(raw: raw)])
        }
    }
}

enum EntryFactory {
    static let addonCategory = Pattern("加料|配料|加購|升級")
    static let promotionCategory = "加料／套餐／促銷"

    static func make(category: String, name: String, size: String, price: Int?, candidates: [Int], reasons: [ReviewReason], source: EntrySource?, lexicon: TypoLexicon) -> MenuEntry {
        var all = reasons
        let suggestion = lexicon.suggestion(for: name)
        if let suggestion { all.append(.possibleTypo(suggestion: suggestion)) }
        if addonCategory.test(category) { all.append(.addonOrPromotion) }
        var unique: [ReviewReason] = []
        for r in all where !unique.contains(r) { unique.append(r) }
        return MenuEntry(
            category: category,
            name: name,
            size: size,
            price: price,
            candidatePrices: candidates,
            reasons: unique,
            source: source,
            originalName: name,
            suggestedName: suggestion
        )
    }

    /// 加料／促銷行：價格照讀，但一律待確認，且不覆蓋任何基本價格。
    static func promotionEntry(text: String, rawText: String, box: NormRect?, lineIDs: [Int], lexicon: TypoLexicon) -> MenuEntry {
        let tokens = Tokenizer.tokens(for: OCRLine(id: lineIDs.first ?? -1, text: text, box: box ?? .unit))
        var values: [Int] = []
        for t in tokens {
            switch t.kind {
            case .price(let v), .sizedPrice(_, let v): values.append(v)
            case .multiPrice(let vs): values += vs
            default: break
            }
        }
        var unique: [Int] = []
        for v in values where !unique.contains(v) { unique.append(v) }
        let name = NameCleaner.cleanName(tokens.filter { $0.kind == .text }.map(\.raw).joined(separator: " "))
        return make(
            category: promotionCategory,
            name: name.isEmpty ? text : name,
            size: "",
            price: unique.count == 1 ? unique[0] : nil,
            candidates: unique,
            reasons: [.addonOrPromotion],
            source: EntrySource(box: box, rawText: rawText, lineIDs: lineIDs),
            lexicon: lexicon
        )
    }
}

/// 以「所有字塊都沒有覆蓋到的垂直空白帶」切出直欄。
enum Gutters {
    typealias Band = (lo: Double, hi: Double)

    static func bands(from spans: [(Double, Double)], minGap: Double, resolution: Int = 1000) -> [Band] {
        guard !spans.isEmpty else { return [(lo: 0, hi: 1)] }
        var covered = [Bool](repeating: false, count: resolution)
        for (a, b) in spans {
            let lo = max(0, min(resolution - 1, Int(a * Double(resolution))))
            let hi = max(lo, min(resolution - 1, Int(b * Double(resolution))))
            for i in lo...hi { covered[i] = true }
        }
        var runs: [(Int, Int)] = []
        var i = 0
        while i < resolution {
            if covered[i] {
                var j = i
                while j + 1 < resolution && covered[j + 1] { j += 1 }
                runs.append((i, j))
                i = j + 1
            } else {
                i += 1
            }
        }
        let gapBins = Int((minGap * Double(resolution)).rounded(.up))
        var merged: [(Int, Int)] = []
        for r in runs {
            if let last = merged.last, r.0 - last.1 - 1 < gapBins {
                merged[merged.count - 1].1 = r.1
            } else {
                merged.append(r)
            }
        }
        if merged.isEmpty { return [(lo: 0, hi: 1)] }
        return merged.map { run -> Band in
            (lo: Double(run.0) / Double(resolution), hi: Double(run.1 + 1) / Double(resolution))
        }
    }

    static func index(of x: Double, in bands: [Band]) -> Int {
        if let i = bands.firstIndex(where: { x >= $0.lo && x <= $0.hi }) { return i }
        var best = 0
        var bestD = Double.infinity
        for (i, b) in bands.enumerated() {
            let d = x < b.lo ? b.lo - x : x - b.hi
            if d < bestD { bestD = d; best = i }
        }
        return best
    }
}
