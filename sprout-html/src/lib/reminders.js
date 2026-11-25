import { diffDays } from "./dates";
import { todoState } from "./rules";

// What a to-do is "due" on: the booked date once booked, otherwise the first
// day of the suggested window.
export function targetDate(todo) {
  return todo.status === "booked" ? todo.bookedDate : todo.suggestStart;
}

const OPEN = new Set(["soon", "later", "booked", "overdue", "confirm"]);

// 本次需完成: due today, inside its suggested window right now, or already
// past its date and still waiting for an answer.
// 下次需完成: the nearest to-do whose date is still ahead.
export function nowAndNext(todos, today) {
  const now = [];
  const ahead = [];
  for (const t of todos) {
    const s = todoState(t, today);
    if (!OPEN.has(s)) continue;
    const target = targetDate(t);
    if (!target) continue;
    const left = diffDays(target, today);
    const inWindow = t.status !== "booked" && left <= 0 && (!t.suggestEnd || diffDays(t.suggestEnd, today) >= 0);
    if (s === "overdue" || s === "confirm" || left === 0 || inWindow) now.push({ todo: t, state: s, left });
    else if (left > 0) ahead.push({ todo: t, state: s, left });
  }
  const rank = { overdue: 0, confirm: 0 };
  now.sort((a, b) => (rank[a.state] ?? 1) - (rank[b.state] ?? 1) || a.left - b.left);
  ahead.sort((a, b) => a.left - b.left || String(a.todo.title).localeCompare(String(b.todo.title)));
  return { now, next: ahead[0] ?? null, ahead };
}

// Pop-up reminders, oldest problem first:
//   overdue: the date has passed — ask whether it was done (again every time the
//            app opens, unless the family chose "之後再問我" today)
//   day:     one day before
//   week:    2–7 days before
// A reminder stops once the family taps it; acks live in settings.remind and
// include the date, so moving an appointment brings its reminders back.
export function reminderKey(todo, kind) {
  return kind === "overdue" ? `${todo.id}|overdue` : `${todo.id}|${kind}|${targetDate(todo)}`;
}

export function pendingReminders(todos, today, remind = {}) {
  const list = [];
  for (const t of todos) {
    const s = todoState(t, today);
    if (!OPEN.has(s)) continue;
    const target = targetDate(t);
    if (!target) continue;
    let kind = null;
    if (s === "overdue" || s === "confirm") kind = "overdue";
    else {
      const left = diffDays(target, today);
      if (left === 1) kind = "day";
      else if (left >= 2 && left <= 7) kind = "week";
    }
    if (!kind) continue;
    const key = reminderKey(t, kind);
    const ack = remind[key];
    if (kind === "overdue" ? ack === today : ack) continue;
    list.push({ todo: t, kind, key, left: diffDays(target, today) });
  }
  const order = { overdue: 0, day: 1, week: 2 };
  return list.sort((a, b) => order[a.kind] - order[b.kind] || a.left - b.left);
}

// Keep the ack list small: drop entries for to-dos that no longer exist.
export function pruneRemind(remind, todos) {
  const ids = new Set(todos.map((t) => t.id));
  return Object.fromEntries(Object.entries(remind).filter(([k]) => ids.has(k.split("|")[0])));
}
