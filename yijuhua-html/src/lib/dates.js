// 日期工具：一律以「YYYY-MM-DD」字串運算，依使用者時區取得今天
export const DEFAULT_TZ = "Asia/Taipei";

export function userTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
}

// 某個時間點在指定時區的日期與時間
export function zonedParts(date = new Date(), timeZone = DEFAULT_TZ) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

const toUTC = (ymd) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

const fromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export function addDays(ymd, days) {
  return fromUTC(toUTC(ymd) + days * 864e5);
}

// 0 = 星期日 … 6 = 星期六
export function weekday(ymd) {
  return new Date(toUTC(ymd)).getUTCDay();
}

// 以星期一為一週的開始
export function startOfWeek(ymd) {
  const wd = weekday(ymd);
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}

export function startOfMonth(ymd) {
  return `${ymd.slice(0, 7)}-01`;
}

export function endOfMonth(ymd) {
  const [y, m] = ymd.split("-").map(Number);
  return fromUTC(Date.UTC(y, m, 0));
}

export function makeDate(y, m, d) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  const out = fromUTC(ms);
  return Number(out.slice(8, 10)) === d ? out : null;
}

const WEEK = ["日", "一", "二", "三", "四", "五", "六"];

export function formatDateLabel(ymd) {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-");
  return `${y}/${m}/${d}（${WEEK[weekday(ymd)]}）`;
}
