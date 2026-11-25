// 390px 手機寬度：每個步驟都不能出現水平捲動
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await p.goto(process.env.BASE || 'http://localhost:4173/', { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: '載入範例' }).click();
  let bad = 0;
  for (const step of ['訂單與菜單', '名單', '點餐', '總計收款', '匯出']) {
    await p.getByRole('navigation', { name: '步驟' }).getByRole('button', { name: new RegExp(step) }).click();
    await p.waitForTimeout(700);
    if (step === '點餐') await p.getByTestId('person-card').first().locator('.person-sum').click();
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    console.log(step, 'scrollWidth', w, w <= 390 ? 'OK' : 'OVERFLOW');
    if (w > 390) bad++;
    await p.screenshot({ path: `shots/w390-${step}.png`, fullPage: true });
  }
  await b.close();
  process.exit(bad ? 1 : 0);
})();
