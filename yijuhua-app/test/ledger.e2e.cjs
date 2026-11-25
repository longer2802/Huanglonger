const { chromium, devices } = require('playwright');
const URL0 = 'https://app-63aa1609.base44.app';
const rec = (i, type, amount, cat, item, pm, date) => ({ id: `local-t${i}`, type, amount, currency: 'TWD', categoryName: cat, itemName: item, transactionDate: date, transactionTime: '12:00', timezone: 'Asia/Taipei', inputMethod: 'manual', status: 'confirmed', clientRequestId: `t${i}`, created_date: '2026-11-20T00:00:00Z', updated_date: '2026-11-20T00:00:00Z', ...(pm ? { paymentMethod: pm } : {}) });
const RECORDS = [
  rec(1, 'expense', 150, '飲食', '午餐', '現金', '2026-11-24'),
  rec(2, 'expense', 1200, '購物', '外套', '信用卡', '2026-11-22'),
  rec(3, 'expense', 800, '交通', '加油', '信用卡', '2026-11-20'),
  rec(4, 'expense', 15000, '居家', '房租', '銀行轉帳', '2026-11-05'),
  rec(5, 'expense', 50, '飲食', '飲料', null, '2026-11-25'),
  rec(6, 'income', 40000, '薪資', '薪水', null, '2026-11-05'),
  rec(7, 'transfer', 5000, '轉帳', '轉到儲蓄帳戶', null, '2026-11-06'),
  rec(8, 'expense', 3000, '購物', '上個月的東西', '信用卡', '2026-10-30'),
];
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'], timezoneId: 'Asia/Taipei' });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-25T04:00:00Z') });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(URL0 + '/', { waitUntil: 'networkidle' });
  await p.evaluate((r) => localStorage.setItem('yijuhua-ledger-v1', JSON.stringify(r)), RECORDS);
  await p.goto(URL0 + '/ledger', { waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  const sec = p.getByRole('region', { name: '付款方式統計' });
  console.log('本月:', (await sec.innerText()).replace(/\n/g, ' | '));
  await sec.screenshot({ path: '../shots/pay-month.png' });
  await sec.getByRole('button', { name: /信用卡/ }).click(); await p.waitForTimeout(500);
  const items = await p.locator('section[aria-label="交易列表"] li span.font-medium').allInnerTexts();
  console.log('信用卡 list:', items, '| chip:', await p.getByText(/只看信用卡付款的支出/).count());
  await p.getByText(/只看信用卡付款的支出/).click(); await p.waitForTimeout(300);
  console.log('after clear:', (await p.locator('section[aria-label="交易列表"] li span.font-medium').allInnerTexts()).length, 'items');
  await p.getByRole('button', { name: '今日' }).click(); await p.waitForTimeout(400);
  console.log('今日:', (await sec.innerText()).replace(/\n/g, ' | '));
  await p.getByRole('button', { name: '本月' }).click(); await p.waitForTimeout(400);
  await p.screenshot({ path: '../shots/ledger-top.png' });
  console.log('errors', errs);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
