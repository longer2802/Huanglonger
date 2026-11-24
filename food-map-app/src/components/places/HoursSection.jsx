import { useState } from "react";
import { ClipboardPaste, Clock, Copy, Loader2, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { notifyPlacesChanged, updatePlace } from "@/lib/localPlaces";
import {
  DAY_LABEL,
  MEAL_SLOTS,
  WEEK_ORDER,
  emptyHours,
  formatDay,
  hasHours,
  normalizeHours,
  normalizeMealSlots,
  openStatus,
  parseHoursText,
  statusText,
  taipeiNow,
} from "@/lib/hours";
import { cn } from "@/lib/utils";

const FIELD = "h-10 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-center text-[15px] text-foreground";
const SMALL_BTN = "inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground";

export function StatusPill({ hours, className }) {
  const status = openStatus(hours);
  if (status.state === "unknown") return null;
  const open = status.state === "open";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        open ? (status.closesSoon ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800") : "bg-secondary text-muted-foreground",
        className,
      )}
    >
      <Clock className="h-3 w-3" />
      {statusText(status)}
    </span>
  );
}

function cloneDays(hours) {
  const base = hasHours(hours) ? hours : emptyHours();
  return base.days.map((day) => day.map((r) => ({ ...r })));
}

function Editor({ place, onDone }) {
  const [days, setDays] = useState(() => cloneDays(place.hours));
  const [slots, setSlots] = useState(() => normalizeMealSlots(place.meal_slots));
  const [note, setNote] = useState(place.hours_note ?? "");
  const [paste, setPaste] = useState("");
  const [saving, setSaving] = useState(false);

  const setDay = (dow, ranges) => setDays((prev) => prev.map((d, i) => (i === dow ? ranges : d)));

  const readPaste = () => {
    const result = parseHoursText(paste);
    if (!result.hours) {
      toast.error("沒有讀到時間，請確認文字裡有像「11:00–14:00」的格式");
      return;
    }
    setDays(cloneDays(result.hours));
    toast.success(result.everyDay ? "已套用到每一天，請確認公休日" : `讀到 ${result.matchedDays} 天的營業時間，請確認`);
    setPaste("");
  };

  const copyMonday = () => {
    setDays((prev) => prev.map(() => prev[1].map((r) => ({ ...r }))));
    toast.success("已把星期一的時間套用到每一天");
  };

  const save = async (clear = false) => {
    const incomplete = days.some((day) => day.some((r) => !r.open || !r.close || r.open === r.close));
    if (!clear && incomplete) {
      toast.error("有時段沒填完整（開門和打烊時間都要填，且不能相同）");
      return;
    }
    setSaving(true);
    try {
      await updatePlace(place.id, clear ? { hours: null, meal_slots: [], hours_note: "" } : { hours: normalizeHours({ days }), meal_slots: slots, hours_note: note.trim().slice(0, 200) });
      notifyPlacesChanged();
      toast.success(clear ? "已清除營業時間" : "已儲存營業時間");
      onDone();
    } catch {
      toast.error("儲存失敗，請再試一次");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2 rounded-xl bg-secondary/60 p-2.5">
        <label htmlFor="hours-paste" className="flex items-center gap-1 text-xs font-semibold text-foreground">
          <ClipboardPaste className="h-3.5 w-3.5" /> 貼上營業時間文字（可從 Google 地圖或店家貼文複製）
        </label>
        <textarea
          id="hours-paste"
          rows={3}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={"例：\n星期一 休息\n星期二 11:00–14:00、17:00–21:00"}
          className="w-full rounded-lg border border-border bg-card px-2.5 py-2 text-sm text-foreground"
        />
        <button type="button" disabled={!paste.trim()} onClick={readPaste} className={cn(SMALL_BTN, "disabled:opacity-50")}>
          讀取並填入
        </button>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground">每天的營業時間</p>
          <button type="button" onClick={copyMonday} className={SMALL_BTN}>
            <Copy className="h-3.5 w-3.5" /> 星期一套用全週
          </button>
        </div>
        {WEEK_ORDER.map((dow) => (
          <div key={dow} className="rounded-xl border border-border bg-card p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-foreground">{DAY_LABEL[dow]}</span>
              <div className="flex items-center gap-1.5">
                {days[dow].length ? null : <span className="text-xs text-muted-foreground">公休</span>}
                <button
                  type="button"
                  disabled={days[dow].length >= 4}
                  onClick={() => setDay(dow, [...days[dow], { open: days[dow].length ? "17:00" : "11:00", close: days[dow].length ? "21:00" : "14:00" }])}
                  className={cn(SMALL_BTN, "h-8 disabled:opacity-40")}
                  aria-label={`${DAY_LABEL[dow]}新增時段`}
                >
                  <Plus className="h-3.5 w-3.5" /> 時段
                </button>
              </div>
            </div>
            {days[dow].map((range, i) => (
              <div key={i} className="mt-1.5 flex items-center gap-1.5">
                <input
                  type="time"
                  aria-label={`${DAY_LABEL[dow]}第 ${i + 1} 段開門`}
                  value={range.open}
                  onChange={(e) => setDay(dow, days[dow].map((r, j) => (j === i ? { ...r, open: e.target.value } : r)))}
                  className={FIELD}
                />
                <span className="text-muted-foreground">–</span>
                <input
                  type="time"
                  aria-label={`${DAY_LABEL[dow]}第 ${i + 1} 段打烊`}
                  value={range.close === "24:00" ? "00:00" : range.close}
                  onChange={(e) => setDay(dow, days[dow].map((r, j) => (j === i ? { ...r, close: e.target.value } : r)))}
                  className={FIELD}
                />
                <button
                  type="button"
                  onClick={() => setDay(dow, days[dow].filter((_, j) => j !== i))}
                  aria-label={`刪除${DAY_LABEL[dow]}第 ${i + 1} 段`}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        ))}
        <p className="text-[11px] leading-relaxed text-muted-foreground">沒有時段的日子視為公休。打烊時間比開門早（例如 18:00–02:00）代表營業到隔天凌晨；00:00 打烊代表營業到午夜。</p>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-foreground">適合的用餐時段（不確定營業時間時，也能靠這個篩選）</p>
        <div className="grid grid-cols-4 gap-1.5">
          {MEAL_SLOTS.map((slot) => {
            const on = slots.includes(slot.key);
            return (
              <button
                key={slot.key}
                type="button"
                aria-pressed={on}
                onClick={() => setSlots((prev) => normalizeMealSlots(on ? prev.filter((k) => k !== slot.key) : [...prev, slot.key]))}
                className={cn("h-10 rounded-xl border text-sm font-medium", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground")}
              >
                {slot.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="hours-note" className="text-xs font-semibold text-foreground">
          營業備註
        </label>
        <input id="hours-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="例：賣完為止、每月第一個週一公休" className="h-10 w-full rounded-lg border border-border bg-card px-2.5 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onDone} disabled={saving} className="h-11 rounded-xl border border-border bg-card text-sm font-medium">
          取消
        </button>
        <button type="button" onClick={() => save(false)} disabled={saving} className="flex h-11 items-center justify-center gap-1 rounded-xl bg-primary text-sm font-semibold text-primary-foreground">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} 儲存
        </button>
      </div>
      {hasHours(place.hours) || (place.meal_slots ?? []).length || place.hours_note ? (
        <button type="button" onClick={() => save(true)} disabled={saving} className="w-full text-center text-xs text-muted-foreground underline underline-offset-4">
          清除這家店的營業時間
        </button>
      ) : null}
    </div>
  );
}

// Shown in the place card: today's status, the week, meal tags, and an editor.
export default function HoursSection({ place }) {
  const [editing, setEditing] = useState(false);
  const known = hasHours(place.hours);
  const slots = normalizeMealSlots(place.meal_slots);
  const today = taipeiNow().dow;

  return (
    <section className="space-y-2 rounded-2xl border border-border bg-card p-3" aria-label="營業時間">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Clock className="h-4 w-4 text-primary" /> 營業時間
        </h3>
        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className={SMALL_BTN}>
            <Pencil className="h-3.5 w-3.5" /> {known || slots.length ? "編輯" : "填寫"}
          </button>
        ) : null}
      </div>

      {editing ? (
        <Editor place={place} onDone={() => setEditing(false)} />
      ) : (
        <>
          {known ? (
            <>
              <StatusPill hours={place.hours} />
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                {WEEK_ORDER.map((dow) => (
                  <div key={dow} className={cn("contents", dow === today ? "font-bold text-foreground" : "text-muted-foreground")}>
                    <dt>{DAY_LABEL[dow]}</dt>
                    <dd className={cn(!place.hours.days[dow]?.length && "text-[color:var(--map-pin)]")}>{formatDay(place.hours.days[dow])}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">尚未填寫營業時間。填好後就能用「早餐／午餐／晚餐／宵夜」篩選，並看到營業中或休息中。</p>
          )}
          {slots.length ? (
            <div className="flex flex-wrap gap-1.5">
              {slots.map((key) => (
                <span key={key} className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">
                  {MEAL_SLOTS.find((s) => s.key === key)?.label}
                </span>
              ))}
            </div>
          ) : null}
          {place.hours_note ? <p className="whitespace-pre-wrap text-xs text-foreground">備註：{place.hours_note}</p> : null}
          {known ? <p className="text-[11px] text-muted-foreground">營業時間為自己填寫的資料，出發前可再向店家確認。</p> : null}
        </>
      )}
    </section>
  );
}
