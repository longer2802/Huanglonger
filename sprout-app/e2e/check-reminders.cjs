const { chromium, devices } = require('playwright');
const URL0 = 'https://app-5a7d2e40.base44.app/';
const log = (...a) => console.log(...a);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const welcome = () => p.getByRole('dialog', { name: '歡迎使用媽媽手冊E版' });
  await p.goto(URL0 + '?v=' + Date.now(), { waitUntil: 'networkidle' });
  await welcome().waitFor({ timeout: 30000 });
  await p.getByRole('button', { name: '孕期範例' }).click();
  await p.waitForTimeout(2500);
  log('1 after choosing demo, popup visible (want false):', await welcome().isVisible().catch(() => false));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  log('2 reopen with demo, popup visible (want true):', await welcome().isVisible());
  await p.screenshot({ path: 'shots/b1-demo-popup.png' });
  await p.getByRole('button', { name: '先繼續看範例' }).click(); await p.waitForTimeout(800);
  log('3 after 先繼續看範例 (want false):', await welcome().isVisible().catch(() => false));
  for (let i = 0; i < 30 && await p.locator('[role=presentation] [aria-label="關閉"]').count(); i++) { log('   closing popup:', await p.getByRole('dialog').first().getAttribute('aria-label')); await p.locator('[role=presentation] [aria-label="關閉"]').first().click(); await p.waitForTimeout(600); }
  await p.getByRole('navigation', { name: '主選單' }).getByRole('link', { name: '我的' }).click(); await p.waitForTimeout(1500);
  log('4 navigate within visit, popup (want false):', await welcome().isVisible().catch(() => false));
  await p.getByRole('button', { name: /範例・填我的資料/ }).click(); await p.waitForTimeout(500);
  log('5 header chip reopens (want true):', await welcome().isVisible());
  await p.getByText('我在孕期').click();
  await p.getByLabel(/怎麼稱呼媽媽/).first().fill('真的媽媽');
  const edd = new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10);
  await p.locator('input[type=date]').first().fill(edd);
  await p.getByRole('button', { name: '開始使用' }).click(); await p.waitForTimeout(3000);
  log('6 after real data, welcome (want false):', await welcome().isVisible().catch(() => false));
  log('   demo chip (want 0):', await p.getByText('範例・填我的資料').count());
  // close today's mood popup
  if (await p.getByText('今天心情好嗎？').count()) { await p.getByRole('button', { name: '關閉' }).first().click(); await p.waitForTimeout(800); }
  await p.goto(URL0 + 'me', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  log('7 me: demo section (want 0):', await p.getByRole('button', { name: /範例資料/ }).count(), 'people:', await p.getByText('真的媽媽').count());
  // Inject dates: one booked in 5 days, one booked yesterday
  const ids = await p.evaluate(() => new Promise((res, rej) => {
    const r = indexedDB.open('sprout-family'); r.onerror = rej;
    r.onsuccess = () => { const db = r.result; const tx = db.transaction('todos', 'readwrite'); const st = tx.objectStore('todos');
      const g = st.getAll(); g.onsuccess = () => {
        const open = g.result.filter(t => t.status === 'suggested').sort((a,b)=>a.suggestStart.localeCompare(b.suggestStart));
        const d = (n) => { const x = new Date(Date.now() + 8*3600e3 + n*864e5); return x.toISOString().slice(0,10); };
        const a = { ...open[0], status: 'booked', bookedDate: d(5), bookedTime: '10:00' };
        const c = { ...open[1], status: 'booked', bookedDate: d(-1), bookedTime: '10:00' };
        st.put(a); st.put(c); tx.oncomplete = () => res([a.title, c.title]); };
    };
  }));
  log('   injected', ids);
  await p.goto(URL0 + '?r=' + Date.now(), { waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  const title = async () => (await p.getByRole('dialog').first().getAttribute('aria-label').catch(() => null));
  log('8 popup:', await title());
  await p.screenshot({ path: 'shots/b2-overdue.png' });
  await p.getByRole('button', { name: '之後再問我' }).click(); await p.waitForTimeout(1200);
  log('9 next popup:', await title());
  await p.screenshot({ path: 'shots/b3-week.png' });
  await p.getByRole('button', { name: '知道了' }).click(); await p.waitForTimeout(1200);
  log('10 after 知道了, dialogs:', await p.getByRole('dialog').count());
  await p.screenshot({ path: 'shots/b4-today.png', fullPage: false });
  log('   本次/下次 sections:', await p.getByText('本次需完成').count(), await p.getByText('下次需完成').count());
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  log('11 reopen same day, dialogs (want 0):', await p.getByRole('dialog').count());
  // simulate tomorrow: clear overdue ack date to yesterday
  await p.evaluate(() => new Promise((res) => { const r = indexedDB.open('sprout-family'); r.onsuccess = () => { const tx = r.result.transaction('meta','readwrite'); const st = tx.objectStore('meta'); const g = st.get('settings'); g.onsuccess = () => { const s = g.result; for (const k in s.remind) if (k.endsWith('|overdue')) s.remind[k] = '2000-01-01'; st.put(s); tx.oncomplete = res; }; }; }));
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  log('12 next day, overdue asks again:', await title());
  await p.getByRole('button', { name: '已完成' }).click(); await p.waitForTimeout(1200);
  log('13 after 已完成, dialogs:', await p.getByRole('dialog').count());
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2500);
  log('14 reopen, dialogs (want 0):', await p.getByRole('dialog').count());
  log('errors', errs);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
