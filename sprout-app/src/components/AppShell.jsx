import { useEffect, useMemo, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, CalendarDays, FlaskConical, Home, Loader2, Plus, UserRound } from "lucide-react";
import { reload, useSprout } from "@/lib/store";
import { todayTW } from "@/lib/dates";
import { todoState } from "@/lib/rules";
import { personContext } from "@/lib/stage";
import { answerId, moodStage } from "@/lib/care";
import { cn } from "@/lib/utils";
import { ICON_192 } from "@/lib/icons";
import Onboarding, { demoPrompt } from "./Onboarding";
import DailyMood, { useMoodToday } from "./CarePrompt";
import Reminders from "./Reminders";

let started = false;

export const APP_NAME = "媽媽手冊E版";

export function useCounts() {
  const { todos, people, family, answers } = useSprout();
  return useMemo(() => {
    const today = todayTW();
    let overdue = 0;
    let soon = 0;
    let confirm = 0;
    for (const t of todos) {
      const s = todoState(t, today);
      if (s === "overdue") overdue += 1;
      else if (s === "soon") soon += 1;
      else if (s === "confirm") confirm += 1;
      else if (s === "booked" && t.bookedDate <= todayPlus(today, 7)) soon += 1;
    }
    let care = 0;
    for (const p of people) {
      const ctx = personContext(p, family, today);
      if (!ctx?.care) continue;
      const a = answers.find((x) => x.id === answerId(p.id, ctx.care));
      if (!a || a.answer === "later") care += 1;
    }
    const mother = people.find((p) => p.role === "mother");
    const mood = mother ? answers.find((x) => x.id === answerId(mother.id, moodStage(today))) : null;
    const moodPending = !!mother && (!mood || mood.answer === "later");
    return { overdue, soon, confirm, care: care + (moodPending ? 1 : 0), moodPending, attention: overdue + confirm };
  }, [todos, people, family, answers]);
}

function todayPlus(today, n) {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const NAV = [
  { to: "/", label: "今天", icon: Home, heart: true },
  { to: "/handbook", label: "手冊", icon: BookOpen },
  { to: "/record", label: "記錄", icon: Plus, center: true },
  { to: "/calendar", label: "行事曆", icon: CalendarDays, badge: true },
  { to: "/me", label: "我的", icon: UserRound },
];

function BottomNav({ attention, carePending }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav aria-label="主選單" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.map(({ to, label, icon: Icon, center, badge, heart }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <li key={to}>
              <Link to={to} className={cn("relative flex min-h-[64px] flex-col items-center justify-center gap-0.5 text-[12px] font-semibold", active ? "text-primary" : "text-muted-foreground")}>
                {center ? (
                  <span className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background">
                    <Icon className="h-7 w-7" />
                  </span>
                ) : (
                  <Icon className="h-6 w-6" />
                )}
                <span>{center ? "＋記錄" : label}</span>
                {badge && attention > 0 ? (
                  <span className="absolute right-[22%] top-2 min-w-[20px] rounded-full bg-destructive px-1 text-center text-[11px] font-bold leading-5 text-destructive-foreground" aria-label={`${attention} 項需要處理`}>
                    {attention}
                  </span>
                ) : null}
                {heart && carePending ? (
                  <span className="absolute right-[26%] top-2 text-[14px] leading-none text-primary" aria-label="今天的心情關懷還沒填">
                    ♥
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// App icon badge, only where the browser supports it (installed PWA on some
// platforms). The result is reported on the 我的 page.
function useAppBadge(count) {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const p = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge?.();
    p?.catch?.(() => {});
  }, [count]);
}

export default function AppShell({ children, allowWithoutFamily = false }) {
  const s = useSprout();
  const counts = useCounts();
  const mood = useMoodToday();
  const [, bump] = useState(0);
  const showDemoPrompt = !!s.family?.demo && !demoPrompt.closed;
  useAppBadge(s.family ? counts.attention + counts.care : 0);

  useEffect(() => {
    if (!started) {
      started = true;
      reload();
    }
  }, []);

  if (!s.ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="載入中" />
      </div>
    );
  }
  if (s.error) {
    return (
      <div className="min-h-dvh bg-background p-6">
        <p className="rounded-2xl border-2 border-destructive p-4 text-destructive">⚠ {s.error}</p>
      </div>
    );
  }
  if (!s.family && !allowWithoutFamily) return <Onboarding />;

  return (
    <div className="min-h-dvh bg-background pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <img src={ICON_192} alt="" className="h-10 w-10 rounded-xl" />
            <div>
              <p className="text-lg font-extrabold leading-tight text-primary">{APP_NAME}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">從第一次產檢，到寶寶的每一個第一次</p>
            </div>
          </div>
          {s.family?.demo ? (
            <button type="button" onClick={() => {
              demoPrompt.closed = false;
              bump((n) => n + 1);
            }} className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground">
              <FlaskConical className="h-3.5 w-3.5" /> 範例・填我的資料
            </button>
          ) : null}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pt-3">{children}</main>
      {/* One pop-up at a time: basic details (example data only) → today's mood → date reminders. */}
      {showDemoPrompt ? (
        <Onboarding
          asPopup
          onClose={() => {
            demoPrompt.closed = true;
            bump((n) => n + 1);
          }}
        />
      ) : s.family ? (
        <>
          <DailyMood />
          {mood.pending && !mood.answer && !mood.dismissedToday ? null : <Reminders />}
        </>
      ) : null}
      {s.family ? <BottomNav attention={counts.attention} carePending={counts.moodPending} /> : null}
    </div>
  );
}
