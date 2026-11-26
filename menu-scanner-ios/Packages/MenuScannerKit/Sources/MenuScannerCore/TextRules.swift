import Foundation

// MARK: - 正規表示式小工具（NSRegularExpression，iOS／macOS／Linux 行為一致）

struct Pattern {
    let re: NSRegularExpression

    init(_ pattern: String, caseInsensitive: Bool = false) {
        // 規則是寫死的常數，編譯失敗代表程式碼錯誤，測試會立即發現。
        re = try! NSRegularExpression(pattern: pattern, options: caseInsensitive ? [.caseInsensitive] : [])
    }

    private func range(_ s: String) -> NSRange { NSRange(s.startIndex..<s.endIndex, in: s) }

    func test(_ s: String) -> Bool {
        re.firstMatch(in: s, options: [], range: range(s)) != nil
    }

    func matches(_ s: String) -> [NSTextCheckingResult] {
        re.matches(in: s, options: [], range: range(s))
    }

    func replace(_ s: String, with template: String) -> String {
        re.stringByReplacingMatches(in: s, options: [], range: range(s), withTemplate: template)
    }

    /// 第 n 個擷取群組的文字（沒有符合時為 nil）。
    static func group(_ m: NSTextCheckingResult, _ i: Int, in s: String) -> String? {
        let r = m.range(at: i)
        guard r.location != NSNotFound, let rr = Range(r, in: s) else { return nil }
        return String(s[rr])
    }
}

// MARK: - 文字與價格正規化

public enum TextNormalizer {
    /// 全形英數符號 → 半形；全形空白 → 半形空白。中文字不變。
    public static func halfwidth(_ s: String) -> String {
        var scalars = String.UnicodeScalarView()
        for u in s.unicodeScalars {
            switch u.value {
            case 0xFF01...0xFF5E:
                scalars.append(Unicode.Scalar(u.value - 0xFEE0)!)
            case 0x3000:
                scalars.append(" ")
            default:
                scalars.append(u)
            }
        }
        return String(scalars)
    }

    /// 整行正規化：半形化、空白收斂。
    public static func normalizedLine(_ s: String) -> String {
        Tokenizer.words(in: s).map(halfwidth).joined(separator: " ")
    }

    /// 解析單一價格字串：接受「65」「６５」「NT$65」「$65」「65元」。其他格式回傳 nil。
    public static func parsePrice(_ s: String) -> Int? {
        var t = halfwidth(s).trimmingCharacters(in: .whitespaces)
        for prefix in ["NT$", "NTD", "NT", "$"] where t.uppercased().hasPrefix(prefix) {
            t = String(t.dropFirst(prefix.count))
            break
        }
        t = t.trimmingCharacters(in: .whitespaces)
        if t.hasSuffix("元") { t.removeLast() }
        t = t.trimmingCharacters(in: .whitespaces)
        guard !t.isEmpty, t.allSatisfy({ $0.isASCII && $0.isNumber }), let v = Int(t), v > 0, v < 10000 else {
            return nil
        }
        return v
    }

    private static let volumeRX = Pattern(#"^([0-9]{2,4})\s*(ml|cc|c\.c\.)$"#, caseInsensitive: true)

    /// 規格字詞正規化：中／中杯→中杯、大／大杯→大杯、M、L、700ml…；不是規格時回傳 nil。
    public static func normalizeSize(_ s: String) -> String? {
        let t = halfwidth(s).trimmingCharacters(in: .whitespaces)
        switch t.uppercased() {
        case "M", "L", "S", "XL": return t.uppercased()
        default: break
        }
        switch t {
        case "中", "中杯": return "中杯"
        case "大", "大杯": return "大杯"
        case "小", "小杯": return "小杯"
        case "特大", "特大杯": return "特大杯"
        case "單一", "單價", "單一價": return SizeLabel.single
        case "瓶", "瓶裝": return "瓶"
        default: break
        }
        if let m = volumeRX.matches(t).first, let n = Pattern.group(m, 1, in: t), let unit = Pattern.group(m, 2, in: t) {
            return n + (unit.lowercased().hasPrefix("m") ? "ml" : "cc")
        }
        return nil
    }

    public static func isVolumeLabel(_ label: String) -> Bool {
        label.hasSuffix("ml") || label.hasSuffix("cc")
    }
}

// MARK: - 非品項文字（電話、地址、日期、著作權、甜度冰量表…）

public enum NoiseFilter {
    static let phone = Pattern(#"電話|TEL|專線|訂購|外送|叫餐|☎|📞|(?<![0-9])0[0-9]{1,3}[-\s)]?[0-9]{3,4}[-\s]?[0-9]{3,4}(?![0-9])"#, caseInsensitive: true)
    static let address = Pattern(#"地址|[市縣]\S{0,6}[區鄉鎮]|(?:路|街|大道|巷|弄)\S{0,10}?[0-9]+\s*號"#)
    static let dateTime = Pattern(#"(?:19|20)[0-9]{2}\s*[/.\-年]\s*[0-9]{1,2}|[0-9]{1,2}\s*月\s*[0-9]{1,2}\s*[日號]|[0-9]{1,2}\s*/\s*[0-9]{1,2}\s*[~\-至]\s*[0-9]{1,2}\s*/\s*[0-9]{1,2}|[0-9]{1,2}\s*:\s*[0-9]{2}|活動期間|活動時間|營業時間|公休|(?<![0-9])1[0-2][0-9]\s*[-.]\s*[0-9]{1,2}\s*[.]\s*[0-9]{1,2}(?![0-9])|星期[一二三四五六日]|週[一二三四五六日]"#)
    static let copyright = Pattern(#"©|\(c\)|版權|著作權|copyright|all rights|reserved"#, caseInsensitive: true)
    static let web = Pattern(#"www\.|https?:|\.com|\.tw|facebook|instagram|(?<![A-Za-z])(?:FB|IG)(?![A-Za-z])|LINE\s*@|@[A-Za-z0-9_]{3,}|加入會員|線上點餐|官方網站|QR\s*code"#, caseInsensitive: true)
    static let footnote = Pattern(#"^(?:[※*]|註\s*:|備註)"#)
    /// 獨立一行的「甜度冰量固定」說明（前面可能有圖示被讀成數字）
    static let sweetFixed = Pattern(#"^\S{0,2}\s*(?:甜度冰量固定|甜度固定|冰量固定)\s*$"#)

    /// 加料、套餐加價、促銷：無法確定適用範圍，一律放待確認。
    static let promotion = Pattern(#"加料|加購|升級|第二杯|第2杯|買\s*[一二三1-9][0-9]?\s*送\s*[一二三1-9]|特價|現折|折抵|折價|優惠|促銷|折扣|(?<![0-9])[1-9]\s*折|[一二三四五六七八九]折|原價|會員價|加價|套餐\s*(?:\+|加)|(?:^|\s|[\p{Han}])\+\s*\$?[0-9]|加\s*\$?[0-9]+\s*元"#)

    static let sugarIceWords: [String] = [
        "正常甜", "全糖", "少糖", "半糖", "微糖", "一分糖", "二分糖", "三分糖", "無糖",
        "完全去冰", "正常冰", "少冰", "微冰", "去冰", "常溫", "溫熱",
        "甜度冰塊", "冰量表", "糖量表", "甜度表", "甜度", "冰量", "冰塊", "糖度", "糖量", "正常", "可調整", "可選",
        "一分", "二分", "三分", "五分", "七分", "八分", "九分", "sugar", "ice", "溫", "熱", "冰",
    ].sorted { $0.count > $1.count }

    /// 是否為獨立的甜度／冰量表。要求至少兩個表內字詞，且去掉這些字詞後幾乎沒有其他字，避免誤刪「無糖綠茶」這類品名。
    static func isSugarIceTable(_ text: String) -> Bool {
        var rest = text.lowercased()
        var hits = 0
        for w in sugarIceWords {
            let parts = rest.components(separatedBy: w)
            hits += parts.count - 1
            rest = parts.joined(separator: " ")
        }
        guard hits >= 2 else { return false }
        let leftover = rest.filter { !$0.isWhitespace && !$0.isNumber && !"%:/|、,()·.-".contains($0) }
        return leftover.count <= 1
    }

    /// 回傳排除原因；nil 代表這行可能是品項。
    public static func noiseReason(for normalizedText: String) -> String? {
        let t = normalizedText
        if copyright.test(t) { return "著作權" }
        if web.test(t) { return "網址或社群帳號" }
        if phone.test(t) { return "電話或聯絡資訊" }
        if address.test(t) { return "地址" }
        if dateTime.test(t) { return "日期或營業時間" }
        if isSugarIceTable(t) { return "甜度冰量表" }
        if footnote.test(t) && !promotion.test(t) { return "附註說明" }
        if sweetFixed.test(t) { return "附註說明" }
        return nil
    }

    public static func isPromotion(_ normalizedText: String) -> Bool {
        promotion.test(normalizedText)
    }
}

// MARK: - 常見誤字詞庫

/// 只提供「建議」，不直接改品名；原文保留在 MenuEntry.originalName。
public struct TypoLexicon: Codable, Hashable, Sendable {
    public var corrections: [String: String]

    public init(corrections: [String: String]) {
        self.corrections = corrections
    }

    public static let standard = TypoLexicon(corrections: [
        "憲桃": "蜜桃", "密桃": "蜜桃",
        "拿錢": "拿鐵", "拿銕": "拿鐵",
        "烏籠": "烏龍", "鳥龍": "烏龍",
        "紅荼": "紅茶", "綠荼": "綠茶", "奶荼": "奶茶", "青荼": "青茶", "荼凍": "茶凍",
        "珍殊": "珍珠", "珍朱": "珍珠",
        "鐵觀晉": "鐵觀音",
        "冬爪": "冬瓜",
        "檸蒙": "檸檬", "寧檬": "檸檬",
        "百番果": "百香果", "百香菓": "百香果",
        "芋頸": "芋頭",
        "滷內飯": "滷肉飯",
        "雞服": "雞腿",
        "便徵": "便當", "會護": "會議",
    ])

    /// 回傳建議品名；沒有可修正的字詞時為 nil。
    public func suggestion(for name: String) -> String? {
        var out = name
        for (wrong, right) in corrections.sorted(by: { $0.key.count > $1.key.count }) {
            out = out.replacingOccurrences(of: wrong, with: right)
        }
        return out == name ? nil : out
    }
}

// MARK: - 品名、分類整理

enum NameCleaner {
    static let hanSpace = Pattern(#"(?<=[\p{Han}])\s+(?=[\p{Han}])"#)
    static let leadingMarker = Pattern(#"^(?:[0-9]{1,2}\s*[.、)]|[•·●○◎★☆▲△■□◆◇►▶➤@®©*#]|[A-Za-z](?=\s*[\p{Han}]))\s*"#)
    static let trailingCurrency = Pattern(#"\s*(?:NT\$?|NTD|\$)$"#, caseInsensitive: true)
    static let edgeJunk = Pattern(#"^[\s.:…·,，、|/\\\-~+]+|[\s.:…·,，、|/\\\-~+]+$"#)
    static let spaces = Pattern(#"\s{2,}"#)
    /// 品名後的選項清單，例如「波霸奶茶 (椰果/波波/綠茶凍)」。
    static let optionParen = Pattern(#"\s*[（(][^（）()]*[/、][^（）()]*[）)]\s*$"#)
    /// 品名後的甜度附註，例如「玫瑰奶茶 / 產品略含甜度」。
    static let sweetnessNote = Pattern(#"\s*/?\s*(?:產品)?[略陷]?含?(?:略含甜度|含甜[度座]|甜度冰量固定|甜度固定|冰量固定|品甜固定)\s*$"#)
    /// 黏在品名後的溫度／冰沙標記（含 OCR 常見讀法）：冷/熱、冷1熱、冷1點、碎冰沙、砵冰沙/熱、s冰沙、沐沙…
    static let trailingMarker = Pattern(#"(?:\s+(?:[碎砵体體淬]?冰沙|沐沙)(?:\s*[/1lI|]\s*[熱热點])?\s*[)）]?|(?:[碎砵体體淬sS]冰沙|沐沙)(?:\s*[/1lI|]\s*[熱热點])?\s*[)）]?|\s*[冷净淨冶]\s*[/1lI|]?\s*[熱热點路熟澱酪]?\s*[)）]?|\s+[熱热])\s*$"#)
    /// 黏在品名後的季節標籤（OCR 常漏掉連字號）：5-9月、59月、103月、(59月)、⑤59月、659月
    static let trailingMonth = Pattern(#"\s*[(（]?\s*[①-⑳@]?\s*(?<![0-9.])[0-9]{1,2}\s*[-~～–]?\s*[0-9]{1,2}\s*月\s*[)）]?\s*$"#)
    /// 中文品名後同一行的英文副標，例如「阿華田拿鐵 Ovaltine Latte」
    static let trailingEnglish = Pattern(#"(?<=[\p{Han}])\s+[A-Za-z][A-Za-z &/'.,-]*$"#)
    static let brackets = Pattern(#"[【】\[\]「」《》<>]"#)
    static let categoryRX = Pattern(#"(?:系列|類|專區|特調|推薦|人氣|精選|限定|MENU)$|^[【\[「《<].*[】\]」》>]$"#, caseInsensitive: true)
    static let headerFillers: Set<String> = [
        "品名", "品項", "名稱", "飲品", "飲料", "價格", "價錢", "售價", "項目", "規格", "尺寸",
        "SIZE", "MENU", "PRICE", "ITEM", "冷飲", "熱飲", "杯型", "容量",
    ]

    static func cleanName(_ s: String) -> String {
        var t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        t = leadingMarker.replace(t, with: "")
        // 不成對的開頭括號（「（日式大雞腿」）
        if let f = t.first, "(（".contains(f), !t.contains(")"), !t.contains("）") { t.removeFirst() }
        t = hanSpace.replace(t, with: "")
        t = trailingCurrency.replace(t, with: "")
        // 尾端附註可能疊在一起（「梅子冰茶 品甜固定 冷)」），重複剝到沒有變化
        for _ in 0..<3 {
            let before = t
            t = trailingEnglish.replace(t, with: "")
            t = trailingMarker.replace(t, with: "")
            t = trailingMonth.replace(t, with: "")
            t = sweetnessNote.replace(t, with: "")
            t = optionParen.replace(t, with: "")
            if t == before { break }
        }
        t = edgeJunk.replace(t, with: "")
        t = spaces.replace(t, with: " ")
        return t.trimmingCharacters(in: .whitespaces)
    }

    static func cleanCategory(_ s: String) -> String {
        cleanName(brackets.replace(s, with: " "))
    }

    static func looksLikeCategory(_ s: String) -> Bool {
        categoryRX.test(s.trimmingCharacters(in: .whitespaces))
    }

    static func isHeaderFiller(_ s: String) -> Bool {
        let words = Tokenizer.words(in: s)
        return !words.isEmpty && words.allSatisfy { headerFillers.contains($0.uppercased()) }
    }

    static func containsHan(_ s: String) -> Bool {
        s.unicodeScalars.contains { $0.properties.isIdeographic }
    }

    /// 可能是品名：含中文，或至少 3 個英文字母（排除截圖狀態列「5G」、「LTE」以外的雜字）。
    static func isPlausibleName(_ s: String) -> Bool {
        containsHan(s) || s.filter({ $0.isLetter && $0.isASCII }).count >= 3
    }

    static func isLatinOnly(_ s: String) -> Bool {
        let letters = s.filter { $0.isLetter }
        return !letters.isEmpty && letters.allSatisfy { $0.isASCII }
    }
}

enum Stats {
    static func median(_ xs: [Double]) -> Double? {
        guard !xs.isEmpty else { return nil }
        let s = xs.sorted()
        return s.count % 2 == 1 ? s[s.count / 2] : (s[s.count / 2 - 1] + s[s.count / 2]) / 2
    }
}
