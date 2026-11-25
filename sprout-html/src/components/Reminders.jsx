import { useState } from "react";
import { BellRing, CalendarCheck2, CalendarClock, Check, Clock } from "lucide-react";
import { toast } from "sonner";
import { Btn, Sheet } from "./kit";
import { personName } from "./CarePrompt";
import { TodoSheet } from "./Todo";
import { completeTodo, updateSettings, useSprout } from "@/lib/store";
import { formatDate, todayTW } from "@/lib/dates";
import { pendingReminders, pruneRemind } from "@/lib/reminders";

// Closing with ✕ only hides a reminder until the app is opened again.
const hiddenThisVisit = new Set();

const HEAD = {
  week: { label: "一週內的提醒", icon: CalendarClock },
  day: { label: "明天的提醒", icon: BellRing },
  overdue: { label: "這件事完成了嗎？", icon: Clock },
};

export default function Reminders() {
  const { todos, people, settings } = useSprout();
  const today = todayTW();
  const [, force] = useState(0);
  const [openTodo, setOpenTodo] = useState(null);
  const [busy, setBusy] = useState(false);

  const queue = pendingReminders(todos, today, settings.remind ?? {}).filter((r) => !hiddenThisVisit.has(r.key));
  const current = queue[0];

  const ack = async (r, value = true) => {
    await updateSettings({ remind: { ...pruneRemind(settings.remind ?? {}, todos), [r.key]: value } });
  };
  const hide = (r) => {
    hiddenThisVisit.add(r.key);
    force((n) => n + 1);
  };

  if (openTodo) return <TodoSheet todo={openTodo} onClose={() => setOpenTodo(null)} />;
  if (!current) return null;

  const t = current.todo;
  const person = people.find((p) => p.id === t.subjectId);
  const booked = t.status === "booked";
  const Head = HEAD[current.kind];
  const when = booked ? `${formatDate(t.bookedDate, { weekday: true })} ${t.bookedTime || ""}` : `${formatDate(t.suggestStart, { weekday: true })} 起`;

  const run = async (fn) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={() => (current.kind === "overdue" ? hide(current) : run(() => ack(current)))} title={`${Head.label}${queue.length > 1 ? `（1/${queue.length}）` : ""}`}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-3xl bg-secondary/70 p-4">
          <Head.icon className="mt-0.5 h-7 w-7 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-[18px] font-extrabold leading-snug">{t.title}</p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              {person ? `${personName(person)}・` : ""}
              {booked ? "已預約 " : "建議 "}
              {when}
              {t.place ? `・${t.place}` : ""}
            </p>
            <p className="mt-2 text-[15px] font-semibold text-primary">
              {current.kind === "week" ? `還有 ${current.left} 天` : null}
              {current.kind === "day" ? "就是明天了" : null}
              {current.kind === "overdue" ? (booked ? "預約的日期已經過了" : "建議的時間已經過了") : null}
            </p>
          </div>
        </div>

        {current.kind === "overdue" ? (
          <div className="grid gap-2">
            <Btn disabled={busy} onClick={() => run(async () => { await completeTodo(t.id, booked ? t.bookedDate : today); toast.success("已標示完成"); })}>
              <Check className="h-5 w-5" /> 已完成
            </Btn>
            <Btn variant="soft" disabled={busy} onClick={() => run(async () => { await ack(current, today); setOpenTodo(t); })}>
              <CalendarCheck2 className="h-5 w-5" /> 還沒完成，重新預約
            </Btn>
            <Btn variant="outline" disabled={busy} onClick={() => run(() => ack(current, today))}>
              之後再問我
            </Btn>
            <p className="text-[12px] leading-relaxed text-muted-foreground">按「之後再問我」或關掉，下次打開 App 時會再問一次，直到回答為止。</p>
          </div>
        ) : (
          <div className="grid gap-2">
            <Btn disabled={busy} onClick={() => run(() => ack(current))}>
              <Check className="h-5 w-5" /> 知道了
            </Btn>
            <Btn variant="soft" disabled={busy} onClick={() => run(async () => { await ack(current); setOpenTodo(t); })}>
              <CalendarCheck2 className="h-5 w-5" /> {booked ? "查看預約" : "去預約日期"}
            </Btn>
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {current.kind === "week" ? "日期前一天還會再提醒一次。" : "日期過了之後，會再問你是否已經完成。"}
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
}
