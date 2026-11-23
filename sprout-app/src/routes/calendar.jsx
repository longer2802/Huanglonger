import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import AppShell, { useCounts } from "@/components/AppShell";
import { Btn, Empty, Field, inputClass, SectionTitle, Sheet } from "@/components/kit";
import SubjectSwitcher from "@/components/SubjectSwitcher";
import { TodoRow, TodoSheet } from "@/components/Todo";
import { personName } from "@/components/CarePrompt";
import { addCustomTodo, useSprout } from "@/lib/store";
import { todayTW } from "@/lib/dates";
import { todoState } from "@/lib/rules";

export const Route = createFileRoute("/calendar")({
  ssr: false,
  head: () => ({ meta: [{ title: "行事曆・小芽" }] }),
  component: () => (
    <AppShell>
      <CalendarPage />
    </AppShell>
  ),
});

const GROUPS = [
  { key: "attention", title: "需要處理", states: ["overdue", "confirm"] },
  { key: "booked", title: "已預約", states: ["booked"] },
  { key: "soon", title: "近期建議安排（14 天內開始）", states: ["soon"] },
  { key: "later", title: "之後的建議安排", states: ["later"], fold: true },
  { key: "done", title: "已完成", states: ["done"], fold: true },
  { key: "past", title: "開始使用前的建議（可補登）", states: ["past"], fold: true },
  { key: "cancelled", title: "已取消", states: ["cancelled"], fold: true },
];

const sortKey = (t) => t.bookedDate || t.doneDate || t.suggestStart || "";

function CalendarPage() {
  const { todos } = useSprout();
  const counts = useCounts();
  const [who, setWho] = useState("all");
  const [open, setOpen] = useState(null);
  const [adding, setAdding] = useState(false);
  const [folds, setFolds] = useState({});
  const today = todayTW();

  const grouped = useMemo(() => {
    const list = todos.filter((t) => who === "all" || t.subjectId === who).map((t) => ({ t, s: todoState(t, today) }));
    return GROUPS.map((g) => ({
      ...g,
      items: list
        .filter((x) => g.states.includes(x.s))
        .map((x) => x.t)
        .sort((a, b) => (g.key === "done" ? sortKey(b).localeCompare(sortKey(a)) : sortKey(a).localeCompare(sortKey(b)))),
    }));
  }, [todos, who, today]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">行事曆</h1>
        <Btn size="md" onClick={() => setAdding(true)}>
          <Plus className="h-5 w-5" /> 新增待辦
        </Btn>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          ["建議期已過", counts.overdue, "text-destructive"],
          ["近期", counts.soon, "text-primary"],
          ["待確認", counts.confirm, "text-[hsl(var(--apricot-strong))]"],
        ].map(([label, n, cls]) => (
          <div key={label} className="rounded-2xl border border-border bg-card py-2">
            <span className={`block text-2xl font-extrabold ${cls}`}>{n}</span>
            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
      <SubjectSwitcher allowAll value={who} onChange={setWho} />
      <p className="rounded-2xl bg-secondary px-3 py-2 text-[13px] leading-relaxed">建議日期由官方時程推算；請先選實際日期與時間設為「已預約」，再加入手機行事曆。App 關閉後的提醒，靠手機行事曆通知。</p>
      {grouped.map((g) => {
        if (!g.items.length && g.fold) return null;
        const folded = g.fold && !folds[g.key];
        return (
          <section key={g.key}>
            <SectionTitle
              action={
                g.fold ? (
                  <button type="button" onClick={() => setFolds((f) => ({ ...f, [g.key]: !f[g.key] }))} className="inline-flex min-h-[36px] items-center gap-1 text-sm font-semibold text-primary">
                    {folded ? `展開（${g.items.length}）` : "收合"}
                    <ChevronDown className={`h-4 w-4 ${folded ? "" : "rotate-180"}`} />
                  </button>
                ) : null
              }
            >
              {g.title}
            </SectionTitle>
            {folded ? null : g.items.length ? (
              <div className="space-y-2">
                {g.items.map((t) => (
                  <TodoRow key={t.id} todo={t} onOpen={setOpen} />
                ))}
              </div>
            ) : (
              <Empty title="沒有項目" />
            )}
          </section>
        );
      })}
      {open ? <TodoSheet todo={open} onClose={() => setOpen(null)} /> : null}
      <AddTodo open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

const TYPES = [
  ["prenatal", "產檢"],
  ["test", "檢驗"],
  ["visit", "回診"],
  ["vaccine", "疫苗"],
  ["wellchild", "健康檢查"],
  ["custom", "自訂任務"],
];

function AddTodo({ open, onClose }) {
  const { people, settings } = useSprout();
  const [form, setForm] = useState({ title: "", date: todayTW(), time: "", type: "custom", subjectId: settings.activeSubject });
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const save = async () => {
    try {
      await addCustomTodo(form);
      toast.success(form.time ? "已新增為「已預約」" : "已新增為「建議安排」，之後可再選時間");
      onClose();
      setForm((f) => ({ ...f, title: "", time: "" }));
    } catch (e) {
      toast.error(e.message);
    }
  };
  return (
    <Sheet open={open} onClose={onClose} title="新增待辦" footer={<Btn className="w-full" onClick={save}>新增</Btn>}>
      <div className="space-y-4">
        <Field label="給誰" required>
          {(id) => (
            <select id={id} className={inputClass} value={form.subjectId} onChange={(e) => set({ subjectId: e.target.value })}>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {personName(p)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="類型" required>
          {(id) => (
            <select id={id} className={inputClass} value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="名稱" required>
          {(id) => <input id={id} className={inputClass} value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="例：回診拿報告" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="日期" required>
            {(id) => <input id={id} type="date" className={inputClass} value={form.date} onChange={(e) => set({ date: e.target.value })} />}
          </Field>
          <Field label="時間" hint="填了就是已預約">
            {(id) => <input id={id} type="time" className={inputClass} value={form.time} onChange={(e) => set({ time: e.target.value })} />}
          </Field>
        </div>
      </div>
    </Sheet>
  );
}
