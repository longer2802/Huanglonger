import MenuScannerCore
import MenuScannerVision
import UIKit

/// 照片方向、縮放、裁切、對比增強集中在這裡處理，確保 OCR 與畫面高亮使用同一個座標系。
/// 裁切與對比增強的實作在 MenuScannerVision（與 macOS 基準測試工具共用）。
enum ImagePreparation {
    /// 保留足夠解析度給小字，但避免超大照片拖慢 Vision。
    static let maxPixelDimension: CGFloat = 4096

    /// 依 EXIF 方向轉正，回傳 `.up` 方向的 CGImage（之後所有正規化座標都以它為準）。
    static func uprightCGImage(from image: UIImage) -> CGImage? {
        let pixelSize = CGSize(width: image.size.width * image.scale, height: image.size.height * image.scale)
        let longest = max(pixelSize.width, pixelSize.height)
        if image.imageOrientation == .up, let cg = image.cgImage, longest <= maxPixelDimension {
            return cg
        }
        let factor = min(1, maxPixelDimension / max(longest, 1))
        let target = CGSize(width: (pixelSize.width * factor).rounded(), height: (pixelSize.height * factor).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let rendered = UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
        return rendered.cgImage
    }

    /// 旋轉 90° 的倍數（校對前讓使用者把菜單轉正）。
    static func rotated(_ image: CGImage, quarterTurns: Int) -> CGImage? {
        let turns = ((quarterTurns % 4) + 4) % 4
        guard turns != 0 else { return image }
        let orientation: UIImage.Orientation = [.up, .right, .down, .left][turns]
        return uprightCGImage(from: UIImage(cgImage: image, scale: 1, orientation: orientation))
    }

    static func crop(_ image: CGImage, to region: NormRect) -> (image: CGImage, region: NormRect)? {
        VisionImageTools.crop(image, to: region)
    }

    static func enhanceContrast(_ image: CGImage) -> CGImage? {
        VisionImageTools.enhanceContrast(image)
    }
}

extension NormRect {
    /// 轉成畫面上（左上原點）的矩形。
    func cgRect(in size: CGSize) -> CGRect {
        CGRect(x: x * size.width, y: y * size.height, width: width * size.width, height: height * size.height)
    }
}
