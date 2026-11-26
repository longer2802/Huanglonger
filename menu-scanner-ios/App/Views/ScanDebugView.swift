import MenuScannerCore
import PhotosUI
import SwiftUI

/// 第一階段的驗證畫面：選照片 → Vision 辨識 → 解析 → 列出結果。
/// 第二階段會換成正式的首頁、辨識流程與校對畫面。
@MainActor
struct ScanDebugView: View {
    @State private var pickerItem: PhotosPickerItem?
    @State private var result: ParseResult?
    @State private var status = "請選擇一張菜單照片"
    @State private var task: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            List {
                Section {
                    PhotosPicker(selection: $pickerItem, matching: .images) {
                        Label("選擇照片", systemImage: "photo.on.rectangle")
                    }
                    Text(status).foregroundStyle(.secondary)
                    if task != nil {
                        Button("取消辨識", role: .cancel) { task?.cancel() }
                    }
                }
                if let result {
                    Section("品項（\(result.entries.count) 筆，待確認 \(result.pendingEntries.count) 筆）") {
                        ForEach(result.entries) { e in
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(e.name)｜\(e.size.isEmpty ? "？" : e.size)｜\(e.price.map { "\($0) 元" } ?? "—")")
                                if !e.reasons.isEmpty {
                                    Text(e.reasons.map(\.message).joined(separator: "、"))
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
                            }
                        }
                    }
                    Section("已排除（\(result.excluded.count)）") {
                        ForEach(Array(result.excluded.enumerated()), id: \.offset) { _, x in
                            Text("\(x.reason)：\(x.text)").font(.caption)
                        }
                    }
                }
            }
            .navigationTitle("菜單掃描（階段一）")
            .onChange(of: pickerItem) { _, item in
                guard let item else { return }
                scan(item)
            }
        }
    }

    private func scan(_ item: PhotosPickerItem) {
        task?.cancel()
        status = "辨識中…"
        result = nil
        task = Task {
            defer { task = nil }
            do {
                guard let data = try await item.loadTransferable(type: Data.self),
                      let image = UIImage(data: data),
                      let cg = ImagePreparation.uprightCGImage(from: image) else {
                    throw OCRError.invalidImage
                }
                let doc = try await VisionTextRecognizer().recognize(cg, region: nil, enhanceContrast: false)
                let parsed = MenuParser.parse(doc)
                result = parsed
                status = String(format: "完成：%d 行文字，%.1f 秒", doc.lines.count, doc.processingSeconds)
            } catch is CancellationError {
                status = "已取消"
            } catch {
                status = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
    }
}
