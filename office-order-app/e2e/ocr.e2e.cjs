// OCR 實測：上傳繁中菜單照片 → 辨識 → 校對候選清單
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch({ env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => console.log('[console]', m.type(), m.text().slice(0, 300))); p.on('requestfailed', (r) => console.log('[reqfail]', r.url(), r.failure()?.errorText));
  const reqs = []; p.on('request', (r) => reqs.push(r.url()));
  await p.goto(BASE, { waitUntil: 'networkidle' });
  console.log('home requests OCR assets?', reqs.some((u) => /tesseract|traineddata|worker\.min/.test(u)));
  await p.getByRole('button', { name: '＋ 開新訂單' }).click();
  await p.getByLabel('餐點店家').fill('幸福便當');
  await p.getByLabel('上傳餐點菜單照片').setInputFiles('e2e/fixtures/menu-bento.jpg');
  await p.getByRole('button', { name: '辨識', exact: true }).click();
  const t0 = Date.now();
  const iv = setInterval(async () => { try { console.log('status:', (await p.locator('[role=status]').allInnerTexts()).join(' / ').slice(0,200), '| err:', await p.locator('.banner.bad').allInnerTexts()); } catch {} }, 5000);
  await p.getByRole('dialog', { name: '校對餐點候選清單' }).waitFor({ timeout: 60000 });
  clearInterval(iv);
  console.log('OCR seconds', ((Date.now() - t0) / 1000).toFixed(1));
  console.log('same-site OCR assets only:', reqs.filter((u) => /tesseract|traineddata|worker/.test(u)).every((u) => u.startsWith(BASE)));
  const dlg = p.getByRole('dialog');
  console.log('banner:', await dlg.locator('.banner').first().innerText());
  const items = await dlg.locator('[data-testid=menu-item]').evaluateAll((els) => els.map((el) => {
    const ins = [...el.querySelectorAll('input')].map((i) => i.value);
    const chips = [...el.querySelectorAll('.chip')].map((c) => c.textContent);
    return ins.join(' | ') + '  ' + chips.join(',');
  }));
  console.log(items.join('\n'));
  await dlg.getByRole('button', { name: '查看辨識原文' }).click();
  console.log('RAW:\n' + await dlg.locator('pre').innerText());
  await p.screenshot({ path: 'shots/ocr-table.png' });
  await dlg.getByRole('button', { name: '原圖' }).click();
  await p.screenshot({ path: 'shots/ocr-orig.png' });
  // 深色底、多欄、英文副標的海報式菜單
  await p.getByRole('button', { name: '取消' }).click();
  await p.getByRole('button', { name: '刪除照片' }).click();
  await p.getByLabel('上傳餐點菜單照片').setInputFiles('e2e/fixtures/menu-poster-dark.jpg');
  await p.getByRole('button', { name: '辨識', exact: true }).click();
  const dlg2 = p.getByRole('dialog', { name: '校對餐點候選清單' });
  await dlg2.waitFor({ timeout: 120000 });
  const names = await dlg2.getByPlaceholder('品名').evaluateAll((els) => els.map((e) => e.value));
  const prices = await dlg2.locator('.price-input input').evaluateAll((els) => els.map((e) => e.value));
  console.log('poster:', names.map((n, i) => `${n} ${prices[i]}`).join(' / '));
  const ok = names.length === 7 && names.every((n) => /便當$/.test(n) && !/[A-Za-z]/.test(n)) && prices.every((v) => /^\d{2,3}$/.test(v));
  console.log(ok ? 'POSTER OK：7 個中文品名、每個都有價格、沒有英文與店名' : 'POSTER FAIL');
  await p.screenshot({ path: 'shots/ocr-poster.png' });

  // 飲料單三種版型：品名都要讀到，而且每個品項都有兩個規格的價格
  await p.getByRole('button', { name: '取消' }).click();
  await p.getByRole('button', { name: '刪除照片' }).click();
  await p.getByRole('checkbox', { name: '訂飲料' }).check();
  const drinks = [['drink-table-light.jpg', 9, 3], ['drink-dark-two-tables.jpg', 8, 0], ['drink-inline-sizes.jpg', 4, 0]];
  for (const [file, expectItems, expectAddons] of drinks) {
    await p.getByLabel('上傳飲料菜單照片').setInputFiles('e2e/fixtures/' + file);
    await p.getByRole('region', { name: '飲料菜單' }).getByRole('button', { name: '辨識', exact: true }).click();
    const dd = p.getByRole('dialog', { name: '校對飲料候選清單' });
    await dd.waitFor({ timeout: 180000 });
    const items = await dd.locator('[data-testid=menu-item]').evaluateAll((els) => els.map((el) => ({ name: el.querySelector('input[placeholder="品名"]').value, prices: [...el.querySelectorAll('.price-input input')].map((i) => i.value) })));
    const addons = await dd.getByPlaceholder('加料名稱').evaluateAll((els) => els.map((e) => e.value));
    const ok = items.length === expectItems && items.every((i) => i.prices.length === 2 && i.prices.every((v) => /^\d{2,3}$/.test(v))) && addons.length === expectAddons;
    console.log(`${file}: ${items.map((i) => `${i.name} ${i.prices.join('/')}`).join('、')}${addons.length ? `｜加料 ${addons.join('、')}` : ''}`);
    console.log(ok ? `DRINK OK ${file}` : `DRINK FAIL ${file}`);
    await dd.getByRole('button', { name: '取消' }).click();
    await p.getByRole('region', { name: '飲料菜單' }).getByRole('button', { name: '刪除照片' }).click();
  }
  console.log('errors', errs);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
