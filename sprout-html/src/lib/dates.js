// Every date in the app is a plain "YYYY-MM-DD" value read in Taiwan time.
// Arithmetic runs on whole UTC days, so there are no DST or clock-hour slips.

const DAY = 86400000;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const TZ = "Asia/Taipei";

export function isValidDate(value) {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || d < 1) return false;
  const back = new Date(Date.UTC(y, mo - 1, d));
  return back.getUTCMonth() === mo - 1 && back.getUTCDate() === d;
}

export function toDayNum(value) {
  const m = DATE_RE.exec(value);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY;
}

export function fromDayNum(n) {
  const d = new Date(n * DAY);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const da = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

// Today's date in Taiwan, whatever the phone's own time zone is.
export function todayTW(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function nowTimeTW(now = new Date()) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
}

export function addDays(value, n) {
  return fromDayNum(toDayNum(value) + n);
}

// a - b in days.
export function diffDays(a, b) {
  return toDayNum(a) - toDayNum(b);
}

export function addMonths(value, months) {
  const [y, m, d] = value.split("-").map(Number);
  const total = (m - 1) + months;
  const ny = y + Math.floor(total / 12);
  const nm = ((total % 12) + 12) % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fromDayNum(Date.UTC(ny, nm, Math.min(d, last)) / DAY);
}

// Calendar age: whole months, then the days left over.
export function ageParts(birth, today) {
  const days = diffDays(today, birth);
  if (days < 0) return { totalDays: days, months: 0, days: 0, years: 0 };
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 0) months = 0;
  let anchor = addMonths(birth, months);
  if (diffDays(today, anchor) < 0) {
    months -= 1;
    anchor = addMonths(birth, months);
  }
  return { totalDays: days, months, days: diffDays(today, anchor), years: Math.floor(months / 12) };
}

export function formatAge(parts) {
  if (parts.totalDays < 0) return "尚未出生";
  if (parts.months === 0) return `出生第 ${parts.totalDays} 天`;
  if (parts.months < 24) return `${parts.months} 個月 ${parts.days} 天`;
  const y = Math.floor(parts.months / 12);
  const m = parts.months % 12;
  return m ? `${y} 歲 ${m} 個月` : `${y} 歲`;
}

const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

export function formatDate(value, { weekday = false } = {}) {
  if (!isValidDate(value)) return "—";
  const [y, m, d] = value.split("-").map(Number);
  const base = `${y}/${m}/${d}`;
  if (!weekday) return base;
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${base}（${WEEKDAY[w]}）`;
}

export function isValidTime(value) {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// ---------- Pregnancy ----------

export const TERM_DAYS = 280;
export const MAX_GA_DAYS = 44 * 7; // past this the dates are almost certainly wrong

// Due date from whichever basis the parents picked.
export function computeEdd(preg) {
  if (!preg) return null;
  if (preg.basis === "edd") return isValidDate(preg.edd) ? preg.edd : null;
  if (preg.basis === "lmp") return isValidDate(preg.lmp) ? addDays(preg.lmp, TERM_DAYS) : null;
  if (preg.basis === "ga") {
    if (!isValidDate(preg.gaDate)) return null;
    const total = Number(preg.gaWeeks) * 7 + Number(preg.gaDays || 0);
    if (!Number.isFinite(total)) return null;
    return addDays(preg.gaDate, TERM_DAYS - total);
  }
  return null;
}

export function gestationalAge(edd, date) {
  const total = TERM_DAYS - diffDays(edd, date);
  return { total, weeks: Math.floor(total / 7), days: ((total % 7) + 7) % 7 };
}

// Date on which the pregnancy reaches week W + d.
export function dateAtGA(edd, weeks, days = 0) {
  return addDays(edd, weeks * 7 + days - TERM_DAYS);
}

// Returns a list of problems in plain words; empty means the input is usable.
export function validatePregnancy(preg, today) {
  const errors = [];
  if (!preg || !["edd", "lmp", "ga"].includes(preg.basis)) {
    return ["請選擇用哪一種日期計算孕週。"];
  }
  if (preg.basis === "edd") {
    if (!preg.edd) errors.push("請填寫醫師確認的預產期。");
    else if (!isValidDate(preg.edd)) errors.push("預產期不是有效的日期。");
  }
  if (preg.basis === "lmp") {
    if (!preg.lmp) errors.push("請填寫末次月經第一天。");
    else if (!isValidDate(preg.lmp)) errors.push("末次月經日期不是有效的日期。");
    else if (diffDays(preg.lmp, today) > 0) errors.push("末次月經第一天不能晚於今天。");
  }
  if (preg.basis === "ga") {
    const w = Number(preg.gaWeeks);
    const d = Number(preg.gaDays || 0);
    if (preg.gaWeeks === "" || preg.gaWeeks == null || !Number.isInteger(w) || w < 0 || w > 44) {
      errors.push("孕週請填 0 到 44 的整數。");
    }
    if (!Number.isInteger(d) || d < 0 || d > 6) errors.push("天數請填 0 到 6。");
    if (!preg.gaDate) errors.push("請填寫這個孕週是哪一天確認的。");
    else if (!isValidDate(preg.gaDate)) errors.push("確認孕週的日期不是有效的日期。");
    else if (diffDays(preg.gaDate, today) > 0) errors.push("確認孕週的日期不能晚於今天。");
  }
  if (errors.length) return errors;

  const edd = computeEdd(preg);
  const ga = gestationalAge(edd, today);
  if (ga.total < 0) errors.push("依這個日期，今天還沒有進入孕期。請再確認日期。");
  if (ga.total > MAX_GA_DAYS) {
    errors.push(`依這個日期，今天已是第 ${ga.weeks} 週，超過 44 週。請確認日期，或到「我的」切換為寶寶已出生。`);
  }
  return errors;
}

export function pregnancyStatus(edd, today) {
  const ga = gestationalAge(edd, today);
  let phase = "early";
  if (ga.total >= 13 * 7) phase = "mid";
  if (ga.total >= 29 * 7) phase = "late";
  return {
    ...ga,
    phase,
    overdue: ga.total > TERM_DAYS,
    tooLate: ga.total > MAX_GA_DAYS,
    daysToEdd: diffDays(edd, today),
  };
}

export const PHASE_LABEL = {
  early: "懷孕初期（未滿 13 週）",
  mid: "懷孕中期（13～未滿 29 週）",
  late: "懷孕後期（29 週以上）",
};
