import CoreImage
import CoreImage.CIFilterBuiltins
import MenuScannerCore
import UIKit

/// 照片方向、縮放、裁切、對比增強集中在這裡處理，確保 OCR 與畫面高亮使用同一個座標系。
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

    /// 依正規化範圍裁切，並回傳實際裁到的範圍（像素取整後），供座標換算使用。
    static func crop(_ image: CGImage, to region: NormRect) -> (image: CGImage, region: NormRect)? {
        let p = VisionGeometry.pixelRect(region, imageWidth: image.width, imageHeight: image.height)
        guard let cropped = image.cropping(to: CGRect(x: p.x, y: p.y, width: p.width, height: p.height)) else { return nil }
        let actual = VisionGeometry.normRect(pixelX: p.x, pixelY: p.y, width: cropped.width, height: cropped.height, imageWidth: image.width, imageHeight: image.height)
        return (cropped, actual)
    }

    /// 局部重掃用：灰階＋提高對比。
    static func enhanceContrast(_ image: CGImage) -> CGImage? {
        let input = CIImage(cgImage: image)
        let filter = CIFilter.colorControls()
        filter.inputImage = input
        filter.saturation = 0
        filter.contrast = 1.5
        filter.brightness = 0.02
        guard let output = filter.outputImage else { return nil }
        return CIContext(options: [.useSoftwareRenderer: false]).createCGImage(output, from: input.extent)
    }
}

extension NormRect {
    init(_ rect: CGRect) {
        self.init(x: Double(rect.origin.x), y: Double(rect.origin.y), width: Double(rect.size.width), height: Double(rect.size.height))
    }

    /// 轉成畫面上（左上原點）的矩形。
    func cgRect(in size: CGSize) -> CGRect {
        CGRect(x: x * size.width, y: y * size.height, width: width * size.width, height: height * size.height)
    }
}
