#if canImport(Vision)
import CoreGraphics
import Foundation
import MenuScannerCore

/// 直書文字轉橫排：把一條直排文字依「每列墨水量」切成一個個字，再橫向排成一行，交給 Vision 辨識。
/// （Vision 不支援直排中文；窄長條裡疊起來的單字也常讀不到，橫排後就能正常辨識。）
public enum VerticalText {
    /// - Returns: 橫排後的影像；切不出至少 2 個字時為 nil。
    public static func horizontalize(_ image: CGImage, strip: NormRect) -> CGImage? {
        guard let crop = VisionImageTools.crop(image, to: strip)?.image else { return nil }
        let w = crop.width, h = crop.height
        guard w >= 8, h >= w else { return nil }

        // 灰階像素（記憶體第一列是影像最上方）
        var gray = [UInt8](repeating: 255, count: w * h)
        let drawn = gray.withUnsafeMutableBytes { buf -> Bool in
            guard let ctx = CGContext(
                data: buf.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                space: CGColorSpaceCreateDeviceGray(), bitmapInfo: CGImageAlphaInfo.none.rawValue
            ) else { return false }
            ctx.draw(crop, in: CGRect(x: 0, y: 0, width: w, height: h))
            return true
        }
        guard drawn else { return nil }

        let threshold = otsu(gray)
        // 只看中間 80% 的寬度，避免鄰欄的筆畫
        let x0 = w / 10, x1 = w - w / 10
        var rowInk = [Int](repeating: 0, count: h)
        for y in 0..<h {
            var n = 0
            let base = y * w
            for x in x0..<x1 where gray[base + x] < threshold { n += 1 }
            rowInk[y] = n
        }
        let minInk = max(2, (x1 - x0) / 25)

        // 有墨水的連續列 → 片段；間隔小的合併（「二」「三」這類字中間有空白）
        var segments: [(start: Int, end: Int)] = []
        var y = 0
        while y < h {
            guard rowInk[y] >= minInk else { y += 1; continue }
            var e = y
            while e + 1 < h && rowInk[e + 1] >= minInk { e += 1 }
            if let last = segments.last, y - last.end < Int(Double(w) * 0.18) {
                segments[segments.count - 1].end = e
            } else {
                segments.append((y, e))
            }
            y = e + 1
        }
        // 去掉太扁的雜點；過高的片段（兩個字黏在一起）依字寬切開
        var glyphs: [(start: Int, end: Int)] = []
        let charH = Double(x1 - x0) * 1.1
        for s in segments where Double(s.end - s.start + 1) >= Double(w) * 0.2 {
            let height = Double(s.end - s.start + 1)
            let parts = max(1, Int((height / charH).rounded()))
            let step = height / Double(parts)
            for k in 0..<parts {
                let a = s.start + Int(Double(k) * step), b = s.start + Int(Double(k + 1) * step) - 1
                glyphs.append((a, max(a, b)))
            }
        }
        guard glyphs.count >= 2 else { return nil }

        // 橫向排成一行（白底、字與字之間留空）
        let pad = max(8, w / 4)
        let maxH = glyphs.map { $0.end - $0.start + 1 }.max() ?? w
        let outW = glyphs.count * w + (glyphs.count + 1) * pad
        let outH = maxH + pad * 2
        guard let out = CGContext(
            data: nil, width: outW, height: outH, bitsPerComponent: 8, bytesPerRow: 0,
            space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue
        ) else { return nil }
        out.setFillColor(CGColor(red: 1, green: 1, blue: 1, alpha: 1))
        out.fill(CGRect(x: 0, y: 0, width: outW, height: outH))
        var x = pad
        for g in glyphs {
            let gh = g.end - g.start + 1
            if let piece = crop.cropping(to: CGRect(x: 0, y: g.start, width: w, height: gh)) {
                out.draw(piece, in: CGRect(x: x, y: (outH - gh) / 2, width: w, height: gh))
            }
            x += w + pad
        }
        return out.makeImage()
    }

    /// Otsu 二值化門檻。
    static func otsu(_ pixels: [UInt8]) -> UInt8 {
        var hist = [Int](repeating: 0, count: 256)
        for p in pixels { hist[Int(p)] += 1 }
        let total = Double(pixels.count)
        var sumAll = 0.0
        for i in 0..<256 { sumAll += Double(i * hist[i]) }
        var sumB = 0.0, wB = 0.0, best = 0.0, threshold = 128
        for t in 0..<256 {
            wB += Double(hist[t])
            if wB == 0 { continue }
            let wF = total - wB
            if wF == 0 { break }
            sumB += Double(t * hist[t])
            let mB = sumB / wB, mF = (sumAll - sumB) / wF
            let between = wB * wF * (mB - mF) * (mB - mF)
            if between > best { best = between; threshold = t }
        }
        return UInt8(threshold)
    }
}
#endif
