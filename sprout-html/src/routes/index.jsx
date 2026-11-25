import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Baby, CalendarClock, HeartPulse, Sparkles } from "lucide-react";
import AppShell, { useCounts } from "@/components/AppShell";
import { Card, Empty, SectionTitle, Sheet } from "@/components/kit";
import SubjectSwitcher, { useActivePerson } from "@/components/SubjectSwitcher";
import ContentCard from "@/components/ContentCard";
import { CareForm, personName, useCareQueue, useMoodToday } from "@/components/CarePrompt";
import { TodoRow, TodoSheet } from "@/components/Todo";
import { KINDS, QUICK_KINDS, kindsFor } from "@/lib/records";
import { useSprout } from "@/lib/store";
import { formatDate, todayTW } from "@/lib/dates";
import { personContext } from "@/lib/stage";
import { nowAndNext } from "@/lib/reminders";
import { ANSWER_LABEL } from "@/lib/care";
import { RecordIcon } from "@/components/RecordIcon";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "今天・媽媽手冊E版" }] }),
  component: () => (
    <AppShell>
      <Today />
    </AppShell>
  ),
});

function Today() {
  const { family, todos } = useSprout();
  const person = useActivePerson();
  const counts = useCounts();
  const queue = useCareQueue();
  const mood = useMoodToday();
  const today = todayTW();
  const ctx = personContext(person, family, today);
  const [openTodo, setOpenTodo] = useState(null);
  const [careOpen, setCareOpen] = useState(null);

  const plan = nowAndNext(
    todos.filter((t) => t.subjectId === person?.id),
    today,
  );
  const pendingCare = [
    ...(mood.pending ? [{ person: mood.mother, stage: mood.stage, answer: mood.answer }] : []),
    ...queue.filter((q) => !q.answer || q.answer.answer === "later"),
  ];
  const answeredCare = queue.filter((q) => q.answer && q.answer.answer !== "later");
  const cards = ctx?.cards ?? [];
  const quick = kindsFor(person).filter((k) => QUICK_KINDS.includes(k.key) || ["prenatal", "postpartum", "visit"].includes(k.key)).slice(0, 6);

  if (!person || !ctx) return null;

  return (
    <div className="space-y-5">
      <SubjectSwitcher />

      <Card className="border-0 bg-gradient-to-br from-[hsl(var(--sage-soft))] to-[hsl(var(--apricot-soft))]">
        <p className="text-sm font-semibold text-muted-foreground">{personName(person)}・今天 {today.replaceAll("-", "/")}</p>
        <p className="mt-1 text-[28px] font-extrabold leading-tight text-foreground">{ctx.headline}</p>
        <p className="mt-1 text-[15px] text-foreground/80">{ctx.sub}</p>
        {ctx.kind === "pregnant" && ctx.status?.weeks >= 37 ? (
          <Link to="/me" hash="birth" className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-card px-4 text-[15px] font-bold text-primary">
            <Baby className="h-5 w-5" /> 寶寶出生了？切換到出生後
          </Link>
        ) : null}
        {ctx.kind === "pregnant" && ctx.status?.overdue ? (
          <p className="mt-3 rounded-2xl bg-card/80 px-3 py-2 text-[14px] leading-relaxed">已超過 40 週。手冊提到：超過 40 週還沒有產兆，醫師會評估是否需要催生，請依產檢院所安排。</p>
        ) : null}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            ["建議期已過", counts.overdue, "text-destructive"],
            ["近期", counts.soon, "text-primary"],
            ["待確認", counts.confirm + counts.care, "text-[hsl(var(--apricot-strong))]"],
          ].map(([label, n, cls]) => (
            <Link key={label} to="/calendar" className="rounded-2xl bg-card/85 px-2 py-2">
              <span className={`block text-2xl font-extrabold ${cls}`}>{n}</span>
              <span className="block text-xs font-semibold text-muted-foreground">{label}</span>
            </Link>
          ))}
        </div>
      </Card>

      <section>
        <SectionTitle action={<Link to="/calendar" className="text-sm font-semibold text-primary">行事曆 →</Link>}>本次需完成</SectionTitle>
        {plan.now.length ? (
          <div className="space-y-2">
            {plan.now.slice(0, 4).map(({ todo }) => (
              <TodoRow key={todo.id} todo={todo} onOpen={setOpenTodo} showPerson={false} />
            ))}
            {plan.now.length > 4 ? (
              <Link to="/calendar" className="block rounded-2xl bg-card px-3.5 py-2.5 text-center text-[14px] font-semibold text-primary">
                還有 {plan.now.length - 4} 項，到行事曆查看 →
              </Link>
            ) : null}
          </div>
        ) : (
          <p className="rounded-2xl bg-card px-3.5 py-3 text-[14px] text-muted-foreground">今天沒有需要完成的事項。</p>
        )}
      </section>

      <section>
        <SectionTitle>下次需完成</SectionTitle>
        {plan.next ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-primary">
              <CalendarClock className="h-4 w-4" /> {formatDate(plan.next.todo.status === "booked" ? plan.next.todo.bookedDate : plan.next.todo.suggestStart, { weekday: true })}・還有 {plan.next.left} 天
            </p>
            <TodoRow todo={plan.next.todo} onOpen={setOpenTodo} showPerson={false} />
            <p className="text-[12px] leading-relaxed text-muted-foreground">日期前一週與前一天會跳出提醒；日期過了會再問你是否已完成。</p>
          </div>
        ) : (
          <Empty title="目前沒有排定的下一件事">可以從衛教卡片或行事曆新增。</Empty>
        )}
      </section>

      <section>
        <SectionTitle>待回答關懷</SectionTitle>
        {pendingCare.length ? (
          <div className="space-y-2">
            {pendingCare.map((q) => (
              <button key={`${q.person.id}:${q.stage.key}`} type="button" onClick={() => setCareOpen(q)} className="flex w-full items-center gap-3 rounded-2xl border-2 border-primary/30 bg-card px-3.5 py-3 text-left">
                <HeartPulse className="h-6 w-6 shrink-0 text-primary" />
                <span className="flex-1">
                  <span className="block text-[15px] font-bold">{personName(q.person)}：{q.stage.title}</span>
                  <span className="block text-[13px] text-muted-foreground">{q.stage.key.startsWith("mood-") ? "點這裡填寫今天的心情" : "最近有出現以下狀況嗎？"}</span>
                </span>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-card px-3.5 py-3 text-[14px] text-muted-foreground">
            這個階段的關懷都回答過了。
            {answeredCare.map((q) => ` ${personName(q.person)}：${ANSWER_LABEL[q.answer.answer]}。`).join("")}
          </p>
        )}
      </section>

      <section>
        <SectionTitle action={<Link to="/handbook" className="text-sm font-semibold text-primary">手冊 →</Link>}>本階段衛教</SectionTitle>
        <div className="space-y-3">
          {cards.slice(0, 3).map((c) => (
            <ContentCard key={c.id} card={c} subjectId={person.id} />
          ))}
          {!cards.length ? <Empty icon={Sparkles} title="這個階段還沒有已核對的衛教內容" /> : null}
        </div>
      </section>

      <section>
        <SectionTitle action={<Link to="/record" search={{ tab: "timeline" }} className="text-sm font-semibold text-primary">時間軸 →</Link>}>快速記錄</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {quick.map((k) => (
            <Link key={k.key} to="/record" search={{ kind: k.key, subject: person.id }} className="flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-card text-center text-[14px] font-semibold">
              <RecordIcon name={KINDS[k.key].icon} className="h-6 w-6 text-primary" />
              {k.label}
            </Link>
          ))}
        </div>
      </section>

      <p className="pb-2 text-center text-[12px] leading-relaxed text-muted-foreground">所有紀錄皆為家庭自行記錄。衛教摘要自官方手冊、未經醫療專業審閱；身體不適請詢問醫療院所。</p>

      {openTodo ? <TodoSheet todo={openTodo} onClose={() => setOpenTodo(null)} /> : null}
      <Sheet open={!!careOpen} onClose={() => setCareOpen(null)} title={careOpen ? (careOpen.stage.key.startsWith("mood-") ? `${personName(careOpen.person)}，今天心情好嗎？` : `${personName(careOpen.person)}：最近有出現以下狀況嗎？`) : ""} tall>
        {careOpen ? <CareForm person={careOpen.person} stage={careOpen.stage} onDone={() => setCareOpen(null)} /> : null}
      </Sheet>
    </div>
  );
}
