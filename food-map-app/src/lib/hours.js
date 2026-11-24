// Opening hours and meal-time filters. Everything is typed in by the user
// (or pasted from text they copied); nothing is looked up online.
//
// place.hours      = { days: [[{ open: "07:00", close: "11:00" }], ...] }  // 7 lists, 0 = Sunday
//                    a day with [] is closed; a close at or before open runs past midnight
// place.meal_slots = ["breakfast", "dinner"]  // optional tags the user ticks by hand
// place.hours_note = "賣完為止"                // optional free text

export const MEAL_SLOTS = [
  { key: "breakfast", label: "早餐", start: 5 * 60, end: 10 * 60 + 30, range: "05:00–10:30" },
  { key: "lunch", label: "午餐", start: 11 * 60, end: 14 * 60, range: "11:00–14:00" },
  { key: "dinner", label: "晚餐", start: 17 * 60, end: 20 * 60 + 30, range: "17:00–20:30" },
  { key: "latenight", label: "宵夜", start: 21 * 60, end: 26 * 60, range: "21:00–02:00" },
];

export function mealSlot(key) {
  return MEAL_SLOTS.find((slot) => slot.key === key) ?? null;
}

// Monday first, the way Taiwanese shops list their hours.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABEL = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
export const DAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

export function toMinutes(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

export function fromMinutes(total) {
  const t = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

// Interval in minutes from the start of its own day; closing at or before the
// opening time means the shop stays open past midnight.
function span(range) {
  const open = toMinutes(range.open);
  let close = toMinutes(range.close);
  if (open == null || close == null) return null;
  if (close <= open) close += 1440;
  return [open, close];
}

export function hasHours(hours) {
  return Array.isArray(hours?.days) && hours.days.length === 7 && hours.days.some((d) => Array.isArray(d) && d.length > 0);
}

// Everything open during one calendar day, including a late shift that
// started the evening before.
export function spansOnDay(hours, dow) {
  if (!hasHours(hours)) return [];
  const out = [];
  for (const r of hours.days[dow] ?? []) {
    const s = span(r);
    if (s) out.push(s);
  }
  for (const r of hours.days[(dow + 6) % 7] ?? []) {
    const s = span(r);
    if (s && s[1] > 1440) out.push([s[0] - 1440, s[1] - 1440]);
  }
  return out;
}

export function openDuring(hours, dow, start, end) {
  return spansOnDay(hours, dow).some(([o, c]) => o < end && c > start);
}

// Day of week and minutes since midnight in Taiwan, whatever the phone's zone.
export function taipeiNow(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Taipei", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { dow, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// day: "today" checks only today's opening hours; "any" accepts any day of the week.
export function matchesMeal(place, slotKey, day = "today", now = taipeiNow()) {
  const slot = mealSlot(slotKey);
  if (!slot) return true;
  const tagged = Array.isArray(place?.meal_slots) && place.meal_slots.includes(slotKey);
  if (!hasHours(place?.hours)) return tagged;
  const days = day === "today" ? [now.dow] : [0, 1, 2, 3, 4, 5, 6];
  if (days.some((d) => openDuring(place.hours, d, slot.start, slot.end))) return true;
  // A ticked tag still counts on days the shop is open at all.
  return tagged && days.some((d) => spansOnDay(place.hours, d).length > 0);
}

// "open" with closing time, "closed" with the next opening, or "unknown".
export function openStatus(hours, now = taipeiNow()) {
  if (!hasHours(hours)) return { state: "unknown" };
  const t = now.minutes;
  const current = spansOnDay(hours, now.dow).find(([o, c]) => o <= t && t < c);
  if (current) {
    const closesSoon = current[1] - t <= 30;
    return { state: "open", until: fromMinutes(current[1]), closesSoon, allDay: current[1] - current[0] >= 1440 };
  }
  for (let add = 0; add < 8; add += 1) {
    const dow = (now.dow + add) % 7;
    const opens = (hours.days[dow] ?? [])
      .map(span)
      .filter(Boolean)
      .map(([o]) => o)
      .filter((o) => add > 0 || o > t)
      .sort((a, b) => a - b);
    if (opens.length) return { state: "closed", nextDay: add, nextDow: dow, nextTime: fromMinutes(opens[0]), closedToday: add === 0 ? false : (hours.days[now.dow] ?? []).length === 0 };
  }
  return { state: "closed", nextDay: null };
}

export function statusText(status) {
  if (status.state === "open") return status.allDay ? "營業中・24 小時" : `營業中・至 ${status.until}`;
  if (status.state !== "closed") return "";
  if (status.nextDay == null) return "休息中";
  const when = status.nextDay === 0 ? "" : status.nextDay === 1 ? "明天 " : `${DAY_LABEL[status.nextDow]} `;
  return `${status.closedToday ? "今日公休" : "休息中"}・${when}${status.nextTime} 開`;
}

export function formatDay(ranges) {
  if (!ranges?.length) return "公休";
  return ranges
    .map((r) => (r.open === "00:00" && (r.close === "24:00" || r.close === "00:00") ? "24 小時" : `${r.open}–${r.close}`))
    .join("、");
}

export function emptyHours() {
  return { days: [[], [], [], [], [], [], []] };
}

// Keeps only well-formed ranges; used for the editor and for backup files.
export function normalizeHours(raw) {
  if (!raw || !Array.isArray(raw.days) || raw.days.length !== 7) return null;
  const days = raw.days.map((day) =>
    (Array.isArray(day) ? day : [])
      .filter((r) => r && toMinutes(r.open) != null && toMinutes(r.close) != null && r.open !== r.close)
      .slice(0, 4)
      .map((r) => ({ open: fromMinutes(toMinutes(r.open)), close: toMinutes(r.close) === 1440 ? "24:00" : fromMinutes(toMinutes(r.close)) })),
  );
  return days.some((d) => d.length) ? { days } : null;
}

export function normalizeMealSlots(raw) {
  return Array.isArray(raw) ? MEAL_SLOTS.map((s) => s.key).filter((k) => raw.includes(k)) : [];
}

// ---- Pasting hours copied from Google Maps or a shop's post ----
// Understands lines like「星期一 07:00–11:00, 17:00–21:00」「週二 休息」
// 「星期三 上午11:00 到 下午2:00」「24 小時營業」「每日 11:00-20:00」「一至五 ...」.

const DAY_CHARS = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };

function to24(h, min, ampm) {
  let hour = h;
  if (ampm === "上午" || ampm === "早上" || ampm === "凌晨") hour = h === 12 ? 0 : h;
  else if (ampm === "中午") hour = h < 11 ? h + 12 : h;
  else if (ampm === "下午" || ampm === "晚上" || ampm === "傍晚") hour = h < 12 ? h + 12 : h;
  return `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function parseRanges(text) {
  if (/24\s*小時/.test(text)) return [{ open: "00:00", close: "24:00" }];
  if (/休息|公休|店休|不營業|closed/i.test(text)) return [];
  const out = [];
  const re = /(上午|早上|凌晨|中午|下午|晚上|傍晚)?\s*(\d{1,2})[:：](\d{2})\s*(?:[–\-~～〜至到]|—)\s*(上午|早上|凌晨|中午|下午|晚上|傍晚)?\s*(\d{1,2})[:：](\d{2})/g;
  let m;
  while ((m = re.exec(text))) {
    const openAp = m[1];
    const closeAp = m[4] ?? (openAp && openAp !== "上午" && openAp !== "早上" && openAp !== "凌晨" ? openAp : undefined);
    const open = to24(Number(m[2]), Number(m[3]), openAp);
    let close = to24(Number(m[5]), Number(m[6]), closeAp);
    if (close === "00:00" && open !== "00:00") close = "24:00";
    out.push({ open, close });
  }
  return out;
}

function daysInLabel(label) {
  if (/每日|每天|天天|全年無休|週一至週日|一至日/.test(label)) return [0, 1, 2, 3, 4, 5, 6];
  const range = /(?:星期|週|周|禮拜)?([一二三四五六日天])\s*(?:[至到~～\-–])\s*(?:星期|週|周|禮拜)?([一二三四五六日天])/.exec(label);
  if (range) {
    const a = DAY_CHARS[range[1]];
    const b = DAY_CHARS[range[2]];
    const order = WEEK_ORDER;
    const i = order.indexOf(a);
    const j = order.indexOf(b);
    if (i <= j) return order.slice(i, j + 1);
  }
  // 「週六、日」「星期一、三、五」: a list after one prefix.
  const list = /(?:星期|週|周|禮拜)([一二三四五六日天](?:\s*[、,，及和與]\s*(?:星期|週|周|禮拜)?[一二三四五六日天])*)/.exec(label);
  return list ? [...new Set(list[1].match(/[一二三四五六日天]/g).map((c) => DAY_CHARS[c]))] : [];
}

export function parseHoursText(text) {
  const result = emptyHours();
  const seen = new Set();
  const lines = String(text ?? "")
    .normalize("NFKC")
    .replace(/ | /g, " ")
    .split(/\n|；|;/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Google Maps puts the day on one line and the hours on the next.
  for (let i = 0; i < lines.length; i += 1) {
    const days = daysInLabel(lines[i]);
    if (!days.length) continue;
    let rest = lines[i];
    if (!parseRanges(rest).length && !/休息|公休|店休|不營業|24\s*小時/.test(rest) && lines[i + 1] && !daysInLabel(lines[i + 1]).length) {
      rest = lines[i + 1];
      i += 1;
    }
    const ranges = parseRanges(rest);
    if (!ranges.length && !/休息|公休|店休|不營業/.test(rest)) continue;
    for (const d of days) {
      result.days[d] = ranges;
      seen.add(d);
    }
  }
  if (!seen.size) {
    const ranges = parseRanges(text);
    if (ranges.length) return { hours: { days: Array.from({ length: 7 }, () => ranges.map((r) => ({ ...r }))) }, matchedDays: 7, everyDay: true };
    return { hours: null, matchedDays: 0 };
  }
  return { hours: normalizeHours(result) ?? emptyHours(), matchedDays: seen.size, everyDay: false };
}
