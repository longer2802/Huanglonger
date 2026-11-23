const { chromium, devices } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('https://app-5a7d2e40.base44.app/?v=' + Date.now(), { waitUntil: 'networkidle' });
  await p.getByRole('dialog', { name: '歡迎使用媽媽手冊E版' }).waitFor({ timeout: 30000 });
  await p.screenshot({ path: 'shots/1-welcome.png' });
  await p.getByText('寶寶已出生').click();
  await p.getByLabel(/怎麼稱呼媽媽/).first().fill('測試媽媽');
  await p.getByLabel(/院所電話/).first().fill('02-1234-5678');
  await p.screenshot({ path: 'shots/2-born-form.png', fullPage: true });
  // baby fields
  const inputs = await p.locator('input').all();
  console.log('inputs', inputs.length);
  await p.getByLabel(/寶寶.*(稱呼|暱稱|名字)/).first().fill('測試寶寶').catch(e=>console.log('nick fail'));
  await p.locator('input[type=date]').first().fill('2026-10-01');
  await p.getByRole('button', { name: '開始使用' }).click();
  const mood = p.getByText('今天心情好嗎？');
  await mood.waitFor({ timeout: 15000 });
  console.log('title:', await p.title());
  await p.screenshot({ path: 'shots/3-mood-popup.png' });
  // close without answering
  await p.keyboard.press('Escape');
  await p.waitForTimeout(800);
  let closed = !(await mood.isVisible());
  if (!closed) { await p.getByRole('button', { name: /關閉/ }).first().click(); await p.waitForTimeout(800); closed = !(await mood.isVisible()); }
  console.log('closed:', closed);
  await p.screenshot({ path: 'shots/4-home-after-close.png' });
  console.log('heart dot:', await p.getByLabel('今天的心情關懷還沒填').count());
  console.log('row:', await p.getByText('點這裡填寫今天的心情').count());
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2000);
  console.log('popup after reload (should be 0):', await p.getByText('今天心情好嗎？').count());
  await p.getByText('點這裡填寫今天的心情').click();
  await p.getByRole('button', { name: '目前沒有這些狀況' }).click();
  await p.waitForTimeout(1000);
  console.log('row after answer:', await p.getByText('點這裡填寫今天的心情').count(), 'dot:', await p.getByLabel('今天的心情關懷還沒填').count());
  await p.goto('https://app-5a7d2e40.base44.app/me', { waitUntil: 'networkidle' }); await p.waitForTimeout(1500);
  const sh = await p.evaluate(() => [document.documentElement.scrollHeight, innerHeight, getComputedStyle(document.documentElement).overflowY]);
  console.log('me scroll', sh);
  await p.screenshot({ path: 'shots/5-me.png' });
  console.log('errors', errs);
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
