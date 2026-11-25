import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/components/ReviewPanel";
import { FieldLabel } from "@/components/TransactionFields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EXPENSE_CATEGORIES, categoryIcon } from "@/lib/categories";
import { formatDateLabel, zonedParts } from "@/lib/dates";
import { useLedger } from "@/lib/ledger";
import {
  WEEK_LABELS,
  cycleLabel,
  dueStatus,
  monthlyEquivalent,
  newScheduleId,
  nextDue,
  usePlanned,
  useRecurring,
} from "@/lib/schedules";
import { cn } from "@/lib/utils";

const field =
  "h-12 w-full rounded-xl border border-input bg-white px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const STATUS = {
  overdue: { label: "已到期", className: "bg-red-100 text-red-700" },
  soon: { label: "快到了", className: "bg-amber-100 text-amber-800" },
  later: { label: "", className: "" },
};

function blank(mode, today) {
  const base = { id: newScheduleId(), categoryName: "居家", name: "", amount: null, note: "" };
  if (mode === "recurring") return { ...base, cycle: "monthly", day: Number(today.slice(8, 10)), weekday: 1, month: Number(today.slice(5, 7)), paidPeriods: [], createdOn: today };
  return { ...base, categoryName: "購物", date: today, done: false };
}

function ScheduleSheet({ mode, open, onOpenChange, value, onChange, onSave, onDelete, editing }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const valid = Number(value.amount) > 0 && value.name.trim() && (mode === "recurring" || value.date);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">
            {editing ? "編輯" : "新增"}
            {mode === "recurring" ? "固定繳費" : "預定花費"}
          </SheetTitle>
          <SheetDescription>
            {mode === "recurring" ? "例如房租、電話費、保險費，每期到了可以一鍵記入帳本。" : "例如下個月要買的家電、預計的旅費。"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="sch-category">項目（分類）</FieldLabel>
              <select id="sch-category" value={value.categoryName} onChange={(e) => set({ categoryName: e.target.value })} className={field}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel htmlFor="sch-name">名目</FieldLabel>
              <input
                id="sch-name"
                value={value.name}
                onChange={(e) => set({ name: e.target.value.slice(0, 30) })}
                placeholder={mode === "recurring" ? "例如 房租" : "例如 買冰箱"}
                className={field}
              />
            </div>
          </div>

          {mode === "recurring" ? (
            <div>
              <FieldLabel>扣款週期</FieldLabel>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {[
                  ["monthly", "每月"],
                  ["weekly", "每週"],
                  ["yearly", "每年"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set({ cycle: key })}
                    className={cn("h-10 rounded-lg text-base font-semibold", value.cycle === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2 text-base">
                {value.cycle === "weekly" && (
                  <>
                    <span>每週</span>
                    <select value={value.weekday} onChange={(e) => set({ weekday: Number(e.target.value) })} className={cn(field, "w-28")} aria-label="星期">
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <option key={d} value={d}>
                          星期{WEEK_LABELS[d]}
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {value.cycle === "yearly" && (
                  <>
                    <span>每年</span>
                    <select value={value.month} onChange={(e) => set({ month: Number(e.target.value) })} className={cn(field, "w-24")} aria-label="月">
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {m} 月
                        </option>
                      ))}
                    </select>
                  </>
                )}
                {value.cycle !== "weekly" && (
                  <>
                    {value.cycle === "monthly" && <span>每月</span>}
                    <select value={value.day} onChange={(e) => set({ day: Number(e.target.value) })} className={cn(field, "w-24")} aria-label="日">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>
                          {d} 日
                        </option>
                      ))}
                    </select>
                    {value.cycle === "monthly" && value.day > 28 && <span className="text-sm text-muted-foreground">小月以月底計</span>}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <FieldLabel htmlFor="sch-date">扣款日期</FieldLabel>
              <input id="sch-date" type="date" value={value.date} onChange={(e) => set({ date: e.target.value })} className={field} />
            </div>
          )}

          <div>
            <FieldLabel htmlFor="sch-amount">金額（NT$）</FieldLabel>
            <input
              id="sch-amount"
              inputMode="numeric"
              value={value.amount ?? ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/[^\d]/g, "");
                set({ amount: digits ? Number(digits) : null });
              }}
              placeholder="例如 12000"
              className={cn(field, "text-lg font-semibold")}
            />
          </div>
          <div>
            <FieldLabel htmlFor="sch-note">備註（可空白）</FieldLabel>
            <input id="sch-note" value={value.note} onChange={(e) => set({ note: e.target.value.slice(0, 100) })} className={field} />
          </div>
        </div>

        <div className="mt-5 grid gap-2">
          <Button type="button" onClick={onSave} disabled={!valid} className="h-14 rounded-2xl text-lg font-bold">
            儲存
          </Button>
          {!valid && <p className="text-center text-sm text-muted-foreground">請填寫名目與金額</p>}
          {editing && (
            <Button type="button" variant="ghost" onClick={onDelete} className="h-12 rounded-2xl text-base text-red-600 hover:text-red-700">
              <Trash2 className="mr-1.5 h-4 w-4" />
              刪除
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function SchedulePage({ mode }) {
  const isRecurring = mode === "recurring";
  const recurring = useRecurring();
  const planned = usePlanned();
  const store = isRecurring ? recurring : planned;
  const { addMany, prefs } = useLedger();
  const today = zonedParts(new Date(), prefs.timezone).date;
  const [form, setForm] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const lock = useRef(false);

  const rows = useMemo(() => {
    const list = store.items.map((item) => {
      const due = isRecurring ? nextDue(item, today) : item.date;
      return { item, due, status: dueStatus(due, today) };
    });
    return list.sort((a, b) => a.due.localeCompare(b.due));
  }, [store.items, isRecurring, today]);

  const active = isRecurring ? rows : rows.filter((r) => !r.item.done);
  const done = isRecurring ? [] : rows.filter((r) => r.item.done).reverse();
  const monthlyTotal = isRecurring
    ? store.items.reduce((sum, i) => sum + monthlyEquivalent(i), 0)
    : active.filter((r) => r.due.slice(0, 7) === today.slice(0, 7)).reduce((s, r) => s + r.item.amount, 0);

  const openNew = () => setForm({ value: blank(mode, today), editing: false });

  const handleSave = () => {
    try {
      store.upsert({ ...form.value, name: form.value.name.trim(), amount: Number(form.value.amount) });
      toast.success(form.editing ? "已更新" : "已新增");
      setForm(null);
    } catch (error) {
      toast.error(error?.message || "儲存失敗");
    }
  };

  const handleDelete = () => {
    const removed = form.value;
    store.remove(removed.id);
    setForm(null);
    toast("已刪除", { duration: 6000, action: { label: "撤銷", onClick: () => store.upsert(removed) } });
  };

  // 記入帳本：產生一筆支出；同一期只會記一次
  const handleRecord = async ({ item, due }) => {
    if (lock.current) return;
    lock.current = true;
    setBusyId(item.id);
    try {
      const date = due > today ? today : due;
      const saved = await addMany([
        {
          clientRequestId: `${item.id}-${due}`,
          type: "expense",
          amount: item.amount,
          currency: "TWD",
          categoryName: item.categoryName,
          itemName: item.name,
          merchant: "",
          note: item.note || (isRecurring ? `固定繳費（${cycleLabel(item)}）` : "預定花費"),
          transactionDate: date,
          transactionTime: "",
          timezone: prefs.timezone,
          inputMethod: "manual",
          confidence: 1,
        },
      ]);
      if (isRecurring) recurring.markPaid(item.id, due);
      else planned.setDone(item.id, true);
      toast.success(saved.length ? `已記入帳本：${item.name} ${money(item.amount)}` : "這一期已經記過了");
    } catch (error) {
      toast.error(error?.message || "記帳失敗");
    } finally {
      lock.current = false;
      setBusyId(null);
    }
  };

  const title = isRecurring ? "固定繳費" : "預定花費";

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="回首頁" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl font-bold">{title}</h1>
        <Button type="button" onClick={openNew} className="h-10 rounded-xl">
          <Plus className="mr-1 h-4 w-4" />
          新增
        </Button>
      </header>

      {store.items.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{isRecurring ? "每月固定支出（約）" : "本月預定花費"}</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{money(monthlyTotal)}</p>
        </div>
      )}

      {store.ready && !store.items.length && (
        <div className="mt-8 rounded-2xl border border-dashed border-primary/40 bg-white p-6 text-center">
          <p className="text-lg font-semibold">還沒有{title}</p>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            {isRecurring ? "把房租、電話費、保險費這類每期都要繳的錢記下來，到期會提醒你。" : "把之後確定要花的錢先記下來，例如旅費、家電。"}
          </p>
          <Button type="button" onClick={openNew} className="mt-4 h-12 rounded-xl px-6 text-base">
            <Plus className="mr-1 h-4 w-4" />
            新增第一筆
          </Button>
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {active.map((row) => {
          const { item, due, status } = row;
          return (
            <li key={item.id} className="rounded-2xl bg-white p-3 shadow-sm">
              <button type="button" onClick={() => setForm({ value: { ...item }, editing: true })} className="flex w-full items-center gap-3 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-xl">{categoryIcon(item.categoryName)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-base font-semibold">{item.name}</span>
                    {STATUS[status].label && (
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", STATUS[status].className)}>{STATUS[status].label}</span>
                    )}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {item.categoryName}・{isRecurring ? `${cycleLabel(item)}・下次 ${formatDateLabel(due)}` : formatDateLabel(due)}
                  </span>
                  {item.note && <span className="block truncate text-sm text-muted-foreground">{item.note}</span>}
                </span>
                <span className="shrink-0 text-lg font-bold">{money(item.amount)}</span>
              </button>
              <Button
                type="button"
                variant={status === "later" ? "outline" : "default"}
                onClick={() => handleRecord(row)}
                disabled={busyId === item.id}
                className="mt-2 h-10 w-full rounded-xl text-base"
              >
                {busyId === item.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                {isRecurring ? `已繳費，記入帳本（${due.slice(5).replace("-", "/")} 這期）` : "已花費，記入帳本"}
              </Button>
            </li>
          );
        })}
      </ul>

      {done.length > 0 && (
        <section className="mt-6">
          <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 px-1 text-sm font-semibold text-muted-foreground">
            已完成 {done.length} 筆
            <ChevronDown className={cn("h-4 w-4 transition-transform", showDone && "rotate-180")} />
          </button>
          {showDone && (
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl bg-white shadow-sm">
              {done.map(({ item }) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2.5 text-muted-foreground">
                  <span className="text-lg">{categoryIcon(item.categoryName)}</span>
                  <span className="min-w-0 flex-1 truncate text-base line-through">{item.name}</span>
                  <span className="text-sm">{formatDateLabel(item.date)}</span>
                  <button type="button" onClick={() => store.remove(item.id)} aria-label="刪除" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {form && (
        <ScheduleSheet
          mode={mode}
          open={Boolean(form)}
          onOpenChange={(o) => !o && setForm(null)}
          value={form.value}
          editing={form.editing}
          onChange={(value) => setForm({ ...form, value })}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </main>
  );
}
