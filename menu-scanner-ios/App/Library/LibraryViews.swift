import MenuScannerCore
import SwiftData
import SwiftUI

/// 店家菜單庫：搜尋店名或分店。
struct LibraryView: View {
    @Environment(\.modelContext) private var context
    @Query(sort: \StoreMenu.updatedAt, order: .reverse) private var stores: [StoreMenu]
    @State private var search = ""

    private var filtered: [StoreMenu] {
        let q = search.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty else { return stores }
        return stores.filter { $0.storeName.localizedCaseInsensitiveContains(q) || $0.branch.localizedCaseInsensitiveContains(q) }
    }

    var body: some View {
        List {
            ForEach(filtered) { store in
                NavigationLink(value: Route.store(store.id)) {
                    StoreRow(store: store)
                }
                .accessibilityIdentifier("storeRow")
            }
            .onDelete { offsets in
                let targets = offsets.map { filtered[$0] }
                for t in targets { context.delete(t) }
                try? context.save()
            }
        }
        .overlay {
            if filtered.isEmpty {
                if search.isEmpty {
                    ContentUnavailableView("還沒有菜單", systemImage: "books.vertical", description: Text("在校對畫面右上角選「存入店家菜單庫」。"))
                } else {
                    ContentUnavailableView.search(text: search)
                }
            }
        }
        .searchable(text: $search, prompt: "搜尋店名或分店")
        .navigationTitle("店家菜單庫")
    }
}

struct StoreRow: View {
    let store: StoreMenu

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 6) {
                Text(store.storeName).font(.headline)
                if store.isDemo { DemoBadge() }
            }
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    private var subtitle: String {
        var parts: [String] = []
        if !store.branch.isEmpty { parts.append(store.branch) }
        parts.append(store.kind.rawValue)
        parts.append("\(store.versions.count) 個版本")
        if let latest = store.latest {
            parts.append("最新校對 \(latest.reviewedAt.formatted(date: .numeric, time: .omitted))")
        }
        return parts.joined(separator: " · ")
    }
}

struct DemoBadge: View {
    var body: some View {
        Text("示範")
            .font(.caption2.bold())
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Color.orange.opacity(0.2), in: Capsule())
            .foregroundStyle(.orange)
    }
}

/// 一家店的所有版本（新到舊）。
struct StoreDetailView: View {
    @Query private var matches: [StoreMenu]

    init(storeID: UUID) {
        _matches = Query(filter: #Predicate<StoreMenu> { $0.id == storeID })
    }

    var body: some View {
        if let store = matches.first {
            List {
                Section {
                    LabeledContent("店名", value: store.storeName)
                    LabeledContent("分店", value: store.branch.isEmpty ? "—" : store.branch)
                    LabeledContent("分類", value: store.kind.rawValue)
                    if store.isDemo {
                        Text("這是內建的虛構示範菜單，可以用來試匯出與編輯流程。").font(.footnote).foregroundStyle(.secondary)
                    }
                }
                Section("版本（新到舊）") {
                    ForEach(store.sortedVersions) { v in
                        NavigationLink(value: Route.version(v.id)) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text("第 \(v.number) 版").font(.headline)
                                Text("校對 \(v.reviewedAt.formatted(date: .numeric, time: .omitted))・儲存 \(v.savedAt.formatted(date: .numeric, time: .shortened))・\(v.entryCount) 筆\(v.pendingCount > 0 ? "（待確認 \(v.pendingCount)）" : "")")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .accessibilityIdentifier("versionRow")
                    }
                }
            }
            .navigationTitle(store.displayName)
            .navigationBarTitleDisplayMode(.inline)
        } else {
            ContentUnavailableView("找不到這家店", systemImage: "questionmark.folder")
        }
    }
}

/// 已儲存的版本：唯讀檢視，可匯出或從這版編輯新稿（舊版保留）。
struct VersionDetailView: View {
    @Environment(AppModel.self) private var model
    @Query private var matches: [MenuVersion]
    @State private var exportSession: ReviewSession?
    @State private var showImage = false

    init(versionID: UUID) {
        _matches = Query(filter: #Predicate<MenuVersion> { $0.id == versionID })
    }

    var body: some View {
        if let v = matches.first, let draft = v.draft() {
            List {
                Section {
                    Text("這是已儲存的版本，內容不會被修改。要調整請按「從這版編輯新稿」，儲存後會成為新的版本，這一版仍可查看。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                    Button {
                        model.editFromVersion(draft: draft, image: v.image(), storeID: v.store?.id)
                    } label: {
                        Label("從這版編輯新稿", systemImage: "square.and.pencil")
                    }
                    .accessibilityIdentifier("editFromVersion")
                    Button {
                        exportSession = ReviewSession(draft: draft, image: nil)
                    } label: {
                        Label("匯出 TXT／CSV", systemImage: "square.and.arrow.up")
                    }
                    .accessibilityIdentifier("exportVersion")
                    if v.imageData != nil {
                        Button {
                            showImage = true
                        } label: {
                            Label("查看原圖", systemImage: "photo")
                        }
                    }
                }
                Section("品項（\(draft.entries.count) 筆）") {
                    ForEach(draft.entries) { EntryRow(entry: $0) }
                }
            }
            .navigationTitle("第 \(v.number) 版")
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $exportSession) { ExportView(session: $0) }
            .sheet(isPresented: $showImage) {
                NavigationStack {
                    Group {
                        if let image = v.image() {
                            SourceImageView(image: image, highlight: nil)
                        }
                    }
                    .navigationTitle("原圖")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .confirmationAction) { Button("關閉") { showImage = false } }
                    }
                }
            }
        } else {
            ContentUnavailableView("找不到這個版本", systemImage: "questionmark.folder")
        }
    }
}

/// 存入店家菜單庫前補店家資訊。
struct StoreInfoSheet: View {
    @Bindable var session: ReviewSession
    var onSave: () -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                TextField("店名", text: $session.draft.metadata.storeName)
                    .accessibilityIdentifier("libraryStoreName")
                TextField("分店（選填）", text: $session.draft.metadata.branch)
                Picker("分類", selection: $session.draft.metadata.kind) {
                    ForEach(MenuKind.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                DatePicker("校對日期", selection: $session.draft.metadata.reviewedAt, displayedComponents: .date)
            }
            .navigationTitle("存入店家菜單庫")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("儲存") {
                        dismiss()
                        onSave()
                    }
                    .disabled(session.draft.metadata.storeName.trimmingCharacters(in: .whitespaces).isEmpty)
                    .accessibilityIdentifier("confirmLibrarySave")
                }
            }
        }
    }
}
