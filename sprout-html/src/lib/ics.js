import { addDays, isValidDate, isValidTime } from "./dates";

// Builds a standards-compliant iCalendar file for one appointment.
// The title is neutral by default so a lock screen shows no names or details.
export const NEUTRAL_TITLE = "家庭健康提醒";
const UID_DOMAIN = "sprout-family.local";

function esc(text) {
  return String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

// RFC 5545: lines longer than 75 octets are folded (CRLF + space). Never split
// a multi-byte character.
export function foldLine(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const out = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (curBytes + b > limit) {
      out.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function stamp(d = new Date()) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function local(date, time) {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function plusMinutes(date, time, minutes) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const day = Math.floor(total / 1440);
  const rest = ((total % 1440) + 1440) % 1440;
  const hh = String(Math.floor(rest / 60)).padStart(2, "0");
  const mm = String(rest % 60).padStart(2, "0");
  return { date: addDays(date, day), time: `${hh}:${mm}` };
}

export function eventUid(todoId) {
  return `${String(todoId).replace(/[^A-Za-z0-9-]/g, "-")}@${UID_DOMAIN}`;
}

// todo: { id, title }, when: { date, time }, opts: { detail, alarmDay, alarmHours, sequence, cancel, place }
export function buildIcs(todo, when, opts = {}) {
  const { detail = false, alarmDay = true, alarmHours = true, sequence = 0, cancel = false, durationMin = 60 } = opts;
  if (!isValidDate(when?.date) || !isValidTime(when?.time)) throw new Error("請先選擇實際的日期與時間。");
  const end = plusMinutes(when.date, when.time, durationMin);
  const summary = detail ? `${NEUTRAL_TITLE}：${todo.title}` : NEUTRAL_TITLE;
  const description = detail ? `${todo.title}\n由媽媽手冊E版匯出，改期請在媽媽手冊E版內修改後重新匯出。` : "請開啟媽媽手冊E版查看詳情。改期請在媽媽手冊E版內修改後重新匯出。";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Sprout//Family Health Handbook//ZH-TW",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancel ? "CANCEL" : "PUBLISH"}`,
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Taipei",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0800",
    "TZOFFSETTO:+0800",
    "TZNAME:CST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${eventUid(todo.id)}`,
    `DTSTAMP:${stamp()}`,
    `SEQUENCE:${sequence}`,
    `DTSTART;TZID=Asia/Taipei:${local(when.date, when.time)}`,
    `DTEND;TZID=Asia/Taipei:${local(end.date, end.time)}`,
    `SUMMARY:${esc(summary)}`,
    `DESCRIPTION:${esc(description)}`,
    ...(detail && opts.place ? [`LOCATION:${esc(opts.place)}`] : []),
    `STATUS:${cancel ? "CANCELLED" : "CONFIRMED"}`,
    "TRANSP:OPAQUE",
  ];
  if (!cancel) {
    if (alarmDay) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(NEUTRAL_TITLE)}`, "TRIGGER:-P1D", "END:VALARM");
    if (alarmHours) lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(NEUTRAL_TITLE)}`, "TRIGGER:-PT2H", "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// Plain text the family can paste into any calendar app by hand.
export function eventText(todo, when, opts = {}) {
  const alarms = [opts.alarmDay !== false ? "前一天" : null, opts.alarmHours !== false ? "前 2 小時" : null].filter(Boolean).join("、") || "無";
  return [
    `標題：${opts.detail ? `${NEUTRAL_TITLE}：${todo.title}` : NEUTRAL_TITLE}`,
    `日期：${when.date}`,
    `時間：${when.time}（台灣時間）`,
    `提醒：${alarms}`,
  ].join("\n");
}

export function icsFileName(todo) {
  return `family-reminder-${String(todo.id).slice(-8).replace(/[^A-Za-z0-9-]/g, "")}.ics`;
}

// Tries the share sheet with a file first (iPhone and Android open the
// calendar from there), then falls back to a download. Returns what happened;
// neither path can confirm the event was actually saved on the phone.
export async function deliverIcs(text, fileName) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  try {
    if (typeof File !== "undefined" && navigator.canShare) {
      const file = new File([blob], fileName, { type: "text/calendar" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: NEUTRAL_TITLE });
        return "shared";
      }
    }
  } catch (e) {
    if (e?.name === "AbortError") return "aborted";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return "downloaded";
}

export function downloadIcs(text, fileName) {
  const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
