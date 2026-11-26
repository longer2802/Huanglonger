#if canImport(Vision)
import CoreGraphics
import CoreImage
import CoreImage.CIFilterBuiltins
import Foundation
import ImageIO
import MenuScannerCore
import Vision

public enum OCRError: LocalizedError, Equatable {
    case invalidImage
    case noReadableText
    case failed(String)

    public var errorDescription: String? {
        switch self {
        case .invalidImage: return "無法讀取這張圖片"
        case .noReadableText: return "找不到可讀的文字，請把菜單拍清楚、拍完整後再試一次"
        case .failed(let message): return "辨識失敗：\(message)"
        }
    }
}

public protocol TextRecognizing: Sendable {
    /// - Parameters:
    ///   - image: 已轉正（`.up`）的整張原圖。
    ///   - region: 只辨識這個範圍（左上原點正規化座標）；nil 為整張。
    ///   - enhanceContrast: 是否先做灰階對比增強（局部重掃用）。
    ///   - lineIDOffset: 行號起點，讓重掃結果的行號不與先前重複。
    func recognize(_ image: CGImage, region: NormRect?, enhanceContrast: Bool, lineIDOffset: Int) async throws -> OCRDocument
}

public extension NormRect {
    init(_ rect: CGRect) {
        self.init(x: Double(rect.origin.x), y: Double(rect.origin.y), width: Double(rect.size.width), height: Double(rect.size.height))
    }
}

/// 不依賴 UIKit 的影像處理（App 與 macOS 基準工具共用）。
public enum VisionImageTools {
    /// 依正規化範圍裁切，並回傳實際裁到的範圍（像素取整後），供座標換算使用。
    public static func crop(_ image: CGImage, to region: NormRect) -> (image: CGImage, region: NormRect)? {
        let p = VisionGeometry.pixelRect(region, imageWidth: image.width, imageHeight: image.height)
        guard let cropped = image.cropping(to: CGRect(x: p.x, y: p.y, width: p.width, height: p.height)) else { return nil }
        let actual = VisionGeometry.normRect(pixelX: p.x, pixelY: p.y, width: cropped.width, height: cropped.height, imageWidth: image.width, imageHeight: image.height)
        return (cropped, actual)
    }

    /// 局部重掃用：灰階＋提高對比。
    public static func enhanceContrast(_ image: CGImage) -> CGImage? {
        let input = CIImage(cgImage: image)
        let filter = CIFilter.colorControls()
        filter.inputImage = input
        filter.saturation = 0
        filter.contrast = 1.5
        filter.brightness = 0.02
        guard let output = filter.outputImage else { return nil }
        return CIContext().createCGImage(output, from: input.extent)
    }

    /// 長邊小於 2400 像素時放大到約 3000（最多 3 倍），讓 Vision 讀得到小字。
    public static func upscaledIfSmall(_ image: CGImage, minLongSide: Int = 2400, target: Double = 3000) -> CGImage {
        let longest = max(image.width, image.height)
        guard longest > 0, longest < minLongSide else { return image }
        let scale = min(3.0, target / Double(longest))
        let w = Int((Double(image.width) * scale).rounded()), h = Int((Double(image.height) * scale).rounded())
        guard let ctx = CGContext(
            data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) else { return image }
        ctx.interpolationQuality = .high
        ctx.draw(image, in: CGRect(x: 0, y: 0, width: w, height: h))
        return ctx.makeImage() ?? image
    }

    /// 從檔案讀圖並依 EXIF 方向轉正，長邊最多 `maxPixelSize`（基準測試工具使用）。
    public static func loadUpright(url: URL, maxPixelSize: Int = 4096) -> CGImage? {
        guard let source = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixelSize,
        ]
        return CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary)
    }
}

/// Apple Vision 文字辨識（完全在裝置上執行，不連網）。
public struct VisionTextRecognizer: TextRecognizing {
    public init() {}

    public func recognize(_ image: CGImage, region: NormRect?, enhanceContrast: Bool, lineIDOffset: Int = 0) async throws -> OCRDocument {
        let started = Date()
        var work = image
        var crop = NormRect.unit
        if let region {
            guard let c = VisionImageTools.crop(image, to: region) else { throw OCRError.invalidImage }
            work = c.image
            crop = c.region
        }
        if enhanceContrast, let enhanced = VisionImageTools.enhanceContrast(work) {
            work = enhanced
        }
        // 截圖、遠拍的小字：先放大（正規化座標不受影響）
        work = VisionImageTools.upscaledIfSmall(work)

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.revision = VNRecognizeTextRequest.currentRevision
        // 不做語言校正：保留原始文字，價格數字也不會被「修正」。
        request.usesLanguageCorrection = false
        // 預設只辨識高度約圖高 1/32 以上的字；整張菜單的字常只有 1% 左右
        request.minimumTextHeight = 0.004
        let supported = (try? request.supportedRecognitionLanguages()) ?? []
        request.recognitionLanguages = OCRLanguagePolicy.select(from: supported)
        #if targetEnvironment(simulator)
        request.usesCPUOnly = true
        #endif

        let input = work
        let observations: [VNRecognizedTextObservation] = try await withTaskCancellationHandler {
            try await withCheckedThrowingContinuation { continuation in
                DispatchQueue.global(qos: .userInitiated).async {
                    do {
                        let handler = VNImageRequestHandler(cgImage: input, orientation: .up, options: [:])
                        try handler.perform([request])
                        continuation.resume(returning: request.results ?? [])
                    } catch {
                        continuation.resume(throwing: error)
                    }
                }
            }
        } onCancel: {
            request.cancel()
        }
        try Task.checkCancellation()

        var lines: [OCRLine] = []
        let imageW = Double(image.width), imageH = Double(image.height)
        for observation in observations {
            let candidates = observation.topCandidates(3)
            guard let top = candidates.first else { continue }
            guard !top.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { continue }
            let lineBox = VisionGeometry.toImageSpace(visionBox: NormRect(observation.boundingBox), crop: crop)
            // Vision 常把左右兩欄同一高度的文字合成一行：依字距切成多段，各自成為一行
            let segments = Self.segments(for: top, lineBox: lineBox, crop: crop, imageWidth: imageW, imageHeight: imageH)
            for seg in segments {
                lines.append(OCRLine(
                    id: lineIDOffset + lines.count,
                    text: seg.text,
                    confidence: Double(top.confidence),
                    candidates: segments.count == 1 ? candidates.map { OCRCandidate(text: $0.string, confidence: Double($0.confidence)) } : [],
                    box: seg.box,
                    wordBoxes: seg.wordBoxes
                ))
            }
        }
        if lines.isEmpty { throw OCRError.noReadableText }

        return OCRDocument(
            lines: lines,
            imageWidth: image.width,
            imageHeight: image.height,
            region: region == nil ? nil : crop,
            languages: request.recognitionLanguages,
            revision: request.revision,
            processingSeconds: Date().timeIntervalSince(started)
        )
    }

    struct Segment {
        var text: String
        var box: NormRect
        var wordBoxes: [NormRect]?
    }

    /// 以每個字的位置把一行切成多段：字距大於字高 1.5 倍（且至少 8 像素）就切開。
    /// 取不到逐字位置、或逐字位置都等於整行框（部分 revision 的中文行為）時，維持整行。
    static func segments(for text: VNRecognizedText, lineBox: NormRect, crop: NormRect, imageWidth: Double, imageHeight: Double) -> [Segment] {
        let s = text.string
        let fallback = [Segment(text: s.trimmingCharacters(in: .whitespaces), box: lineBox, wordBoxes: nil)]
        var chars: [(ch: Character, box: NormRect?)] = []
        var idx = s.startIndex
        while idx < s.endIndex {
            let next = s.index(after: idx)
            let ch = s[idx]
            var box: NormRect?
            if !ch.isWhitespace {
                guard let obs = (try? text.boundingBox(for: idx..<next)) ?? nil else { return fallback }
                box = VisionGeometry.toImageSpace(visionBox: NormRect(obs.boundingBox), crop: crop)
            }
            chars.append((ch, box))
            idx = next
        }
        let boxes = chars.compactMap(\.box)
        guard boxes.count >= 2 else { return fallback }
        if boxes.allSatisfy({ $0.width > lineBox.width * 0.9 }) { return fallback }

        let heightPx = boxes.map(\.height).sorted()[boxes.count / 2] * imageHeight
        let gapLimit = max(heightPx * 1.5, 8)
        var groups: [[(ch: Character, box: NormRect?)]] = [[]]
        var last: NormRect?
        for c in chars {
            if let b = c.box, let l = last, (b.minX - l.maxX) * imageWidth > gapLimit, !groups[groups.count - 1].isEmpty {
                groups.append([])
            }
            groups[groups.count - 1].append(c)
            if let b = c.box { last = b }
        }

        return groups.compactMap { g -> Segment? in
            let segText = String(g.map(\.ch)).trimmingCharacters(in: .whitespaces)
            let bs = g.compactMap(\.box)
            guard !segText.isEmpty, let first = bs.first else { return nil }
            let box = bs.dropFirst().reduce(first) { $0.union($1) }
            var words: [NormRect] = []
            var cur: NormRect?
            for (ch, b) in g {
                if ch.isWhitespace {
                    if let c = cur { words.append(c); cur = nil }
                } else if let b {
                    cur = cur.map { $0.union(b) } ?? b
                }
            }
            if let c = cur { words.append(c) }
            let wordCount = Tokenizer.words(in: segText).count
            return Segment(text: segText, box: box, wordBoxes: wordCount > 1 && words.count == wordCount ? words : nil)
        }
    }
}
#endif
