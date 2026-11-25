import { PAYMENT_METHODS } from "@/lib/categories";

// Spending by how it was paid. Only expenses count: account-to-account
// transfers (type "transfer") and income are left out. An expense saved
// without a method counts as 現金, the same default the app saves with.
export const PAYMENT_COLORS = { 現金: "#2F6B4F", 信用卡: "#D9822B", 銀行轉帳: "#3B7DD8" };
export const PAYMENT_ICONS = { 現金: "💵", 信用卡: "💳", 銀行轉帳: "🏦" };

export function paymentMethodOf(record) {
  const m = record?.paymentMethod === "轉帳" ? "銀行轉帳" : record?.paymentMethod;
  return PAYMENT_METHODS.includes(m) ? m : "現金";
}

export function paymentStats(records) {
  const rows = PAYMENT_METHODS.map((name) => ({ name, amount: 0, count: 0 }));
  const byName = new Map(rows.map((r) => [r.name, r]));
  let total = 0;
  for (const r of records) {
    if (r.type !== "expense") continue;
    const row = byName.get(paymentMethodOf(r));
    row.amount += r.amount;
    row.count += 1;
    total += r.amount;
  }
  for (const row of rows) row.share = total > 0 ? row.amount / total : 0;
  return { rows, total };
}

// Whole-number percentages that add up to exactly 100 (largest remainder).
export function roundedShares(rows) {
  const raw = rows.map((r) => r.share * 100);
  const floors = raw.map(Math.floor);
  let left = raw.some((v) => v > 0) ? 100 - floors.reduce((a, b) => a + b, 0) : 0;
  const order = raw.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    if (raw[i] > 0) {
      floors[i] += 1;
      left -= 1;
    }
  }
  return floors;
}
