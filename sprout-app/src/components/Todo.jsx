import { useState } from "react";
import { CalendarCheck2, CalendarClock, CalendarX2, Check, ClipboardCopy, Download, RotateCcw, Share2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Btn, Confirm, Field, inputClass, Pill, Sheet } from "./kit";
import { personName } from "./CarePrompt";
import { bookTodo, cancelTodo, completeTodo, deleteTodo, markExported, reopenTodo, updateSettings, useSprout } from "@/lib/store";
import { formatDate, isValidDate, isValidTime, todayTW } from "@/lib/dates";
import { STATE_LABEL, todoState } from "@/lib/rules";
import { buildIcs, deliverIcs, downloadIcs, eventText, icsFileName } from "@/lib/ics";
import { cn } from "@/lib/utils";

const TONE = { overdue: "alert", soon: "apricot", later: "line", booked: "sage", confirm: "apricot", done: "done", past: "line", cancelled: "line" };

export function TodoRow({ todo, onOpen, showPerson = true }) {
  const { people } = useSprout();
  const today = todayTW();
  const state = todoState(todo, today);
  const person = people.find((p) => p.id === todo.subjectId);
  const when =
    todo.status === "booked"
      ? `${formatDate(todo.bookedDate, { weekday: true })} ${todo.bookedTime}`
      : todo.status === "done"
        ? `完成於 ${formatDate(todo.doneDate)}`
        : `建議 ${formatDate(todo.suggestStart)}${todo.suggestEnd && todo.suggestEnd !== todo.suggestStart ? `～${formatDate(todo.suggestEnd)}` : ""}`;
  return (
    <button type="button" onClick={() => onOpen(todo)} className={cn("flex w-full items-start gap-3 rounded-2xl border bg-card px-3.5 py-3 text-left", state === "overdue" ? "border-destructive/60" : "border-border")}>
      <span className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl", state === "done" ? "bg-primary text-primary-foreground" : state === "booked" ? "bg-secondary text-primary" : "bg-accent text-accent-foreground")}>
        {state === "done" ? <Check className="h-5 w-5" /> : state === "booked" ? <CalendarCheck2 className="h-5 w-5" /> : <CalendarClock className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[15px] font-bold leading-snug">{todo.title}</span>
          <Pill tone={TONE[state]}>
            {state === "overdue" ? "⚠ " : ""}
            {STATE_LABEL[state]}
          </Pill>
        </span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">
          {showPerson && person ? `${personName(person)}・` : ""}
          {when}
          {todo.hint && todo.status !== "booked" && todo.status !== "done" ? `（${todo.hint}）` : ""}
        </span>
        {todo.needsCalendarUpdate ? (
          <span className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-[hsl(var(--apricot-strong))]">
            <TriangleAlert className="h-4 w-4" /> 手機行事曆裡是舊時間，請重新匯出
          </span>
        ) : todo.exportedAt && todo.status === "booked" ? (
          <span className="mt-1 block text-[12px] text-muted-foreground">已匯出（請在手機行事曆確認）</span>
        ) : null}
      </span>
    </button>
  );
}

export function TodoSheet({ todo, onClose }) {
  const { settings, people } = useSprout();
  const live = useSprout().todos.find((t) => t.id === todo?.id) ?? todo;
  const today = todayTW();
  const [date, setDate] = useState(live?.bookedDate || (live && live.suggestStart > today ? live.suggestStart : today));
  const [time, setTime] = useState(live?.bookedTime || "09:00");
  const [place, setPlace] = useState(live?.place || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exportedMsg, setExportedMsg] = useState("");
  if (!live) return null;
  const person = people.find((p) => p.id === live.subjectId);
  const booked = live.status === "booked";
  const cancelledExported = live.status === "cancelled" && live.exportedAt && live.needsCalendarUpdate;

  const save = async () => {
    try {
      const { changed } = await bookTodo(live.id, { date, time, place });
      toast.success(changed ? "已改期。手機行事曆裡還是舊時間，請按下方重新匯出並刪除舊事件。" : "已設為「已預約」。");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const opts = { detail: settings.icsDetail, alarmDay: settings.alarmDay, alarmHours: settings.alarmHours, place: live.place };
  const when = cancelledExported ? live.exported ?? { date: live.bookedDate, time: live.bookedTime } : { date: live.bookedDate, time: live.bookedTime };
  const sequence = (live.exportSeq ?? -1) + 1;

  const doExport = async (how) => {
    try {
      const ics = buildIcs(live, when, { ...opts, sequence, cancel: cancelledExported });
      if (how === "share") {
        const r = await deliverIcs(ics, icsFileName(live));
        if (r === "aborted") return;
      } else if (how === "download") downloadIcs(ics, icsFileName(live));
      else {
        await navigator.clipboard.writeText(eventText(live, when, opts));
        toast.success("已複製事件資訊，可貼到行事曆 App 手動建立。");
      }
      await markExported(live.id, { date: when.date, time: when.time, cancelled: cancelledExported });
      setExportedMsg(
        cancelledExported
          ? "已匯出「取消」檔。部分行事曆 App 不會自動刪除，請到手機行事曆確認舊事件已移除。"
          : "已匯出。小芽無法確認手機是否已加入，請打開手機行事曆確認事件與提醒時間。",
      );
    } catch (e) {
      toast.error(e.message || "匯出失敗");
    }
  };

  return (
    <Sheet open onClose={onClose} title={live.title} tall>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {person ? `${personName(person)}・` : ""}
          {live.hint || ""}
          {live.suggestStart ? `・建議 ${formatDate(live.suggestStart)}${live.suggestEnd !== live.suggestStart ? `～${formatDate(live.suggestEnd)}` : ""}` : ""}
        </p>
        {live.type === "vaccine" || live.type === "wellchild" ? (
          <p className="rounded-2xl bg-secondary px-3 py-2 text-[13px] leading-relaxed">實際接種與就醫日期以醫療院所安排為準；早產或特殊醫囑可直接改成院所約定的日期。</p>
        ) : null}

        {live.status === "done" ? (
          <div className="space-y-2">
            <p className="rounded-2xl bg-primary px-3 py-2 text-[15px] font-semibold text-primary-foreground">✓ 已完成（{formatDate(live.doneDate)}）</p>
            <Btn variant="outline" className="w-full" onClick={() => reopenTodo(live.id)}>
              <RotateCcw className="h-4 w-4" /> 改回未完成
            </Btn>
          </div>
        ) : live.status === "cancelled" ? (
          <div className="space-y-2">
            <p className="rounded-2xl bg-muted px-3 py-2 text-[15px]">已取消{live.cancelReason ? `（${live.cancelReason}）` : ""}</p>
            <Btn variant="outline" className="w-full" onClick={() => reopenTodo(live.id)}>
              <RotateCcw className="h-4 w-4" /> 恢復這個待辦
            </Btn>
          </div>
        ) : (
          <div className="space-y-3 rounded-3xl border border-border p-3">
            <p className="text-[15px] font-bold">{booked ? "已預約的時間" : "選擇實際日期與時間"}</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="日期" required>
                {(id) => <input id={id} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />}
              </Field>
              <Field label="時間" required>
                {(id) => <input id={id} type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />}
              </Field>
            </div>
            <Field label="地點">
              {(id) => <input id={id} className={inputClass} value={place} onChange={(e) => setPlace(e.target.value)} />}
            </Field>
            <Btn className="w-full" disabled={!isValidDate(date) || !isValidTime(time)} onClick={save}>
              <CalendarCheck2 className="h-5 w-5" /> {booked ? "儲存改期" : "設為已預約"}
            </Btn>
          </div>
        )}

        {(booked || cancelledExported) && live.bookedDate ? (
          <div className="space-y-3 rounded-3xl border-2 border-primary/30 bg-secondary/40 p-3">
            <p className="text-[15px] font-bold">{cancelledExported ? "同步取消到手機行事曆" : "加入手機行事曆"}</p>
            {live.needsCalendarUpdate && !cancelledExported ? (
              <p className="rounded-2xl bg-accent px-3 py-2 text-[13px] font-semibold text-accent-foreground">⚠ 時間改過了。重新匯出後，請到手機行事曆刪除舊的那一筆，避免舊提醒。</p>
            ) : null}
            {!cancelledExported ? (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  <label className="flex min-h-[40px] items-center gap-2 rounded-xl bg-card px-3">
                    <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={settings.alarmDay} onChange={(e) => updateSettings({ alarmDay: e.target.checked })} />
                    前一天提醒
                  </label>
                  <label className="flex min-h-[40px] items-center gap-2 rounded-xl bg-card px-3">
                    <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={settings.alarmHours} onChange={(e) => updateSettings({ alarmHours: e.target.checked })} />
                    前 2 小時提醒
                  </label>
                </div>
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  行事曆標題為「家庭健康提醒」，鎖定畫面不會出現姓名、孕週或醫療細節{settings.icsDetail ? "（目前已在「我的」改為顯示項目名稱）" : ""}。
                </p>
              </>
            ) : null}
            <div className="grid gap-2">
              <Btn onClick={() => doExport("share")}>
                <Share2 className="h-5 w-5" /> {cancelledExported ? "分享取消檔" : "加入手機行事曆"}
              </Btn>
              <div className="grid grid-cols-2 gap-2">
                <Btn variant="outline" size="md" onClick={() => doExport("download")}>
                  <Download className="h-4 w-4" /> 下載 .ics
                </Btn>
                <Btn variant="outline" size="md" onClick={() => doExport("copy")}>
                  <ClipboardCopy className="h-4 w-4" /> 複製資訊
                </Btn>
              </div>
            </div>
            {exportedMsg ? <p className="rounded-2xl bg-card px-3 py-2 text-[13px] font-semibold">{exportedMsg}</p> : null}
            <p className="text-[12px] leading-relaxed text-muted-foreground">iPhone：按「加入手機行事曆」後選「行事曆」或打開下載的檔案再按「加入」。Android：選 Google 日曆開啟 .ics。若手機不支援直接匯入，請用「複製資訊」手動建立，並檢查提醒時間。</p>
          </div>
        ) : null}

        {live.status !== "done" && live.status !== "cancelled" ? (
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="soft" onClick={() => completeTodo(live.id, booked ? live.bookedDate : today).then(() => toast.success("已標示完成"))}>
              <Check className="h-5 w-5" /> 已完成
            </Btn>
            <Btn variant="outline" onClick={() => cancelTodo(live.id).then(() => toast(live.exportedAt ? "已取消。請匯出取消檔或到手機行事曆刪除這筆。" : "已取消"))}>
              <CalendarX2 className="h-5 w-5" /> 取消
            </Btn>
          </div>
        ) : null}
        {!live.ruleKey ? (
          <Btn variant="ghost" className="w-full text-destructive" onClick={() => setConfirmDelete(true)}>
            刪除這個自訂待辦
          </Btn>
        ) : null}
      </div>
      <Confirm
        open={confirmDelete}
        title="刪除待辦？"
        body={live.exportedAt ? "刪除後，手機行事曆裡已匯出的那一筆不會自動刪除，請自行移除。" : "刪除後無法復原。"}
        danger
        confirmLabel="刪除"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deleteTodo(live.id);
          onClose();
        }}
      />
    </Sheet>
  );
}
