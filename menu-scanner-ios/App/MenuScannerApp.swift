import SwiftUI

@main
struct MenuScannerApp: App {
    @State private var model: AppModel

    init() {
        // UI 測試每次從乾淨狀態開始
        if CommandLine.arguments.contains("-uiTesting") {
            DraftStore().clear()
        }
        _model = State(initialValue: AppModel())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(model)
        }
    }
}

struct RootView: View {
    @Environment(AppModel.self) private var model

    var body: some View {
        @Bindable var model = model
        NavigationStack(path: $model.path) {
            HomeView()
                .navigationDestination(for: Route.self) { route in
                    switch route {
                    case .prepare: PrepareView()
                    case .review: ReviewView()
                    case .pasteText: PasteTextView()
                    case .library: LibraryPlaceholderView()
                    }
                }
        }
    }
}
