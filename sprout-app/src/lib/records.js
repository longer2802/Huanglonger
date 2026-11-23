import { VACCINES } from "./rules";

// Every record type the family can keep. Fields are all optional unless
// "required"; numbers keep their unit next to them and are never interpreted.
// who: which people the type applies to ("mother", "baby" or both).
const NOTE = { name: "note", label: "自訂備註", type: "textarea" };

export const KINDS = {
  prenatal: {
    label: "產檢",
    icon: "Stethoscope",
    who: ["mother"],
    fields: [
      { name: "clinic", label: "院所", type: "text" },
      { name: "weight", label: "體重", type: "number", unit: "kg", step: "0.1" },
      { name: "bpSys", label: "血壓（收縮壓）", type: "number", unit: "mmHg" },
      { name: "bpDia", label: "血壓（舒張壓）", type: "number", unit: "mmHg" },
      { name: "tests", label: "檢查項目", type: "text", placeholder: "例：超音波、血液常規" },
      { name: "results", label: "檢查結果（照報告抄寫）", type: "textarea" },
      { name: "symptoms", label: "症狀", type: "textarea" },
      { name: "doctorNotes", label: "醫師交代", type: "textarea" },
      { name: "questions", label: "想問醫師的問題", type: "textarea" },
      { name: "nextVisit", label: "下次回診日期", type: "date" },
      NOTE,
    ],
  },
  postpartum: {
    label: "產後",
    icon: "HeartHandshake",
    who: ["mother"],
    fields: [
      { name: "clinic", label: "回診院所", type: "text" },
      { name: "body", label: "身體感受", type: "textarea" },
      { name: "mood", label: "心情", type: "select", options: ["很好", "還可以", "有點低落", "很低落", "不想選"] },
      { name: "moodNote", label: "心情補充", type: "textarea" },
      { name: "feeding", label: "哺乳狀況", type: "textarea" },
      { name: "doctorNotes", label: "醫師交代", type: "textarea" },
      { name: "nextVisit", label: "下次回診日期", type: "date" },
      NOTE,
    ],
  },
  visit: {
    label: "就醫",
    icon: "Hospital",
    who: ["mother", "baby"],
    fields: [
      { name: "clinic", label: "院所", type: "text" },
      { name: "reason", label: "就醫原因", type: "text" },
      { name: "symptoms", label: "所見症狀", type: "textarea" },
      { name: "diagnosis", label: "醫師診斷紀錄", type: "textarea" },
      { name: "orders", label: "醫師開立的用藥與照護指示", type: "textarea", placeholder: "照藥袋與醫囑抄寫" },
      { name: "followUp", label: "複診日期", type: "date" },
      NOTE,
    ],
  },
  vaccine: {
    label: "疫苗接種",
    icon: "Syringe",
    who: ["mother", "baby"],
    fields: [
      { name: "vaccineCode", label: "疫苗品項", type: "select", required: true, options: VACCINES.map((v) => ({ value: v.code, label: v.name })) },
      { name: "vaccineOther", label: "其他疫苗名稱", type: "text", showIf: { vaccineCode: "other" } },
      { name: "dose", label: "劑次", type: "number", unit: "劑", required: true, step: "1", min: 1 },
      { name: "clinic", label: "接種院所", type: "text" },
      { name: "observation", label: "接種後觀察", type: "textarea" },
      NOTE,
    ],
  },
  injection: {
    label: "其他注射",
    icon: "Pipette",
    who: ["mother", "baby"],
    fields: [
      { name: "name", label: "注射名稱", type: "text", required: true },
      { name: "clinic", label: "院所", type: "text" },
      { name: "reason", label: "原因", type: "text" },
      { name: "observation", label: "注射後觀察", type: "textarea" },
      NOTE,
    ],
  },
  growth: {
    label: "身長體重頭圍",
    icon: "Ruler",
    who: ["baby"],
    fields: [
      { name: "length", label: "身長", type: "number", unit: "cm", step: "0.1" },
      { name: "weight", label: "體重", type: "number", unit: "kg", step: "0.01" },
      { name: "head", label: "頭圍", type: "number", unit: "cm", step: "0.1" },
      NOTE,
    ],
  },
  temperature: {
    label: "體溫",
    icon: "Thermometer",
    who: ["mother", "baby"],
    fields: [
      { name: "value", label: "體溫", type: "number", unit: "°C", step: "0.1", required: true },
      { name: "site", label: "量測部位", type: "select", options: ["耳溫", "額溫", "腋溫", "肛溫", "口溫"] },
      NOTE,
    ],
  },
  feeding: {
    label: "喝奶／哺乳",
    icon: "Milk",
    who: ["baby"],
    fields: [
      { name: "method", label: "方式", type: "select", options: ["親餵", "瓶餵母乳", "配方奶", "混合"] },
      { name: "amount", label: "奶量", type: "number", unit: "ml" },
      { name: "minutes", label: "時間長度", type: "number", unit: "分鐘" },
      NOTE,
    ],
  },
  sleep: {
    label: "睡眠",
    icon: "Moon",
    who: ["baby"],
    fields: [
      { name: "endTime", label: "醒來時間", type: "time" },
      { name: "place", label: "睡眠地點", type: "text" },
      NOTE,
    ],
  },
  diaper: {
    label: "尿布／便便",
    icon: "Baby",
    who: ["baby"],
    fields: [
      { name: "type", label: "類型", type: "select", options: ["濕尿布", "便便", "都有"] },
      { name: "stoolColor", label: "大便顏色（對照黃金九色卡號碼）", type: "select", options: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "不確定"], help: "兒童健康手冊第 20 頁：7～9 號為正常；1～6 號為不正常，請帶寶寶就醫。" },
      { name: "texture", label: "形狀", type: "select", options: ["稀水狀", "糊狀", "條狀", "其他"] },
      NOTE,
    ],
  },
  solids: {
    label: "副食品",
    icon: "Soup",
    who: ["baby"],
    fields: [
      { name: "food", label: "食物", type: "text", required: true },
      { name: "amount", label: "份量", type: "text" },
      { name: "reaction", label: "吃後反應", type: "textarea" },
      NOTE,
    ],
  },
  milestone: {
    label: "發展里程碑",
    icon: "Sparkles",
    who: ["baby"],
    fields: [
      { name: "title", label: "第一次做到什麼？", type: "text", required: true, placeholder: "例：第一次翻身" },
      NOTE,
    ],
  },
  symptom: {
    label: "症狀",
    icon: "Activity",
    who: ["mother", "baby"],
    fields: [
      { name: "description", label: "觀察到的狀況", type: "textarea", required: true },
      NOTE,
    ],
  },
  custom: {
    label: "自訂事件",
    icon: "PenLine",
    who: ["mother", "baby"],
    fields: [
      { name: "title", label: "標題", type: "text", required: true },
      NOTE,
    ],
  },
};

export const QUICK_KINDS = ["feeding", "diaper", "sleep", "temperature", "growth", "milestone"];

export function kindsFor(person) {
  if (!person) return [];
  return Object.entries(KINDS)
    .filter(([key, k]) => k.who.includes(person.role) && !(key === "prenatal" && person.pregnancyOver))
    .map(([key, k]) => ({ key, ...k }));
}

// One line summary shown in the timeline. Values are shown as written.
export function recordSummary(record) {
  const f = record.fields || {};
  const unit = (n, u) => (f[n] !== undefined && f[n] !== "" ? `${f[n]} ${u}` : null);
  switch (record.kind) {
    case "prenatal":
      return [f.clinic, unit("weight", "kg"), f.bpSys && f.bpDia ? `${f.bpSys}/${f.bpDia} mmHg` : null, f.tests].filter(Boolean).join("・");
    case "postpartum":
      return [f.clinic, f.mood && `心情：${f.mood}`].filter(Boolean).join("・");
    case "visit":
      return [f.clinic, f.reason].filter(Boolean).join("・");
    case "vaccine": {
      const name = f.vaccineCode === "other" ? f.vaccineOther || "其他疫苗" : VACCINES.find((v) => v.code === f.vaccineCode)?.name;
      return [name, f.dose && `第 ${f.dose} 劑`, f.clinic].filter(Boolean).join("・");
    }
    case "injection":
      return [f.name, f.clinic].filter(Boolean).join("・");
    case "growth":
      return [unit("length", "cm"), unit("weight", "kg"), f.head ? `頭圍 ${f.head} cm` : null].filter(Boolean).join("・");
    case "temperature":
      return [unit("value", "°C"), f.site].filter(Boolean).join("・");
    case "feeding":
      return [f.method, unit("amount", "ml"), unit("minutes", "分鐘")].filter(Boolean).join("・");
    case "sleep":
      return [record.time && f.endTime ? `${record.time}～${f.endTime}` : null, f.place].filter(Boolean).join("・");
    case "diaper":
      return [f.type, f.stoolColor && `色卡 ${f.stoolColor}`, f.texture].filter(Boolean).join("・");
    case "solids":
      return [f.food, f.amount].filter(Boolean).join("・");
    case "milestone":
    case "custom":
      return f.title || "";
    case "symptom":
      return f.description || "";
    default:
      return "";
  }
}

// Validates a record before saving. Returns a list of problems.
export function validateRecord(record, { records, isValidDate, today, diffDays }) {
  const errors = [];
  const kind = KINDS[record.kind];
  if (!kind) return ["未知的紀錄類型"];
  if (!isValidDate(record.date)) errors.push("請填寫有效的日期。");
  else if (diffDays(record.date, today) > 0 && !["prenatal", "postpartum", "visit"].includes(record.kind)) {
    errors.push("這類紀錄的日期不能晚於今天（預約請到行事曆）。");
  }
  for (const field of kind.fields) {
    const v = record.fields?.[field.name];
    if (field.required && (v === undefined || v === null || String(v).trim() === "")) errors.push(`請填寫「${field.label}」。`);
    if (field.type === "number" && v !== undefined && v !== "" && !Number.isFinite(Number(v))) errors.push(`「${field.label}」要填數字。`);
    if (field.type === "date" && v && !isValidDate(v)) errors.push(`「${field.label}」不是有效的日期。`);
  }
  if (record.kind === "vaccine" && record.fields?.vaccineCode && record.fields.vaccineCode !== "other") {
    const dup = records.find(
      (r) =>
        r.id !== record.id &&
        r.kind === "vaccine" &&
        r.subjectId === record.subjectId &&
        r.fields?.vaccineCode === record.fields.vaccineCode &&
        Number(r.fields?.dose) === Number(record.fields.dose),
    );
    if (dup) errors.push(`這位家人已經登記過同一品項的第 ${record.fields.dose} 劑（${dup.date}），請確認是否重複。`);
  }
  return errors;
}
