import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ListFilter } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Card, Empty, Field, inputClass, Pill } from "@/components/kit";
import SubjectSwitcher, { useActivePerson } from "@/components/SubjectSwitcher";
import RecordForm from "@/components/RecordForm";
import { RecordIcon } from "@/components/RecordIcon";
import { personName } from "@/components/CarePrompt";
import { KINDS, kindsFor, recordSummary } from "@/lib/records";
import { useSprout } from "@/lib/store";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

const str = (v) => (typeof v === "string" && v.length < 80 ? v : undefined);

export const Route = createFileRoute("/record")({
  ssr: false,
  validateSearch: (s) => ({ tab: s.tab === "timeline" ? "timeline" : undefined, kind: str(s.kind), subject: str(s.subject), id: str(s.id) }),
  head: () => ({ meta: [{ title: "記錄・媽媽手冊E版" }] }),
  component: () => (
    <AppShell>
      <RecordPage />
    </AppShell>
  ),
});

function RecordPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { records, people } = useSprout();
  const active = useActivePerson();
  const go = (s) => navigate({ to: "/record", search: s, replace: false });

  const editing = search.id ? records.find((r) => r.id === search.id) : null;
  if (editing) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold">編輯紀錄</h1>
        <RecordForm key={editing.id} kind={editing.kind} subjectId={editing.subjectId} existing={editing} onSaved={() => go({ tab: "timeline" })} onCancel={() => go({ tab: "timeline" })} />
      </div>
    );
  }

  const subject = people.find((p) => p.id === search.subject) ?? active;
  if (search.kind && KINDS[search.kind] && subject) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-extrabold">新增{KINDS[search.kind].label}</h1>
        <RecordForm key={`${subject.id}-${search.kind}`} kind={search.kind} subjectId={subject.id} onSaved={() => go({ tab: "timeline" })} onCancel={() => go({})} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-secondary p-1" role="tablist">
        {[
          [undefined, "新增紀錄"],
          ["timeline", "時間軸"],
        ].map(([tab, label]) => (
          <button key={label} type="button" role="tab" aria-selected={search.tab === tab} onClick={() => go({ tab })} className={cn("min-h-[44px] rounded-xl text-[15px] font-bold", search.tab === tab ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
      </div>
      {search.tab === "timeline" ? <Timeline onOpen={(id) => go({ id })} /> : <KindPicker onPick={(kind, subjectId) => go({ kind, subject: subjectId })} />}
    </div>
  );
}

function KindPicker({ onPick }) {
  const person = useActivePerson();
  return (
    <>
      <SubjectSwitcher />
      <div className="grid grid-cols-3 gap-2">
        {kindsFor(person).map((k) => (
          <button key={k.key} type="button" onClick={() => onPick(k.key, person.id)} className="flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card px-1 text-center text-[14px] font-semibold">
            <RecordIcon name={k.icon} className="h-7 w-7 text-primary" />
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-center text-[12px] text-muted-foreground">所有紀錄都標示為「家庭自行記錄」，可回填過去的日期。</p>
    </>
  );
}

function Timeline({ onOpen }) {
  const { records, people } = useSprout();
  const [who, setWho] = useState("all");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = useMemo(
    () =>
      records.filter(
        (r) => (who === "all" || r.subjectId === who) && (!kind || r.kind === kind) && (!from || r.date >= from) && (!to || r.date <= to),
      ),
    [records, who, kind, from, to],
  );
  const groups = useMemo(() => {
    const m = new Map();
    for (const r of list) {
      if (!m.has(r.date)) m.set(r.date, []);
      m.get(r.date).push(r);
    }
    return [...m.entries()];
  }, [list]);

  return (
    <>
      <SubjectSwitcher allowAll value={who} onChange={setWho} />
      <Card className="space-y-3 p-3">
        <p className="flex items-center gap-1.5 text-sm font-bold">
          <ListFilter className="h-4 w-4" /> 篩選
        </p>
        <Field label="類別">
          {(id) => (
            <select id={id} className={inputClass} value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">全部類別</option>
              {Object.entries(KINDS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="從">
            {(id) => <input id={id} type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />}
          </Field>
          <Field label="到">
            {(id) => <input id={id} type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />}
          </Field>
        </div>
      </Card>
      {groups.length ? (
        <div className="space-y-4">
          {groups.map(([date, items]) => (
            <section key={date}>
              <h3 className="mb-1.5 px-1 text-sm font-bold text-muted-foreground">{formatDate(date, { weekday: true })}</h3>
              <div className="space-y-2">
                {items.map((r) => {
                  const p = people.find((x) => x.id === r.subjectId);
                  return (
                    <button key={r.id} type="button" onClick={() => onOpen(r.id)} className="flex w-full items-start gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left">
                      <RecordIcon name={KINDS[r.kind]?.icon} className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[15px] font-bold">{KINDS[r.kind]?.label}</span>
                          <Pill tone="line">{personName(p)}</Pill>
                          {r.time ? <span className="text-xs text-muted-foreground">{r.time}</span> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[14px] text-muted-foreground">{recordSummary(r) || "（無內容）"}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">家庭自行記錄{r.demo ? "・範例" : ""}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty title="沒有符合的紀錄">換個篩選條件，或到「新增紀錄」開始記錄。</Empty>
      )}
    </>
  );
}
