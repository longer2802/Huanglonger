import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// OCR 語言資料（繁中＋英文）以固定檔名放在站點的 ocr-lang/ 下，和網站一起部署。
// tesseract.js 依 langPath + 語言代碼抓檔，所以不能用帶 hash 的檔名。
const LANG_FILES: Record<string, string> = {
  "chi_tra.traineddata.gz": "node_modules/@tesseract.js-data/chi_tra/4.0.0_best_int/chi_tra.traineddata.gz",
  "eng.traineddata.gz": "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
};

function ocrLangAssets(): Plugin {
  const root = fileURLToPath(new URL(".", import.meta.url));
  return {
    name: "ocr-lang-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/ocr-lang\/([\w.]+)$/);
        const src = m && LANG_FILES[m[1]];
        if (!src) return next();
        res.setHeader("Content-Type", "application/octet-stream");
        res.end(readFileSync(root + src));
      });
    },
    generateBundle() {
      for (const [name, src] of Object.entries(LANG_FILES)) {
        this.emitFile({ type: "asset", fileName: `ocr-lang/${name}`, source: readFileSync(root + src) });
      }
    },
  };
}

// 相對路徑：dist 可以放在任何靜態主機的任何子目錄
export default defineConfig({
  base: "./",
  plugins: [react(), ocrLangAssets()],
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
  test: { include: ["src/test/**/*.test.ts"] },
} as never);
