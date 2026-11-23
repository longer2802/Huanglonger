import { useState } from "react";
import { Baby, FlaskConical, HeartHandshake, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Btn, Field, inputClass } from "./kit";
import { BabyForm, PregnancyForm } from "./Forms";
import { getState, replaceEverything, startBorn, startPregnancy, updatePerson } from "@/lib/store";
import { todayTW } from "@/lib/dates";
import { demoBorn, demoPregnancy } from "@/lib/demo";
import { ICON_192 } from "@/lib/icons";

function MotherFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4 rounded-3xl bg-secondary/50 p-4">
      <p className="flex items-center gap-1.5 text-[16px] font-bold text-primary">
        <HeartHandshake className="h-5 w-5" /> 媽媽的基本資料
      </p>
      <Field label="怎麼稱呼媽媽？" hint="例如：媽媽、小美媽。">
        {(id) => <input id={id} className={inputClass} maxLength={20} value={value.name} onChange={(e) => set({ name: e.target.value })} />}
      </Field>
      <Field label="產檢／照護院所">
        {(id) => <input id={id} className={inputClass} value={value.clinic} onChange={(e) => set({ clinic: e.target.value })} />}
      </Field>
      <Field label="院所電話" hint="身體不適時可以一鍵撥打。">
        {(id) => <input id={id} type="tel" inputMode="tel" className={inputClass} value={value.phone} onChange={(e) => set({ phone: e.target.value })} />}
      </Field>
    </div>
  );
}

// First visit: a welcome pop-up that collects the mother's (and baby's) basic
// information before anything else.
export default function Onboarding() {
  const today = todayTW();
  const [mode, setMode] = useState(null);
  const [mom, setMom] = useState({ name: "", clinic: "", phone: "" });
  const [preg, setPreg] = useState({ basis: "edd", edd: "", lmp: "", gaWeeks: "", gaDays: 0, gaDate: today });
  const [handbookDate, setHandbookDate] = useState(today);
  const [baby, setBaby] = useState({ nickname: "", birthDate: "" });
  const [delivery, setDelivery] = useState("");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (fn) => {
    setTried(true);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e.message.split("\n")[0]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
      <div className="fixed inset-0 bg-[hsl(336_60%_40%/0.12)]" aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="歡迎使用媽媽手冊E版" className="relative mx-auto max-w-lg space-y-5 rounded-[32px] border border-border bg-card/95 p-5 shadow-[0_20px_50px_-20px_hsl(336_75%_55%/0.5)] backdrop-blur">
        <div className="flex flex-col items-center gap-2 text-center">
          <img src={ICON_192} alt="" className="h-20 w-20 rounded-3xl shadow-sm" />
          <h1 className="text-[26px] font-extrabold text-primary">媽媽手冊E版</h1>
          <p className="text-[15px] text-muted-foreground">從第一次產檢，到寶寶的每一個第一次</p>
          <p className="rounded-full bg-secondary px-4 py-1.5 text-[14px] font-semibold text-secondary-foreground">歡迎！先花一分鐘填寫基本資料</p>
        </div>

        {!mode ? (
          <>
            <div className="grid gap-3">
              <button type="button" onClick={() => setMode("pregnant")} className="flex min-h-[84px] items-center gap-4 rounded-3xl bg-primary px-5 text-left text-primary-foreground shadow-md">
                <HeartHandshake className="h-9 w-9 shrink-0" />
                <span>
                  <span className="block text-xl font-bold">我在孕期</span>
                  <span className="block text-sm opacity-90">填媽媽資料與預產期</span>
                </span>
              </button>
              <button type="button" onClick={() => setMode("born")} className="flex min-h-[84px] items-center gap-4 rounded-3xl bg-accent px-5 text-left text-accent-foreground shadow-md">
                <Baby className="h-9 w-9 shrink-0" />
                <span>
                  <span className="block text-xl font-bold">寶寶已出生</span>
                  <span className="block text-sm opacity-90">填媽媽與寶寶的資料</span>
                </span>
              </button>
            </div>
            <p className="flex items-start gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              免登入，資料只存在這支手機。不需要身分證字號或健保卡號。
            </p>
            <div className="space-y-2 rounded-3xl border border-dashed border-border p-3">
              <p className="flex items-center gap-1.5 text-[14px] font-bold">
                <FlaskConical className="h-4 w-4 text-primary" /> 只是想先看看？
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Btn size="md" variant="outline" disabled={busy} onClick={() => run(() => replaceEverything(demoPregnancy()))}>
                  孕期範例
                </Btn>
                <Btn size="md" variant="outline" disabled={busy} onClick={() => run(() => replaceEverything(demoBorn()))}>
                  兩個寶寶範例
                </Btn>
              </div>
            </div>
            <p className="text-center text-[12px] leading-relaxed text-muted-foreground">展示測試版：衛教內容摘要自官方手冊，尚未經醫療專業審閱。</p>
          </>
        ) : null}

        {mode === "pregnant" ? (
          <div className="space-y-4">
            <MotherFields value={mom} onChange={setMom} />
            <div className="space-y-4 rounded-3xl bg-secondary/50 p-4">
              <p className="text-[16px] font-bold text-primary">孕期日期</p>
              <PregnancyForm value={preg} onChange={setPreg} showErrors={tried} />
              <Field label="領到媽媽手冊的日期" hint="只做紀錄，不影響孕週計算。">
                {(id) => <input id={id} type="date" max={today} className={inputClass} value={handbookDate} onChange={(e) => setHandbookDate(e.target.value)} />}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" onClick={() => setMode(null)}>
                返回
              </Btn>
              <Btn disabled={busy} onClick={() => run(() => startPregnancy({ pregnancy: preg, handbookDate, motherName: mom.name, clinic: mom.clinic, clinicPhone: mom.phone }))}>
                開始使用
              </Btn>
            </div>
          </div>
        ) : null}

        {mode === "born" ? (
          <div className="space-y-4">
            <MotherFields value={mom} onChange={setMom} />
            <div className="space-y-4 rounded-3xl bg-secondary/50 p-4">
              <p className="flex items-center gap-1.5 text-[16px] font-bold text-primary">
                <Baby className="h-5 w-5" /> 寶寶的基本資料
              </p>
              <BabyForm value={baby} onChange={setBaby} />
              <Field label="生產日期" hint="用來計算媽媽的產後天數；不填就用寶寶的出生日期。">
                {(id) => <input id={id} type="date" max={today} className={inputClass} value={delivery} onChange={(e) => setDelivery(e.target.value)} />}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" onClick={() => setMode(null)}>
                返回
              </Btn>
              <Btn
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await startBorn({ baby, deliveryDate: delivery || baby.birthDate, motherName: mom.name });
                    const m = getState().people.find((p) => p.role === "mother");
                    if (m && (mom.clinic || mom.phone)) await updatePerson({ ...m, clinic: mom.clinic, clinicPhone: mom.phone });
                  })
                }
              >
                開始使用
              </Btn>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
