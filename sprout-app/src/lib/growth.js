import { ageParts, diffDays, isValidDate } from "./dates";

// Growth-chart maths for the WHO 0–5 standard used by the 兒童健康手冊.
// The WHO LMS table (WHO_URL, ~30 KB) is loaded once on first use: daily values
// to day 59, then every 7 days, then every 14 days after 2 years; linear
// interpolation stays within 0.1 percentile points of WHO's full daily table.
// Length: up to day 730 lying length, from day 731 standing height.
// This only places a measurement among the chart's percentile lines; the
// words shown with it are the handbook's own (p.11). It does not judge health.

export const MAX_DAY = 1856; // 5 years
export const TERM_WEEKS = 40;

export const WHO_URL = "https://media.base44.com/files/public/6b03d4092f1493715a7d2e40/877738a8a4e4f20033fd9162b47c8af8_who-growth-0-5.json";

let DATA = null;
let loading = null;
export function setWhoData(d) {
  DATA = d;
}
export function whoReady() {
  return !!DATA;
}
export function loadWho() {
  if (DATA) return Promise.resolve(DATA);
  loading ??= fetch(WHO_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((d) => {
      if (!Array.isArray(d.DAYS) || d.WFA_BOY?.length !== d.DAYS.length * 3) throw new Error("資料格式不符");
      DATA = d;
      return d;
    })
    .catch((e) => {
      loading = null;
      throw e;
    });
  return loading;
}

export const INDICATORS = {
  weight: { key: "weight", label: "體重", unit: "kg", field: "weight", birthField: "birthWeight", tables: { boy: "WFA_BOY", girl: "WFA_GIRL" } },
  length: { key: "length", label: "身長／身高", unit: "cm", field: "length", birthField: "birthLength", tables: { boy: "LHFA_BOY", girl: "LHFA_GIRL" } },
  head: { key: "head", label: "頭圍", unit: "cm", field: "head", birthField: "birthHead", tables: { boy: "HCFA_BOY", girl: "HCFA_GIRL" } },
};

export function tableOf(ind, sex) {
  return DATA?.[ind.tables[sex]] ?? null;
}

// The five lines printed on the handbook chart.
export const LINES = [
  { p: 3, z: -1.880794 },
  { p: 15, z: -1.036433 },
  { p: 50, z: 0 },
  { p: 85, z: 1.036433 },
  { p: 97, z: 1.880794 },
];

export const BAND_LABEL = ["低於第 3 百分位", "第 3～15 百分位之間", "第 15～50 百分位之間", "第 50～85 百分位之間", "第 85～97 百分位之間", "高於第 97 百分位"];

// LMS at an age in days (linear between sampled days).
export function lmsAt(table, day) {
  if (!table || !(day >= 0 && day <= MAX_DAY)) return null;
  const DAYS = DATA.DAYS;
  let lo = 0;
  let hi = DAYS.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (DAYS[mid] <= day) lo = mid;
    else hi = mid;
  }
  if (DAYS[lo] === day || lo === hi) return table.slice(lo * 3, lo * 3 + 3);
  const t = (day - DAYS[lo]) / (DAYS[hi] - DAYS[lo]);
  return [0, 1, 2].map((k) => table[lo * 3 + k] * (1 - t) + table[hi * 3 + k] * t);
}

export function zScore(x, [L, M, S]) {
  return L === 0 ? Math.log(x / M) / S : ((x / M) ** L - 1) / (L * S);
}

export function valueAtZ([L, M, S], z) {
  return L === 0 ? M * Math.exp(S * z) : M * (1 + L * S * z) ** (1 / L);
}

// Standard normal CDF via the Numerical Recipes erfc approximation (|err| < 1.2e-7).
export function normalCdf(z) {
  const t = 1 / (1 + 0.5 * Math.abs(z) / Math.SQRT2);
  const x = Math.abs(z) / Math.SQRT2;
  const y =
    t *
    Math.exp(
      -x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return z >= 0 ? 1 - y / 2 : y / 2;
}

export function bandOf(z) {
  let b = 0;
  for (const l of LINES) if (z >= l.z) b += 1;
  return b; // 0..5
}

// Age used on the chart. The handbook asks for corrected age for babies born
// early (每次健檢紀錄：「早產兒請用矯正年齡」); we correct until 2 years.
export function chartDay(baby, date) {
  if (!isValidDate(baby?.birthDate) || !isValidDate(date)) return null;
  const days = diffDays(date, baby.birthDate);
  if (days < 0) return null;
  const gw = Number(baby.gestWeeks);
  if (gw >= 20 && gw < 37 && days < 730) {
    const corrected = days - Math.round((TERM_WEEKS - gw) * 7);
    return { day: corrected, actual: days, corrected: true };
  }
  return { day: days, actual: days, corrected: false };
}

export function formatAgeDays(day) {
  if (day < 0) return "未滿預產期";
  if (day < 60) return `${day} 天`;
  const months = Math.floor(day / 30.4375);
  if (months < 24) return `${months} 個月`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} 歲 ${m} 個月` : `${y} 歲`;
}

// Age shown next to a measurement: calendar months like the rest of the app;
// corrected ages are counted from the due date.
export function ageLabel(baby, point) {
  if (point.birth) return "出生";
  if (point.corrected) return `${formatAgeDays(point.day)}（矯正）`;
  const a = ageParts(baby.birthDate, point.date);
  if (a.totalDays < 60) return `${a.totalDays} 天`;
  if (a.months < 24) return `${a.months} 個月`;
  return a.months % 12 ? `${a.years} 歲 ${a.months % 12} 個月` : `${a.years} 歲`;
}

// Every plotted measurement for one indicator: birth data + growth records.
export function growthPoints(baby, records, indicatorKey) {
  const ind = INDICATORS[indicatorKey];
  const sex = baby?.sex;
  if (!ind || (sex !== "boy" && sex !== "girl") || !DATA) return [];
  const table = tableOf(ind, sex);
  const raw = [];
  const birthVal = Number(baby[ind.birthField]);
  if (birthVal > 0) raw.push({ id: "birth", date: baby.birthDate, value: birthVal, birth: true });
  for (const r of records) {
    if (r.subjectId !== baby.id || r.kind !== "growth") continue;
    const v = Number(r.fields?.[ind.field]);
    if (v > 0) raw.push({ id: r.id, date: r.date, value: v, birth: false });
  }
  const out = [];
  for (const p of raw) {
    const age = chartDay(baby, p.date);
    if (!age || age.day < 0 || age.day > MAX_DAY) continue;
    const lms = lmsAt(table, age.day);
    const z = zScore(p.value, lms);
    out.push({ ...p, ...age, z, pct: normalCdf(z) * 100, band: bandOf(z) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.day - b.day);
}

export function pctText(pct) {
  if (pct < 1) return "低於第 1 百分位";
  if (pct > 99) return "高於第 99 百分位";
  return `約第 ${Math.round(pct)} 百分位`;
}

// What the handbook (p.11) says about the latest point and the line joining
// the points. Comparisons skip measurements from the first 2 weeks.
export function describe(points) {
  if (!points.length) return null;
  const latest = points[points.length - 1];
  const inRange = latest.band >= 1 && latest.band <= 4;
  let crossing = null;
  const later = points.filter((p) => p.day >= 14);
  for (let i = later.length - 1; i > 0; i--) {
    const a = later[i - 1];
    const b = later[i];
    if (Math.abs(b.band - a.band) >= 2) {
      crossing = { from: a, to: b, up: b.band > a.band };
      break;
    }
  }
  return { latest, inRange, crossing };
}

export const HANDBOOK_TEXT = {
  inRange: "寶寶的生長指標落在第 3-97 百分位之間都屬正常範圍。",
  outOfRange: "若生長指標超過第 97 百分位或低於第 3 百分位就可能有過高或低的情形！",
  crossing: "兒童的成長是連續性的，生長連線應依循生長曲線的走勢；如果高於或低於二個曲線區間時，需要請醫師評估檢查。",
  disclaimer: "檢測結果僅供參考，如有生長發育之疑義，請逕洽兒科或家醫科醫師。",
};
