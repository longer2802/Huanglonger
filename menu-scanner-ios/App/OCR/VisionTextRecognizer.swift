import CoreGraphics
import Foundation
import MenuScannerCore
import Vision

enum OCRError: LocalizedError, Equatable {
    case invalidImage
    case noReadableText
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .invalidImage: return "無法讀取這張圖片"
        case .noReadableText: return "找不到可讀的文字，請把菜單拍清楚、拍完整後再試一次"
        case .failed(let message): return "辨識失敗：\(message)"
        }
    }
}

protocol TextRecognizing: Sendable {
    /// - Parameters:
    ///   - image: 已轉正（`.up`）的整張原圖。
    ///   - region: 只辨識這個範圍（左上原點正規化座標）；nil 為整張。
    ///   - enhanceContrast: 是否先做灰階對比增強（局部重掃用）。
    ///   - lineIDOffset: 行號起點，讓重掃結果的行號不與先前重複。
    func recognize(_ image: CGImage, region: NormRect?, enhanceContrast: Bool, lineIDOffset: Int) async throws -> OCRDocument
}

/// Apple Vision 文字辨識（完全在裝置上執行，不連網）。
struct VisionTextRecognizer: TextRecognizing {
    func recognize(_ image: CGImage, region: NormRect?, enhanceContrast: Bool, lineIDOffset: Int = 0) async throws -> OCRDocument {
        let started = Date()
        var work = image
        var crop = NormRect.unit
        if let region {
            guard let c = ImagePreparation.crop(image, to: region) else { throw OCRError.invalidImage }
            work = c.image
            crop = c.region
        }
        if enhanceContrast, let enhanced = ImagePreparation.enhanceContrast(work) {
            work = enhanced
        }

        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.revision = VNRecognizeTextRequest.currentRevision
        // 不做語言校正：保留原始文字，價格數字也不會被「修正」。
        request.usesLanguageCorrection = false
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
        for observation in observations {
            let candidates = observation.topCandidates(3)
            guard let top = candidates.first else { continue }
            let text = top.string.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !text.isEmpty else { continue }
            let box = VisionGeometry.toImageSpace(visionBox: NormRect(observation.boundingBox), crop: crop)
            lines.append(OCRLine(
                id: lineIDOffset + lines.count,
                text: top.string,
                confidence: Double(top.confidence),
                candidates: candidates.map { OCRCandidate(text: $0.string, confidence: Double($0.confidence)) },
                box: box,
                wordBoxes: Self.wordBoxes(for: top, lineBox: box, crop: crop)
            ))
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

    /// 每個以空白分隔的字詞的實際位置。部分 revision 對中文只回整行框，此時放棄改用估算。
    static func wordBoxes(for text: VNRecognizedText, lineBox: NormRect, crop: NormRect) -> [NormRect]? {
        let s = text.string
        let words = Tokenizer.words(in: s)
        guard words.count > 1 else { return nil }
        var boxes: [NormRect] = []
        var cursor = s.startIndex
        for w in words {
            guard let range = s.range(of: w, range: cursor..<s.endIndex),
                  let observation = (try? text.boundingBox(for: range)) ?? nil else { return nil }
            let rect = observation.boundingBox
            cursor = range.upperBound
            let box = VisionGeometry.toImageSpace(visionBox: NormRect(rect), crop: crop)
            if box.width > lineBox.width * 0.95 { return nil }
            boxes.append(box)
        }
        return boxes
    }
}
