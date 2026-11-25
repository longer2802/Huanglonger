import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpenCheck, TrendingUp, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { SourceLine } from "./ContentCard";
import { updatePerson, useSprout } from "@/lib/store";
import { diffDays, formatDate, todayTW } from "@/lib/dates";
import { ageLabel, BAND_LABEL, chartDay, describe, growthPoints, HANDBOOK_TEXT, INDICATORS, LINES, lmsAt, loadWho, MAX_DAY, pctText, tableOf, valueAtZ, whoReady } from "@/lib/growth";
import { cn } from "@/lib/utils";

const W = 360;
const H = 250;
const PAD = { l: 38, r: 30, t: 14, b: 30 };
const TABS = ["weight", "length", "head"];

function windowFor(maxDay) {
  if (maxDay <= 365 - 30) return { end: 365, step: 30.4375, every: 1, unit: "月" };
  if (maxDay <= 730 - 30) return { end: 730, step: 30.4375 * 3, every: 3, unit: "月" };
  return { end: MAX_DAY, step: 365.25, every: 1, unit: "歲" };
}

function niceStep(range) {
  const raw = range / 6;
  const pow = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw);
}

function SexPicker({ baby }) {
  const choose = async (sex) => {
    await updatePerson({ ...baby, sex });
    toast.success("已設定，生長曲線會用對應的男孩／女孩版本");
  };
  return (
    <div className="space-y-3 rounded-2xl bg-white/80 p-4 text-center">
      <p className="text-[15px] font-bold">手冊的生長曲線分男孩版和女孩版</p>
      <p className="text-[13px] text-muted-foreground">請選擇{baby.nickname}要用哪一版（之後可在「我的」修改）。</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => choose("boy")} className="min-h-[52px] rounded-2xl bg-[hsl(205_90%_92%)] text-[16px] font-bold text-[hsl(205_60%_30%)]">
          男孩版
        </button>
        <button type="button" onClick={() => choose("girl")} className="min-h-[52px] rounded-2xl bg-secondary text-[16px] font-bold text-secondary-foreground">
          女孩版
        </button>
      </div>
    </div>
  );
}

function Chart({ baby, ind, points }) {
  const today = todayTW();
  const table = tableOf(ind, baby.sex);
  const nowDay = chartDay(baby, today)?.day ?? 0;
  const lastDay = Math.max(nowDay, ...points.map((p) => p.day), 0);
  const win = windowFor(lastDay);

  const { curves, yMin, yMax } = (() => {
    const days = [];
    for (let d = 0; d <= win.end; d += win.end <= 365 ? 3 : 7) days.push(d);
    if (days[days.length - 1] !== win.end) days.push(win.end);
    // Length switches from lying to standing at 2 years: draw the two parts separately.
    const segs = ind.key === "length" && win.end > 730 ? [days.filter((d) => d <= 730).concat(730), [731, ...days.filter((d) => d > 731)]] : [days];
    const c = LINES.map((l) => ({ ...l, segs: segs.map((s) => s.map((d) => [d, valueAtZ(lmsAt(table, d), l.z)])) }));
    const vals = c.flatMap((l) => l.segs.flat().map(([, v]) => v)).concat(points.filter((p) => p.day <= win.end).map((p) => p.value));
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const m = (hi - lo) * 0.05;
    return { curves: c, yMin: lo - m, yMax: hi + m };
  })();

  const x = (d) => PAD.l + (d / win.end) * (W - PAD.l - PAD.r);
  const y = (v) => H - PAD.b - ((v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const path = (seg) => seg.map(([d, v], i) => `${i ? "L" : "M"}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const band = (lo, hi) =>
    lo.segs.map((seg, i) => {
      const top = hi.segs[i];
      return `${path(seg)}L${top
        .slice()
        .reverse()
        .map(([d, v]) => `${x(d).toFixed(1)},${y(v).toFixed(1)}`)
        .join("L")}Z`;
    });
  const yStep = niceStep(yMax - yMin);
  const yTicks = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) yTicks.push(v);
  const xTicks = [];
  for (let i = 0; i * win.step <= win.end + 1; i += 1) xTicks.push(i);
  const shown = points.filter((p) => p.day <= win.end);
  const latest = shown[shown.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${ind.label}生長曲線，${latest ? `最近一次 ${latest.value} ${ind.unit}，${pctText(latest.pct)}` : "尚無紀錄"}`}>
      <rect x={PAD.l} y={PAD.t} width={W - PAD.l - PAD.r} height={H - PAD.t - PAD.b} fill="#fff" rx="6" />
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="hsl(345 60% 93%)" strokeWidth="1" />
          <text x={PAD.l - 5} y={y(v) + 3.5} textAnchor="end" fontSize="10" fill="hsl(330 14% 45%)">
            {Number(v.toFixed(2))}
          </text>
        </g>
      ))}
      {xTicks.map((i) => (
        <g key={i}>
          <line x1={x(i * win.step)} x2={x(i * win.step)} y1={PAD.t} y2={H - PAD.b} stroke="hsl(345 60% 95%)" strokeWidth="1" />
          <text x={x(i * win.step)} y={H - PAD.b + 13} textAnchor="middle" fontSize="10" fill="hsl(330 14% 45%)">
            {i === 0 ? "出生" : `${i * win.every}`}
          </text>
        </g>
      ))}
      <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize="10" fill="hsl(330 14% 45%)">
        年齡（{win.unit}）
      </text>
      <text x={PAD.l - 5} y={PAD.t - 2} textAnchor="end" fontSize="10" fill="hsl(330 14% 45%)">
        {ind.unit}
      </text>
      {band(curves[0], curves[4]).map((d, i) => (
        <path key={`o${i}`} d={d} fill="hsl(336 80% 90% / 0.55)" />
      ))}
      {band(curves[1], curves[3]).map((d, i) => (
        <path key={`i${i}`} d={d} fill="hsl(336 80% 86% / 0.45)" />
      ))}
      {curves.map((l) =>
        l.segs.map((seg, i) => (
          <path key={`${l.p}-${i}`} d={path(seg)} fill="none" stroke={l.p === 50 ? "hsl(336 66% 50%)" : l.p === 3 || l.p === 97 ? "hsl(336 55% 62%)" : "hsl(336 50% 75%)"} strokeWidth={l.p === 50 ? 1.8 : 1.2} strokeDasharray={l.p === 15 || l.p === 85 ? "4 3" : undefined} />
        )),
      )}
      {curves.map((l) => {
        const last = l.segs[l.segs.length - 1];
        const v = last[last.length - 1][1];
        return (
          <text key={`t${l.p}`} x={W - PAD.r + 3} y={y(v) + 3.5} fontSize="10" fontWeight="700" fill="hsl(336 60% 42%)">
            {l.p}
          </text>
        );
      })}
      {shown.length > 1 ? <path d={path(shown.map((p) => [p.day, p.value]))} fill="none" stroke="hsl(205 75% 42%)" strokeWidth="2" /> : null}
      {shown.map((p) => (
        <circle key={p.id} cx={x(p.day)} cy={y(p.value)} r={p === latest ? 5 : 3.6} fill={p === latest ? "hsl(205 80% 40%)" : "#fff"} stroke="hsl(205 75% 40%)" strokeWidth="2" />
      ))}
    </svg>
  );
}

function useWho() {
  const [state, setState] = useState(whoReady() ? "ready" : "loading");
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (whoReady()) return undefined;
    let alive = true;
    setState("loading");
    loadWho().then(
      () => alive && setState("ready"),
      () => alive && setState("error"),
    );
    return () => {
      alive = false;
    };
  }, [tries]);
  return [state, () => setTries((n) => n + 1)];
}

export default function GrowthChart({ baby }) {
  const { records } = useSprout();
  const [tab, setTab] = useState("weight");
  const [who, retry] = useWho();
  if (!baby) return null;
  if (baby.sex !== "boy" && baby.sex !== "girl") return <SexPicker baby={baby} />;
  if (who !== "ready") {
    return (
      <div className="rounded-2xl bg-white/80 px-3 py-6 text-center text-[14px] text-muted-foreground">
        {who === "loading" ? (
          "正在載入 WHO 生長曲線資料…"
        ) : (
          <>
            <p>生長曲線資料載入失敗，請確認網路後再試一次。</p>
            <button type="button" onClick={retry} className="mt-3 min-h-[44px] rounded-2xl bg-primary px-5 font-bold text-primary-foreground">
              重新載入
            </button>
          </>
        )}
      </div>
    );
  }
  const ind = INDICATORS[tab];
  const points = growthPoints(baby, records, tab);
  const info = describe(points);
  const today = todayTW();
  const age = chartDay(baby, today);
  const stale = info && diffDays(today, info.latest.date) > 60;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-secondary/70 p-1" role="tablist" aria-label="生長指標">
        {TABS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("min-h-[40px] rounded-xl text-[14px] font-bold", tab === k ? "bg-card text-primary shadow-sm" : "text-muted-foreground")}>
            {INDICATORS[k].label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-white/90 p-2">
        <p className="px-1 pb-1 text-[12px] font-semibold text-muted-foreground">
          {baby.sex === "boy" ? "男孩" : "女孩"}版・WHO 0–5 歲標準・粉紅帶為第 3～97 百分位
          {age?.corrected ? "・早產兒以矯正年齡標示" : ""}
        </p>
        <Chart baby={baby} ind={ind} points={points} />
      </div>

      {info ? (
        <div className="space-y-2">
          <div className="rounded-2xl bg-white/90 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" /> 最近一次{ind.label}（{formatDate(info.latest.date)}，{info.latest.birth ? "出生時" : ageLabel(baby, info.latest)}）
            </p>
            <p className="mt-1 text-[22px] font-extrabold leading-tight">
              {info.latest.value} {ind.unit}
              <span className="ml-2 text-[16px] text-primary">{pctText(info.latest.pct)}</span>
            </p>
            <p className={cn("mt-1 text-[15px] font-bold", info.inRange ? "text-primary" : "text-[hsl(var(--alert-fg))]")}>
              {info.inRange ? "✓ " : "⚠ "}落在{BAND_LABEL[info.latest.band]}
            </p>
            <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-secondary/70 px-2.5 py-2 text-[13px] leading-relaxed">
              <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>手冊說明：{info.inRange ? HANDBOOK_TEXT.inRange : HANDBOOK_TEXT.outOfRange}</span>
            </p>
          </div>
          {info.crossing ? (
            <div className="rounded-2xl border-2 border-[hsl(var(--apricot-strong))]/40 bg-accent px-3.5 py-3 text-[14px] leading-relaxed text-accent-foreground">
              <p className="flex items-center gap-1.5 font-bold">
                <TriangleAlert className="h-4 w-4" /> 曲線走勢變化較大
              </p>
              <p>
                {formatDate(info.crossing.from.date)}（{BAND_LABEL[info.crossing.from.band]}）→ {formatDate(info.crossing.to.date)}（{BAND_LABEL[info.crossing.to.band]}），{info.crossing.up ? "往上" : "往下"}跨過了 2 個以上的曲線區間。
              </p>
              <p className="mt-1">手冊說明：{HANDBOOK_TEXT.crossing}</p>
            </div>
          ) : null}
          {stale ? <p className="rounded-xl bg-white/80 px-3 py-2 text-[13px] text-muted-foreground">最近 2 個月沒有新的{ind.label}紀錄。健兒門診量完後記得補上。</p> : null}
        </div>
      ) : (
        <p className="rounded-2xl bg-white/80 px-3 py-3 text-center text-[14px] text-muted-foreground">還沒有{ind.label}紀錄。</p>
      )}

      <Link to="/record" search={{ kind: "growth", subject: baby.id }} className="flex min-h-[48px] items-center justify-center rounded-2xl bg-primary text-[15px] font-bold text-primary-foreground">
        ＋ 記錄身長體重頭圍
      </Link>

      {points.length ? (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-secondary/70">
              {["日期", "年齡", `${ind.label}`, "百分位"].map((h) => (
                <th key={h} className="border border-border px-2 py-1.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {points
              .slice()
              .reverse()
              .map((p) => (
                <tr key={p.id} className="text-center">
                  <td className="border border-border px-2 py-1.5">{formatDate(p.date)}</td>
                  <td className="border border-border px-2 py-1.5">{ageLabel(baby, p)}</td>
                  <td className="border border-border px-2 py-1.5">
                    {p.value} {ind.unit}
                  </td>
                  <td className={cn("border border-border px-2 py-1.5", (p.band === 0 || p.band === 5) && "font-bold text-[hsl(var(--alert-fg))]")}>{pctText(p.pct).replace("約", "")}</td>
                </tr>
              ))}
          </tbody>
        </table>
      ) : null}

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        百分位代表和 100 位同年齡、同性別的寶寶相比大約排在第幾位，只是位置參考，不是健康判定。{HANDBOOK_TEXT.disclaimer}
        {age?.corrected ? "早產兒依手冊用矯正年齡（滿 2 歲後改用實際年齡）。" : ""}2 歲時身長改量站立身高，曲線會有落差。
      </p>
      <SourceLine source={{ id: "hpa-child-2026-06", section: "兒童生長曲線百分位圖", page: "p.10–19" }} compact />
    </div>
  );
}
