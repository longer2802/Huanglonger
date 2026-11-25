// 菜單 OCR：Tesseract.js 在瀏覽器裡辨識繁體中文＋英文。
// worker、WASM 由 Vite 打包進站點，語言資料放在站點的 ocr-lang/（同站提供，不連 CDN）；
// 這個檔案只在使用者按下「開始辨識」時才被 import，首頁不會載入。
import { createWorker, OEM, PSM, type Worker } from "tesseract.js";
import { simd, relaxedSimd } from "wasm-feature-detect";
import workerUrl from "tesseract.js/dist/worker.min.js?url";
import coreUrl from "tesseract.js-core/tesseract-core-lstm.wasm.js?url";
import coreSimdUrl from "tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url";
import coreRelaxedUrl from "tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js?url";

export interface OcrProgress {
  stage: string;
  /** 0–1 */
  progress: number;
}

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
        createWorker(["chi_tra", "eng"], OEM.LSTM_ONLY, {
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
      await w.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK, preserve_interword_spaces: "1" });
      return w;
    })();
    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

/** 大圖等比例縮小再辨識，避免手機記憶體不足 */
export async function downscale(blob: Blob, maxSide = 1800): Promise<HTMLCanvasElement> {
  const bitmap = await loadBitmap(blob);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, w, h);
  if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
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

export async function recognizeImage(blob: Blob, onProgress: (p: OcrProgress) => void): Promise<string> {
  progressCb = onProgress;
  try {
    onProgress({ stage: "縮圖處理", progress: 0 });
    const canvas = await downscale(blob);
    const worker = await getWorker();
    const { data } = await withTimeout(worker.recognize(canvas), 240_000, "辨識逾時，照片可能太複雜，請裁切後重試");
    onProgress({ stage: "完成", progress: 1 });
    // 中文字之間的多餘空白去掉，保留中文與數字之間的空白方便切價格
    return data.text.replace(/([一-鿿]) (?=[一-鿿])/g, "$1");
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
