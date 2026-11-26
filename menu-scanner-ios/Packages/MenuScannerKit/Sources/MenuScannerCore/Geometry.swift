import Foundation

/// 正規化矩形：原點在影像「左上角」，x、y、寬、高都介於 0...1。
/// App 內所有座標（OCR 結果、高亮、裁切）統一使用這個座標系。
public struct NormRect: Codable, Hashable, Sendable {
    public var x: Double
    public var y: Double
    public var width: Double
    public var height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }

    public static let unit = NormRect(x: 0, y: 0, width: 1, height: 1)

    public var minX: Double { x }
    public var maxX: Double { x + width }
    public var minY: Double { y }
    public var maxY: Double { y + height }
    public var midX: Double { x + width / 2 }
    public var midY: Double { y + height / 2 }

    public func union(_ other: NormRect) -> NormRect {
        let lx = min(minX, other.minX), ly = min(minY, other.minY)
        let hx = max(maxX, other.maxX), hy = max(maxY, other.maxY)
        return NormRect(x: lx, y: ly, width: hx - lx, height: hy - ly)
    }

    public func intersects(_ other: NormRect) -> Bool {
        minX < other.maxX && other.minX < maxX && minY < other.maxY && other.minY < maxY
    }

    /// 是否大致落在另一個矩形內（以中心點判斷）。
    public func isCentered(in other: NormRect) -> Bool {
        midX >= other.minX && midX <= other.maxX && midY >= other.minY && midY <= other.maxY
    }

    public func verticalOverlap(with other: NormRect) -> Double {
        max(0, min(maxY, other.maxY) - max(minY, other.minY))
    }

    /// 垂直重疊長度 ÷ 較矮者的高度。
    public func verticalOverlapRatio(with other: NormRect) -> Double {
        let m = min(height, other.height)
        return m > 0 ? verticalOverlap(with: other) / m : 0
    }

    public var clamped: NormRect {
        let lx = min(max(minX, 0), 1), ly = min(max(minY, 0), 1)
        let hx = min(max(maxX, 0), 1), hy = min(max(maxY, 0), 1)
        return NormRect(x: lx, y: ly, width: max(0, hx - lx), height: max(0, hy - ly))
    }
}

/// Vision 座標換算。Vision 的 boundingBox 原點在左下角，而且是相對於「送進 Vision 的那張圖」。
/// 若送進去的是裁切後的局部影像，必須再換回整張原圖的座標，高亮位置才會正確。
public enum VisionGeometry {
    /// - Parameters:
    ///   - visionBox: Vision 回傳的 boundingBox（原點左下，x/y/width/height 皆為 0...1）。
    ///   - crop: 送進 Vision 的影像在整張原圖中的範圍（左上原點）；整張辨識時為 `.unit`。
    /// - Returns: 整張原圖、左上原點的正規化矩形。
    public static func toImageSpace(visionBox: NormRect, crop: NormRect = .unit) -> NormRect {
        let topLeftY = 1 - visionBox.y - visionBox.height
        return NormRect(
            x: crop.x + visionBox.x * crop.width,
            y: crop.y + topLeftY * crop.height,
            width: visionBox.width * crop.width,
            height: visionBox.height * crop.height
        )
    }

    /// 正規化矩形轉像素矩形（左上原點，CGImage.cropping 使用的座標）。
    public static func pixelRect(_ rect: NormRect, imageWidth: Int, imageHeight: Int) -> (x: Int, y: Int, width: Int, height: Int) {
        let r = rect.clamped
        let x0 = Int((r.minX * Double(imageWidth)).rounded(.down))
        let y0 = Int((r.minY * Double(imageHeight)).rounded(.down))
        let x1 = Int((r.maxX * Double(imageWidth)).rounded(.up))
        let y1 = Int((r.maxY * Double(imageHeight)).rounded(.up))
        return (x0, y0, max(1, min(imageWidth, x1) - x0), max(1, min(imageHeight, y1) - y0))
    }

    /// 像素矩形轉回正規化矩形。
    public static func normRect(pixelX: Int, pixelY: Int, width: Int, height: Int, imageWidth: Int, imageHeight: Int) -> NormRect {
        NormRect(
            x: Double(pixelX) / Double(imageWidth),
            y: Double(pixelY) / Double(imageHeight),
            width: Double(width) / Double(imageWidth),
            height: Double(height) / Double(imageHeight)
        )
    }
}

/// 辨識語言選擇：依目前 revision 實際支援的語言，優先 zh-Hant，其次 en-US。
public enum OCRLanguagePolicy {
    public static let preferred = ["zh-Hant", "en-US"]

    public static func select(from supported: [String]) -> [String] {
        var out = preferred.filter { supported.contains($0) }
        if !out.contains("zh-Hant"), supported.contains("zh-Hans") {
            out.insert("zh-Hans", at: 0)
        }
        if out.isEmpty, let first = supported.first { out = [first] }
        return out
    }
}
