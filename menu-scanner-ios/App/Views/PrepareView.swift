import MenuScannerCore
import SwiftUI

/// 照片預覽、旋轉、裁切，然後開始辨識。辨識在背景執行，可取消、可重試。
struct PrepareView: View {
    @Environment(AppModel.self) private var model

    private var isRunning: Bool { model.recognition == .running }

    var body: some View {
        VStack(spacing: 12) {
            if let photo = model.photo {
                Text("請確認整張菜單都清楚入鏡，尤其是最上方的價格表頭（中杯／大杯）。拖曳黃色角點可以裁掉不需要的部分。")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                CropView(
                    image: photo.image,
                    crop: Binding(
                        get: { model.photo?.crop ?? .unit },
                        set: { model.photo?.crop = $0 }
                    )
                )
                .allowsHitTesting(!isRunning)

                HStack {
                    Button { model.rotate(-1) } label: { Label("左轉", systemImage: "rotate.left") }
                    Button { model.rotate(1) } label: { Label("右轉", systemImage: "rotate.right") }
                    Button { model.photo?.crop = .unit } label: { Label("重設裁切", systemImage: "crop") }
                }
                .buttonStyle(.bordered)
                .disabled(isRunning)

                status
            } else {
                ContentUnavailableView("沒有照片", systemImage: "photo")
            }
        }
        .padding()
        .navigationTitle("確認照片")
        .navigationBarTitleDisplayMode(.inline)
        .onDisappear {
            if isRunning { model.cancelRecognition() }
        }
    }

    @ViewBuilder
    private var status: some View {
        switch model.recognition {
        case .idle:
            startButton(title: "開始辨識")
        case .running:
            HStack(spacing: 12) {
                ProgressView()
                Text("辨識中…（在這台裝置上處理）")
                Spacer()
                Button("取消", role: .cancel) { model.cancelRecognition() }
                    .accessibilityIdentifier("cancelRecognition")
            }
        case .noText:
            Text("找不到可讀的文字。請確認照片清楚、沒有反光，或裁掉多餘背景後重試。")
                .foregroundStyle(.orange)
            startButton(title: "重試")
        case .failed(let message):
            Text(message).foregroundStyle(.red)
            startButton(title: "重試")
        }
    }

    private func startButton(title: String) -> some View {
        Button {
            model.startRecognition()
        } label: {
            Label(title, systemImage: "text.viewfinder")
                .frame(maxWidth: .infinity, minHeight: 44)
        }
        .buttonStyle(.borderedProminent)
        .accessibilityIdentifier("startRecognition")
    }
}

enum AspectFit {
    static func rect(for imageSize: CGSize, in container: CGSize) -> CGRect {
        guard imageSize.width > 0, imageSize.height > 0, container.width > 0, container.height > 0 else { return .zero }
        let s = min(container.width / imageSize.width, container.height / imageSize.height)
        let w = imageSize.width * s, h = imageSize.height * s
        return CGRect(x: (container.width - w) / 2, y: (container.height - h) / 2, width: w, height: h)
    }
}

/// 可拖曳四個角的裁切框（正規化座標）。
struct CropView: View {
    let image: CGImage
    @Binding var crop: NormRect

    enum Corner: CaseIterable, Identifiable {
        case topLeft, topRight, bottomLeft, bottomRight
        var id: Self { self }

        func point(in r: CGRect) -> CGPoint {
            switch self {
            case .topLeft: return CGPoint(x: r.minX, y: r.minY)
            case .topRight: return CGPoint(x: r.maxX, y: r.minY)
            case .bottomLeft: return CGPoint(x: r.minX, y: r.maxY)
            case .bottomRight: return CGPoint(x: r.maxX, y: r.maxY)
            }
        }

        func moved(_ crop: NormRect, to location: CGPoint, fit: CGRect) -> NormRect {
            guard fit.width > 0, fit.height > 0 else { return crop }
            let nx = min(max(Double((location.x - fit.minX) / fit.width), 0), 1)
            let ny = min(max(Double((location.y - fit.minY) / fit.height), 0), 1)
            let m = 0.08
            var minX = crop.minX, maxX = crop.maxX, minY = crop.minY, maxY = crop.maxY
            switch self {
            case .topLeft:
                minX = min(nx, maxX - m); minY = min(ny, maxY - m)
            case .topRight:
                maxX = max(nx, minX + m); minY = min(ny, maxY - m)
            case .bottomLeft:
                minX = min(nx, maxX - m); maxY = max(ny, minY + m)
            case .bottomRight:
                maxX = max(nx, minX + m); maxY = max(ny, minY + m)
            }
            return NormRect(x: minX, y: minY, width: maxX - minX, height: maxY - minY)
        }
    }

    var body: some View {
        GeometryReader { geo in
            let fit = AspectFit.rect(for: CGSize(width: image.width, height: image.height), in: geo.size)
            let r = crop.cgRect(in: fit.size).offsetBy(dx: fit.minX, dy: fit.minY)
            ZStack {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .frame(width: fit.width, height: fit.height)
                    .position(x: fit.midX, y: fit.midY)
                Path { p in
                    p.addRect(fit)
                    p.addRect(r)
                }
                .fill(Color.black.opacity(0.45), style: FillStyle(eoFill: true))
                Rectangle()
                    .stroke(Color.yellow, lineWidth: 2)
                    .frame(width: r.width, height: r.height)
                    .position(x: r.midX, y: r.midY)
                ForEach(Corner.allCases) { corner in
                    Circle()
                        .fill(Color.yellow)
                        .frame(width: 26, height: 26)
                        .contentShape(Rectangle().inset(by: -12))
                        .position(corner.point(in: r))
                        .gesture(
                            DragGesture(coordinateSpace: .named("crop"))
                                .onChanged { value in crop = corner.moved(crop, to: value.location, fit: fit) }
                        )
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .coordinateSpace(.named("crop"))
        }
        .accessibilityLabel("菜單照片與裁切框")
    }
}

/// 原圖，並以橘框標示目前選取品項的來源位置；可雙指縮放。
struct SourceImageView: View {
    let image: CGImage
    var highlight: NormRect?
    @State private var scale: CGFloat = 1
    @State private var baseScale: CGFloat = 1

    var body: some View {
        GeometryReader { geo in
            let fit = AspectFit.rect(for: CGSize(width: image.width, height: image.height), in: geo.size)
            let anchor: UnitPoint = {
                guard let h = highlight, geo.size.width > 0, geo.size.height > 0 else { return .center }
                return UnitPoint(x: (fit.minX + h.midX * fit.width) / geo.size.width, y: (fit.minY + h.midY * fit.height) / geo.size.height)
            }()
            ZStack {
                Image(decorative: image, scale: 1)
                    .resizable()
                    .frame(width: fit.width, height: fit.height)
                    .position(x: fit.midX, y: fit.midY)
                if let h = highlight {
                    let r = h.cgRect(in: fit.size).offsetBy(dx: fit.minX, dy: fit.minY).insetBy(dx: -4, dy: -4)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.orange.opacity(0.15))
                        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Color.orange, lineWidth: 3))
                        .frame(width: r.width, height: r.height)
                        .position(x: r.midX, y: r.midY)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .scaleEffect(scale, anchor: anchor)
            .gesture(
                MagnifyGesture()
                    .onChanged { scale = min(max(baseScale * $0.magnification, 1), 6) }
                    .onEnded { _ in baseScale = scale }
            )
            .onTapGesture(count: 2) {
                scale = scale > 1 ? 1 : 2.5
                baseScale = scale
            }
            .clipped()
        }
    }
}

/// 編輯畫面中的原圖片段：來源列的整條橫向區域（含左右的價格）。
struct SourceSnippet: View {
    let image: CGImage
    let box: NormRect

    var body: some View {
        let pad = max(box.height * 0.8, 0.01)
        let strip = NormRect(x: 0, y: box.minY - pad, width: 1, height: box.height + pad * 2).clamped
        if let c = ImagePreparation.crop(image, to: strip) {
            Image(decorative: c.image, scale: 1)
                .resizable()
                .scaledToFit()
                .frame(maxHeight: 120)
                .accessibilityLabel("原圖片段")
        }
    }
}
