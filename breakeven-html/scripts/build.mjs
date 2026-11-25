// 把圖示轉成 data URL 放進 HTML，產出單一檔案 release/breakeven.html
import { readFileSync, writeFileSync, mkdirSync, statSync } from "node:fs";
const dataUrl = (f) => `data:image/png;base64,${readFileSync(new URL(`../icons/${f}`, import.meta.url)).toString("base64")}`;
let html = readFileSync(new URL("../src/app.html", import.meta.url), "utf8");
html = html.replaceAll("{{ICON_192}}", dataUrl("icon-192.png")).replaceAll("{{ICON_180}}", dataUrl("icon-180.png"));
mkdirSync(new URL("../release/", import.meta.url), { recursive: true });
const out = new URL("../release/breakeven.html", import.meta.url);
writeFileSync(out, html);
console.log(`release/breakeven.html  ${(statSync(out).size / 1024).toFixed(0)} KB`);
