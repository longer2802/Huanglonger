import Foundation

public enum TokenKind: Equatable, Sendable {
    case text
    case price(Int)
    /// 行內標示規格的價格，例如「M55」「大杯 65」。
    case sizedPrice(size: String, price: Int)
    /// 斜線連寫的多個價格，例如「55/65」。
    case multiPrice([Int])
    /// 「—」「-」：此規格未供應。
    case unavailable
    /// 看起來是價格但讀不清楚，例如「6O」「5?」。
    case unreadable
    case header(String)
    case multiHeader([String])
    case volume(String)
    /// 溫度／冰沙標記（冷、熱、冷/熱、碎冰沙）、季節標籤（5-9月）：不是品名也不是價格。
    case note

    var isPriceLike: Bool {
        switch self {
        case .price, .sizedPrice, .multiPrice, .unavailable, .unreadable: return true
        default: return false
        }
    }

    var isHeaderLike: Bool {
        switch self {
        case .header, .multiHeader, .volume: return true
        default: return false
        }
    }
}

struct Token {
    var raw: String
    var kind: TokenKind
    var box: NormRect
    var lineID: Int
}

/// 把一行 OCR 文字切成「文字／價格／表頭／容量」片段，並估算每段的位置。
public enum Tokenizer {
    public static func words(in text: String) -> [String] {
        text.split(whereSeparator: { $0.isWhitespace }).map(String.init)
    }

    /// 字寬權重：中日韓及全形字元約為半形的兩倍寬。
    static func weight(_ c: Character) -> Double {
        guard let s = c.unicodeScalars.first else { return 1 }
        switch s.value {
        case 0x1100...0x115F, 0x2E80...0xA4CF, 0xAC00...0xD7A3, 0xF900...0xFAFF,
             0xFE30...0xFE4F, 0xFF00...0xFF60, 0xFFE0...0xFFE6, 0x20000...0x3FFFD:
            return 2
        default:
            return 1
        }
    }

    static func weight(_ s: String) -> Double {
        s.reduce(0) { $0 + weight($1) }
    }

    struct Piece {
        var raw: String
        var kind: TokenKind
        /// 在字詞內的字元位移（Character）。
        var start: Int
        var end: Int
    }

    static let dashRX = Pattern(#"^[—–\-─_]+$"#)
    static let temperatureRX = Pattern(#"^(?:冷|熱|溫|冰|冰沙|碎冰沙|碎冰|常溫|冷飲|熱飲)(?:/(?:冷|熱|溫|冰|冰沙|碎冰沙|碎冰|常溫))*$"#)
    /// 季節供應標籤，例如「5-9月」「10-3月」。
    static let monthRangeRX = Pattern(#"[0-9]{1,2}\s*[-~～–]\s*[0-9]{1,2}\s*月"#)
    static let maskChar: Character = "\u{2063}"
    /// 連寫的規格表頭，例如「L瓶」「ML」「中杯大杯」。
    static let joinableLabels = ["特大杯", "大杯", "中杯", "小杯", "瓶裝", "XL", "瓶", "M", "L", "S"]

    static func splitJoinedLabels(_ w: String) -> [String]? {
        var rest = Substring(w.uppercased())
        var out: [String] = []
        while !rest.isEmpty {
            guard let l = joinableLabels.first(where: { rest.hasPrefix($0) }) else { return nil }
            out.append(TextNormalizer.normalizeSize(l) ?? l)
            rest = rest.dropFirst(l.count)
        }
        return out.count >= 2 ? out : nil
    }
    static let readableChars = Set("0123456789")
    static let confusableChars = Set("OoIlSsB?")

    /// 字詞內的數字片段：容量 → 行內規格價格 → 斜線多價格 → 一般價格。
    static let innerRX = Pattern(
        #"(?<![0-9A-Za-z])(?:([0-9]{2,4})(ml|cc)|(特大杯|大杯|中杯|小杯|M|L|中|大|小):?(?:NT\$|\$)?([0-9]{2,4})元?|((?:NT\$|\$)?[0-9]{2,4}元?(?:/(?:NT\$|\$)?[0-9]{2,4}元?)+)|(?:NT\$|\$)?([0-9]{1,4})元?)(?![0-9])"#,
        caseInsensitive: true
    )

    static func isUnreadablePrice(_ w: String) -> Bool {
        var core = w
        for prefix in ["NT$", "$"] where core.hasPrefix(prefix) {
            core = String(core.dropFirst(prefix.count))
            break
        }
        if core.hasSuffix("元") { core.removeLast() }
        guard (2...4).contains(core.count) else { return false }
        let allowed = readableChars.union(confusableChars)
        return core.allSatisfy { allowed.contains($0) }
            && core.contains { readableChars.contains($0) }
            && core.contains { confusableChars.contains($0) }
    }

    /// 單一字詞（已半形化）切片。
    static func pieces(ofWord original: String) -> [Piece] {
        let n = original.count
        guard n > 0 else { return [] }
        if temperatureRX.test(original) { return [Piece(raw: original, kind: .note, start: 0, end: n)] }
        // 季節標籤：整個字詞就是標籤 → note；黏在品名後面 → 遮掉（字數不變，位置仍對得上）
        var w = original
        let monthMatches = monthRangeRX.matches(original)
        if !monthMatches.isEmpty {
            for m in monthMatches.reversed() {
                guard let r = Range(m.range, in: w) else { continue }
                w.replaceSubrange(r, with: String(repeating: maskChar, count: w[r].count))
            }
            if w.allSatisfy({ $0 == maskChar || $0.isWhitespace }) {
                return [Piece(raw: original, kind: .note, start: 0, end: n)]
            }
        }
        let chars = Array(w)

        if dashRX.test(w) { return [Piece(raw: w, kind: .unavailable, start: 0, end: n)] }
        if !w.allSatisfy({ $0.isNumber }), let label = TextNormalizer.normalizeSize(w) {
            let kind: TokenKind = TextNormalizer.isVolumeLabel(label) ? .volume(label) : .header(label)
            return [Piece(raw: w, kind: kind, start: 0, end: n)]
        }
        let slashParts = w.split(separator: "/").map(String.init)
        if slashParts.count >= 2 {
            let labels = slashParts.compactMap { TextNormalizer.normalizeSize($0) }
            if labels.count == slashParts.count {
                return [Piece(raw: w, kind: .multiHeader(labels), start: 0, end: n)]
            }
        }
        if let labels = splitJoinedLabels(w) {
            return [Piece(raw: w, kind: .multiHeader(labels), start: 0, end: n)]
        }
        if isUnreadablePrice(w) { return [Piece(raw: w, kind: .unreadable, start: 0, end: n)] }

        var out: [Piece] = []
        var cursor = 0

        func appendText(_ a: Int, _ b: Int) {
            guard a < b else { return }
            let raw = String(chars[a..<b].filter { $0 != maskChar })
            let trimmed = raw.trimmingCharacters(in: CharacterSet.whitespaces.union(CharacterSet(charactersIn: ":/.,、，|~+")))
            guard !trimmed.isEmpty, !["元", "NT", "NT$", "$", "NTD"].contains(trimmed.uppercased()) else { return }
            out.append(Piece(raw: trimmed, kind: .text, start: a, end: b))
        }

        for m in innerRX.matches(w) {
            guard let r = Range(m.range, in: w) else { continue }
            let s = w.distance(from: w.startIndex, to: r.lowerBound)
            let e = w.distance(from: w.startIndex, to: r.upperBound)
            guard s >= cursor else { continue }
            var kind: TokenKind?
            if let num = Pattern.group(m, 1, in: w), let unit = Pattern.group(m, 2, in: w) {
                kind = .volume(num + unit.lowercased())
            } else if let sz = Pattern.group(m, 3, in: w), let p = Pattern.group(m, 4, in: w),
                      let v = Int(p), let label = TextNormalizer.normalizeSize(sz) {
                kind = .sizedPrice(size: label, price: v)
            } else if let multi = Pattern.group(m, 5, in: w) {
                let values = multi.split(separator: "/").compactMap { TextNormalizer.parsePrice(String($0)) }
                if values.count >= 2 { kind = .multiPrice(values) }
            } else if let p = Pattern.group(m, 6, in: w), let v = Int(p) {
                let before: Character? = s > 0 ? chars[s - 1] : nil
                let after: Character? = e < n ? chars[e] : nil
                // 「第2杯」「1號餐」「3Q」這類數字是名稱的一部分，不是價格。
                let blockedAfter = after.map { $0.isLetter && $0 != "元" } ?? false
                let blockedBefore = before == "第"
                if v >= 5, !blockedAfter, !blockedBefore { kind = .price(v) }
            }
            if let kind {
                appendText(cursor, s)
                out.append(Piece(raw: String(chars[s..<e]), kind: kind, start: s, end: e))
                cursor = e
            }
        }
        appendText(cursor, n)
        return out
    }

    /// 沒有逐字框時，依字寬比例估算每個字詞在整行框內的位置。
    static func estimateWordBoxes(_ words: [String], in box: NormRect) -> [NormRect] {
        let ws = words.map { max(weight($0), 1) }
        let space = 1.0
        let total = ws.reduce(0, +) + space * Double(max(words.count - 1, 0))
        guard total > 0 else { return words.map { _ in box } }
        var cursor = 0.0
        var out: [NormRect] = []
        for w in ws {
            out.append(NormRect(x: box.x + box.width * cursor / total, y: box.y, width: box.width * w / total, height: box.height))
            cursor += w + space
        }
        return out
    }

    /// 一行 OCR → 片段（含位置）。相鄰文字合併；「中 30」這種表頭字＋價格合併成行內規格價格。
    static func tokens(for line: OCRLine) -> [Token] {
        let lineWords = Tokenizer.words(in: line.text)
        guard !lineWords.isEmpty else { return [] }
        let boxes: [NormRect]
        if let wb = line.wordBoxes, wb.count == lineWords.count {
            boxes = wb
        } else {
            boxes = estimateWordBoxes(lineWords, in: line.box)
        }

        var raw: [Token] = []
        for (w, box) in zip(lineWords, boxes) {
            let norm = TextNormalizer.halfwidth(w)
            let chars = Array(norm)
            var prefix: [Double] = [0]
            for c in chars { prefix.append(prefix[prefix.count - 1] + weight(c)) }
            let total = max(prefix[prefix.count - 1], 1)
            for p in pieces(ofWord: norm) {
                let a = prefix[p.start] / total
                let b = prefix[p.end] / total
                raw.append(Token(
                    raw: p.raw,
                    kind: p.kind,
                    box: NormRect(x: box.x + box.width * a, y: box.y, width: box.width * (b - a), height: box.height),
                    lineID: line.id
                ))
            }
        }

        var out: [Token] = []
        for t in raw {
            if let last = out.last {
                if case .price(let v) = t.kind, case .header(let label) = last.kind {
                    out[out.count - 1] = Token(raw: last.raw + " " + t.raw, kind: .sizedPrice(size: label, price: v), box: last.box.union(t.box), lineID: t.lineID)
                    continue
                }
                if t.kind == .text, last.kind == .text {
                    out[out.count - 1] = Token(raw: last.raw + " " + t.raw, kind: .text, box: last.box.union(t.box), lineID: t.lineID)
                    continue
                }
            }
            out.append(t)
        }
        return out
    }
}
