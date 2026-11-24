const { chromium, devices } = require('playwright');
const BASE = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push('console: ' + m.text()));
  await p.goto(BASE + '/?v=' + Date.now(), { waitUntil: 'networkidle' });
  await p.getByRole('dialog', { name: '歡迎使用媽媽手冊E版' }).waitFor({ timeout: 40000 });
  await p.getByRole('button', { name: '兩個寶寶範例' }).click();
  await p.waitForTimeout(2500);
  for (let i = 0; i < 20 && await p.locator('[role=presentation] [aria-label="關閉"]').count(); i++) { await p.locator('[role=presentation] [aria-label="關閉"]').first().click(); await p.waitForTimeout(500); }
  await p.getByRole('navigation', { name: '主選單' }).getByRole('link', { name: '手冊' }).click();
  await p.waitForTimeout(1500);
  await p.getByRole('tab', { name: '寶寶手冊' }).click();
  const shoot = async (name, who) => {
    if (who) await p.getByRole('button', { name: who }).click();
    await p.waitForTimeout(500);
    await p.getByRole('button', { name: '目錄' }).click();
    await p.getByRole('button', { name: /生長曲線與紀錄/ }).click();
    await p.getByText(/正在載入/).waitFor({ state: 'detached', timeout: 20000 }).catch(() => {});
    await p.waitForTimeout(1200);
    const txt = await p.locator('.book-page').innerText();
    console.log('---', name, '\n', txt.split('\n').filter((l) => /百分位|kg|cm|手冊說明|曲線走勢/.test(l)).slice(0, 12).join('\n '));
    const book = p.locator('.book-page');
    await book.scrollIntoViewIfNeeded();
    await book.screenshot({ path: `shots/g-${name}.png` });
  };
  await shoot('bean', /小豆/);
  await p.getByRole('tab', { name: '身長／身高' }).click(); await p.waitForTimeout(400);
  await p.locator('.book-page').screenshot({ path: 'shots/g-bean-length.png' });
  await shoot('millet', /小米/);
  console.log('errors', errs);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
