import { PREGNANCY_DANGER_SIGNS } from "./content";

// Check-in questions ("最近有出現以下狀況嗎？"). Each stage asks once per person;
// the answer is stored with the question version, so a later wording change
// asks again only if the version changes.
// "action" is what the official source itself says to do.
export const CARE_STAGES = [
  {
    key: "preg-early",
    version: 1,
    role: "mother",
    when: { phase: "preg", fromWeek: 0, toWeek: 12 },
    title: "懷孕初期關懷",
    items: PREGNANCY_DANGER_SIGNS.filter((s) => !s.startsWith("胎動")),
    action: "手冊寫明：懷孕期間出現任何一項，應立即就醫。",
    urgent: true,
    source: { id: "hpa-mom-2026-06", page: "第 13 頁" },
  },
  {
    key: "preg-mid",
    version: 1,
    role: "mother",
    when: { phase: "preg", fromWeek: 13, toWeek: 28 },
    title: "懷孕中期關懷",
    items: PREGNANCY_DANGER_SIGNS,
    action: "手冊寫明：懷孕期間出現任何一項，應立即就醫。",
    urgent: true,
    source: { id: "hpa-mom-2026-06", page: "第 13 頁" },
  },
  {
    key: "preg-late",
    version: 1,
    role: "mother",
    when: { phase: "preg", fromWeek: 29, toWeek: 45 },
    title: "懷孕後期關懷",
    items: PREGNANCY_DANGER_SIGNS,
    action: "手冊寫明：懷孕期間出現任何一項，應立即就醫。",
    urgent: true,
    source: { id: "hpa-mom-2026-06", page: "第 13 頁" },
  },
  {
    key: "baby-newborn",
    version: 1,
    role: "baby",
    when: { phase: "age", fromDay: 0, toDay: 60 },
    title: "新生兒關懷",
    items: [
      "大便顏色像黃金九色卡 1～6 號",
      "出生滿 14 天仍有黃疸，或皮膚、眼白變黃",
    ],
    action: "手冊寫明：出生 14 天仍有黃疸或大便顏色不正常，要帶回院所檢驗。",
    urgent: true,
    source: { id: "hpa-child-2026-06", page: "第 20～22 頁" },
  },
];

// Daily mood check for the mother, from the handbook's 心情溫度計. It pops up
// once a day; each day's answer is stored under its own date.
export const MOOD_DAILY = {
  key: "mood",
  version: 1,
  role: "mother",
  title: "今日心情關懷",
  items: [
    "過去一個月，常被情緒低落、憂鬱或對未來焦慮所困擾",
    "過去一個月，因對事物失去興趣或無法專心而困擾",
  ],
  action: "手冊建議：任一項為「是」，再用「愛丁堡產後憂鬱量表」自我篩檢，並可和產檢或產後照護的醫護人員聊聊。",
  urgent: false,
  source: { id: "hpa-mom-2026-06", page: "第 31 頁（心情溫度計）" },
};

export function moodStage(date) {
  return { ...MOOD_DAILY, key: `mood-${date}` };
}

// The stage that applies right now for one person, or null.
export function currentCareStage(person, ctx) {
  for (const stage of CARE_STAGES) {
    if (stage.role !== person.role) continue;
    const w = stage.when;
    if (w.phase === "preg" && ctx.pregWeek != null && !ctx.born && ctx.pregWeek >= w.fromWeek && ctx.pregWeek <= w.toWeek) return stage;
    if (w.phase === "pp" && ctx.ppDay != null && ctx.ppDay >= w.fromDay && ctx.ppDay <= w.toDay) return stage;
    if (w.phase === "age" && ctx.ageDays != null && ctx.ageDays >= w.fromDay && ctx.ageDays <= w.toDay) return stage;
  }
  return null;
}

export function answerId(subjectId, stage) {
  return `${subjectId}:${stage.key}:v${stage.version}`;
}

export const ANSWER_LABEL = {
  none: "目前沒有這些狀況",
  yes: "有出現",
  unsure: "我不確定",
  later: "稍後處理",
};
