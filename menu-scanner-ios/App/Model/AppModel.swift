import MenuScannerCore
import Observation
import SwiftUI
import UIKit

enum Route: Hashable {
    case prepare
    case review
    case pasteText
    case library
}

/// 載入後、辨識前的照片（已轉正）與使用者框選的範圍。
struct PreparedPhoto {
    var image: CGImage
    var crop: NormRect = .unit
    var isSample = false
}

enum RecognitionState: Equatable {
    case idle
    case running
    case noText
    case failed(String)
}

/// 校對中的一份菜單：草稿資料＋辨識用的影像。
@Observable
final class ReviewSession {
    var draft: MenuDraft
    /// OCR 所用的影像（裁切後）；來源座標都相對於它。貼上文字時為 nil。
    let image: CGImage?
    var selectedID: UUID?

    init(draft: MenuDraft, image: CGImage?) {
        self.draft = draft
        self.image = image
    }
}

@Observable
final class AppModel {
    var path: [Route] = []
    var photo: PreparedPhoto?
    var recognition: RecognitionState = .idle
    var session: ReviewSession?
    var hasSavedDraft = false
    var homeMessage: String?

    @ObservationIgnored private var task: Task<Void, Never>?
    let recognizer: TextRecognizing
    let drafts: DraftStore

    init(recognizer: TextRecognizing = VisionTextRecognizer(), drafts: DraftStore = DraftStore()) {
        self.recognizer = recognizer
        self.drafts = drafts
        self.hasSavedDraft = drafts.hasDraft
    }

    // MARK: 照片

    func load(image: UIImage, isSample: Bool = false) {
        guard let cg = ImagePreparation.uprightCGImage(from: image) else {
            homeMessage = "無法讀取這張圖片"
            return
        }
        homeMessage = nil
        cancelRecognition()
        photo = PreparedPhoto(image: cg, isSample: isSample)
        path = [.prepare]
    }

    func rotate(_ quarterTurns: Int) {
        guard var p = photo, let rotated = ImagePreparation.rotated(p.image, quarterTurns: quarterTurns) else { return }
        p.image = rotated
        p.crop = .unit
        photo = p
    }

    // MARK: 辨識（Vision 在背景執行，不阻塞畫面）

    func startRecognition() {
        guard let p = photo else { return }
        task?.cancel()
        recognition = .running
        let recognizer = self.recognizer
        task = Task { @MainActor [weak self] in
            do {
                var image = p.image
                if p.crop != .unit {
                    guard let c = ImagePreparation.crop(p.image, to: p.crop) else { throw OCRError.invalidImage }
                    image = c.image
                }
                let doc = try await recognizer.recognize(image, region: nil, enhanceContrast: false, lineIDOffset: 0)
                let result = await Task.detached(priority: .userInitiated) { MenuParser.parse(doc) }.value
                try Task.checkCancellation()
                guard let self else { return }
                var meta = MenuMetadata()
                if p.isSample { meta.storeName = "示範茶飲（虛構）" }
                self.session = ReviewSession(draft: MenuDraft(metadata: meta, result: result, document: doc), image: image)
                self.recognition = .idle
                self.path.append(.review)
            } catch {
                guard let self, !Task.isCancelled, !(error is CancellationError) else { return }
                if let e = error as? OCRError, e == .noReadableText {
                    self.recognition = .noText
                } else {
                    self.recognition = .failed((error as? LocalizedError)?.errorDescription ?? error.localizedDescription)
                }
            }
        }
    }

    func cancelRecognition() {
        task?.cancel()
        task = nil
        recognition = .idle
    }

    // MARK: 貼上文字

    func parseText(_ text: String) {
        let result = MenuParser.parsePlainText(text)
        session = ReviewSession(draft: MenuDraft(result: result, sourceText: text), image: nil)
        path.append(.review)
    }

    // MARK: 草稿

    @discardableResult
    func saveDraft() -> Bool {
        guard let session else { return false }
        do {
            try drafts.save(session.draft, image: session.image)
            hasSavedDraft = true
            return true
        } catch {
            return false
        }
    }

    func resumeDraft() {
        do {
            let (draft, image) = try drafts.load()
            session = ReviewSession(draft: draft, image: image)
            path = [.review]
        } catch {
            homeMessage = "無法開啟草稿：\(error.localizedDescription)"
            hasSavedDraft = drafts.hasDraft
        }
    }

    func refreshDraftFlag() {
        hasSavedDraft = drafts.hasDraft
    }
}

/// 單一「目前草稿」存在 Application Support（第三階段改由 SwiftData 店家菜單庫管理正式版本）。
struct DraftStore: Sendable {
    let directory: URL

    init(directory: URL? = nil) {
        self.directory = directory ?? FileManager.default
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Drafts", isDirectory: true)
    }

    var draftURL: URL { directory.appendingPathComponent("current.json") }
    var imageURL: URL { directory.appendingPathComponent("current.jpg") }
    var hasDraft: Bool { FileManager.default.fileExists(atPath: draftURL.path) }

    func save(_ draft: MenuDraft, image: CGImage?) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try JSONEncoder().encode(draft).write(to: draftURL, options: .atomic)
        if let image, let data = UIImage(cgImage: image).jpegData(compressionQuality: 0.92) {
            try data.write(to: imageURL, options: .atomic)
        } else {
            try? FileManager.default.removeItem(at: imageURL)
        }
    }

    func load() throws -> (MenuDraft, CGImage?) {
        let draft = try JSONDecoder().decode(MenuDraft.self, from: Data(contentsOf: draftURL))
        let image = (try? Data(contentsOf: imageURL)).flatMap { UIImage(data: $0)?.cgImage }
        return (draft, image)
    }

    func clear() {
        try? FileManager.default.removeItem(at: directory)
    }
}
