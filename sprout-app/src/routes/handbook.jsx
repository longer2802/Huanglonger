import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Library } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Btn, Empty } from "@/components/kit";
import SubjectSwitcher, { useActivePerson } from "@/components/SubjectSwitcher";
import ContentCard from "@/components/ContentCard";
import { personName } from "@/components/CarePrompt";
import { useSprout } from "@/lib/store";
import { todayTW } from "@/lib/dates";
import { personContext } from "@/lib/stage";
import { cardsForBabyAge, cardsForPostpartumDay, cardsForPregnancyWeek, MONTH_DAYS } from "@/lib/content";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/handbook")({
  ssr: false,
  head: () => ({ meta: [{ title: "手冊・小芽" }] }),
  component: () => (
    <AppShell>
      <Handbook />
    </AppShell>
  ),
});

const WEEKS = Array.from({ length: 42 }, (_, i) => i + 1);
const PP_STOPS = [
  { day: 0, label: "產後 1 個月內" },
  { day: 31, label: "產後 1～3 個月" },
  { day: 93, label: "產後 3 個月以後" },
];
const AGE_STOPS = [
  { day: 0, label: "出生 6 天內" },
  { day: 14, label: "2 週～2 個月" },
  { day: MONTH_DAYS(2), label: "2～4 個月" },
  { day: MONTH_DAYS(4), label: "4～6 個月" },
  { day: MONTH_DAYS(6), label: "6 個月～1 歲" },
  { day: MONTH_DAYS(12), label: "1～1 歲半" },
  { day: MONTH_DAYS(18), label: "1 歲半～2 歲" },
  { day: MONTH_DAYS(24), label: "2～3 歲" },
  { day: MONTH_DAYS(36), label: "3～5 歲" },
  { day: MONTH_DAYS(60), label: "5～7 歲" },
];

function nearestStop(stops, value) {
  let idx = 0;
  stops.forEach((s, i) => {
    if (value >= s.day) idx = i;
  });
  return idx;
}

function Handbook() {
  const { family } = useSprout();
  const person = useActivePerson();
  const today = todayTW();
  const ctx = personContext(person, family, today);
  return (
    <div className="space-y-4">
      <SubjectSwitcher />
      {ctx?.kind === "pregnant" ? <PregnancyWeeks key={person.id} current={ctx.pregWeek} personId={person.id} /> : null}
      {ctx?.kind === "postpartum" ? <Stops key={person.id} stops={PP_STOPS} current={ctx.ppDay} cardsFor={cardsForPostpartumDay} personId={person.id} title={`${personName(person)}的產後照護`} /> : null}
      {ctx?.kind === "baby" ? <Stops key={person.id} stops={AGE_STOPS} current={ctx.ageDays} cardsFor={cardsForBabyAge} personId={person.id} title={`${personName(person)}的成長手冊`} /> : null}
      <Link to="/sources" className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[15px] font-semibold text-primary">
        <Library className="h-5 w-5" /> 官方資料與版本核對
      </Link>
      <p className="text-center text-[12px] leading-relaxed text-muted-foreground">只顯示已對照官方原文的內容；尚待確認版次的內容保留為草稿，不會出現在這裡。</p>
    </div>
  );
}

function PregnancyWeeks({ current, personId }) {
  const start = Math.min(Math.max(current, 1), 42);
  const [week, setWeek] = useState(start);
  const stripRef = useRef(null);
  useEffect(() => {
    stripRef.current?.querySelector(`[data-week="${week}"]`)?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [week]);
  const cards = cardsForPregnancyWeek(week);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <Btn size="md" variant="outline" aria-label="上一週" disabled={week <= 1} onClick={() => setWeek((w) => w - 1)}>
          <ChevronLeft className="h-5 w-5" />
        </Btn>
        <div className="text-center">
          <p className="text-2xl font-extrabold">第 {week} 週{week === 42 && current > 42 ? "以上" : ""}</p>
          <p className="text-xs text-muted-foreground">{week === Math.min(current, 42) ? "這是本週" : `本週是第 ${current} 週`}</p>
        </div>
        <Btn size="md" variant="outline" aria-label="下一週" disabled={week >= 42} onClick={() => setWeek((w) => w + 1)}>
          <ChevronRight className="h-5 w-5" />
        </Btn>
      </div>
      <div ref={stripRef} className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-1.5">
          {WEEKS.map((w) => (
            <button key={w} type="button" data-week={w} onClick={() => setWeek(w)} aria-label={`第 ${w} 週`} className={cn("h-11 w-11 rounded-full text-[15px] font-bold", w === week ? "bg-primary text-primary-foreground" : w === Math.min(current, 42) ? "border-2 border-primary bg-card text-primary" : "bg-card text-foreground")}>
              {w}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {cards.map((c) => (
          <ContentCard key={`${week}-${c.id}`} card={c} subjectId={personId} defaultOpen={c.id.startsWith("preg-visit")} />
        ))}
        {!cards.length ? <Empty title="這週沒有已核對的內容" /> : null}
      </div>
    </>
  );
}

function Stops({ stops, current, cardsFor, personId, title }) {
  const [idx, setIdx] = useState(nearestStop(stops, current));
  const stop = stops[idx];
  const cards = cardsFor(stop.day);
  return (
    <>
      <h1 className="text-xl font-extrabold">{title}</h1>
      <div className="-mx-4 overflow-x-auto px-4 pb-1">
        <div className="flex w-max gap-2">
          {stops.map((s, i) => (
            <button key={s.label} type="button" onClick={() => setIdx(i)} className={cn("min-h-[44px] rounded-full border px-4 text-[14px] font-semibold", i === idx ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card", i === nearestStop(stops, current) && i !== idx && "border-primary text-primary")}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        {cards.map((c) => (
          <ContentCard key={`${idx}-${c.id}`} card={c} subjectId={personId} />
        ))}
        {!cards.length ? <Empty title="這個階段還沒有已核對的內容" /> : null}
      </div>
    </>
  );
}
