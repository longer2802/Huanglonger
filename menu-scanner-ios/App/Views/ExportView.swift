import MenuScannerCore
import SwiftUI

/// 匯出：有待確認時先列出清單，讓使用者回去修正或明確選擇只匯出已確認品項。
struct ExportView: View {
    @Bindable var session: ReviewSession
    @Environment(\.dismiss) private var dismiss
    @State private var format: ExportFormat = .csv
    @State private var allowPartial = false
    @State private var fileURL: URL?
    @State private var copied = false

    private var attention: [MenuEntry] { session.draft.attentionEntries }
    private var exportable: [MenuEntry] { session.draft.exportableEntries }
    private var content: String {
        MenuExporter.text(format, entries: session.draft.entries, metadata: session.draft.metadata)
    }
    private var fileName: String { MenuExporter.fileName(session.draft.metadata, format: format) }
    private var showsPendingList: Bool { !attention.isEmpty && !allowPartial }

    var body: some View {
        NavigationStack {
            Form {
                Section("店家資訊") {
                    TextField("店名", text: $session.draft.metadata.storeName)
                        .accessibilityIdentifier("storeNameField")
                    TextField("分店（選填）", text: $session.draft.metadata.branch)
                        .accessibilityIdentifier("branchField")
                    Picker("分類", selection: $session.draft.metadata.kind) {
                        ForEach(MenuKind.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    DatePicker("校對日期", selection: $session.draft.metadata.reviewedAt, displayedComponents: .date)
                }

                if showsPendingList {
                    Section {
                        ForEach(attention) { e in
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(e.name.isEmpty ? "（未填品名）" : e.name)｜\(e.size.isEmpty ? "規格未定" : e.size)")
                                Text(MenuDraft.attentionMessages(e).joined(separator: "；"))
                                    .font(.caption)
                                    .foregroundStyle(.orange)
                            }
                        }
                    } header: {
                        Text("還有 \(attention.count) 筆待確認")
                    } footer: {
                        Text("待確認的價格不會被匯出。請回去修正，或明確選擇只匯出已確認的 \(exportable.count) 筆。")
                    }
                    Section {
                        Button("回去修正") { dismiss() }
                            .accessibilityIdentifier("backToReview")
                        Button("只匯出已確認品項（\(exportable.count) 筆）") { allowPartial = true }
                            .disabled(exportable.isEmpty)
                            .accessibilityIdentifier("exportConfirmedOnly")
                    }
                } else {
                    Section {
                        Picker("格式", selection: $format) {
                            ForEach(ExportFormat.allCases) { Text($0.rawValue).tag($0) }
                        }
                        .pickerStyle(.segmented)
                        .accessibilityIdentifier("formatPicker")
                        Button(copied ? "已複製" : "複製 \(format.rawValue) 文字") {
                            UIPasteboard.general.string = content
                            copied = true
                        }
                        .accessibilityIdentifier("copyText")
                        if let fileURL {
                            ShareLink(item: fileURL) {
                                Label("分享 \(fileURL.lastPathComponent)", systemImage: "square.and.arrow.up")
                            }
                            .accessibilityIdentifier("shareFile")
                        }
                    } footer: {
                        if allowPartial {
                            Text("只匯出已確認的 \(exportable.count) 筆，另有 \(attention.count) 筆待確認未匯出。")
                        } else {
                            Text("共 \(exportable.count) 筆。CSV 為 UTF-8（含 BOM），Excel 可直接開啟。")
                        }
                    }
                    Section("預覽") {
                        Text(content)
                            .font(.caption.monospaced())
                            .textSelection(.enabled)
                            .accessibilityIdentifier("exportPreview")
                    }
                }
            }
            .navigationTitle("匯出")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("完成") { dismiss() }
                }
            }
            .task(id: "\(fileName)|\(content)") {
                copied = false
                fileURL = writeFile()
            }
        }
    }

    /// 寫到暫存資料夾，交給 iOS 分享面板。
    private func writeFile() -> URL? {
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent("Export", isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let url = dir.appendingPathComponent(fileName)
            try MenuExporter.data(format, entries: session.draft.entries, metadata: session.draft.metadata)
                .write(to: url, options: .atomic)
            return url
        } catch {
            return nil
        }
    }
}
