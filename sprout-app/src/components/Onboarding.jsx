import { useState } from "react";
import { Baby, FlaskConical, HeartHandshake, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Field, inputClass } from "./kit";
import { BabyForm, PregnancyForm } from "./Forms";
import { replaceEverything, startBorn, startPregnancy } from "@/lib/store";
import { todayTW } from "@/lib/dates";
import { demoBorn, demoPregnancy } from "@/lib/demo";
import { ICON_192 } from "@/lib/icons";

export default function Onboarding() {
  const today = todayTW();
  const [mode, setMode] = useState(null);
  const [preg, setPreg] = useState({ basis: "edd", edd: "", lmp: "", gaWeeks: "", gaDays: 0, gaDate: today });
  const [handbookDate, setHandbookDate] = useState(today);
  const [motherName, setMotherName] = useState("");
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
    <div className="min-h-dvh bg-background px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+1.5rem)]">
      <div className="mx-auto max-w-lg space-y-5">
        <div className="flex items-center gap-3">
          <img src={ICON_192} alt="" className="h-14 w-14 rounded-2xl shadow-sm" />
          <div>
            <h1 className="text-3xl font-extrabold text-primary">小芽</h1>
            <p className="text-[15px] text-muted-foreground">從第一次產檢，到寶寶的每一個第一次</p>
          </div>
        </div>

        {!mode ? (
          <>
            <div className="grid gap-3">
              <button type="button" onClick={() => setMode("pregnant")} className="flex min-h-[88px] items-center gap-4 rounded-3xl bg-primary px-5 text-left text-primary-foreground shadow-md">
                <HeartHandshake className="h-9 w-9 shrink-0" />
                <span>
                  <span className="block text-xl font-bold">我在孕期</span>
                  <span className="block text-sm opacity-90">從今天的孕週開始，追蹤產檢與衛教</span>
                </span>
              </button>
              <button type="button" onClick={() => setMode("born")} className="flex min-h-[88px] items-center gap-4 rounded-3xl bg-accent px-5 text-left text-accent-foreground shadow-md">
                <Baby className="h-9 w-9 shrink-0" />
                <span>
                  <span className="block text-xl font-bold">寶寶已出生</span>
                  <span className="block text-sm opacity-90">產後照護、疫苗、健兒門診與日常</span>
                </span>
              </button>
            </div>
            <Card className="space-y-2">
              <p className="flex items-center gap-1.5 text-[15px] font-bold">
                <ShieldCheck className="h-5 w-5 text-primary" /> 資料只存在這支手機
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">免登入。不需要身分證字號或健保卡號。換手機或清除瀏覽器資料前，請先到「我的」做加密備份。</p>
            </Card>
            <Card className="space-y-2 border-dashed">
              <p className="flex items-center gap-1.5 text-[15px] font-bold">
                <FlaskConical className="h-5 w-5 text-[hsl(var(--apricot-strong))]" /> 先看看範例
              </p>
              <p className="text-sm text-muted-foreground">載入虛構的範例家庭，隨時可在「我的」一鍵清除。</p>
              <div className="grid grid-cols-2 gap-2">
                <Btn size="md" variant="outline" disabled={busy} onClick={() => run(() => replaceEverything(demoPregnancy()))}>
                  孕期範例
                </Btn>
                <Btn size="md" variant="outline" disabled={busy} onClick={() => run(() => replaceEverything(demoBorn()))}>
                  兩個寶寶範例
                </Btn>
              </div>
            </Card>
            <p className="text-center text-[12px] leading-relaxed text-muted-foreground">展示測試版：衛教內容摘要自官方手冊，尚未經醫療專業審閱，請使用範例資料試用。</p>
          </>
        ) : null}

        {mode === "pregnant" ? (
          <Card className="space-y-4">
            <h2 className="text-xl font-bold">設定孕期日期</h2>
            <PregnancyForm value={preg} onChange={setPreg} showErrors={tried} />
            <Field label="領到媽媽手冊的日期" hint="只做紀錄，不影響孕週計算。">
              {(id) => <input id={id} type="date" max={today} className={inputClass} value={handbookDate} onChange={(e) => setHandbookDate(e.target.value)} />}
            </Field>
            <Field label="怎麼稱呼媽媽？" hint="例如：媽媽、小芽媽。">
              {(id) => <input id={id} className={inputClass} maxLength={20} value={motherName} onChange={(e) => setMotherName(e.target.value)} />}
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" onClick={() => setMode(null)}>
                返回
              </Btn>
              <Btn disabled={busy} onClick={() => run(() => startPregnancy({ pregnancy: preg, handbookDate, motherName }))}>
                開始使用
              </Btn>
            </div>
          </Card>
        ) : null}

        {mode === "born" ? (
          <Card className="space-y-4">
            <h2 className="text-xl font-bold">寶寶的基本資料</h2>
            <BabyForm value={baby} onChange={setBaby} />
            <Field label="生產日期" hint="用來計算媽媽的產後天數；不填就用寶寶的出生日期。">
              {(id) => <input id={id} type="date" max={today} className={inputClass} value={delivery} onChange={(e) => setDelivery(e.target.value)} />}
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" onClick={() => setMode(null)}>
                返回
              </Btn>
              <Btn disabled={busy} onClick={() => run(() => startBorn({ baby, deliveryDate: delivery || baby.birthDate, motherName }))}>
                開始使用
              </Btn>
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
