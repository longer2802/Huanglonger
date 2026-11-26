import MenuScannerCore
import MenuScannerVision
import UIKit
import XCTest
@testable import MenuScanner

/// 在模擬器上實際跑 Vision：確認方向、裁切與座標換算正確。
final class VisionOCRTests: XCTestCase {
    private func renderMenu() -> UIImage {
        let size = CGSize(width: 1200, height: 600)
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            let attrs: [NSAttributedString.Key: Any] = [
                .font: UIFont.systemFont(ofSize: 72, weight: .semibold),
                .foregroundColor: UIColor.black,
            ]
            ("紅茶" as NSString).draw(at: CGPoint(x: 80, y: 120), withAttributes: attrs)
            ("35" as NSString).draw(at: CGPoint(x: 900, y: 120), withAttributes: attrs)
            ("綠茶" as NSString).draw(at: CGPoint(x: 80, y: 400), withAttributes: attrs)
            ("40" as NSString).draw(at: CGPoint(x: 900, y: 400), withAttributes: attrs)
        }
    }

    private func recognize(_ cg: CGImage, region: NormRect? = nil) async throws -> OCRDocument {
        do {
            return try await VisionTextRecognizer().recognize(cg, region: region, enhanceContrast: false)
        } catch let error as OCRError {
            throw error
        } catch {
            // 部分模擬器環境沒有 Vision 推論能力；這種情況需在真機驗證。
            throw XCTSkip("此模擬器無法執行 Vision 文字辨識：\(error.localizedDescription)")
        }
    }

    func testFullImageBoxesUseTopLeftOrigin() async throws {
        let cg = try XCTUnwrap(renderMenu().cgImage)
        let doc = try await recognize(cg)
        let price = try XCTUnwrap(doc.lines.first { $0.text.contains("35") }, "\(doc.lines.map(\.text))")
        XCTAssertGreaterThan(price.box.midX, 0.6)
        XCTAssertLessThan(price.box.midY, 0.5, "「35」在上半部，左上原點的 y 應小於 0.5")
        let lower = try XCTUnwrap(doc.lines.first { $0.text.contains("40") })
        XCTAssertGreaterThan(lower.box.midY, 0.5)
    }

    func testRegionRescanMapsBackToFullImage() async throws {
        let cg = try XCTUnwrap(renderMenu().cgImage)
        let rightHalf = NormRect(x: 0.5, y: 0, width: 0.5, height: 1)
        let doc = try await recognize(cg, region: rightHalf)
        XCTAssertFalse(doc.lines.contains { $0.text.contains("紅茶") }, "範圍外的文字不應出現")
        let price = try XCTUnwrap(doc.lines.first { $0.text.contains("40") })
        XCTAssertGreaterThan(price.box.minX, 0.5)
        XCTAssertGreaterThan(price.box.midY, 0.5)
        XCTAssertEqual(doc.region, rightHalf)
    }

    func testOrientationIsNormalized() throws {
        let cg = try XCTUnwrap(renderMenu().cgImage)
        let rotated = UIImage(cgImage: cg, scale: 1, orientation: .right)
        let upright = try XCTUnwrap(ImagePreparation.uprightCGImage(from: rotated))
        XCTAssertEqual(upright.width, cg.height)
        XCTAssertEqual(upright.height, cg.width)
    }

    func testCropReportsActualRegion() throws {
        let cg = try XCTUnwrap(renderMenu().cgImage)
        let c = try XCTUnwrap(ImagePreparation.crop(cg, to: NormRect(x: 0.25, y: 0.5, width: 0.5, height: 0.5)))
        XCTAssertEqual(c.image.width, 600)
        XCTAssertEqual(c.image.height, 300)
        XCTAssertEqual(c.region, NormRect(x: 0.25, y: 0.5, width: 0.5, height: 0.5))
    }
}
