// swift-tools-version:5.9
// MenuScannerCore：解析規則與資料模型，只依賴 Foundation，與 UI／Vision 解耦。
// MenuScannerVision：Apple Vision 文字辨識（iOS 與 macOS 共用）。
// menu-benchmark：macOS 命令列基準測試工具（讀 Benchmarks/ 的圖片與標準答案）。
import PackageDescription

let package = Package(
    name: "MenuScannerKit",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "MenuScannerCore", targets: ["MenuScannerCore"]),
        .library(name: "MenuScannerVision", targets: ["MenuScannerVision"]),
        .executable(name: "menu-benchmark", targets: ["MenuBenchmark"]),
    ],
    targets: [
        .target(name: "MenuScannerCore"),
        .target(name: "MenuScannerVision", dependencies: ["MenuScannerCore"]),
        .executableTarget(name: "MenuBenchmark", dependencies: ["MenuScannerCore", "MenuScannerVision"]),
        .testTarget(name: "MenuScannerCoreTests", dependencies: ["MenuScannerCore"]),
    ]
)
