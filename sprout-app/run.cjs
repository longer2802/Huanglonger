const { chromium, devices } = require("playwright");
const fs = require("fs");
const BASE = "https://app-5a7d2e40.base44.app";
const log = (...a) => console.log(...a);
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const addDays = (d, n) => { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 13"], acceptDownloads: true, locale: "zh-TW", timezoneId: "Asia/Taipei" });
  const page = await ctx.newPage();
  const errors = [], reqs = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 160)));
  page.on("request", (r) => reqs.push(r.method() + " " + r.url()));
  const shot = (n) => page.screenshot({ path: n + ".png" });
  const toast = async () => (await page.locator("[data-sonner-toast]").allTextContents()).join(" | ");
  const go = async (p) => { await page.goto(BASE + p, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(2500); };
  const R = {}; global.R = R; global.P = page;
  const fold = async (t) => { const b = page.locator("section > button[aria-expanded]", { hasText: t }).first(); if ((await b.getAttribute("aria-expanded")) === "false") { await b.click(); await page.waitForTimeout(300); } };
  const esc=(t)=>t.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const L=(root,t)=>root.getByLabel(new RegExp("^"+esc(t)+"\\s*(\\*|選填)?$"));

  await go("/");
  await page.getByText("我在孕期").click();
  await page.getByText("某天的已知孕週＋天數").click();
  await L(page,"孕週").fill("12");
  await L(page,"＋天數").fill("0");
  await page.getByRole("button", { name: "開始使用" }).click();
  await page.waitForTimeout(2000);
  R.headline12 = await page.getByText("孕 12 週 + 0 天").count() > 0;
  R.week12card = await page.getByText("第 2 次產檢（建議第 12 週）").count() > 0;
  R.careShown = await page.getByRole("complementary", { name: "關懷問題" }).count() > 0;
  await shot("01-today-w12");
  // check-in: answer, then reload
  await page.getByRole("complementary", { name: "關懷問題" }).getByRole("button", { name: "目前沒有這些狀況" }).click();
  await page.waitForTimeout(1000);
  R.careCollapsed = await page.getByRole("complementary", { name: "關懷問題" }).count() === 0;
  await page.reload(); await page.waitForTimeout(2500);
  R.careNotRepeated = await page.getByRole("complementary", { name: "關懷問題" }).count() === 0;
  R.careAnsweredText = await page.getByText("目前沒有這些狀況。").count() > 0;
  // danger sign card shows action
  R.dangerCardTitle = await page.getByText("亮黃燈！懷孕期間的危險徵兆").count() > 0;

  // handbook week navigation
  await go("/handbook");
  R.hbW12 = await page.getByText("第 2 次產檢（建議第 12 週）").count() > 0;
  await page.getByRole("button", { name: "下一週" }).click();
  R.hbW13 = await page.getByText("第 3 次產檢（建議第 16 週）").count() > 0 && await page.getByText("懷孕中期：13～未滿 29 週").count() > 0;
  await shot("02-handbook-w13");

  // prenatal record add / edit / delete, persistence
  await go("/record?kind=prenatal");
  await L(page,"院所").fill("測試診所A");
  await L(page,"體重").fill("56.4");
  await page.getByRole("button", { name: "儲存" }).click();
  await page.waitForTimeout(1500);
  await page.reload(); await page.waitForTimeout(2500);
  R.recordPersisted = await page.getByText("測試診所A・56.4 kg").count() > 0;
  await page.getByText("測試診所A・56.4 kg").click(); await page.waitForTimeout(800);
  await L(page,"體重").fill("56.9");
  await page.getByRole("button", { name: "儲存" }).click(); await page.waitForTimeout(1200);
  R.recordEdited = await page.getByText("測試診所A・56.9 kg").count() > 0;
  await page.getByText("測試診所A・56.9 kg").click(); await page.waitForTimeout(800);
  R.history2 = await page.getByText("修改歷史（2）").count() > 0;
  await page.getByRole("button", { name: "刪除" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "刪除" }).click(); await page.waitForTimeout(1200);
  R.recordDeleted = await page.getByText("測試診所A").count() === 0;

  // visit record (就醫)
  await go("/record?kind=visit");
  await L(page,"院所").fill("測試醫院");
  await L(page,"就醫原因").fill("回診");
  await page.getByRole("button", { name: "儲存" }).click(); await page.waitForTimeout(1200);
  R.visitSaved = await page.getByText("測試醫院・回診").count() > 0;

  // calendar: book prenatal-2, export ics, reschedule
  await go("/calendar");
  await page.getByRole("button", { name: /第 2 次產檢/ }).first().click(); await page.waitForTimeout(600);
  await L(page,"日期").fill(addDays(today, 5));
  await L(page,"時間").fill("10:30");
  await page.getByRole("button", { name: "設為已預約" }).click(); await page.waitForTimeout(1200);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "下載 .ics" }).click()]);
  const icsPath = await dl.path(); const ics = fs.readFileSync(icsPath, "utf8"); fs.writeFileSync("export1.ics", ics);
  R.ics = { uid: (ics.match(/UID:(.*)/) || [])[1]?.trim(), start: (ics.match(/DTSTART;TZID=Asia\/Taipei:(\S+)/) || [])[1], alarms: (ics.match(/TRIGGER:[^\r\n]+/g) || []).join(","), summary: (ics.match(/SUMMARY:([^\r\n]+)/) || [])[1], seq: (ics.match(/SEQUENCE:(\d+)/) || [])[1] };
  await page.waitForTimeout(800);
  R.exportedMsg = await page.getByText("小芽無法確認手機是否已加入").count() > 0;
  await L(page,"時間").fill("14:00");
  await page.getByRole("button", { name: "儲存改期" }).click(); await page.waitForTimeout(1200);
  R.rescheduleWarn = await page.getByText("時間改過了").count() > 0;
  const [dl2] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "下載 .ics" }).click()]);
  const ics2 = fs.readFileSync(await dl2.path(), "utf8");
  R.ics2 = { sameUid: ics2.includes("UID:" + R.ics.uid), start: (ics2.match(/DTSTART;TZID=Asia\/Taipei:(\S+)/) || [])[1], seq: (ics2.match(/SEQUENCE:(\d+)/) || [])[1] };
  await shot("03-calendar-export");
  await page.getByRole("button", { name: "關閉" }).click();

  // change EDD (+7 days) keeps booked
  await go("/me"); await fold("孕期日期");
  await page.getByText("醫師確認的預產期").click();
  const curEdd = addDays(today, 280 - 84);
  await L(page,"預產期").fill(addDays(curEdd, 7));
  await page.getByRole("button", { name: "更新日期" }).click(); await page.waitForTimeout(1500);
  R.eddToast = (await toast()).slice(0, 80);
  await go("/");
  R.afterEdd = await page.getByText("孕 11 週 + 0 天").count() > 0;
  await go("/calendar");
  R.bookedKept = await page.getByText(/14:00/).count() > 0;

  // over 40 weeks
  await go("/me"); await fold("孕期日期");
  await page.getByText("醫師確認的預產期").click();
  await L(page,"預產期").fill(addDays(today, -9));
  await page.getByRole("button", { name: "更新日期" }).click(); await page.waitForTimeout(1500);
  await go("/");
  R.over40 = await page.getByText("孕 41 週 + 2 天").count() > 0 && await page.getByText("已超過 40 週").count() > 0;
  await shot("04-over40");
  // invalid: over 44
  await go("/me"); await fold("孕期日期");
  await page.getByText("醫師確認的預產期").click();
  await L(page,"預產期").fill(addDays(today, -40));
  await page.getByRole("button", { name: "更新日期" }).click(); await page.waitForTimeout(800);
  R.over44Error = await page.getByText(/超過 44 週/).count() > 0;

  // birth switch + second baby
  await go("/me#birth");
  const birth = page.locator("#birth");
  await L(birth,"寶寶暱稱").fill("測試甲");
  await birth.getByRole("button", { name: "切換為出生後" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "確定切換" }).click(); await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "新增寶寶" }).click();
  const dlg = page.getByRole("dialog");
  await L(dlg,"寶寶暱稱").fill("測試乙");
  await L(dlg,"出生日期").fill(addDays(today, -400));
  await dlg.getByRole("button", { name: "新增" }).click(); await page.waitForTimeout(2000);
  await go("/");
  R.babyHeadline = await page.getByText(/測試甲・出生第 0 天/).count() > 0;
  await page.getByRole("tab", { name: "小芽媽" }).or(page.getByRole("tab", { name: "媽媽" })).first().click(); await page.waitForTimeout(800);
  R.postpartum = await page.getByText("產後第 0 天").count() > 0;
  await shot("05-postpartum");
  // vaccine records per baby
  const ids = await page.evaluate(async () => new Promise((res) => { const r = indexedDB.open("sprout-family"); r.onsuccess = () => { const q = r.result.transaction("people").objectStore("people").getAll(); q.onsuccess = () => res(q.result.map((p) => [p.nickname, p.id])); }; }));
  const idA = ids.find((x) => x[0] === "測試甲")[1], idB = ids.find((x) => x[0] === "測試乙")[1];
  const addVax = async (sid) => { await go(`/record?kind=vaccine&subject=${sid}`); await L(page,"疫苗品項").selectOption("hepb"); await page.getByRole("button", { name: "儲存" }).click(); await page.waitForTimeout(1200); };
  await addVax(idA); await addVax(idA);
  R.dupBlocked = await page.getByText(/已經登記過同一品項的第 1 劑/).count() > 0;
  await addVax(idB);
  R.bSaved = await page.getByText("時間軸").count() > 0;
  const counts = await page.evaluate(async ([a, b]) => new Promise((res) => { const r = indexedDB.open("sprout-family"); r.onsuccess = () => { const q = r.result.transaction("records").objectStore("records").getAll(); q.onsuccess = () => { const v = q.result.filter((x) => x.kind === "vaccine"); res({ a: v.filter((x) => x.subjectId === a).length, b: v.filter((x) => x.subjectId === b).length }); }; }; }), [idA, idB]);
  R.vaxPerBaby = counts;
  // timeline filter by baby
  await go("/record?tab=timeline");
  await page.getByRole("tab", { name: "測試乙" }).click(); await page.waitForTimeout(500);
  R.timelineB = await page.locator("button", { hasText: "疫苗接種" }).count();

  // backup → corrupt import → valid import
  await go("/me"); await fold("備份與還原");
  await L(page,"設定備份密碼").fill("secret123");
  const [bk] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "產生加密備份" }).click()]);
  const bkText = fs.readFileSync(await bk.path(), "utf8"); fs.writeFileSync("backup.sproutbackup", bkText);
  const j = JSON.parse(bkText); j.data = j.data.slice(0, -12) + "AAAAAAAAAAAA"; fs.writeFileSync("corrupt.sproutbackup", JSON.stringify(j));
  const before = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("sprout-family"); r.onsuccess = () => { const q = r.result.transaction("records").objectStore("records").count(); q.onsuccess = () => res(q.result); }; }));
  await page.locator('input[type="file"]').setInputFiles("corrupt.sproutbackup");
  await L(page,"備份密碼").fill("secret123");
  await page.getByRole("button", { name: "檢查備份內容" }).click(); await page.waitForTimeout(2500);
  R.corruptRejected = await page.getByText(/損壞|完整性/).count() > 0;
  const after = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("sprout-family"); r.onsuccess = () => { const q = r.result.transaction("records").objectStore("records").count(); q.onsuccess = () => res(q.result); }; }));
  R.dataUnchanged = before === after;
  // wipe then restore valid
  await fold("刪除全部資料");
  await page.locator("button.bg-destructive", { hasText: "刪除全部資料" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "下一步" }).click();
  await L(page,"請輸入「刪除」兩個字").fill("刪除");
  await page.getByRole("button", { name: "永久刪除" }).click(); await page.waitForTimeout(2000);
  R.wiped = await page.getByText("我在孕期").count() > 0;
  // restore from onboarding? backup lives on /me; load demo first is not desired -> use sources? set minimal family via born flow then restore
  await page.getByText("寶寶已出生").click();
  await L(page,"寶寶暱稱").fill("暫時");
  await L(page,"出生日期").fill(today);
  await page.getByRole("button", { name: "開始使用" }).click(); await page.waitForTimeout(2000);
  await go("/me"); await fold("備份與還原");
  await page.locator('input[type="file"]').setInputFiles("backup.sproutbackup");
  await L(page,"備份密碼").fill("secret123");
  await page.getByRole("button", { name: "檢查備份內容" }).click(); await page.waitForTimeout(3000);
  R.summary = (await page.getByRole("dialog").textContent())?.slice(0, 160);
  await page.getByRole("dialog").getByRole("button", { name: "確認還原" }).click(); await page.waitForTimeout(2500);
  const restored = await page.evaluate(() => new Promise((res) => { const r = indexedDB.open("sprout-family"); r.onsuccess = () => { const q = r.result.transaction("people").objectStore("people").getAll(); q.onsuccess = () => res(q.result.map((p) => p.nickname)); }; }));
  R.restored = restored;

  // demo load & clear
  await fold("範例資料");
  await page.getByRole("button", { name: "兩個寶寶範例" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "載入" }).click(); await page.waitForTimeout(2000);
  R.demoBadge = await page.getByText("範例資料").count() > 0;
  await go("/"); await shot("06-demo");
  await go("/me"); await fold("範例資料");
  await page.getByRole("button", { name: "清除範例資料" }).click(); await page.waitForTimeout(1500);
  R.demoCleared = await page.getByText("我在孕期").count() > 0;

  const bad = reqs.filter((u) => /integration|invokellm|InvokeLLM|\/ai\/|openai|anthropic|llm/i.test(u));
  R.suspiciousRequests = bad;
  R.hosts = [...new Set(reqs.map((u) => new URL(u.split(" ")[1]).host))];
  R.errors = errors.filter((e) => !/Failed to load resource|net::ERR/.test(e));
  console.log(JSON.stringify(R, null, 1));
  await browser.close();
})().catch(async (e) => { console.error("TEST FAILED:", e.message.split("\n").slice(0,3).join(" ")); console.log(JSON.stringify(global.R)); try { await global.P.screenshot({ path: "fail.png" }); } catch {} process.exit(1); });
