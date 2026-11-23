import { useMemo, useState } from "react";
import { ExternalLink, HeartPulse, Phone } from "lucide-react";
import { toast } from "sonner";
import { AlertBox, Btn, Sheet } from "./kit";
import { saveAnswer, saveRecord, updateSettings, useSprout } from "@/lib/store";
import { nowTimeTW, todayTW } from "@/lib/dates";
import { personContext } from "@/lib/stage";
import { answerId, moodStage } from "@/lib/care";
import { sourceOf } from "@/lib/sources";
import { cn } from "@/lib/utils";

export function personName(p) {
  return p?.role === "mother" ? p.nickname || "媽媽" : p?.nickname || "寶寶";
}

// Stage check-ins (danger signs, newborn) that apply now. They are listed on
// 今天 and never pop up by themselves.
export function useCareQueue() {
  const { people, family, answers } = useSprout();
  return useMemo(() => {
    const today = todayTW();
    const list = [];
    for (const p of people) {
      const ctx = personContext(p, family, today);
      if (!ctx?.care) continue;
      const a = answers.find((x) => x.id === answerId(p.id, ctx.care));
      list.push({ person: p, stage: ctx.care, answer: a ?? null });
    }
    return list;
  }, [people, family, answers]);
}

// Today's mood check for the mother.
export function useMoodToday() {
  const { people, answers, settings, family } = useSprout();
  const today = todayTW();
  const mother = people.find((p) => p.role === "mother");
  const stage = moodStage(today);
  const answer = mother ? answers.find((a) => a.id === answerId(mother.id, stage)) ?? null : null;
  const pending = !!family && !!mother && (!answer || answer.answer === "later");
  return { mother, stage, answer, pending, dismissedToday: settings.moodDismissedOn === today, today };
}

function ClinicContact({ person, mother }) {
  const phone = person.clinicPhone || (person.role === "baby" ? "" : mother?.clinicPhone);
  const clinic = person.clinic || "";
  if (phone) {
    return (
      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-base font-bold text-primary-foreground">
        <Phone className="h-5 w-5" /> 撥打{clinic ? `「${clinic}」` : "照護院所"}
      </a>
    );
  }
  return <p className="rounded-2xl bg-secondary px-3 py-2 text-sm">還沒有存院所電話。可到「我的」幫{personName(person)}加上照護院所電話，下次就能一鍵撥打。</p>;
}

export function CareForm({ person, stage, onDone }) {
  const { people } = useSprout();
  const mother = people.find((p) => p.role === "mother");
  const [step, setStep] = useState("ask");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const src = sourceOf(stage.source.id);

  const finish = async (answer, items = []) => {
    setBusy(true);
    try {
      if (answer === "yes" && items.length) {
        await saveRecord({
          subjectId: person.id,
          kind: "symptom",
          date: todayTW(),
          time: nowTimeTW(),
          fields: { description: items.join("、"), note: `由「${stage.title}」關懷問題建立` },
        });
      }
      await saveAnswer({ subjectId: person.id, stage, answer, items });
      if (answer === "none") toast.success("已記下：這次沒有觀察到所列情況。");
      if (answer === "later") toast("已保留在「今天」的待回答關懷。");
      onDone?.(answer);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === "yes") {
    return (
      <div className="space-y-3">
        <p className="text-[15px] font-semibold">請勾選{personName(person)}出現的狀況：</p>
        <div className="space-y-2">
          {stage.items.map((item) => {
            const on = picked.includes(item);
            return (
              <label key={item} className={cn("flex min-h-[48px] items-center gap-3 rounded-2xl border px-3 py-2 text-[15px]", on ? "border-destructive bg-[hsl(var(--alert-bg))]" : "border-border bg-card")}>
                <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--destructive))]" checked={on} onChange={() => setPicked((v) => (on ? v.filter((x) => x !== item) : [...v, item]))} />
                {item}
              </label>
            );
          })}
        </div>
        {stage.urgent ? <AlertBox title="官方資料寫明的行動" action={stage.action} /> : <p className="rounded-2xl bg-accent px-3 py-2 text-[15px] font-semibold text-accent-foreground">{stage.action}</p>}
        <ClinicContact person={person} mother={mother} />
        <Btn className="w-full" disabled={!picked.length || busy} onClick={() => finish("yes", picked)}>
          記錄這些狀況
        </Btn>
        <Btn variant="ghost" className="w-full" onClick={() => setStep("ask")}>
          返回
        </Btn>
      </div>
    );
  }

  if (step === "unsure") {
    return (
      <div className="space-y-3">
        <p className="text-[15px] leading-relaxed">不確定的時候，可以直接詢問照護院所，或看看官方原文怎麼說。</p>
        {stage.urgent ? <AlertBox title="官方資料寫明的行動" action={stage.action} /> : null}
        <ClinicContact person={person} mother={mother} />
        <a href={src?.url} target="_blank" rel="noopener noreferrer" className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 text-[15px] font-semibold text-primary">
          查看官方資料（{src?.name}{stage.source.page ? ` ${stage.source.page}` : ""}） <ExternalLink className="h-4 w-4" />
        </a>
        <Btn className="w-full" variant="soft" disabled={busy} onClick={() => finish("unsure")}>
          記下「我不確定」
        </Btn>
        <Btn variant="ghost" className="w-full" onClick={() => setStep("ask")}>
          返回
        </Btn>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-1 rounded-2xl bg-secondary/60 px-4 py-3 text-[15px] leading-relaxed">
        {stage.items.map((i) => (
          <li key={i} className="list-disc pl-0.5 marker:text-primary">
            {i}
          </li>
        ))}
      </ul>
      {stage.urgent ? <AlertBox title="出現任何一項時" action={stage.action} /> : null}
      <div className="grid gap-2">
        <Btn disabled={busy} onClick={() => finish("none")}>
          目前沒有這些狀況
        </Btn>
        <Btn variant="danger" disabled={busy} onClick={() => setStep("yes")}>
          有出現
        </Btn>
        <Btn variant="apricot" disabled={busy} onClick={() => setStep("unsure")}>
          我不確定
        </Btn>
      </div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        回答「目前沒有這些狀況」只代表這次沒有觀察到上面的情況，不是健康評估。媽媽手冊E版不做診斷；有疑問請詢問醫療院所。來源：{src?.name}（{src?.edition}）{stage.source.page}。
      </p>
    </div>
  );
}

// The daily mood pop-up. It opens once a day. Answering records it and closes
// it; closing without answering tucks it away (a heart dot on 今天 and a row
// in 待回答關懷) until tomorrow.
export default function DailyMood() {
  const { mother, stage, answer, pending, dismissedToday, today } = useMoodToday();
  const [closed, setClosed] = useState(false);
  const open = pending && !answer && !dismissedToday && !closed;
  if (!mother) return null;
  const close = () => {
    setClosed(true);
    updateSettings({ moodDismissedOn: today });
  };
  return (
    <Sheet open={open} onClose={close} title={`${personName(mother)}，今天心情好嗎？`}>
      <div className="mb-3 flex items-center gap-2 rounded-2xl bg-secondary px-3 py-2 text-[14px]">
        <HeartPulse className="h-5 w-5 shrink-0 text-primary" />
        <span>每天一次的心情小關懷。不想回答可以先關掉，之後在「今天」也能填。</span>
      </div>
      <CareForm person={mother} stage={stage} onDone={() => setClosed(true)} />
    </Sheet>
  );
}
