import { useMemo } from "react";
import { Field, inputClass } from "./kit";
import { computeEdd, formatDate, gestationalAge, todayTW, validatePregnancy } from "@/lib/dates";
import { cn } from "@/lib/utils";

const BASES = [
  { value: "edd", label: "醫師確認的預產期", hint: "建議優先使用" },
  { value: "lmp", label: "末次月經第一天", hint: "以 280 天推算" },
  { value: "ga", label: "某天的已知孕週＋天數", hint: "例：超音波當天 12 週 3 天" },
];

export function PregnancyForm({ value, onChange, showErrors }) {
  const today = todayTW();
  const set = (patch) => onChange({ ...value, ...patch });
  const errors = useMemo(() => validatePregnancy(value, today), [value, today]);
  const preview = !errors.length ? (() => {
    const edd = computeEdd(value);
    const ga = gestationalAge(edd, today);
    return { edd, ga };
  })() : null;

  return (
    <div className="space-y-4">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-[15px] font-semibold">用哪一種日期計算孕週？</legend>
        {BASES.map((b) => (
          <label key={b.value} className={cn("flex min-h-[56px] cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2", value.basis === b.value ? "border-primary bg-secondary" : "border-border bg-card")}>
            <input type="radio" name="basis" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={value.basis === b.value} onChange={() => set({ basis: b.value })} />
            <span>
              <span className="block text-[15px] font-semibold">{b.label}</span>
              <span className="block text-xs text-muted-foreground">{b.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {value.basis === "edd" ? (
        <Field label="預產期" required>
          {(id) => <input id={id} type="date" className={inputClass} value={value.edd || ""} onChange={(e) => set({ edd: e.target.value })} />}
        </Field>
      ) : null}
      {value.basis === "lmp" ? (
        <Field label="末次月經第一天" required>
          {(id) => <input id={id} type="date" max={today} className={inputClass} value={value.lmp || ""} onChange={(e) => set({ lmp: e.target.value })} />}
        </Field>
      ) : null}
      {value.basis === "ga" ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="孕週" required>
              {(id) => <input id={id} type="number" inputMode="numeric" min="0" max="44" className={inputClass} value={value.gaWeeks ?? ""} onChange={(e) => set({ gaWeeks: e.target.value === "" ? "" : Number(e.target.value) })} />}
            </Field>
            <Field label="＋天數" required>
              {(id) => <input id={id} type="number" inputMode="numeric" min="0" max="6" className={inputClass} value={value.gaDays ?? 0} onChange={(e) => set({ gaDays: e.target.value === "" ? "" : Number(e.target.value) })} />}
            </Field>
          </div>
          <Field label="這是哪一天確認的？" required>
            {(id) => <input id={id} type="date" max={today} className={inputClass} value={value.gaDate || ""} onChange={(e) => set({ gaDate: e.target.value })} />}
          </Field>
        </div>
      ) : null}

      {preview ? (
        <div className="rounded-2xl bg-secondary px-4 py-3 text-[15px] leading-relaxed">
          今天是 <b>孕 {preview.ga.weeks} 週 + {preview.ga.days} 天</b>，預產期 <b>{formatDate(preview.edd, { weekday: true })}</b>
          {preview.ga.total > 280 ? <span className="mt-1 block font-semibold text-[hsl(var(--apricot-strong))]">已超過 40 週，App 會繼續顯示後期內容。</span> : null}
        </div>
      ) : showErrors ? (
        <ul role="alert" className="space-y-1 rounded-2xl border-2 border-destructive bg-[hsl(var(--alert-bg))] px-4 py-3 text-[15px] font-semibold text-[hsl(var(--alert-fg))]">
          {errors.map((e) => (
            <li key={e}>⚠ {e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BabyForm({ value, onChange, full = true }) {
  const today = todayTW();
  const set = (patch) => onChange({ ...value, ...patch });
  const num = (name, label, unit, step = "0.1") => (
    <Field label={`${label}（${unit}）`}>
      {(id) => <input id={id} type="number" inputMode="decimal" step={step} className={inputClass} value={value[name] ?? ""} onChange={(e) => set({ [name]: e.target.value })} />}
    </Field>
  );
  return (
    <div className="space-y-4">
      <Field label="寶寶暱稱" required hint="小名就好，不需要真實姓名。">
        {(id) => <input id={id} className={inputClass} maxLength={20} value={value.nickname || ""} onChange={(e) => set({ nickname: e.target.value })} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="出生日期" required>
          {(id) => <input id={id} type="date" max={today} className={inputClass} value={value.birthDate || ""} onChange={(e) => set({ birthDate: e.target.value })} />}
        </Field>
        <Field label="出生時間">
          {(id) => <input id={id} type="time" className={inputClass} value={value.birthTime || ""} onChange={(e) => set({ birthTime: e.target.value })} />}
        </Field>
      </div>
      {full ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            {num("gestWeeks", "出生週數", "週", "1")}
            {num("birthWeight", "出生體重", "kg", "0.01")}
            {num("birthLength", "出生身長", "cm")}
            {num("birthHead", "出生頭圍", "cm")}
          </div>
          <Field label="照護院所">
            {(id) => <input id={id} className={inputClass} value={value.clinic || ""} onChange={(e) => set({ clinic: e.target.value })} />}
          </Field>
          <Field label="院所電話" hint="存了之後，關懷提醒可以一鍵撥打。">
            {(id) => <input id={id} type="tel" inputMode="tel" className={inputClass} value={value.clinicPhone || ""} onChange={(e) => set({ clinicPhone: e.target.value })} />}
          </Field>
          <Field label="過敏">
            {(id) => <input id={id} className={inputClass} value={value.allergies || ""} onChange={(e) => set({ allergies: e.target.value })} />}
          </Field>
          <Field label="備註">
            {(id) => <textarea id={id} rows={2} className={cn(inputClass, "py-2")} value={value.note || ""} onChange={(e) => set({ note: e.target.value })} />}
          </Field>
          <p className="text-[13px] leading-relaxed text-muted-foreground">早產或有特殊醫囑時，疫苗與健兒門診的實際日期請依醫療院所安排；行事曆中的每一項都可以自己改日期。</p>
        </>
      ) : null}
    </div>
  );
}
