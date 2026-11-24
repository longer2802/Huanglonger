const { chromium, devices } = require('playwright');
const URL0 = 'https://app-8427d28d.base44.app/';
const every = (r) => Array.from({ length: 7 }, () => r);
const now = new Date().toISOString();
const PLACES = [
  { id: 't-a', name: '測試早餐店', category: '早午餐', address: '測試路1號', lat: 25.04, lng: 121.56, location_status: 'confirmed', visit_status: 'want', tags: [], created_date: '2026-01-04T00:00:00Z', updated_date: now,
    hours: { days: [[{ open: '06:00', close: '11:00' }], [], ...Array.from({ length: 5 }, () => [{ open: '06:00', close: '11:00' }])] } },
  { id: 't-b', name: '測試宵夜攤', category: '小吃', address: '測試路2號', lat: 25.05, lng: 121.57, location_status: 'confirmed', visit_status: 'want', tags: [], created_date: '2026-01-03T00:00:00Z', updated_date: now,
    hours: { days: every([{ open: '18:00', close: '02:00' }]) } },
  { id: 't-c', name: '測試午餐便當', category: '飯類', address: '測試路3號', lat: 25.06, lng: 121.58, location_status: 'confirmed', visit_status: 'want', tags: [], created_date: '2026-01-02T00:00:00Z', updated_date: now, meal_slots: ['lunch'] },
  { id: 't-d', name: '測試咖啡廳', category: '咖啡甜點', address: '測試路4號', lat: 25.07, lng: 121.59, location_status: 'confirmed', visit_status: 'want', tags: [], created_date: '2026-01-01T00:00:00Z', updated_date: now },
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Taipei' });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-24T04:00:00Z') }); // Tue 12:00 Taipei
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL0, { waitUntil: 'networkidle' });
  await p.evaluate((places) => new Promise((res, rej) => {
    const r = indexedDB.open('food-map', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('places', { keyPath: 'id' });
    r.onsuccess = () => { const tx = r.result.transaction('places', 'readwrite'); places.forEach((x) => tx.objectStore('places').put(x)); tx.oncomplete = res; tx.onerror = rej; };
  }), PLACES);
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  await p.getByRole('button', { name: '列表' }).first().click().catch(async () => p.getByText('列表').first().click());
  await p.waitForTimeout(1000);
  const names = async () => (await p.locator('p.font-display:visible').allInnerTexts()).filter((t) => t.startsWith('測試'));
  console.log('all:', await names());
  console.log('status pills:', await p.locator('span:visible:has(svg.lucide-clock)').allInnerTexts());
  await p.screenshot({ path: '../shots/fm-list.png' });
  const chip = (label) => p.locator('.no-scrollbar').getByRole('button', { name: label, exact: true });
  for (const label of ['早餐', '午餐', '晚餐', '宵夜']) {
    await chip(label).click(); await p.waitForTimeout(400);
    console.log(label, '→', await names());
    await chip(label).click(); await p.waitForTimeout(300);
  }
  // 不限星期 via filter sheet: breakfast shop is closed on Monday only, so still in for today (Tue)
  await chip('早餐').click(); await p.waitForTimeout(300);
  await p.screenshot({ path: '../shots/fm-breakfast.png' });
  await chip('早餐').click();
  // open the coffee shop and paste hours
  await p.locator('p.font-display:visible', { hasText: '測試咖啡廳' }).first().click(); await p.waitForTimeout(1200);
  await p.getByRole('region', { name: '營業時間' }).getByRole('button', { name: /填寫/ }).click();
  await p.locator('#hours-paste').fill('星期一\n休息\n星期二\n07:30–15:00\n星期三\n07:30–15:00\n星期四\n07:30–15:00\n星期五\n07:30–15:00\n星期六\n08:00–16:00\n星期日\n08:00–16:00');
  await p.getByRole('button', { name: '讀取並填入' }).click(); await p.waitForTimeout(400);
  await p.screenshot({ path: '../shots/fm-editor.png' });
  await p.getByRole('button', { name: /儲存/ }).click(); await p.waitForTimeout(1200);
  const region = p.getByRole('region', { name: '營業時間' });
  console.log('card after save:', (await region.innerText()).replace(/\n/g, ' | '));
  await region.screenshot({ path: '../shots/fm-card.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(800);
  await chip('早餐').click(); await p.waitForTimeout(400);
  console.log('早餐 after coffee hours →', await names());
  await chip('早餐').click(); await chip('午餐').click(); await p.waitForTimeout(400);
  console.log('午餐 after coffee hours →', await names());
  // persisted?
  const saved = await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('food-map', 1); r.onsuccess = () => { const g = r.result.transaction('places').objectStore('places').get('t-d'); g.onsuccess = () => res(g.result.hours); }; }));
  console.log('saved Monday:', JSON.stringify(saved.days[1]), 'Saturday:', JSON.stringify(saved.days[6]));
  console.log('errors', errs);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
