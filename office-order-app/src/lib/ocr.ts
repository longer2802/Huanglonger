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

/**
 * 辨識前的影像處理：
 * - 等比例縮放到長邊約 2400px（小圖放大讓小字看得清楚，大圖縮小避免手機記憶體不足）
 * - 轉灰階；深色底淺色字（黑底金字）自動反白成白底黑字
 * - 拉高對比（依亮度分布 2%～98% 重新伸展）
 */
export async function preprocess(blob: Blob, targetSide = 2400): Promise<HTMLCanvasElement> {
  const bitmap = await loadBitmap(blob);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(2.5, targetSide / longest);
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
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
  const median = pct(0.5);
  const dark = median < 110;
  const lo = pct(0.02);
  const hi = pct(0.98);
  const range = Math.max(1, hi - lo);
  for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
    let v = ((gray[p] - lo) * 255) / range;
    if (dark) v = 255 - v;
    v = v < 0 ? 0 : v > 255 ? 255 : v;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
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

export async function recognizeImage(blob: Blob, onProgress: (p: OcrProgress) => void): Promise<OcrResult> {
  progressCb = onProgress;
  try {
    onProgress({ stage: "影像處理（反白、提高對比）", progress: 0 });
    const canvas = await preprocess(blob);
    const worker = await getWorker();
    const { data } = await withTimeout(worker.recognize(canvas, {}, { text: true, blocks: true }), 240_000, "辨識逾時，照片可能太複雜，請裁切後重試");
    onProgress({ stage: "整理品名與價格", progress: 1 });
    const segments = data.blocks ? segmentsFromBlocks(data.blocks) : [];
    (window as unknown as { __ocrSegments?: OcrSegment[] }).__ocrSegments = segments;
    const raw = data.text.replace(/([一-鿿]) (?=[一-鿿])/g, "$1");
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
