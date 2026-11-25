// 菜單 OCR：Tesseract.js 在瀏覽器裡辨識繁體中文＋英文。
// worker、WASM 由 Vite 打包進站點，語言資料放在站點的 ocr-lang/（同站提供，不連 CDN）；
// 這個檔案只在使用者按下「開始辨識」時才被 import，首頁不會載入。
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import { simd, relaxedSimd } from "wasm-feature-detect";
import workerUrl from "tesseract.js/dist/worker.min.js?url";
import coreUrl from "tesseract.js-core/tesseract-core-lstm.wasm.js?url";
import coreSimdUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";
import coreRelaxedUrl from "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js?url";
import { layoutMenuText, type OcrSegment } from "./ocrLayout";

export interface OcrProgress {
  stage: string;
  /** 0–1 */
  progress: number;
}

export interface OcrResult {
  /** 依位置整理後、只留中文品名與價格的文字（交給 parseMenuText） */
  text: string;
  /** 引擎原始讀到的文字（校對時可展開查看） */
  raw: string;
}

// 只用繁體中文模型：英文副標不需要辨識，混用英文模型反而會把中文行誤認成英文
const OCR_LANGS = ["chi_tra"];

const abs = (u: string) => new URL(u, document.baseURI).href;

let workerPromise: Promise<Worker> | null = null;
let progressCb: ((p: OcrProgress) => void) | null = null;

const STAGE: Record<string, string> = {
  "loading tesseract core": "載入辨識引擎",
  "initializing tesseract": "初始化",
  "initialized tesseract": "初始化完成",
  "loading language traineddata": "載入中文字庫",
  "loaded language traineddata": "字庫就緒",
  "initializing api": "準備辨識",
  "initialized api": "準備完成",
  "recognizing text": "辨識文字中",
};

function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      progressCb?.({ stage: "下載字庫（第一次較久，約 5 MB）", progress: 0 });
      const core = (await relaxedSimd()) ? coreRelaxedUrl : (await simd()) ? coreSimdUrl : coreUrl;
      let failure = "";
      const w = await withTimeout(
        createWorker(OCR_LANGS, OEM.LSTM_ONLY, {
          workerPath: abs(workerUrl),
          corePath: abs(core),
          langPath: abs("./ocr-lang"),
          gzip: true,
          // 字庫下載一次後存在本機瀏覽器（IndexedDB），下次辨識不用再下載
          cacheMethod: "write",
          logger: (m) => {
            if (!progressCb) return;
            progressCb({ stage: STAGE[m.status] ?? m.status, progress: typeof m.progress === "number" ? m.progress : 0 });
          },
          errorHandler: (e) => {
            failure = String(e?.message ?? e);
          },
        }),
        180_000,
        "載入辨識引擎逾時，請確認網路後重試",
      ).catch((e) => {
        throw new Error(failure || (e as Error).message || "辨識引擎載入失敗");
      });
      // 自動版面分析：多欄海報式菜單會分成多個區塊，之後再依座標配對品名與價格
      await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1" });
      return w;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/** 依比例縮放後的尺寸（最多 900 萬像素，避免手機記憶體不足） */
function scaledSize(w: number, h: number, scale: number) {
  let sc = scale;
  if (w * h * sc * sc > 9_000_000) sc = Math.sqrt(9_000_000 / (w * h));
  return { w: Math.max(1, Math.round(w * sc)), h: Math.max(1, Math.round(h * sc)), scale: sc };
}

/** 方格上的形態學運算（max = 膨脹、min = 侵蝕），可分離成水平、垂直兩次 */
function morph(src: Uint8Array, gw: number, gh: number, r: number, op: "max" | "min"): Uint8Array {
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  const pick = op === "max" ? (a: number, b: number) => (a > b ? a : b) : (a: number, b: number) => (a < b ? a : b);
  const init = op === "max" ? 0 : 1;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let v = init;
      for (let k = -r; k <= r; k++) {
        const xx = x + k;
        v = pick(v, xx < 0 || xx >= gw ? init : src[y * gw + xx]);
      }
      tmp[y * gw + x] = v;
    }
  }
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      let v = init;
      for (let k = -r; k <= r; k++) {
        const yy = y + k;
        v = pick(v, yy < 0 || yy >= gh ? init : tmp[yy * gw + x]);
      }
      out[y * gw + x] = v;
    }
  }
  return out;
}

/**
 * 辨識前的影像處理：
 * - 依 scale 等比例縮放（呼叫端依字的大小決定，讓中文字高落在辨識引擎最擅長的範圍）
 * - 轉灰階、拉高對比（依亮度分布 2%～98% 重新伸展）
 * - 找出「大面積的深色底」（黑底、深色標題色塊），只把那些區域反白，整張統一成淺底深字：
 *   深底為主就整張反白；淺底為主時可選擇只反白深色大區塊（標題色塊），邊緣乾淨、不會切到字
 */
export async function preprocess(blob: Blob, scale: number, mode: "global" | "regions" = "global"): Promise<{ canvas: HTMLCanvasElement; scale: number; regionShare: number; dark: boolean }> {
  const bitmap = await loadBitmap(blob);
  const size = scaledSize(bitmap.width, bitmap.height, scale);
  const { w, h } = size;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const gray = new Uint8ClampedArray(w * h);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    // 金色、紅色字在亮度上和深色底差距大，用加權亮度即可
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    gray[p] = g;
    hist[g]++;
  }
  const pct = (q: number) => {
    let acc = 0;
    const target = gray.length * q;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  const lo = pct(0.02);
  const hi = pct(0.98);
  const range = Math.max(1, hi - lo);
  const mid = lo + range * 0.45;

  // 細格子（約長邊的 1/400）
  const C = Math.max(3, Math.round(Math.max(w, h) / 400));
  const gw = Math.ceil(w / C);
  const gh = Math.ceil(h / C);
  const darkCell = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let sum = 0;
      let n = 0;
      for (let y = gy * C; y < Math.min(h, (gy + 1) * C); y += 2) {
        for (let x = gx * C; x < Math.min(w, (gx + 1) * C); x += 2) {
          sum += gray[y * w + x];
          n++;
        }
      }
      darkCell[gy * gw + gx] = n && sum / n < mid ? 1 : 0;
    }
  }
  // 整張圖以深底為主（黑底菜單）→ 整張反白；以淺底為主 → 找出深色大區塊（標題色塊）。
  // mode = "regions" 時只把深色大區塊反白：開運算去掉文字筆畫這種細東西，閉運算把色塊裡的字補成整塊
  const dark = pct(0.5) < 110;
  const mask = new Uint8Array(darkCell.length);
  let regionShare = 0;
  if (dark) {
    mask.fill(1);
  } else {
    const region = morph(morph(morph(morph(darkCell, gw, gh, 2, "min"), gw, gh, 2, "max"), gw, gh, 4, "max"), gw, gh, 4, "min");
    let n = 0;
    for (let i = 0; i < region.length; i++) n += region[i];
    regionShare = n / region.length;
    if (mode === "regions") mask.set(region);
  }

  for (let y = 0, p = 0; y < h; y++) {
    const row = Math.min(gh - 1, Math.floor(y / C)) * gw;
    for (let x = 0; x < w; x++, p++) {
      let v = ((gray[p] - lo) * 255) / range;
      if (mask[row + Math.min(gw - 1, Math.floor(x / C))]) v = 255 - v;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      const i = p * 4;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, scale: size.scale, regionShare, dark };
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions);
    } catch {
      /* 落到 <img> */
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** 把引擎的行再依「字與字之間的大空隙」切成片段，避免同一高度不同欄的品項黏在一起 */
function segmentsFromBlocks(blocks: { paragraphs: { lines: { words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }[]): OcrSegment[] {
  const out: OcrSegment[] = [];
  for (const b of blocks) {
    for (const para of b.paragraphs) {
      for (const line of para.lines) {
        const words = line.words.filter((w) => w.text.trim());
        if (!words.length) continue;
        const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).sort((a, c) => a - c);
        const h = heights[Math.floor(heights.length / 2)] || 1;
        let cur: typeof words = [];
        const flush = () => {
          if (!cur.length) return;
          out.push({
            text: cur.map((w) => w.text).join(" "),
            // 「元」「$」這類符號常常信心偏低，不列入這段的平均信心
            conf: (() => {
              const core = cur.filter((w) => !/^[元圓$＄]+$/.test(w.text.trim()));
              const ws = core.length ? core : cur;
              return ws.reduce((s, w) => s + w.confidence, 0) / ws.length;
            })(),
            x0: Math.min(...cur.map((w) => w.bbox.x0)),
            y0: Math.min(...cur.map((w) => w.bbox.y0)),
            x1: Math.max(...cur.map((w) => w.bbox.x1)),
            y1: Math.max(...cur.map((w) => w.bbox.y1)),
          });
          cur = [];
        };
        for (const w of words) {
          const prev = cur[cur.length - 1];
          if (prev && w.bbox.x0 - prev.bbox.x1 > h * 2.2) flush();
          cur.push(w);
        }
        flush();
      }
    }
  }
  return out;
}

type Blocks = Parameters<typeof segmentsFromBlocks>[0];

/** 看起來像價格、但信心不足的片段（「4?5」「Go5」「50/60O」）：只允許數字再讀一次 */
function looksNumeric(seg: OcrSegment): boolean {
  const t = seg.text.replace(/\s+/g, "");
  if (!t || t.length > 10 || /[\u3400-\u9fff]/.test(t)) return false;
  if (!/^[0-9A-Za-z?$/+.:-]+$/.test(t)) return false;
  return /\d/.test(t) || (t.length >= 2 && t.length <= 4);
}

/** 中文字高（中位數，排除特別大的標題）：辨識引擎在字高約 30～60px 時最準 */
function typicalCjkHeight(segments: OcrSegment[]): number {
  const hs = segments.filter((s) => s.conf >= 50 && (s.text.match(/[\u3400-\u9fff]/g) ?? []).length >= 2).map((s) => s.y1 - s.y0);
  if (hs.length < 2) return 0;
  hs.sort((a, b) => a - b);
  return hs[Math.floor((hs.length - 1) * 0.4)];
}

/** 評分：配到價格的品項越多越好，多規格加分，信心低的扣分 */
export function scoreLayout(text: string): number {
  let score = 0;
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("【")) continue;
    const nums = line.match(/\d{2,4}/g) ?? [];
    const low = /\?\?$/.test(line);
    if (nums.length) score += 1 + 0.4 * (nums.length - 1) - (low ? 0.45 : 0);
    else score += low ? 0 : 0.15;
  }
  return score;
}

const IDEAL_HEIGHT = 46;

export async function recognizeImage(blob: Blob, onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
  progressCb = onProgress;
  try {
    onProgress({ stage: "影像處理（反白、提高對比）", progress: 0 });
    const probe = await loadBitmap(blob);
    const longest = Math.max(probe.width, probe.height);
    if ("close" in probe && typeof probe.close === "function") probe.close();
    const worker = await getWorker();
    let currentPsm: PSM = PSM.AUTO;
    const run = async (scale: number, mode: "global" | "regions", psm: PSM = PSM.AUTO) => {
      const pre = await preprocess(blob, scale, mode);
      if (psm !== currentPsm) {
        await worker.setParameters({ tessedit_pageseg_mode: psm });
        currentPsm = psm;
      }
      const { data } = await withTimeout(worker.recognize(pre.canvas, {}, { text: true, blocks: true }), 240_000, "辨識逾時，照片可能太複雜，請裁切後重試");
      const segments = data.blocks ? segmentsFromBlocks(data.blocks as unknown as Blocks) : [];
      const layout = segments.length ? layoutMenuText(segments) : "";
      return { ...pre, mode, psm, segments, text: data.text, layout, score: scoreLayout(layout) };
    };

    // 候選 1：長邊約 2400px、整張依底色反白
    const candidates = [await run(Math.min(2.5, 2400 / longest), "global")];
    let best = candidates[0];
    // 候選 2：字太大或太小時，調整到引擎最擅長的字高再辨識一次
    const hgt = typicalCjkHeight(best.segments);
    if (!hgt || hgt < IDEAL_HEIGHT * 0.65 || hgt > IDEAL_HEIGHT * 1.45) {
      const want = hgt ? (best.scale * IDEAL_HEIGHT) / hgt : best.scale * 1.5;
      const scale = Math.min(Math.max(want, 1000 / longest), Math.min(4, 3600 / longest));
      if (Math.abs(scale / best.scale - 1) > 0.2) {
        onProgress({ stage: "調整字的大小再辨識一次", progress: 0 });
        candidates.push(await run(scale, "global"));
      }
    }
    best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
    // 候選 3：淺底配深色標題色塊（多數飲料單）→ 只反白色塊再辨識一次，讀出色塊裡的分類與「中杯 大杯」
    if (!best.dark && best.regionShare > 0.02 && best.regionShare < 0.5) {
      onProgress({ stage: "辨識色塊裡的文字", progress: 0 });
      candidates.push(await run(best.scale, "regions"));
      best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
    }
    // 候選 4：讀到很多中文品名、卻很少配到價格（表格式菜單常見，自動版面分析會漏掉整列）→ 改用「零散文字」模式再讀一次
    const nameCount = best.segments.filter((s) => s.conf >= 50 && (s.text.match(/[\u3400-\u9fff]/g) ?? []).length >= 2).length;
    const pricedCount = best.layout.split("\n").filter((l) => !l.startsWith("【") && /\d{2,4}/.test(l)).length;
    if (nameCount >= 3 && pricedCount < nameCount * 0.7) {
      onProgress({ stage: "改用表格模式再辨識一次", progress: 0 });
      candidates.push(await run(best.scale, best.mode, PSM.SPARSE_TEXT));
      best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
    }
    if (currentPsm !== PSM.AUTO) {
      await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      currentPsm = PSM.AUTO;
    }
    if ((window as unknown as { __ocrDebug?: boolean }).__ocrDebug) {
      (window as unknown as { __ocrCanvas?: string }).__ocrCanvas = best.canvas.toDataURL("image/jpeg", 0.8);
      (window as unknown as { __ocrCandidates?: unknown }).__ocrCandidates = candidates.map((c) => ({ scale: c.scale, mode: c.mode, psm: c.psm, score: c.score }));
    }
    const { canvas, segments } = best;

    // 數字重讀：價格位置信心不足時，限定只辨識數字（和 $ / + M L）再讀一次那一小塊
    const retry = segments.filter((s) => s.conf < 85 && looksNumeric(s)).slice(0, 60);
    if (retry.length) {
      onProgress({ stage: "重新確認價格數字", progress: 0 });
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789$/+ML" });
      try {
        for (let i = 0; i < retry.length; i++) {
          const s = retry[i];
          const pad = Math.round((s.y1 - s.y0) * 0.35);
          const left = Math.max(0, s.x0 - pad);
          const top = Math.max(0, s.y0 - pad);
          const rect = { left, top, width: Math.min(canvas.width - left, s.x1 - s.x0 + pad * 2), height: Math.min(canvas.height - top, s.y1 - s.y0 + pad * 2) };
          const r = await worker.recognize(canvas, { rectangle: rect });
          const text = r.data.text.trim();
          if (/\d{2}/.test(text) && r.data.confidence > s.conf) {
            s.text = text;
            s.conf = r.data.confidence;
          }
          onProgress({ stage: "重新確認價格數字", progress: (i + 1) / retry.length });
        }
      } finally {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, tessedit_char_whitelist: "" });
      }
    }

    onProgress({ stage: "整理品名與價格", progress: 1 });
    (window as unknown as { __ocrSegments?: OcrSegment[] }).__ocrSegments = segments;
    const raw = best.text.replace(/([\u4e00-\u9fff]) (?=[\u4e00-\u9fff])/g, "$1");
    const text = segments.length ? layoutMenuText(segments) : raw;
    return { text, raw };
  } finally {
    progressCb = null;
  }
}

export async function terminateOcr(): Promise<void> {
  if (!workerPromise) return;
  const w = await workerPromise.catch(() => null);
  workerPromise = null;
  await w?.terminate();
}
