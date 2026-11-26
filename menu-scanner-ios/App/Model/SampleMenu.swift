import UIKit

/// 合成的示範測試圖（虛構店家），讓模擬器沒有相機、相簿也沒有菜單照片時仍可走完整流程。
/// 只用來驗證流程，不可用來宣稱真實菜單的準確率。
enum SampleMenu {
    struct Row {
        let name: String
        let medium: String
        let large: String
    }

    /// 刻意包含：「—」未供應、誤字「憲桃」、甜度表與電話（應被排除）。
    static let rows: [Row] = [
        Row(name: "紅茶", medium: "30", large: "35"),
        Row(name: "綠茶", medium: "30", large: "35"),
        Row(name: "憲桃烏龍", medium: "50", large: "60"),
        Row(name: "珍珠奶茶", medium: "50", large: "60"),
        Row(name: "鮮奶茶", medium: "—", large: "65"),
        Row(name: "冬瓜檸檬", medium: "45", large: "55"),
    ]

    static func image() -> UIImage {
        let size = CGSize(width: 1200, height: 1500)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))

            func draw(_ s: String, _ x: CGFloat, _ y: CGFloat, size: CGFloat = 56, weight: UIFont.Weight = .medium, color: UIColor = .black) {
                let attrs: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: size, weight: weight),
                    .foregroundColor: color,
                ]
                (s as NSString).draw(at: CGPoint(x: x, y: y), withAttributes: attrs)
            }

            draw("【示範・小森林茶飲】", 60, 50, size: 64, weight: .bold)
            draw("虛構店家 合成測試圖", 60, 140, size: 34, weight: .regular, color: .darkGray)
            draw("醇茶系列", 60, 250, size: 58, weight: .bold)
            draw("中杯", 760, 250, weight: .bold)
            draw("大杯", 960, 250, weight: .bold)
            for (i, row) in rows.enumerated() {
                let y = 370 + CGFloat(i) * 110
                draw(row.name, 60, y)
                draw(row.medium, 770, y)
                draw(row.large, 970, y)
            }
            draw("甜度：正常 少糖 半糖 微糖 無糖", 60, 1120, size: 40, weight: .regular, color: .darkGray)
            draw("電話：02-0000-0000", 60, 1190, size: 40, weight: .regular, color: .darkGray)
        }
    }
}
