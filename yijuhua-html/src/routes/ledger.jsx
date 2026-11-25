import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Download, Mic, Plus, Search, X } from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import TransactionSheet from "@/components/TransactionSheet";
import { money } from "@/components/ReviewPanel";
import { Button } from "@/components/ui/button";
import { ALL_CATEGORIES, EXPENSE_CATEGORIES, categoryIcon } from "@/lib/categories";
import { addDays, endOfMonth, formatDateLabel, startOfMonth, startOfWeek, zonedParts } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
import { useLedger } from "@/lib/ledger";
import { PAYMENT_COLORS, PAYMENT_ICONS, paymentMethodOf, paymentStats, roundedShares } from "@/lib/paymentStats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/ledger")({
  head: () => ({ meta: [{ title: "我的帳本｜一句話記帳" }] }),
  component: LedgerPage,
});

const PERIODS = [
  { id: "today", label: "今日" },
  { id: "week", label: "本週" },
  { id: "month", label: "本月" },
  { id: "custom", label: "自訂" },
];

// 分類圓餅圖的顏色（依支出分類順序）
const PIE_COLORS = ["#2F6B4F", "#D9822B", "#3B7DD8", "#A855F7", "#E5484D", "#14B8A6", "#EAB308", "#64748B", "#0EA5E9", "#F472B6", "#94A3B8"];
const colorOf = (name) => {
  const index = EXPENSE_CATEGORIES.findIndex((c) => c.name === name);
  return PIE_COLORS[index >= 0 ? index % PIE_COLORS.length : PIE_COLORS.length - 1];
};

function LedgerPage() {
  const { items, ready, loadError, reload, prefs } = useLedger();
  const today = zonedParts(new Date(), prefs.timezone).date;
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState(startOfMonth(today));
  const [customTo, setCustomTo] = useState(today);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [editing, setEditing] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);

  const [from, to] = useMemo(() => {
    if (period === "today") return [today, today];
    if (period === "week") return [startOfWeek(today), addDays(startOfWeek(today), 6)];
    if (period === "month") return [startOfMonth(today), endOfMonth(today)];
    return customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
  }, [period, today, customFrom, customTo]);

  const inRange = useMemo(
    () => items.filter((r) => r.transactionDate >= from && r.transactionDate <= to),
    [items, from, to]
  );

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const r of inRange) {
      if (r.type === "income") income += r.amount;
      else if (r.type === "expense") expense += r.amount;
    }
    return { income, expense, balance: income - expense };
  }, [inRange]);

  const payStats = useMemo(() => paymentStats(inRange), [inRange]);
  const payPercents = useMemo(() => roundedShares(payStats.rows), [payStats]);

  const monthExpense = useMemo(
    () =>
      items
        .filter((r) => r.type === "expense" && r.transactionDate >= startOfMonth(today) && r.transactionDate <= endOfMonth(today))
        .reduce((s, r) => s + r.amount, 0),
    [items, today]
  );

  const byCategory = useMemo(() => {
    const map = new Map();
    for (const r of inRange) if (r.type === "expense") map.set(r.categoryName, (map.get(r.categoryName) || 0) + r.amount);
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [inRange]);

  const daily = useMemo(() => {
    if (from === to) return [];
    const days = [];
    for (let d = from; d <= to && days.length < 62; d = addDays(d, 1)) days.push({ date: d, label: `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`, value: 0 });
    const index = new Map(days.map((d, i) => [d.date, i]));
    for (const r of inRange) if (r.type === "expense" && index.has(r.transactionDate)) days[index.get(r.transactionDate)].value += r.amount;
    return days;
  }, [inRange, from, to]);

  const list = useMemo(() => {
    const term = query.trim().toLowerCase();
    return inRange.filter(
      (r) =>
        (!categoryFilter || r.categoryName === categoryFilter) &&
        (!paymentFilter || (r.type === "expense" && paymentMethodOf(r) === paymentFilter)) &&
        (!term || `${r.itemName || ""} ${r.merchant || ""} ${r.note || ""} ${r.categoryName}`.toLowerCase().includes(term))
    );
  }, [inRange, query, categoryFilter, paymentFilter]);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const r of list) {
      if (!map.has(r.transactionDate)) map.set(r.transactionDate, []);
      map.get(r.transactionDate).push(r);
    }
    return [...map.entries()];
  }, [list]);

  const budget = Number(prefs.monthlyBudget) || 0;

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md px-4 pb-24 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="回首頁" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-2xl font-bold">我的帳本</h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!list.length}
          onClick={() => downloadCsv(list, `一句話記帳_${from}_${to}.csv`)}
          className="h-10 rounded-xl"
        >
          <Download className="mr-1 h-4 w-4" />
          CSV
        </Button>
      </header>

      <div className="mt-4 grid grid-cols-4 gap-1 rounded-2xl bg-muted p-1">
        {PERIODS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            className={cn("h-10 rounded-xl text-base font-semibold", period === p.id ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-11 rounded-xl border border-input bg-white px-2" aria-label="開始日期" />
          <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-11 rounded-xl border border-input bg-white px-2" aria-label="結束日期" />
        </div>
      )}
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {from === to ? formatDateLabel(from) : `${formatDateLabel(from)} ～ ${formatDateLabel(to)}`}
      </p>

      <section className="mt-3 grid grid-cols-3 gap-2" aria-label="收支統計">
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">收入</p>
          <p className="mt-1 text-lg font-bold text-primary">{money(totals.income)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">支出</p>
          <p className="mt-1 text-lg font-bold text-red-600">{money(totals.expense)}</p>
        </div>
        <div className="rounded-2xl bg-white p-3 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">結餘</p>
          <p className={cn("mt-1 text-lg font-bold", totals.balance < 0 ? "text-red-600" : "text-foreground")}>
            {totals.balance < 0 ? "-" : ""}
            {money(Math.abs(totals.balance))}
          </p>
        </div>
      </section>

      {payStats.total > 0 && (
        <section className="mt-3 rounded-2xl bg-white p-4 shadow-sm" aria-label="付款方式統計">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">付款方式</h2>
            <span className="text-xs text-muted-foreground">支出合計 {money(payStats.total)}</span>
          </div>
          <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {payStats.rows.map((row) =>
              row.amount > 0 ? <div key={row.name} style={{ width: `${row.share * 100}%`, background: PAYMENT_COLORS[row.name] }} /> : null
            )}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {payStats.rows.map((row, i) => {
              const active = paymentFilter === row.name;
              return (
                <button
                  key={row.name}
                  type="button"
                  aria-pressed={active}
                  disabled={!row.count}
                  onClick={() => setPaymentFilter(active ? "" : row.name)}
                  className={cn(
                    "min-w-0 rounded-xl border px-2 py-2.5 text-left transition-colors disabled:opacity-50",
                    active ? "border-primary bg-secondary" : "border-border bg-white"
                  )}
                >
                  <p className="flex items-center gap-1 whitespace-nowrap text-[13px] text-muted-foreground">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PAYMENT_COLORS[row.name] }} />
                    {row.name}
                  </p>
                  <p className="mt-1 whitespace-nowrap text-[15px] font-bold leading-tight tabular-nums">{money(row.amount)}</p>
                  <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">
                    {row.count} 筆・{payPercents[i]}%
                  </p>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            點一下可只看該付款方式的明細。「銀行轉帳」指用轉帳付款的支出；自己帳戶之間的轉帳不計入。
          </p>
        </section>
      )}

      {budget > 0 && (
        <div className="mt-3 rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex justify-between text-sm">
            <span>本月預算</span>
            <span className={monthExpense > budget ? "font-semibold text-red-600" : "text-muted-foreground"}>
              {money(monthExpense)} / {money(budget)}
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", monthExpense > budget ? "bg-red-600" : monthExpense > budget * 0.8 ? "bg-amber-500" : "bg-primary")}
              style={{ width: `${Math.min(100, (monthExpense / budget) * 100)}%` }}
            />
          </div>
          {monthExpense > budget * 0.8 && (
            <p className="mt-1.5 text-sm text-amber-800">{monthExpense > budget ? "本月已超過預算。" : "本月支出已超過預算的 80%。"}</p>
          )}
        </div>
      )}

      {loadError && (
        <div className="mt-4 rounded-2xl bg-red-50 p-3 text-base text-red-700">
          {loadError}
          <button type="button" onClick={reload} className="ml-2 font-semibold underline">重試</button>
        </div>
      )}

      {ready && !items.length && !loadError && (
        <div className="mt-6 rounded-2xl border border-dashed border-primary/40 bg-white p-6 text-center">
          <Mic className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-2 text-lg font-semibold">還沒有任何記帳</p>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            回到首頁按麥克風，說一句話就好，例如：
            <br />「今天午餐 150 元」「昨天加油 800 元」
          </p>
          <Button asChild className="mt-4 h-12 rounded-xl px-6 text-base">
            <Link to="/">去記第一筆</Link>
          </Button>
        </div>
      )}

      {byCategory.length > 0 && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm" aria-label="分類統計">
          <h2 className="text-base font-semibold">支出分類</h2>
          <div className="mt-2 flex items-center gap-3">
            <div className="h-36 w-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={34} outerRadius={64} paddingAngle={1} stroke="none">
                    {byCategory.map((entry) => (
                      <Cell key={entry.name} fill={colorOf(entry.name)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {byCategory.map((c) => (
                <li key={c.name}>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter(categoryFilter === c.name ? "" : c.name)}
                    className={cn("flex w-full items-center gap-2 rounded-lg px-1 text-left text-sm", categoryFilter === c.name && "bg-secondary")}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf(c.name) }} />
                    <span className="min-w-0 flex-1 truncate">
                      {categoryIcon(c.name)} {c.name}
                    </span>
                    <span className="shrink-0 font-semibold">{money(c.value)}</span>
                    <span className="w-9 shrink-0 text-right text-xs text-muted-foreground">
                      {Math.round((c.value / totals.expense) * 100)}%
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {daily.some((d) => d.value > 0) && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm" aria-label="每日支出">
          <h2 className="text-base font-semibold">每日支出</h2>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={daily} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={48} />
                <Tooltip formatter={(v) => money(v)} labelFormatter={(l) => l} />
                <Bar dataKey="value" name="支出" fill="#2F6B4F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {items.length > 0 && (
        <section className="mt-4" aria-label="交易列表">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜尋項目或商家"
                className="h-11 w-full rounded-xl border border-input bg-white pl-9 pr-3"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-11 w-28 shrink-0 rounded-xl border border-input bg-white px-2"
              aria-label="分類篩選"
            >
              <option value="">全部分類</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {paymentFilter && (
            <button
              type="button"
              onClick={() => setPaymentFilter("")}
              className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border border-primary bg-secondary px-3 text-sm font-medium"
            >
              {PAYMENT_ICONS[paymentFilter]} 只看{paymentFilter}付款的支出
              <X className="h-4 w-4" aria-label="取消付款方式篩選" />
            </button>
          )}

          {!list.length && <p className="mt-6 text-center text-base text-muted-foreground">這段期間沒有符合的紀錄</p>}

          <div className="mt-3 space-y-4">
            {grouped.map(([date, records]) => (
              <div key={date}>
                <p className="mb-1.5 px-1 text-sm font-semibold text-muted-foreground">{formatDateLabel(date)}</p>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl bg-white shadow-sm">
                  {records.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setEditing(r)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-muted/50">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xl">
                          {categoryIcon(r.categoryName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-medium">{r.itemName || r.categoryName}</span>
                          <span className="block truncate text-sm text-muted-foreground">
                            {r.categoryName}
                            {r.type === "expense" && r.paymentMethod ? `・${r.paymentMethod}` : ""}
                            {r.merchant && r.merchant !== r.itemName ? `・${r.merchant}` : ""}
                            {r.transactionTime ? `・${r.transactionTime}` : ""}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-lg font-bold",
                            r.type === "income" ? "text-primary" : r.type === "transfer" ? "text-slate-500" : "text-red-600"
                          )}
                        >
                          {r.type === "income" ? "+" : r.type === "expense" ? "-" : ""}
                          {money(r.amount)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">轉帳以灰色顯示，不計入收入與支出</p>
        </section>
      )}

      <button
        type="button"
        onClick={() => setManualOpen(true)}
        aria-label="手動記帳"
        className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg"
      >
        <Plus className="h-7 w-7" />
      </button>

      <TransactionSheet open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} record={editing} />
      <TransactionSheet open={manualOpen} onOpenChange={setManualOpen} />
    </main>
  );
}
