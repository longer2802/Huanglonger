// 把打包結果複製成好辨認的檔名：release/yijuhua-app.html
import { copyFileSync, mkdirSync, statSync } from "node:fs";
mkdirSync("release", { recursive: true });
copyFileSync("dist/index.html", "release/yijuhua-app.html");
console.log(`release/yijuhua-app.html  ${(statSync("release/yijuhua-app.html").size / 1024).toFixed(0)} KB`);
