import assert from "node:assert/strict";
import { matchesMeal, openStatus, statusText, parseHoursText, normalizeHours, formatDay, taipeiNow, spansOnDay } from "../src/lib/hours.js";
const ok = (m) => console.log("PASS", m);
const every = (ranges) => ({ days: Array.from({ length: 7 }, () => ranges) });
const at = (dow, hhmm) => { const [h, m] = hhmm.split(":").map(Number); return { dow, minutes: h * 60 + m }; };

// Breakfast shop 06:00–11:00, closed Monday
const bfast = { hours: { days: [[{ open: "06:00", close: "11:00" }], [], ...Array.from({ length: 5 }, () => [{ open: "06:00", close: "11:00" }])] } };
assert.ok(matchesMeal(bfast, "breakfast", "today", at(2, "08:00")));
assert.ok(!matchesMeal(bfast, "lunch", "today", at(2, "08:00")));
assert.ok(!matchesMeal(bfast, "breakfast", "today", at(1, "08:00")), "closed Monday");
assert.ok(matchesMeal(bfast, "breakfast", "any", at(1, "08:00")), "any day ok");
ok("breakfast shop: 早餐 yes, 午餐 no, Monday closed only when 今天");

// Late-night shop 18:00–02:00 every day
const night = { hours: every([{ open: "18:00", close: "02:00" }]) };
assert.ok(matchesMeal(night, "dinner", "today", at(3, "12:00")));
assert.ok(matchesMeal(night, "latenight", "today", at(3, "12:00")));
assert.ok(!matchesMeal(night, "breakfast", "today", at(3, "12:00")));
assert.equal(statusText(openStatus(night.hours, at(4, "01:30"))), "營業中・至 02:00");
assert.equal(statusText(openStatus(night.hours, at(4, "03:00"))), "休息中・18:00 開");
ok("past-midnight hours: open at 01:30 until 02:00, counts as 晚餐 and 宵夜");

// Split shift lunch + dinner
const split = { hours: every([{ open: "11:00", close: "14:00" }, { open: "17:00", close: "21:00" }]) };
assert.equal(statusText(openStatus(split.hours, at(5, "15:00"))), "休息中・17:00 開");
assert.equal(statusText(openStatus(split.hours, at(5, "20:45"))), "營業中・至 21:00");
assert.ok(openStatus(split.hours, at(5, "20:45")).closesSoon);
assert.ok(matchesMeal(split, "lunch") && matchesMeal(split, "dinner"));
assert.ok(!matchesMeal(split, "latenight", "any"));
ok("split shifts: status between shifts, 午餐/晚餐 yes, 宵夜 no");

// Closed today → next opening
assert.equal(statusText(openStatus(bfast.hours, at(1, "09:00"))), "今日公休・明天 06:00 開");
assert.equal(statusText(openStatus(bfast.hours, at(0, "12:00"))), "休息中・明天 06:00 開".replace("明天 06:00", "星期二 06:00").replace("休息中", "休息中"));
ok("closed Monday: 今日公休; Sunday afternoon → reopens 星期二");

// No hours: tags decide
assert.ok(matchesMeal({ meal_slots: ["latenight"] }, "latenight"));
assert.ok(!matchesMeal({ meal_slots: ["latenight"] }, "lunch"));
assert.ok(!matchesMeal({}, "lunch"));
assert.equal(openStatus(undefined).state, "unknown");
ok("no hours: manual 時段 tags used; untagged shops drop out of the meal filter");

// Pasting Google Maps style text
let r = parseHoursText("星期一\n休息\n星期二\n06:30–12:30\n星期三\n06:30–12:30\n星期四\n06:30–12:30\n星期五\n06:30–12:30\n星期六\n06:30–13:00\n星期日\n06:30–13:00");
assert.equal(r.matchedDays, 7);
assert.deepEqual(r.hours.days[1], []);
assert.deepEqual(r.hours.days[6], [{ open: "06:30", close: "13:00" }]);
ok("Google Maps multi-line paste (day line, hours line, 休息)");
r = parseHoursText("週一至週五 11:00-14:00、17:00-21:00\n週六、日 公休");
assert.deepEqual(r.hours.days[3], [{ open: "11:00", close: "14:00" }, { open: "17:00", close: "21:00" }]);
assert.deepEqual(r.hours.days[0], []);
assert.deepEqual(r.hours.days[6], []);
assert.equal(r.matchedDays, 7);
r = parseHoursText("星期一、三、五 07:00-10:00");
assert.equal(r.matchedDays, 3);
assert.deepEqual(r.hours.days[5], [{ open: "07:00", close: "10:00" }]);
r = parseHoursText("星期六 上午11:00 到 下午2:00\n星期日 晚上6:00到凌晨1:00");
assert.deepEqual(r.hours.days[6], [{ open: "11:00", close: "14:00" }]);
assert.deepEqual(r.hours.days[0], [{ open: "18:00", close: "01:00" }]);
r = parseHoursText("每日 10:30～20:30");
assert.equal(r.matchedDays, 7);
r = parseHoursText("營業時間 11：00 - 21：00");
assert.ok(r.everyDay && r.hours.days[2][0].open === "11:00");
r = parseHoursText("24 小時營業");
assert.equal(formatDay(r.hours.days[0]), "24 小時");
assert.equal(statusText(openStatus(r.hours, at(2, "03:00"))), "營業中・24 小時");
assert.equal(parseHoursText("好吃的店").hours, null);
ok("paste formats: 週一至週五, 上午/下午/晚上/凌晨, full-width colon, 每日, single range, 24 小時");

assert.equal(normalizeHours({ days: [[{ open: "99:00", close: "1" }], [], [], [], [], [], []] }), null);
assert.equal(normalizeHours({ days: [] }), null);
ok("bad data from backup files is dropped");

const n = taipeiNow(new Date("2026-11-24T16:30:00Z")); // Wed 00:30 in Taipei
assert.deepEqual(n, { dow: 3, minutes: 30 });
ok("Taipei clock regardless of phone time zone");
console.log("HOURS OK");
