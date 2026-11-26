// swift-tools-version:5.9
// 解析規則與資料模型：只依賴 Foundation，與 UI／Vision 解耦，
// 可在 Xcode（iOS 模擬器）或 macOS 上 `swift test` 單獨測試。
import PackageDescription

let package = Package(
    name: "MenuScannerKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "MenuScannerCore", targets: ["MenuScannerCore"]),
    ],
    targets: [
        .target(name: "MenuScannerCore"),
        .testTarget(name: "MenuScannerCoreTests", dependencies: ["MenuScannerCore"]),
    ]
)
