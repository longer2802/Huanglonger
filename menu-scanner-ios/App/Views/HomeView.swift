import PhotosUI
import SwiftUI

struct HomeView: View {
    @Environment(AppModel.self) private var model
    @State private var pickerItem: PhotosPickerItem?
    @State private var showCamera = false
    @State private var loadingPhoto = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("拍下飲料店、便當店的菜單，整理成「品名、規格、價格」表格。照片與辨識都在這台手機上處理，不會上傳。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                if model.hasSavedDraft {
                    Button {
                        model.resumeDraft()
                    } label: {
                        Label("繼續上次的草稿", systemImage: "doc.badge.clock")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("resumeDraft")
                }

                Button {
                    showCamera = true
                } label: {
                    BigButtonLabel(title: "拍攝菜單", systemImage: "camera.fill")
                }
                .buttonStyle(.borderedProminent)
                .disabled(!CameraPicker.isAvailable)
                .accessibilityIdentifier("takePhoto")
                if !CameraPicker.isAvailable {
                    Text("這台裝置無法使用相機（例如模擬器），請改用「選擇照片」或下方的示範測試圖。")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }

                PhotosPicker(selection: $pickerItem, matching: .images) {
                    BigButtonLabel(title: loadingPhoto ? "讀取照片中…" : "選擇照片", systemImage: "photo.on.rectangle")
                }
                .buttonStyle(.borderedProminent)
                .disabled(loadingPhoto)
                .accessibilityIdentifier("pickPhoto")

                HStack(spacing: 12) {
                    NavigationLink(value: Route.pasteText) {
                        Label("貼上文字", systemImage: "doc.on.clipboard")
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("pasteText")
                    NavigationLink(value: Route.library) {
                        Label("店家菜單庫", systemImage: "books.vertical")
                            .frame(maxWidth: .infinity, minHeight: 36)
                    }
                    .buttonStyle(.bordered)
                    .accessibilityIdentifier("library")
                }

                if let message = model.homeMessage {
                    Text(message).font(.footnote).foregroundStyle(.red)
                }

                Divider().padding(.vertical, 8)

                VStack(alignment: .leading, spacing: 6) {
                    Text("測試").font(.headline)
                    Button {
                        model.load(image: SampleMenu.image(), isSample: true)
                    } label: {
                        Label("使用示範測試圖（合成・虛構店家）", systemImage: "testtube.2")
                    }
                    .accessibilityIdentifier("useSampleImage")
                    Text("只用來試流程，不代表真實菜單的辨識準確率。")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
        }
        .navigationTitle("菜單掃描")
        .onAppear { model.refreshDraftFlag() }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            loadingPhoto = true
            Task { @MainActor in
                defer {
                    loadingPhoto = false
                    pickerItem = nil
                }
                if let data = try? await item.loadTransferable(type: Data.self), let image = UIImage(data: data) {
                    model.load(image: image)
                } else {
                    model.homeMessage = "無法讀取這張照片，請換一張再試。"
                }
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker { image in
                showCamera = false
                if let image { model.load(image: image) }
            }
            .ignoresSafeArea()
        }
    }
}

struct BigButtonLabel: View {
    let title: String
    let systemImage: String

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.title3.weight(.semibold))
            .frame(maxWidth: .infinity, minHeight: 52)
    }
}

struct CameraPicker: UIViewControllerRepresentable {
    static var isAvailable: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

    var onFinish: (UIImage?) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let controller = UIImagePickerController()
        controller.sourceType = .camera
        controller.delegate = context.coordinator
        return controller
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onFinish: onFinish) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onFinish: (UIImage?) -> Void

        init(onFinish: @escaping (UIImage?) -> Void) {
            self.onFinish = onFinish
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onFinish(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onFinish(nil)
        }
    }
}

struct PasteTextView: View {
    @Environment(AppModel.self) private var model
    @State private var text = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("貼上從 LINE、網頁複製的菜單文字。沒有座標，所以杯型對不上的價格會標成待確認。")
                .font(.footnote)
                .foregroundStyle(.secondary)
            TextEditor(text: $text)
                .font(.body)
                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.3)))
                .accessibilityIdentifier("pasteEditor")
            HStack {
                Button("從剪貼簿貼上") {
                    if let s = UIPasteboard.general.string { text = s }
                }
                .buttonStyle(.bordered)
                Spacer()
                Button("解析") { model.parseText(text) }
                    .buttonStyle(.borderedProminent)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityIdentifier("parseText")
            }
        }
        .padding()
        .navigationTitle("貼上文字")
    }
}
