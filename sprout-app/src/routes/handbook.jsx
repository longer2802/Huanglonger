import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Baby, ChevronLeft, ChevronRight, HeartHandshake, Library } from "lucide-react";
import AppShell from "@/components/AppShell";
import { Btn, Empty } from "@/components/kit";
import { useActivePerson } from "@/components/SubjectSwitcher";
import BabyBook from "@/components/BabyBook";
import ContentCard from "@/components/ContentCard";
import { personName } from "@/components/CarePrompt";
import { useSprout } from "@/lib/store";
import { todayTW } from "@/lib/dates";
import { personContext } from "@/lib/stage";
import { cardsForPostpartumDay, cardsForPregnancyWeek } from "@/lib/content";
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

function nearestStop(stops, value) {
  let idx = 0;
  stops.forEach((s, i) => {
    if (value >= s.day) idx = i;
  });
  return idx;
}

function Handbook() {
  const { family, people } = useSprout();
  const active = useActivePerson();
  const today = todayTW();
  const mother = people.find((p) => p.role === "mother");
  const babies = people.filter((p) => p.role === "baby");
  const [tab, setTab] = useState(active?.role === "baby" ? "baby" : "mom");
  const [babyId, setBabyId] = useState(active?.role === "baby" ? active.id : babies[0]?.id);
  const baby = babies.find((b) => b.id === babyId) ?? babies[0] ?? null;
  const ctx = personContext(mother, family, today);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1" role="tablist" aria-label="手冊">
        {[
          ["mom", family?.stage === "born" ? "媽媽產後" : "孕期週記", HeartHandshake],
          ["baby", "寶寶手冊", Baby],
        ].map(([key, label, Icon]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("flex min-h-[48px] items-center justify-center gap-1.5 rounded-full text-[15px] font-bold", tab === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
            <Icon className="h-5 w-5" />
            {label}
          </button>
        ))}
      </div>
      {tab === "mom" ? (
        <>
          {ctx?.kind === "pregnant" ? <PregnancyWeeks key="preg" current={ctx.pregWeek} personId={mother.id} /> : null}
          {ctx?.kind === "postpartum" ? <Stops key="pp" stops={PP_STOPS} current={ctx.ppDay} cardsFor={cardsForPostpartumDay} personId={mother.id} title={`${personName(mother)}的產後照護`} /> : null}
        </>
      ) : (
        <>
          {babies.length > 1 ? (
            <div className="-mx-4 overflow-x-auto px-4">
              <div className="flex w-max gap-2">
                {babies.map((b) => (
                  <button key={b.id} type="button" onClick={() => setBabyId(b.id)} className={cn("inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold", b.id === baby?.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
                    <Baby className="h-4 w-4" />
                    {b.nickname}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <BabyBook key={baby?.id ?? "none"} baby={baby} />
        </>
      )}
      <Link to="/sources" className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-border bg-card text-[15px] font-semibold text-primary">
        <Library className="h-5 w-5" /> 官方資料與版本核對
      </Link>
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
          <ContentCard key={`${week}-${c.id}`} card={c} subjectId={personId} />
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
