import MenuScannerCore
import SwiftUI

/// 校對單一品項：對照原圖片段與原文，修改分類、品名、規格、價格。
struct EntryEditorView: View {
    let entry: MenuEntry
    let image: CGImage?
    let isNew: Bool
    var onSave: (EntryEdit) -> Void
    var onAddSize: (EntryEdit) -> Void
    var onDelete: () -> Void
    var onCancel: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var category: String
    @State private var name: String
    @State private var size: String
    @State private var priceText: String

    init(
        entry: MenuEntry, image: CGImage?, isNew: Bool,
        onSave: @escaping (EntryEdit) -> Void,
        onAddSize: @escaping (EntryEdit) -> Void,
        onDelete: @escaping () -> Void,
        onCancel: @escaping () -> Void
    ) {
        self.entry = entry
        self.image = image
        self.isNew = isNew
        self.onSave = onSave
        self.onAddSize = onAddSize
        self.onDelete = onDelete
        self.onCancel = onCancel
        _category = State(initialValue: entry.category)
        _name = State(initialValue: entry.name)
        _size = State(initialValue: entry.size)
        _priceText = State(initialValue: entry.price.map(String.init) ?? "")
    }

    private var trimmedPrice: String { priceText.trimmingCharacters(in: .whitespaces) }
    /// 有填但不是整數價格（例如「6O」「55.5」）。
    private var priceInvalid: Bool { !trimmedPrice.isEmpty && TextNormalizer.parsePrice(trimmedPrice) == nil }
    private var edit: EntryEdit {
        EntryEdit(category: category, name: name, size: size, price: TextNormalizer.parsePrice(trimmedPrice))
    }
    private var canSave: Bool { !priceInvalid && !name.trimmingCharacters(in: .whitespaces).isEmpty }

    var body: some View {
        NavigationStack {
            Form {
                if let image, let box = entry.source?.box {
                    Section("原圖位置") {
                        SourceSnippet(image: image, box: box)
                    }
                }
                if let raw = entry.source?.rawText {
                    Section("辨識原文") {
                        Text(raw).font(.callout.monospaced())
                        if !entry.originalName.isEmpty, entry.originalName != name {
                            Text("OCR 品名：\(entry.originalName)").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
                if entry.needsReview && !entry.reasons.isEmpty {
                    Section("待確認原因") {
                        ForEach(entry.reasons.map(\.message), id: \.self) { Text($0).foregroundStyle(.orange) }
                    }
                }
                if let suggestion = entry.suggestedName {
                    Section("詞庫建議") {
                        Button("採用建議「\(suggestion)」") { name = suggestion }
                            .accessibilityIdentifier("acceptSuggestion")
                        Button("保留原文「\(entry.originalName)」") { name = entry.originalName }
                            .accessibilityIdentifier("keepOriginal")
                    }
                }
                Section("內容") {
                    TextField("分類（選填）", text: $category)
                        .accessibilityIdentifier("categoryField")
                    TextField("品名", text: $name)
                        .accessibilityIdentifier("nameField")
                    TextField("規格（中杯、大杯、單一…）", text: $size)
                        .accessibilityIdentifier("sizeField")
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack {
                            ForEach([SizeLabel.single, "中杯", "大杯", "M", "L"], id: \.self) { s in
                                Button(s) { size = s }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                            }
                        }
                    }
                    TextField("價格（看不清楚就留空，不要填 0）", text: $priceText)
                        .keyboardType(.numberPad)
                        .accessibilityIdentifier("priceField")
                    if priceInvalid {
                        Text("價格只能填整數").font(.caption).foregroundStyle(.red)
                    } else if trimmedPrice.isEmpty {
                        Text("沒有價格的品項不會匯出").font(.caption).foregroundStyle(.secondary)
                    }
                }
                if !entry.candidatePrices.isEmpty {
                    Section("候選價格（請對照原圖選擇）") {
                        HStack {
                            ForEach(entry.candidatePrices, id: \.self) { p in
                                Button("\(p) 元") { priceText = String(p) }
                                    .buttonStyle(.bordered)
                            }
                        }
                    }
                }
                Section {
                    Button("另外新增同品名的其他規格") {
                        onAddSize(edit)
                        dismiss()
                    }
                    .disabled(!canSave)
                    Button("刪除這一筆", role: .destructive) {
                        onDelete()
                        dismiss()
                    }
                }
            }
            .navigationTitle(isNew ? "新增品項" : "校對品項")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") {
                        onCancel()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("確認") {
                        onSave(edit)
                        dismiss()
                    }
                    .disabled(!canSave)
                    .accessibilityIdentifier("confirmEntry")
                }
            }
        }
        .interactiveDismissDisabled()
    }
}
