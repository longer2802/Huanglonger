import MenuScannerCore
import SwiftUI

struct ReviewView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        if let session = model.session {
            ReviewContent(session: session)
        } else {
            ContentUnavailableView("沒有資料", systemImage: "tablecells")
        }
    }
}

private struct EditTarget: Identifiable, Equatable {
    let id: UUID
    let isNew: Bool
}

struct ReviewContent: View {
    @Environment(AppModel.self) private var model
    @Bindable var session: ReviewSession

    enum Tab: String, CaseIterable {
        case image = "原圖"
        case table = "表格"
    }

    @State private var tab: Tab = .table
    @State private var onlyPending = false
    @State private var editing: EditTarget?
    @State private var showExport = false
    @State private var toast: String?

    private var visible: [MenuEntry] {
        onlyPending ? session.draft.attentionEntries : session.draft.entries
    }

    var body: some View {
        VStack(spacing: 0) {
            Picker("檢視", selection: $tab) {
                ForEach(Tab.allCases, id: \.self) { Text($0.rawValue) }
            }
            .pickerStyle(.segmented)
            .padding([.horizontal, .top])
            .accessibilityIdentifier("reviewTabs")

            switch tab {
            case .image: imageTab
            case .table: tableTab
            }
        }
        .navigationTitle("校對")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    Button { save() } label: { Label("儲存草稿", systemImage: "square.and.arrow.down") }
                    Button { addNew() } label: { Label("新增品項", systemImage: "plus") }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
                .accessibilityIdentifier("reviewMenu")
            }
        }
        .safeAreaInset(edge: .bottom) {
            Button {
                showExport = true
            } label: {
                Label("匯出 TXT／CSV", systemImage: "square.and.arrow.up")
                    .frame(maxWidth: .infinity, minHeight: 44)
            }
            .buttonStyle(.borderedProminent)
            .padding()
            .background(.bar)
            .accessibilityIdentifier("exportButton")
        }
        .sheet(item: $editing) { target in
            if let entry = session.draft.entry(target.id) {
                EntryEditorView(
                    entry: entry,
                    image: session.image,
                    isNew: target.isNew,
                    onSave: { session.draft.apply($0, to: target.id) },
                    onAddSize: { edit in
                        session.draft.apply(edit, to: target.id)
                        if let newID = session.draft.addSize(to: target.id, size: "", price: nil) {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                                editing = EditTarget(id: newID, isNew: true)
                            }
                        }
                    },
                    onDelete: { session.draft.delete(target.id) },
                    onCancel: { if target.isNew { session.draft.delete(target.id) } }
                )
            }
        }
        .sheet(isPresented: $showExport) {
            ExportView(session: session)
        }
        .overlay(alignment: .top) {
            if let toast {
                Text(toast)
                    .font(.callout)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(.thinMaterial, in: Capsule())
                    .padding(.top, 60)
                    .transition(.opacity)
            }
        }
        .onDisappear { model.saveDraft() }
    }

    // MARK: 表格

    private var tableTab: some View {
        List {
            Section {
                Toggle(isOn: $onlyPending) {
                    Text("只看待確認（\(session.draft.attentionEntries.count)）")
                }
                .accessibilityIdentifier("onlyPendingToggle")
                Text("共 \(session.draft.entries.count) 筆，可匯出 \(session.draft.exportableEntries.count) 筆。點一列即可修改；向左滑可刪除或直接確認。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Section {
                ForEach(visible) { e in
                    Button {
                        session.selectedID = e.id
                        editing = EditTarget(id: e.id, isNew: false)
                    } label: {
                        EntryRow(entry: e)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("entryRow")
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            session.draft.delete(e.id)
                        } label: {
                            Label("刪除", systemImage: "trash")
                        }
                        if e.needsReview {
                            Button {
                                session.draft.confirm(e.id)
                            } label: {
                                Label("確認", systemImage: "checkmark")
                            }
                            .tint(.green)
                        }
                    }
                    .contextMenu {
                        if e.source?.box != nil, session.image != nil {
                            Button {
                                session.selectedID = e.id
                                tab = .image
                            } label: {
                                Label("在原圖顯示", systemImage: "viewfinder")
                            }
                        }
                    }
                }
            } footer: {
                if visible.isEmpty {
                    Text(onlyPending ? "沒有待確認的品項。" : "沒有品項，可從右上角選單新增。")
                }
            }
        }
        .listStyle(.insetGrouped)
        .accessibilityIdentifier("reviewList")
    }

    // MARK: 原圖

    @ViewBuilder
    private var imageTab: some View {
        if let image = session.image {
            let selected = session.selectedID.flatMap { session.draft.entry($0) }
            SourceImageView(image: image, highlight: selected?.source?.box)
                .padding(.horizontal)
            if let e = selected {
                HStack {
                    Text("\(e.name)｜\(e.size.isEmpty ? "規格未定" : e.size)｜\(e.price.map { "\($0) 元" } ?? "—")")
                    Spacer()
                    Button("修改") { editing = EditTarget(id: e.id, isNew: false) }
                }
                .padding()
            } else {
                Text("在表格長按一列選「在原圖顯示」，或點一列後回到這裡，就會標出它在原圖的位置。雙指可縮放、點兩下放大。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .padding()
            }
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    Text("這份菜單是貼上的文字，沒有原圖。").font(.headline)
                    Text(session.draft.sourceText ?? "")
                        .font(.callout.monospaced())
                        .textSelection(.enabled)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
            }
        }
    }

    // MARK: 動作

    private func save() {
        show(model.saveDraft() ? "已儲存草稿" : "儲存失敗")
    }

    private func addNew() {
        let id = session.draft.addEntry(EntryEdit(category: "", name: "", size: "", price: nil), after: session.selectedID)
        editing = EditTarget(id: id, isNew: true)
    }

    private func show(_ message: String) {
        withAnimation { toast = message }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.8) {
            withAnimation { toast = nil }
        }
    }
}

struct EntryRow: View {
    let entry: MenuEntry

    var body: some View {
        let attention = MenuDraft.needsAttention(entry)
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: attention ? "exclamationmark.triangle.fill" : (entry.status == .auto ? "checkmark.circle" : "checkmark.circle.fill"))
                .foregroundStyle(attention ? Color.orange : Color.green)
                .accessibilityLabel(attention ? "待確認" : "已完成")
            VStack(alignment: .leading, spacing: 3) {
                Text(entry.name.isEmpty ? "（未填品名）" : entry.name)
                    .font(.body.weight(.medium))
                Text([entry.category, entry.size.isEmpty ? "規格未定" : entry.size].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(.secondary)
                if attention {
                    Text(MenuDraft.attentionMessages(entry).joined(separator: "；"))
                        .font(.caption)
                        .foregroundStyle(.orange)
                }
                if let s = entry.suggestedName, s != entry.name {
                    Text("詞庫建議：\(s)（原文：\(entry.originalName)）")
                        .font(.caption)
                        .foregroundStyle(.blue)
                }
            }
            Spacer(minLength: 8)
            Text(priceText)
                .monospacedDigit()
                .foregroundStyle(entry.price == nil ? Color.secondary : Color.primary)
        }
        .contentShape(Rectangle())
    }

    private var priceText: String {
        if let p = entry.price { return "\(p) 元" }
        if !entry.candidatePrices.isEmpty { return entry.candidatePrices.map(String.init).joined(separator: "／") + "？" }
        return "—"
    }
}
