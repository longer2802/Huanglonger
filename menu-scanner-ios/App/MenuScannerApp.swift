import SwiftData
import SwiftUI

@main
struct MenuScannerApp: App {
    @State private var model: AppModel
    private let container: ModelContainer

    init() {
        let uiTesting = CommandLine.arguments.contains("-uiTesting")
        // UI 測試每次從乾淨狀態開始：清掉草稿、使用記憶體資料庫
        if uiTesting { DraftStore().clear() }
        do {
            container = try MenuLibrary.makeContainer(inMemory: uiTesting)
        } catch {
            fatalError("無法開啟店家菜單庫：\(error)")
        }
        _model = State(initialValue: AppModel(isUITesting: uiTesting))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
        }
        .modelContainer(container)
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.modelContext) private var context

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.path) {
            HomeView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .prepare: PrepareView()
                    case .review: ReviewView()
                    case .pasteText: PasteTextView()
                    case .library: LibraryView()
                    case .store(let id): StoreDetailView(storeID: id)
                    case .version(let id): VersionDetailView(versionID: id)
                    }
                }
        }
        .task {
            MenuLibrary.seedDemoIfNeeded(in: context, defaults: model.isUITesting ? nil : .standard)
        }
    }
}
