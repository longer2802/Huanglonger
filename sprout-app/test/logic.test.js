import "fake-indexeddb/auto";
import assert from "node:assert/strict";
import { addDays, todayTW, computeEdd, validatePregnancy, pregnancyStatus, ageParts } from "../app/src/lib/dates";
import * as S from "../app/src/lib/store";
import { personContext } from "../app/src/lib/stage";
import { buildIcs, foldLine } from "../app/src/lib/ics";
import { createBackup, readBackup } from "../app/src/lib/backup";
import { todoState } from "../app/src/lib/rules";
import { nowAndNext, pendingReminders, reminderKey } from "../app/src/lib/reminders";
import { demoBorn } from "../app/src/lib/demo";

const T = todayTW();
const ok = (m) => console.log("PASS", m);

// 1. Week 12 from handbook day
await S.reload();
await S.startPregnancy({ pregnancy: { basis: "ga", gaWeeks: 12, gaDays: 0, gaDate: T }, handbookDate: T });
let st = S.getState();
let ctx = personContext(st.people[0], st.family, T);
assert.equal(ctx.headline, "孕 12 週 + 0 天");
assert.ok(ctx.cards.some((c) => c.id === "preg-visit-2"), "week12 shows visit 2 card");
assert.ok(!ctx.cards.some((c) => c.id === "preg-visit-3"));
ok("week 12 handbook → 第 12 週衛教 (" + ctx.cards.map(c=>c.id).join(",") + ")");
const v1 = st.todos.find((t) => t.ruleKey === "prenatal-1");
assert.equal(v1.status, "past"); ok("visit 1 (week 8) marked 可補登, not overdue");
assert.equal(st.todos.find((t) => t.ruleKey === "prenatal-2").status, "suggested");

// 2. Week crossing
ctx = personContext(st.people[0], st.family, addDays(T, 6));
assert.equal(ctx.headline, "孕 12 週 + 6 天");
ctx = personContext(st.people[0], st.family, addDays(T, 7));
assert.equal(ctx.headline, "孕 13 週 + 0 天");
assert.ok(ctx.cards.some((c) => c.id === "preg-visit-3") && ctx.cards.some((c) => c.id === "preg-phase-mid"));
assert.equal(ctx.care.key, "preg-mid"); ok("week crossing 12+6 → 13+0, mid-phase card & check-in stage");

// 3. Book visit 3, complete visit 2, then change EDD
const id3 = "mother:prenatal-3", id2 = "mother:prenatal-2";
await S.bookTodo(id3, { date: addDays(T, 30), time: "09:30" });
await S.completeTodo(id2, T);
const before4 = S.getState().todos.find((t) => t.ruleKey === "prenatal-4").suggestStart;
const res = await S.updatePregnancy({ basis: "edd", edd: addDays(S.getState().family.edd, 7) });
st = S.getState();
assert.equal(st.todos.find((t) => t.id === id3).bookedDate, addDays(T, 30));
assert.equal(st.todos.find((t) => t.id === id2).status, "done");
assert.equal(st.todos.find((t) => t.ruleKey === "prenatal-4").suggestStart, addDays(before4, 7));
ok(`EDD +7d: recalculated ${res.recalculated}, kept ${res.kept} (booked & done untouched)`);

// 4. Over 40 weeks / over 44
const edd40 = addDays(T, -5);
const s = pregnancyStatus(edd40, T);
assert.equal(s.weeks, 40); assert.ok(s.overdue);
ctx = personContext(st.people[0], { ...st.family, edd: edd40 }, T);
assert.ok(ctx.cards.some((c) => c.id === "preg-visit-14")); ok("40+5: overdue flag, week 40 card shown");
const e = validatePregnancy({ basis: "edd", edd: addDays(T, -40) }, T);
assert.ok(e[0].includes("超過 44 週")); ok("over 44 weeks rejected: " + e[0].slice(0, 30));
assert.ok(validatePregnancy({ basis: "lmp", lmp: addDays(T, 3) }, T)[0].includes("不能晚於今天"));
assert.ok(validatePregnancy({ basis: "edd", edd: "2026-02-30" }, T)[0].includes("有效"));
assert.ok(validatePregnancy({ basis: "edd", edd: "" }, T)[0].includes("請填寫")); ok("invalid / missing / future dates rejected");

// 5. Birth + second baby, records separated
const a = await S.recordBirth({ baby: { nickname: "甲", birthDate: T }, deliveryDate: T });
const b = await S.addBaby({ nickname: "乙", birthDate: addDays(T, -400) });
st = S.getState();
assert.equal(st.family.stage, "born");
assert.ok(st.todos.some((t) => t.id === "mother:prenatal-2" && t.status === "done"), "pregnancy timeline kept");
assert.ok(st.todos.some((t) => t.id === "mother:pp-1"));
ctx = personContext(st.people.find((p) => p.id === "mother"), st.family, T);
assert.equal(ctx.headline, "產後第 0 天");
await S.saveRecord({ subjectId: a.id, kind: "vaccine", date: T, fields: { vaccineCode: "hepb", dose: "1" } });
await assert.rejects(() => S.saveRecord({ subjectId: a.id, kind: "vaccine", date: T, fields: { vaccineCode: "hepb", dose: "1" } }), /已經登記過/);
await S.saveRecord({ subjectId: b.id, kind: "vaccine", date: T, fields: { vaccineCode: "hepb", dose: "1" } });
st = S.getState();
assert.equal(st.todos.find((t) => t.id === `${a.id}:vax-hepb-1`).status, "done");
assert.equal(st.records.filter((r) => r.subjectId === a.id).length, 1);
assert.equal(st.records.filter((r) => r.subjectId === b.id).length, 1);
ok("two babies: same vaccine dose allowed per baby, duplicate blocked within one baby, todo auto-completed");
const bVax = st.todos.filter((t) => t.subjectId === b.id && t.ruleKey === "vax-mmr-1")[0];
assert.equal(bVax.status, "past"); ok("older baby's past-window vaccines shown as 可補登");
// edit + history
const r = st.records.find((r) => r.subjectId === a.id);
await S.saveRecord({ ...r, fields: { ...r.fields, clinic: "X" } });
assert.equal(S.getState().records.find((x) => x.id === r.id).history.length, 2); ok("edit keeps history");
await S.deleteRecord(r.id);
assert.equal(S.getState().todos.find((t) => t.id === `${a.id}:vax-hepb-1`).status, "suggested"); ok("delete vaccine record reopens todo");

// 6. ICS
const ics = buildIcs({ id: "mother:prenatal-3", title: "第 3 次產檢" }, { date: "2026-12-01", time: "23:30" }, { sequence: 2 });
assert.ok(ics.includes("UID:mother-prenatal-3@sprout-family.local"));
assert.ok(ics.includes("DTSTART;TZID=Asia/Taipei:20261201T233000"));
assert.ok(ics.includes("DTEND;TZID=Asia/Taipei:20261202T003000"));
assert.ok(ics.includes("TRIGGER:-P1D") && ics.includes("TRIGGER:-PT2H") && ics.includes("SEQUENCE:2"));
assert.ok(ics.includes("SUMMARY:家庭健康提醒\r\n") && !ics.includes("第 3 次產檢"));
assert.ok(ics.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
const folded = foldLine("DESCRIPTION:" + "家".repeat(60));
assert.ok(folded.split("\r\n").every((l) => new TextEncoder().encode(l).length <= 75));
ok("ICS: stable UID, TZID, alarms -1D/-2H, neutral title, folding ≤75 octets");

// 7. Backup
const snap = S.snapshotForBackup();
const file = await createBackup(snap, "secret123");
const back = await readBackup(file, "secret123");
assert.equal(back.snapshot.records.length, snap.records.length);
assert.deepEqual(back.summary.babies, ["甲", "乙"]);
await assert.rejects(() => readBackup(file, "wrong-pass"), /密碼不正確/);
const j = JSON.parse(file); j.data = j.data.slice(0, -8) + "AAAAAAAA";
await assert.rejects(() => readBackup(JSON.stringify(j), "secret123"), /損壞/);
await assert.rejects(() => readBackup("{not json", "x"), /損壞/);
assert.equal(S.getState().records.length, snap.records.length);
ok("backup: round-trip OK, wrong password / tampered / non-JSON rejected, data untouched");
await S.wipeAll(); assert.equal(S.getState().family, null);
await S.replaceEverything(back.snapshot); assert.equal(S.getState().people.length, 3); ok("restore after wipe");

// 8. Reminders: week / day before, overdue asks again until answered
const mk = (o) => ({ id: o.id, title: o.id, status: "suggested", ...o });
const week = mk({ id: "w", status: "booked", bookedDate: addDays(T, 5), bookedTime: "09:00" });
const day = mk({ id: "d", status: "booked", bookedDate: addDays(T, 1), bookedTime: "09:00" });
const late = mk({ id: "o", status: "booked", bookedDate: addDays(T, -2), bookedTime: "09:00" });
const far = mk({ id: "f", suggestStart: addDays(T, 20), suggestEnd: addDays(T, 40) });
const open = mk({ id: "n", suggestStart: addDays(T, -3), suggestEnd: addDays(T, 10) });
let rs = pendingReminders([week, day, late, far, open], T, {});
assert.deepEqual(rs.map((r) => `${r.todo.id}:${r.kind}`), ["o:overdue", "d:day", "w:week"]);
rs = pendingReminders([week, day, late], T, { [reminderKey(week, "week")]: true, [reminderKey(late, "overdue")]: T });
assert.deepEqual(rs.map((r) => r.todo.id), ["d"], "acked week + overdue asked-later-today are quiet");
rs = pendingReminders([late], addDays(T, 1), { [reminderKey(late, "overdue")]: T });
assert.equal(rs.length, 1, "overdue asks again the next day");
const moved = { ...week, bookedDate: addDays(T, 6) };
assert.equal(pendingReminders([moved], T, { [reminderKey(week, "week")]: true }).length, 1, "rescheduling re-arms reminder");
assert.equal(pendingReminders([{ ...day, status: "done", doneDate: T }], T, {}).length, 0);
const nn = nowAndNext([week, day, late, far, open], T);
assert.deepEqual(nn.now.map((x) => x.todo.id), ["o", "n"]);
assert.equal(nn.next.todo.id, "d");
ok("reminders: 1 week & 1 day before, overdue re-asks, ack stops, reschedule re-arms; 本次/下次 split");

// 9. Real basic data replaces example data completely
await S.replaceEverything(demoBorn());
assert.ok(S.getState().family.demo);
await S.updateSettings({ remind: { "x|week|2026-01-01": true }, moodDismissedOn: T });
await S.startPregnancy({ pregnancy: { basis: "edd", edd: addDays(T, 100) }, motherName: "真媽媽", clinic: "某診所", clinicPhone: "021234" });
st = S.getState();
assert.ok(!st.family.demo);
assert.equal(st.people.length, 1);
assert.equal(st.records.length, 0);
assert.equal(st.people[0].clinicPhone, "021234");
assert.equal(st.settings.remind, undefined);
assert.equal(st.settings.moodDismissedOn, undefined);
ok("starting with real data clears all example people, records and reminder state");
await S.replaceEverything(demoBorn());
await S.startBorn({ baby: { nickname: "寶", birthDate: addDays(T, -10) }, deliveryDate: addDays(T, -10), motherName: "媽", clinic: "院", clinicPhone: "02" });
st = S.getState();
assert.ok(!st.family.demo && st.people.length === 2 && st.records.length === 0 && st.people[0].clinic === "院");
ok("born start over example data: 1 mother + 1 baby, clinic saved");

assert.equal(ageParts("2026-01-31", "2026-03-01").months, 1);
assert.equal(todoState({ status: "suggested", suggestStart: T, suggestEnd: addDays(T,-1) }, T), "overdue");
console.log("ALL OK");
