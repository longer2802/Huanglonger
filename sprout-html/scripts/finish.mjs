// 把打包結果複製成好辨認的檔名：release/mama-handbook.html
import { copyFileSync, mkdirSync, statSync } from "node:fs";
mkdirSync("release", { recursive: true });
copyFileSync("dist/index.html", "release/mama-handbook.html");
console.log(`release/mama-handbook.html  ${(statSync("release/mama-handbook.html").size / 1024).toFixed(0)} KB`);
