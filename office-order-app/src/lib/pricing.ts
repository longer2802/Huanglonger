import type { Kind, MenuItem, Order, OrderLine, Person } from "./types";

// 台幣一律整數。這個檔案是畫面、個人收款單、店家出單共用的唯一金額計算。

/** 價格：非負整數（0 元必須是主揪明確輸入的） */
export function isValidPrice(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 1_000_000;
}

/** 數量：正整數 */
export function isValidQty(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 999;
}

/** 把使用者輸入轉成價格；空白、負數、小數、非數字都回傳 error */
export function parsePriceInput(raw: string): { value: number | null; error: string } {
  const s = raw.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[,，元$＄\s]/g, "");
  if (s === "") return { value: null, error: "缺價" };
  if (/^-/.test(s)) return { value: null, error: "不可為負數" };
  if (/[.．]/.test(s)) return { value: null, error: "台幣請填整數" };
  if (!/^\d+$/.test(s)) return { value: null, error: "請填數字" };
  const n = Number(s);
  if (!isValidPrice(n)) return { value: null, error: "金額太大" };
  return { value: n, error: "" };
}

export function parseQtyInput(raw: string): number | null {
  const s = raw.trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return isValidQty(n) ? n : null;
}

export function addonSum(line: Pick<OrderLine, "addons">): number {
  return line.addons.reduce((s, a) => s + a.price, 0);
}

/** 品項小計 =（單價 + 每份加價）× 數量 */
export function lineTotal(line: OrderLine): number {
  return (line.snapshot.unitPrice + addonSum(line)) * line.qty;
}

export function lineValid(line: OrderLine): boolean {
  return isValidPrice(line.snapshot.unitPrice) && isValidQty(line.qty) && line.addons.every((a) => isValidPrice(a.price));
}

export type PersonState = "pending" | "done" | "skip";

export function personState(p: Person): PersonState {
  if (p.skip) return "skip";
  return p.lines.length > 0 ? "done" : "pending";
}

export const STATE_LABEL: Record<PersonState, string> = { pending: "待填", done: "已完成", skip: "不訂" };

export interface PersonTotals {
  meal: number;
  drink: number;
  due: number;
}

export function personTotals(p: Person): PersonTotals {
  if (p.skip) return { meal: 0, drink: 0, due: 0 };
  let meal = 0;
  let drink = 0;
  for (const l of p.lines) {
    if (l.kind === "meal") meal += lineTotal(l);
    else drink += lineTotal(l);
  }
  return { meal, drink, due: meal + drink };
}

export interface OrderTotals {
  meal: number;
  drink: number;
  total: number;
  paid: number;
  unpaid: number;
  pendingPeople: Person[];
  orderingPeople: Person[];
  skipPeople: Person[];
}

export function orderTotals(order: Order): OrderTotals {
  let meal = 0;
  let drink = 0;
  let paid = 0;
  const pendingPeople: Person[] = [];
  const orderingPeople: Person[] = [];
  const skipPeople: Person[] = [];
  for (const p of order.people) {
    const st = personState(p);
    if (st === "skip") skipPeople.push(p);
    else if (st === "pending") pendingPeople.push(p);
    else orderingPeople.push(p);
    const t = personTotals(p);
    meal += t.meal;
    drink += t.drink;
    if (p.paid) paid += t.due;
  }
  const total = meal + drink;
  return { meal, drink, total, paid, unpaid: total - paid, pendingPeople, orderingPeople, skipPeople };
}

export function displayName(p: Pick<Person, "name" | "tag">): string {
  return p.tag ? `${p.name}（${p.tag}）` : p.name;
}

/** 這個品項是否可以點（每個規格都要有價格才算完整；至少要有一個有價規格） */
export function orderableVariants(item: MenuItem) {
  return item.variants.filter((v) => isValidPrice(v.price));
}

export function itemMissingPrice(item: MenuItem): boolean {
  return item.variants.length === 0 || item.variants.some((v) => !isValidPrice(v.price));
}

/** 做法描述：規格、甜度、冰量、加料、備註（店家彙總用來區分不同做法） */
export function lineDetail(l: OrderLine, opts: { withVariant?: boolean } = {}): string {
  const parts: string[] = [];
  if (opts.withVariant && l.snapshot.variantLabel) parts.push(l.snapshot.variantLabel);
  if (l.sweetness) parts.push(l.sweetness);
  if (l.ice) parts.push(l.ice);
  if (l.addons.length) parts.push(`加${l.addons.map((a) => `${a.name}(+${a.price})`).join("、")}`);
  if (l.note) parts.push(`備註：${l.note}`);
  return parts.join("／");
}

export function lineLabel(l: OrderLine): string {
  return l.snapshot.variantLabel ? `${l.snapshot.name}（${l.snapshot.variantLabel}）` : l.snapshot.name;
}

export interface AggRow {
  key: string;
  name: string;
  variant: string;
  detail: string;
  unitPrice: number;
  qty: number;
  amount: number;
  /** 點這個做法的人（依名單順序） */
  people: { personId: string; qty: number }[];
}

/** 依店家彙總：品名、規格、甜度、冰量、加料、客製備註都相同才合併 */
export function aggregateLines(order: Order, kind: Kind): AggRow[] {
  const map = new Map<string, AggRow>();
  for (const p of order.people) {
    if (p.skip) continue;
    for (const l of p.lines) {
      if (l.kind !== kind) continue;
      const addonKey = l.addons.map((a) => `${a.name}:${a.price}`).sort().join(",");
      const key = [l.snapshot.name, l.snapshot.variantLabel, l.snapshot.unitPrice, l.sweetness, l.ice, addonKey, l.note.trim()].join("|");
      const unit = l.snapshot.unitPrice + addonSum(l);
      const row = map.get(key) ?? {
        key,
        name: l.snapshot.name,
        variant: l.snapshot.variantLabel,
        detail: lineDetail(l),
        unitPrice: unit,
        qty: 0,
        amount: 0,
        people: [],
      };
      row.qty += l.qty;
      row.amount += lineTotal(l);
      row.people.push({ personId: p.id, qty: l.qty });
      map.set(key, row);
    }
  }
  return [...map.values()];
}

export function vendorTotal(order: Order, kind: Kind): number {
  return aggregateLines(order, kind).reduce((s, r) => s + r.amount, 0);
}

export function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
