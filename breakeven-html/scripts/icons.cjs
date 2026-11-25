// 由 icons/icon.svg 產生 PNG 圖示（180、192、512）
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const svg = fs.readFileSync(path.join(__dirname, '../icons/icon.svg'), 'utf8');
(async () => {
  const b = await chromium.launch();
  for (const size of [180, 192, 512]) {
    const p = await b.newPage({ viewport: { width: size, height: size } });
    await p.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`);
    await p.screenshot({ path: path.join(__dirname, `../icons/icon-${size}.png`), omitBackground: true });
  }
  await b.close();
})();
