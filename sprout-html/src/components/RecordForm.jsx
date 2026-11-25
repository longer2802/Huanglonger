import { useState } from "react";
import { History, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Btn, Confirm, Field, inputClass, Sheet } from "./kit";
import { personName } from "./CarePrompt";
import { KINDS, recordSummary } from "@/lib/records";
import { deleteRecord, saveRecord, useSprout } from "@/lib/store";
import { nowTimeTW, todayTW } from "@/lib/dates";
import { cn } from "@/lib/utils";

function FieldInput({ field, value, onChange, id }) {
  if (field.type === "textarea") {
    return <textarea id={id} rows={3} className={cn(inputClass, "py-2.5")} placeholder={field.placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (field.type === "select") {
    const options = field.options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
    return (
      <select id={id} className={inputClass} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">請選擇</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (field.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <input id={id} type="number" inputMode="decimal" step={field.step || "any"} min={field.min} className={inputClass} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
        {field.unit ? <span className="w-14 shrink-0 text-[15px] font-semibold text-muted-foreground">{field.unit}</span> : null}
      </div>
    );
  }
  return <input id={id} type={field.type === "date" ? "date" : field.type === "time" ? "time" : "text"} className={inputClass} placeholder={field.placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
}

export default function RecordForm({ kind, subjectId, existing, onSaved, onCancel }) {
  const { people } = useSprout();
  const def = KINDS[kind];
  const person = people.find((p) => p.id === subjectId);
  const [date, setDate] = useState(existing?.date ?? todayTW());
  const [time, setTime] = useState(existing?.time ?? (["prenatal", "postpartum", "visit", "growth", "milestone", "custom"].includes(kind) ? "" : nowTimeTW()));
  const [fields, setFields] = useState(existing?.fields ?? (kind === "vaccine" ? { dose: "1" } : {}));
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await saveRecord({ id: existing?.id, subjectId, kind, date, time, fields });
      toast.success(existing ? "已更新紀錄" : "已儲存紀錄");
      onSaved?.();
    } catch (e) {
      setErrors(e.message.split("\n"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-secondary px-3 py-2 text-[14px]">
        <b>{personName(person)}</b>・{def.label}
        <span className="ml-1 text-muted-foreground">（家庭自行記錄）</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="日期" required hint="可以補登過去的日期。">
          {(id) => <input id={id} type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={kind === "sleep" ? "入睡時間" : "時間"}>
          {(id) => <input id={id} type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} />}
        </Field>
      </div>
      {def.fields
        .filter((f) => !f.showIf || Object.entries(f.showIf).every(([k, v]) => fields[k] === v))
        .map((f) => (
          <Field key={f.name} label={f.label} required={f.required} hint={f.help}>
            {(id) => <FieldInput id={id} field={f} value={fields[f.name]} onChange={(v) => setFields((x) => ({ ...x, [f.name]: v }))} />}
          </Field>
        ))}
      {kind === "vaccine" ? <p className="text-[13px] leading-relaxed text-muted-foreground">同一位家人、同一品項的同一劑只能登記一次，避免重複。預約請到「行事曆」。</p> : null}
      {kind === "prenatal" || kind === "visit" ? <p className="text-[13px] leading-relaxed text-muted-foreground">請照報告與醫囑原文抄寫；媽媽手冊E版不解讀數值，也不調整用藥。</p> : null}
      {errors.length ? (
        <ul role="alert" className="space-y-1 rounded-2xl border-2 border-destructive bg-[hsl(var(--alert-bg))] px-3 py-2 text-[14px] font-semibold text-[hsl(var(--alert-fg))]">
          {errors.map((e) => (
            <li key={e}>⚠ {e}</li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="outline" onClick={onCancel}>
          取消
        </Btn>
        <Btn disabled={busy} onClick={save}>
          儲存
        </Btn>
      </div>
      {existing ? (
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="ghost" size="md" onClick={() => setShowHistory(true)}>
            <History className="h-4 w-4" /> 修改歷史（{existing.history?.length ?? 1}）
          </Btn>
          <Btn variant="ghost" size="md" className="text-destructive" onClick={() => setConfirmDel(true)}>
            <Trash2 className="h-4 w-4" /> 刪除
          </Btn>
        </div>
      ) : null}
      <Confirm
        open={confirmDel}
        title="刪除這筆紀錄？"
        body="刪除後無法復原。"
        danger
        confirmLabel="刪除"
        onCancel={() => setConfirmDel(false)}
        onConfirm={async () => {
          await deleteRecord(existing.id);
          toast.success("已刪除");
          setConfirmDel(false);
          onSaved?.();
        }}
      />
      <Sheet open={showHistory} onClose={() => setShowHistory(false)} title="修改歷史">
        <ol className="space-y-2">
          {(existing?.history ?? []).map((h, i) => (
            <li key={`${h.at}-${i}`} className="rounded-2xl border border-border bg-card px-3 py-2 text-[14px]">
              <p className="font-semibold">
                {h.action === "create" ? "建立" : "修改"}・{new Date(h.at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
              </p>
              {h.before ? <p className="text-muted-foreground">修改前：{h.before.date} {h.before.time} {recordSummary({ kind, fields: h.before.fields })}</p> : null}
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}
