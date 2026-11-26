import MenuScannerCore
import MenuScannerVision
import SwiftUI

/// 手動框選單欄重掃：只更新所選範圍內的候選結果，差異先列出讓使用者選擇。
struct RescanView: View {
    @Bindable var session: ReviewSession
    let recognizer: TextRecognizing
    @Environment(\.dismiss) private var dismiss

    @State private var region = NormRect(x: 0.5, y: 0, width: 0.5, height: 1)
    @State private var enhance = false
    @State private var preview: CGImage?
    @State private var running = false
    @State private var errorText: String?
    @State private var plan: RescanPlan?
    @State private var newLines: [OCRLine] = []
    @State private var task: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            Group {
                if let plan {
                    diffView(plan)
                } else {
                    selectView
                }
            }
            .navigationTitle("單欄重掃")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        task?.cancel()
                        dismiss()
                    }
                }
            }
        }
        .task(id: "\(region)|\(enhance)") {
            try? await Task.sleep(nanoseconds: 200_000_000)
            guard !Task.isCancelled else { return }
            updatePreview()
        }
    }

    // MARK: 框選

    private var selectView: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("拖曳黃框，只框住要重掃的那一欄（例如右欄或價格欄）。範圍外的品項，以及你已確認或修改過的內容，都不會被自動改動。")
                .font(.footnote)
                .foregroundStyle(.secondary)
            if let image = session.image {
                CropView(image: image, crop: $region)
                    .allowsHitTesting(!running)
            }
            Toggle("局部對比增強（字太淡或反光時使用）", isOn: $enhance)
                .disabled(running)
            if let preview {
                HStack(alignment: .top) {
                    Text("目前使用的影像範圍")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Image(decorative: preview, scale: 1)
                        .resizable()
                        .scaledToFit()
                        .frame(height: 90)
                        .border(Color.yellow)
                }
            }
            if let errorText {
                Text(errorText).foregroundStyle(.red)
            }
            if running {
                HStack {
                    ProgressView()
                    Text("重掃中…")
                    Spacer()
                    Button("取消") {
                        task?.cancel()
                        running = false
                    }
                }
            } else {
                Button {
                    start()
                } label: {
                    Label("開始重掃", systemImage: "text.viewfinder")
                        .frame(maxWidth: .infinity, minHeight: 44)
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("startRescan")
            }
        }
        .padding()
    }

    // MARK: 差異

    private func diffView(_ plan: RescanPlan) -> some View {
        List {
            Section {
                if plan.isEmpty {
                    Text("重掃結果與目前內容相同（\(plan.unchangedCount) 筆），不需要變動。")
                } else {
                    Text("有 \(plan.changes.count) 項差異，另有 \(plan.unchangedCount) 筆相同。請勾選要套用的項目；衝突與「重掃沒讀到」預設保留你原本的內容。")
                        .font(.footnote)
                }
            }
            Section {
                ForEach(Array(plan.changes.enumerated()), id: \.element.id) { i, change in
                    Toggle(isOn: Binding(
                        get: { self.plan?.changes[i].accepted ?? false },
                        set: { self.plan?.changes[i].accepted = $0 }
                    )) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(change.title)
                                .font(.caption.bold())
                                .foregroundStyle(change.kind == .conflict ? Color.orange : Color.secondary)
                            if let e = change.existing { Text("原本：\(describe(e))") }
                            if let n = change.incoming { Text("重掃：\(describe(n))") }
                        }
                    }
                    .accessibilityIdentifier("rescanChange")
                }
            }
            Section {
                Button("套用勾選的差異") { apply() }
                    .disabled(plan.isEmpty)
                    .accessibilityIdentifier("applyRescan")
                Button("重新框選") { self.plan = nil }
            }
        }
    }

    private func describe(_ e: MenuEntry) -> String {
        let price = e.price.map { "\($0) 元" }
            ?? (e.candidatePrices.isEmpty ? "—" : e.candidatePrices.map(String.init).joined(separator: "／") + "？")
        return "\(e.name)｜\(e.size.isEmpty ? "規格未定" : e.size)｜\(price)"
    }

    // MARK: 動作

    private func start() {
        guard let image = session.image else { return }
        running = true
        errorText = nil
        let offset = (session.draft.document?.lines.map(\.id).max() ?? 9_999) + 1
        let region = self.region
        let enhance = self.enhance
        let draft = session.draft
        let recognizer = self.recognizer
        task = Task { @MainActor in
            defer { running = false }
            do {
                let doc = try await recognizer.recognize(image, region: region, enhanceContrast: enhance, lineIDOffset: offset)
                try Task.checkCancellation()
                let result = MenuParser.parse(doc)
                newLines = doc.lines
                plan = RescanMerger.plan(draft: draft, region: region, rescanned: result.entries)
            } catch {
                guard !Task.isCancelled, !(error is CancellationError) else { return }
                errorText = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
            }
        }
    }

    private func apply() {
        guard let plan else { return }
        RescanMerger.apply(plan, to: &session.draft, newLines: newLines)
        dismiss()
    }

    private func updatePreview() {
        guard let image = session.image, var cropped = ImagePreparation.crop(image, to: region)?.image else {
            preview = nil
            return
        }
        if enhance, let e = ImagePreparation.enhanceContrast(cropped) { cropped = e }
        preview = cropped
    }
}
