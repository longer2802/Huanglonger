import { addDays, addMonths, dateAtGA, diffDays, isValidDate } from "./dates";

// Official timing rules that become calendar to-dos. Each rule has a stable key,
// so a to-do keeps its id (and any export UID) when dates are recalculated.
// basis: "ga" (start/end in pregnancy days), "pp" (days after birth),
//        "age" (baby age: { m, d } from the birth date)
const W = (w, d = 0) => w * 7 + d;

const MOM = "hpa-mom-2026-06";
const CHILD = "hpa-child-2026-06";
const VAX = "cdc-vax-11509";

const PRENATAL_WEEKS = [8, 12, 16, 20, 24, 28, 30, 32, 34, 36, 37, 38, 39, 40];

export const RULES = [
  ...PRENATAL_WEEKS.map((week, i) => ({
    key: `prenatal-${i + 1}`,
    role: "mother",
    basis: "ga",
    type: "prenatal",
    title: `第 ${i + 1} 次產檢`,
    hint: `手冊建議第 ${week} 週`,
    start: W(week),
    end: W(week, 6),
    auto: true,
    source: { id: MOM, page: "第 8～9、30～43 頁" },
  })),
  { key: "test-us1", role: "mother", basis: "ga", type: "test", title: "第 1 次產檢超音波", hint: "8～16 週", start: W(8), end: W(16, 6), auto: true, source: { id: MOM, page: "第 8 頁" } },
  { key: "test-us2", role: "mother", basis: "ga", type: "test", title: "第 2 次產檢超音波", hint: "20 週前後", start: W(19), end: W(21, 6), auto: true, source: { id: MOM, page: "第 8 頁" } },
  { key: "test-gdm", role: "mother", basis: "ga", type: "test", title: "妊娠糖尿病篩檢及貧血檢驗", hint: "24～28 週", start: W(24), end: W(28, 6), auto: true, source: { id: MOM, page: "第 9 頁" } },
  { key: "test-us3", role: "mother", basis: "ga", type: "test", title: "第 3 次產檢超音波", hint: "32 週後", start: W(32), end: W(36, 6), auto: true, source: { id: MOM, page: "第 9 頁" } },
  { key: "test-gbs", role: "mother", basis: "ga", type: "test", title: "孕婦乙型鏈球菌篩檢", hint: "35～37 週", start: W(35), end: W(37, 6), auto: true, source: { id: MOM, page: "第 9 頁" } },
  { key: "mvax-tdap", role: "mother", basis: "ga", type: "vaccine", title: "Tdap 疫苗（自費）", hint: "27～36 週", start: W(27), end: W(36, 6), auto: false, source: { id: MOM, page: "第 52 頁" } },
  { key: "mvax-rsv", role: "mother", basis: "ga", type: "vaccine", title: "RSV 疫苗（自費）", hint: "28～36 週", start: W(28), end: W(36, 6), auto: false, source: { id: MOM, page: "第 52 頁" } },
  { key: "mvax-flu", role: "mother", basis: "ga", type: "vaccine", title: "流感疫苗", hint: "任何孕期，每年 10 月起", start: 0, end: W(42), auto: false, source: { id: MOM, page: "第 51 頁" }, startToday: true },

  { key: "pp-1", role: "mother", basis: "pp", type: "postpartum", title: "產後健康照護第 1 次", hint: "產後 1～2 週（1 個月內）", start: 7, end: 30, auto: true, source: { id: MOM, page: "第 18 頁" } },
  { key: "pp-2", role: "mother", basis: "pp", type: "postpartum", title: "產後健康照護第 2 次", hint: "產後 6～8 週（3 個月內）", start: 42, end: 92, auto: true, source: { id: MOM, page: "第 18 頁" } },

  // Baby: newborn screening and stool card (兒童健康手冊)
  { key: "screen-metabolic", role: "baby", basis: "age", type: "screen", title: "新生兒先天性代謝異常疾病篩檢", hint: "出生滿 48 小時且哺乳滿 24 小時", start: { d: 2 }, end: { m: 1 }, auto: true, source: { id: CHILD, page: "手冊前頁紀錄表" } },
  { key: "screen-hearing", role: "baby", basis: "age", type: "screen", title: "新生兒聽力篩檢", hint: "建議 72 小時內（3 個月內補助）", start: { d: 0 }, end: { m: 3 }, auto: true, source: { id: CHILD, page: "手冊前頁紀錄表" } },
  { key: "screen-stool-1", role: "baby", basis: "age", type: "screen", title: "大便卡比對第 1 次", hint: "出生滿 1 週內", start: { d: 0 }, end: { d: 7 }, auto: true, source: { id: CHILD, page: "第 20 頁、手冊前頁紀錄表" } },
  { key: "screen-stool-2", role: "baby", basis: "age", type: "screen", title: "大便卡比對第 2 次", hint: "出生滿 1 個月（B 肝第二劑時）", start: { m: 1 }, end: { m: 1, d: 14 }, auto: true, source: { id: CHILD, page: "第 20 頁、手冊前頁紀錄表" } },
  { key: "screen-hip", role: "baby", basis: "age", type: "screen", title: "髖關節篩檢", hint: "出生 6 個月前", start: { d: 0 }, end: { m: 6 }, auto: true, source: { id: CHILD, page: "手冊前頁紀錄表" } },

  // Baby: preventive care visits (兒童預防保健)
  ...[
    [1, { d: 14 }, { m: 2 }, "出生後 2 週～2 個月"],
    [2, { m: 2 }, { m: 4 }, "2～4 個月"],
    [3, { m: 4 }, { m: 6 }, "4～6 個月"],
    [4, { m: 6 }, { m: 12 }, "6 個月～1 歲"],
    [5, { m: 12 }, { m: 18 }, "1～1 歲半"],
    [6, { m: 18 }, { m: 24 }, "1 歲半～2 歲"],
    [7, { m: 24 }, { m: 36 }, "2～3 歲"],
    [8, { m: 36 }, { m: 60 }, "3～5 歲"],
    [9, { m: 60 }, { m: 84, d: -1 }, "5 歲～未滿 7 歲"],
  ].map(([n, start, end, hint]) => ({
    key: `wellchild-${n}`,
    role: "baby",
    basis: "age",
    type: "wellchild",
    title: `兒童預防保健第 ${n} 次`,
    hint,
    start,
    end,
    auto: true,
    source: { id: CHILD, page: "第 6～7 頁" },
  })),
  ...[
    [1, { m: 6 }, { m: 10 }, "6～10 個月"],
    [2, { m: 10 }, { m: 18 }, "10 個月～1 歲半"],
    [3, { m: 18 }, { m: 24 }, "1 歲半～2 歲"],
    [4, { m: 24 }, { m: 36 }, "2～3 歲"],
    [5, { m: 36 }, { m: 60 }, "3～5 歲"],
    [6, { m: 60 }, { m: 84, d: -1 }, "5 歲～未滿 7 歲"],
  ].map(([n, start, end, hint]) => ({
    key: `devscreen-${n}`,
    role: "baby",
    basis: "age",
    type: "screen",
    title: `兒童發展篩檢第 ${n} 次`,
    hint,
    start,
    end,
    auto: true,
    source: { id: CHILD, page: "手冊前頁就醫憑證" },
  })),

  // Baby: routine vaccines (疾管署 115.09 版)
  ...[
    ["hepb", 1, "B 型肝炎疫苗", { d: 0 }, { d: 0 }, "出生 24 小時內儘速"],
    ["hepb", 2, "B 型肝炎疫苗", { m: 1 }, { m: 1, d: 13 }, "出生滿 1 個月"],
    ["hepb", 3, "B 型肝炎疫苗", { m: 6 }, { m: 6, d: 13 }, "出生滿 6 個月"],
    ["dtap-hib-ipv", 1, "五合一疫苗", { m: 2 }, { m: 2, d: 13 }, "出生滿 2 個月"],
    ["dtap-hib-ipv", 2, "五合一疫苗", { m: 4 }, { m: 4, d: 13 }, "出生滿 4 個月"],
    ["dtap-hib-ipv", 3, "五合一疫苗", { m: 6 }, { m: 6, d: 13 }, "出生滿 6 個月"],
    ["dtap-hib-ipv", 4, "五合一疫苗", { m: 18 }, { m: 18, d: 13 }, "出生滿 18 個月"],
    ["pcv13", 1, "13 價肺炎鏈球菌疫苗", { m: 2 }, { m: 2, d: 13 }, "出生滿 2 個月"],
    ["pcv13", 2, "13 價肺炎鏈球菌疫苗", { m: 4 }, { m: 4, d: 13 }, "出生滿 4 個月"],
    ["pcv13", 3, "13 價肺炎鏈球菌疫苗", { m: 12 }, { m: 15 }, "出生滿 12～15 個月"],
    ["bcg", 1, "卡介苗", { m: 5 }, { m: 8 }, "出生滿 5 個月（建議 5～8 個月）"],
    ["var", 1, "水痘疫苗", { m: 12 }, { m: 12, d: 13 }, "出生滿 12 個月"],
    ["mmr", 1, "MMR 疫苗", { m: 12 }, { m: 12, d: 13 }, "出生滿 12 個月"],
    ["je", 1, "日本腦炎疫苗", { m: 15 }, { m: 15, d: 13 }, "出生滿 15 個月"],
    ["hepa", 1, "A 型肝炎疫苗（公費依資格）", { m: 18 }, { m: 18, d: 13 }, "出生滿 18 個月"],
    ["je", 2, "日本腦炎疫苗", { m: 27 }, { m: 27, d: 13 }, "出生滿 27 個月"],
    ["hepa", 2, "A 型肝炎疫苗（公費依資格）", { m: 27 }, { m: 27, d: 13 }, "出生滿 27 個月"],
    ["mmr", 2, "MMR 疫苗", { m: 60 }, { m: 84, d: -1 }, "滿 5 歲至入國小前"],
    ["dtap-ipv", 1, "DTaP-IPV 疫苗", { m: 60 }, { m: 84, d: -1 }, "滿 5 歲至入國小前"],
    ["flu", 1, "流感疫苗（首次）", { m: 6 }, { m: 12 }, "滿 6 個月起，每年 10 月起；初次接種需 2 劑，間隔 4 週以上"],
  ].map(([code, dose, name, start, end, hint]) => ({
    key: `vax-${code}-${dose}`,
    role: "baby",
    basis: "age",
    type: "vaccine",
    title: `${name}${["hepb", "dtap-hib-ipv", "pcv13", "mmr", "je", "hepa"].includes(code) ? ` 第 ${dose} 劑` : ""}`,
    hint,
    start,
    end,
    auto: true,
    vaccine: { code, dose },
    source: { id: VAX, page: "115.09 版時程表" },
  })),
];

export const VACCINES = [
  { code: "hepb", name: "B 型肝炎疫苗", doses: 3 },
  { code: "dtap-hib-ipv", name: "五合一疫苗（DTaP-Hib-IPV）", doses: 4 },
  { code: "pcv13", name: "13 價肺炎鏈球菌疫苗", doses: 3 },
  { code: "bcg", name: "卡介苗", doses: 1 },
  { code: "var", name: "水痘疫苗", doses: 1 },
  { code: "mmr", name: "MMR 疫苗", doses: 2 },
  { code: "je", name: "日本腦炎疫苗（活性減毒）", doses: 2 },
  { code: "hepa", name: "A 型肝炎疫苗", doses: 2 },
  { code: "dtap-ipv", name: "DTaP-IPV 疫苗", doses: 1 },
  { code: "flu", name: "流感疫苗", doses: 99 },
  { code: "rotavirus", name: "輪狀病毒疫苗（自費）", doses: 3 },
  { code: "other", name: "其他疫苗", doses: 99 },
];

export function vaccineName(code) {
  return VACCINES.find((v) => v.code === code)?.name ?? code;
}

export function ruleByKey(key) {
  return RULES.find((r) => r.key === key) ?? null;
}

function ageDate(birth, spec) {
  return addDays(addMonths(birth, spec.m ?? 0), spec.d ?? 0);
}

// Suggested window for a rule, or null when the anchor date is missing.
export function ruleWindow(rule, anchors) {
  if (rule.basis === "ga") {
    if (!isValidDate(anchors.edd)) return null;
    return { start: dateAtGA(anchors.edd, 0, rule.start), end: dateAtGA(anchors.edd, 0, rule.end) };
  }
  if (rule.basis === "pp") {
    if (!isValidDate(anchors.deliveryDate)) return null;
    return { start: addDays(anchors.deliveryDate, rule.start), end: addDays(anchors.deliveryDate, rule.end) };
  }
  if (rule.basis === "age") {
    if (!isValidDate(anchors.birthDate)) return null;
    return { start: ageDate(anchors.birthDate, rule.start), end: ageDate(anchors.birthDate, rule.end) };
  }
  return null;
}

export function todoId(subjectId, ruleKey) {
  return `${subjectId}:${ruleKey}`;
}

const UNTOUCHED = new Set(["suggested", "past"]);

// Builds or refreshes suggested to-dos. Completed, booked and cancelled items
// are never moved; their recorded dates stay as the family entered them.
// startedOn: the day the family began using the app. Windows that ended before
// it are marked "past" (can be back-filled) instead of overdue.
export function planTodos({ family, people, todos, today, extraKeys = [] }) {
  const byId = new Map(todos.map((t) => [t.id, t]));
  const out = [];
  let recalculated = 0;
  let kept = 0;
  const startedOn = family.startedOn || today;

  const subjects = [];
  const mother = people.find((p) => p.role === "mother");
  if (mother) {
    const anchors = { edd: family.edd, deliveryDate: family.deliveryDate };
    const allowPreg = !!family.edd;
    subjects.push({ person: mother, anchors, allow: (r) => (r.basis === "ga" ? allowPreg && !family.deliveryDate : r.basis === "pp" ? !!family.deliveryDate : false) });
  }
  for (const baby of people.filter((p) => p.role === "baby")) {
    subjects.push({ person: baby, anchors: { birthDate: baby.birthDate }, allow: (r) => r.basis === "age" });
  }

  for (const { person, anchors, allow } of subjects) {
    for (const rule of RULES) {
      if (rule.role !== person.role || !allow(rule)) continue;
      const id = todoId(person.id, rule.key);
      const existing = byId.get(id);
      if (!rule.auto && !existing && !extraKeys.includes(id)) continue;
      const win = ruleWindow(rule, anchors);
      if (!win) continue;
      if (rule.startToday && diffDays(win.start, today) < 0) win.start = today;
      const status = diffDays(win.end, startedOn) < 0 ? "past" : "suggested";
      if (!existing) {
        out.push({
          id,
          subjectId: person.id,
          ruleKey: rule.key,
          type: rule.type,
          title: rule.title,
          hint: rule.hint,
          suggestStart: win.start,
          suggestEnd: win.end,
          status,
          createdOn: today,
        });
        continue;
      }
      if (UNTOUCHED.has(existing.status)) {
        const moved = existing.suggestStart !== win.start || existing.suggestEnd !== win.end;
        if (moved) recalculated += 1;
        out.push({ ...existing, suggestStart: win.start, suggestEnd: win.end, status, title: rule.title, hint: rule.hint });
      } else {
        kept += 1;
        out.push(existing);
      }
      byId.delete(id);
    }
  }
  // Custom to-dos and items whose rule no longer applies stay as they are.
  for (const [id, t] of byId) {
    if (!out.some((o) => o.id === id)) out.push(t);
  }
  return { todos: out, recalculated, kept };
}

// Display bucket for a to-do on a given day.
export function todoState(todo, today) {
  if (todo.status === "done") return "done";
  if (todo.status === "cancelled") return "cancelled";
  if (todo.status === "booked") {
    return diffDays(todo.bookedDate, today) < 0 ? "confirm" : "booked";
  }
  if (todo.status === "past") return "past";
  if (todo.suggestEnd && diffDays(todo.suggestEnd, today) < 0) return "overdue";
  if (todo.suggestStart && diffDays(todo.suggestStart, today) <= 14) return "soon";
  return "later";
}

export const STATE_LABEL = {
  overdue: "建議期已過",
  soon: "建議安排",
  later: "建議安排",
  booked: "已預約",
  confirm: "待確認是否完成",
  done: "已完成",
  past: "開始使用前（可補登）",
  cancelled: "已取消",
};

export function todoDate(todo) {
  if (todo.status === "booked" || todo.status === "done") return todo.bookedDate || todo.doneDate || todo.suggestStart;
  return todo.suggestStart;
}
