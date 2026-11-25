import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ListOrdered } from "lucide-react";
import { AlertBox } from "./kit";
import { AngelBaby } from "./Cute";
import ContentCard, { SourceLine } from "./ContentCard";
import { TodoSheet } from "./Todo";
import GrowthChart from "./GrowthChart";
import { useSprout } from "@/lib/store";
import { ageParts, formatAge, formatDate, todayTW } from "@/lib/dates";
import { RULES, ruleWindow, todoId, todoState } from "@/lib/rules";
import { cardsForBabyAge, MONTH_DAYS } from "@/lib/content";
import { cn } from "@/lib/utils";

// The baby handbook as a book: one page at a time, swipe or tap to turn.
// Layout follows the paper 兒童健康手冊 (cover, contents, record tables),
// filled with this baby's own dates and records.

const STAGES = [
  [0, "出生 6 天內"],
  [14, "出生後 2 週～2 個月"],
  [MONTH_DAYS(2), "2～4 個月"],
  [MONTH_DAYS(4), "4～6 個月"],
  [MONTH_DAYS(6), "6 個月～1 歲"],
  [MONTH_DAYS(12), "1～1 歲半"],
  [MONTH_DAYS(18), "1 歲半～2 歲"],
  [MONTH_DAYS(24), "2～3 歲"],
  [MONTH_DAYS(36), "3～5 歲"],
  [MONTH_DAYS(60), "5～未滿 7 歲"],
];

// Approximate tints only; the printed card is the reference.
const STOOL = ["#F4F1E8", "#EFE8CF", "#E9E3BE", "#EADFA4", "#E7D27A", "#E3C86A", "#D9A92E", "#B8932A", "#6F7A2A"];

function statusOf(todo, today) {
  if (!todo) return { label: "—", tone: "line" };
  const s = todoState(todo, today);
  const map = {
    done: ["已完成", "done"],
    booked: ["已預約", "sage"],
    confirm: ["待確認", "apricot"],
    overdue: ["⚠ 建議期已過", "alert"],
    soon: ["近期", "apricot"],
    later: ["之後", "line"],
    past: ["可補登", "line"],
    cancelled: ["已取消", "line"],
  };
  const [label, tone] = map[s] ?? ["—", "line"];
  return { label, tone };
}

const TONE = {
  done: "bg-primary text-primary-foreground",
  sage: "bg-secondary text-secondary-foreground",
  apricot: "bg-accent text-accent-foreground",
  alert: "bg-destructive text-destructive-foreground",
  line: "border border-border text-muted-foreground",
};

function Stamp({ todo, today }) {
  const st = statusOf(todo, today);
  return <span className={cn("inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold", TONE[st.tone])}>{st.label}</span>;
}

function RuleTable({ rules, baby, onOpen, showDose }) {
  const { todos } = useSprout();
  const today = todayTW();
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="bg-secondary/70 text-left">
          <th className="border border-border px-2 py-1.5 font-bold">項目</th>
          <th className="border border-border px-2 py-1.5 font-bold">建議時間</th>
          <th className="border border-border px-2 py-1.5 font-bold">紀錄</th>
        </tr>
      </thead>
      <tbody>
        {rules.map((r) => {
          const todo = baby ? todos.find((t) => t.id === todoId(baby.id, r.key)) : null;
          const win = baby ? ruleWindow(r, { birthDate: baby.birthDate }) : null;
          const when = todo?.status === "done" ? formatDate(todo.doneDate) : todo?.status === "booked" ? `${formatDate(todo.bookedDate)} ${todo.bookedTime}` : "";
          return (
            <tr key={r.key} onClick={() => todo && onOpen(todo)} className={cn(todo && "cursor-pointer active:bg-secondary/40")}>
              <td className="border border-border px-2 py-1.5 align-top font-semibold">
                {showDose ? r.title : r.title.replace(/^兒童(預防保健|發展篩檢)/, "")}
              </td>
              <td className="border border-border px-2 py-1.5 align-top">
                <span className="block">{r.hint}</span>
                {win ? <span className="block text-[11px] text-muted-foreground">約 {formatDate(win.start)}</span> : null}
              </td>
              <td className="border border-border px-2 py-1.5 align-top">
                {baby ? <Stamp todo={todo} today={today} /> : <span className="text-muted-foreground">＿＿</span>}
                {when ? <span className="mt-0.5 block text-[11px]">{when}</span> : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PageHead({ title, sub }) {
  return (
    <div className="mb-3 border-b-2 border-dashed border-primary/30 pb-2">
      <h2 className="text-[19px] font-extrabold text-primary">{title}</h2>
      {sub ? <p className="text-[12px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default function BabyBook({ baby }) {
  const { records } = useSprout();
  const today = todayTW();
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState("next");
  const [openTodo, setOpenTodo] = useState(null);
  const startX = useRef(null);

  const age = baby ? ageParts(baby.birthDate, today) : null;
  const vax = RULES.filter((r) => r.role === "baby" && r.type === "vaccine");
  const well = RULES.filter((r) => r.key.startsWith("wellchild-"));
  const dev = RULES.filter((r) => r.key.startsWith("devscreen-"));
  const newborn = RULES.filter((r) => r.key.startsWith("screen-") && !r.key.startsWith("screen-stool"));
  const stoolRules = RULES.filter((r) => r.key.startsWith("screen-stool"));
  const lastStool = baby ? records.find((r) => r.subjectId === baby.id && r.kind === "diaper" && r.fields?.stoolColor) : null;

  const pages = useMemo(() => {
    const list = [
      { key: "cover", title: "封面" },
      { key: "toc", title: "目錄" },
      { key: "vax", title: "預防接種時程及紀錄表" },
      { key: "well", title: "兒童預防保健服務" },
      { key: "dev", title: "兒童發展篩檢服務" },
      { key: "newborn", title: "新生兒篩檢紀錄" },
      { key: "stool", title: "嬰兒黃金九色卡" },
      { key: "growth", title: "生長曲線與紀錄" },
      ...STAGES.map(([day, label]) => ({ key: `stage-${day}`, title: `${label}衛教`, day, label })),
      { key: "back", title: "資料來源" },
    ];
    return list;
  }, []);

  const go = (n) => {
    const next = Math.max(0, Math.min(pages.length - 1, n));
    if (next === idx) return;
    setDir(next > idx ? "next" : "prev");
    setIdx(next);
  };
  const page = pages[idx];

  const body = (() => {
    switch (page.key) {
      case "cover":
        return (
          <div className="flex min-h-[56vh] flex-col items-center justify-center gap-3 text-center">
            <AngelBaby className="h-32 w-32" />
            <p className="text-[13px] font-bold tracking-[0.3em] text-primary/80">媽媽手冊E版</p>
            <h1 className="text-[28px] font-extrabold text-primary">寶寶健康手冊</h1>
            {baby ? (
              <div className="mt-2 w-full max-w-[260px] space-y-1 rounded-2xl bg-white/80 px-4 py-3 text-left text-[14px]">
                <p>
                  <b>寶寶：</b>
                  {baby.nickname}
                </p>
                <p>
                  <b>出生：</b>
                  {formatDate(baby.birthDate)} {baby.birthTime}
                </p>
                <p>
                  <b>年齡：</b>
                  {formatAge(age)}
                </p>
                {baby.gestWeeks ? (
                  <p>
                    <b>出生週數：</b>
                    {baby.gestWeeks} 週
                  </p>
                ) : null}
                {baby.birthWeight ? (
                  <p>
                    <b>出生體重：</b>
                    {baby.birthWeight} kg
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[14px] text-muted-foreground">寶寶出生後，到「我的」切換為出生後，這本手冊就會帶入寶寶的日期。</p>
            )}
            <p className="mt-2 text-[12px] text-muted-foreground">往左滑或按「下一頁」翻頁 →</p>
          </div>
        );
      case "toc":
        return (
          <>
            <PageHead title="目錄" />
            <ol className="space-y-1">
              {pages.slice(2).map((p, i) => (
                <li key={p.key}>
                  <button type="button" onClick={() => go(i + 2)} className="flex min-h-[40px] w-full items-center justify-between gap-2 border-b border-dotted border-border text-left text-[15px]">
                    <span>{p.title}</span>
                    <span className="text-[13px] text-muted-foreground">{i + 3}</span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        );
      case "vax":
        return (
          <>
            <PageHead title="預防接種時程及紀錄表" sub="疾管署 115.09 版，2026-10-01 起實施。點一列可預約或標示完成。" />
            <RuleTable rules={vax} baby={baby} onOpen={setOpenTodo} showDose />
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">實際接種日請依醫療院所安排；早產或特殊醫囑請依院所建議。接種後到「＋記錄」登記，這裡會自動顯示已完成。</p>
          </>
        );
      case "well":
        return (
          <>
            <PageHead title="兒童預防保健服務" sub="國健署補助 9 次健兒門診（含衛教指導）" />
            <RuleTable rules={well} baby={baby} onOpen={setOpenTodo} />
          </>
        );
      case "dev":
        return (
          <>
            <PageHead title="兒童發展篩檢服務" sub="就醫時請攜帶兒童健康手冊；超過適用年齡的次數會作廢。" />
            <RuleTable rules={dev} baby={baby} onOpen={setOpenTodo} />
          </>
        );
      case "newborn":
        return (
          <>
            <PageHead title="新生兒篩檢紀錄" sub="先天性代謝異常疾病、聽力與髖關節篩檢" />
            <RuleTable rules={[...newborn, ...stoolRules]} baby={baby} onOpen={setOpenTodo} />
          </>
        );
      case "stool":
        return (
          <>
            <PageHead title="嬰兒黃金九色卡" sub="出生 1 個月內，在日光或白光下比對大便顏色" />
            <div className="grid grid-cols-3 gap-2">
              {STOOL.map((c, i) => {
                const n = i + 1;
                const bad = n <= 6;
                return (
                  <div key={c} className={cn("rounded-2xl border-2 p-1.5 text-center", bad ? "border-destructive/70" : "border-primary/40")}>
                    <div className="h-12 rounded-xl" style={{ background: c }} />
                    <p className={cn("mt-1 text-[13px] font-bold", bad ? "text-destructive" : "text-primary")}>
                      {n} 號{bad ? "・⚠ 不正常" : "・正常"}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">顏色僅為示意，請以手冊上印製的色卡比對。</p>
            {lastStool ? <p className="mt-1 text-[13px]">最近一次記錄：色卡 {lastStool.fields.stoolColor}（{formatDate(lastStool.date)}，家庭自行記錄）</p> : null}
            <div className="mt-3">
              <AlertBox title="手冊寫明的就醫時機" items={["大便顏色像卡上 1～6 號", "出生滿 14 天仍有黃疸"]} action="帶回院所檢驗；可攜帶寶寶的大便或照片就醫。" />
            </div>
          </>
        );
      case "growth":
        return (
          <>
            <PageHead title="生長曲線與紀錄" sub="依手冊「兒童生長曲線百分位圖」，看寶寶落在第幾百分位。" />
            {baby ? <GrowthChart baby={baby} /> : <p className="rounded-2xl bg-white/70 px-3 py-4 text-center text-[14px] text-muted-foreground">寶寶出生後就能記錄身長、體重、頭圍並畫出生長曲線。</p>}
          </>
        );
      case "back":
        return (
          <>
            <PageHead title="資料來源" />
            <div className="space-y-2">
              <SourceLine source={{ id: "hpa-child-2026-06", section: "兒童健康手冊", page: "" }} />
              <SourceLine source={{ id: "cdc-vax-11509", section: "兒童預防接種時程", page: "" }} />
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">本手冊為媽媽手冊E版依官方資料整理的電子版，不取代實體兒童健康手冊；就醫時請攜帶實體手冊。</p>
          </>
        );
      default: {
        const cards = cardsForBabyAge(page.day).filter((c) => c.id !== "baby-vax-overview");
        const isNow = baby && age && age.totalDays >= page.day && (STAGES.find(([d]) => d > page.day)?.[0] ?? Infinity) > age.totalDays;
        return (
          <>
            <PageHead title={page.label} sub={isNow ? "★ 寶寶現在在這個階段" : "衛教重點（點標題展開）"} />
            <div className="space-y-2">
              {cards.map((c) => (
                <ContentCard key={c.id} card={c} subjectId={baby?.id} />
              ))}
            </div>
          </>
        );
      }
    }
  })();

  return (
    <div className="space-y-3">
      <div
        className="book-page relative overflow-hidden rounded-r-[28px] rounded-l-lg"
        onPointerDown={(e) => (startX.current = e.clientX)}
        onPointerUp={(e) => {
          if (startX.current == null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (dx < -50) go(idx + 1);
          if (dx > 50) go(idx - 1);
        }}
        style={{ touchAction: "pan-y" }}
      >
        <div key={idx} className={cn("relative min-h-[64vh] px-5 pb-12 pt-5", dir === "next" ? "page-turn-next" : "page-turn-prev")}>
          {body}
          <p className="absolute inset-x-0 bottom-3 text-center text-[12px] font-semibold text-muted-foreground">
            — {idx + 1} / {pages.length} —
          </p>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button type="button" onClick={() => go(idx - 1)} disabled={idx === 0} className="flex min-h-[52px] items-center justify-center gap-1 rounded-2xl border border-border bg-card text-[15px] font-bold disabled:opacity-40">
          <ChevronLeft className="h-5 w-5" /> 上一頁
        </button>
        <button type="button" onClick={() => go(1)} aria-label="目錄" className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-secondary text-primary">
          <ListOrdered className="h-5 w-5" />
        </button>
        <button type="button" onClick={() => go(idx + 1)} disabled={idx === pages.length - 1} className="flex min-h-[52px] items-center justify-center gap-1 rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground disabled:opacity-40">
          下一頁 <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      {openTodo ? <TodoSheet todo={openTodo} onClose={() => setOpenTodo(null)} /> : null}
    </div>
  );
}
