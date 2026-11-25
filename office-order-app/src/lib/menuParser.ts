import type { Addon, Kind, Menu, MenuItem } from "./types";
import { uid } from "./id";

// 把 OCR（或貼上）的菜單文字用規則轉成候選品項。
// 只做規則判斷，不用任何 AI；看不準的一律標「待確認」交給主揪校對。

export const FLAG = {
  missing: "缺價",
  multiCol: "多欄",
  combo: "套價",
  fuzzy: "模糊數字",
  pairing: "配對不明",
  sizes: "規格名稱待確認",
  lowConf: "辨識信心低",
} as const;

const SIZE_WORDS = ["特大杯", "大杯", "中杯", "小杯", "特大", "大", "中", "小", "XL", "L", "M", "S", "冰", "熱", "溫", "單點", "套餐", "瓶", "罐"];
const SIZE_RE = SIZE_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");

export function normalizeLine(raw: string): string {
  return raw
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/[|｜¦]/g, " ")
    .replace(/[_~`^]+/g, " ")
    .replace(/(\d)\s*(?:元|7T|7C|TC|JT|兀)(?![\dA-Za-z])/g, "$1 ")
    .replace(/[$＄NT]{1,3}\s*(?=\d)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NOISE_RE = /(電話|地址|營業|外送|訂購專線|TEL|Tel|LINE|line|FB|www\.|http|統編|\d{2,4}-\d{3,4}-\d{3,4}|\d{4}-\d{6})/;
const CATEGORY_RE = /^[【\[〔(（<《]?([^\d【】\[\]〔〕()（）<>《》]{1,10})[】\]〕)）>》]?[:：]?$/;

/** 把 OCR 常見誤認（O→0、l→1、S→5）修成數字，並回報是否有修正 */
function fixDigits(token: string): { text: string; fuzzy: boolean } {
  if (/^\d+$/.test(token)) return { text: token, fuzzy: false };
  const fixed = token.replace(/[Oo]/g, "0").replace(/[Il|]/g, "1").replace(/[S]/g, "5").replace(/[B]/g, "8");
  return { text: fixed, fuzzy: fixed !== token };
}

interface PriceToken {
  start: number;
  end: number;
  label: string;
  value: number | null;
  fuzzy: boolean;
  decimal: boolean;
  plus: boolean;
}

function findPrices(line: string): PriceToken[] {
  const out: PriceToken[] = [];
  // 可選的規格字 + 可選的冒號 + 數字（允許 OCR 把 0 認成 O、1 認成 l 的情況，但至少要有一個真數字）
  const re = new RegExp(`(\\+)?\\s*(${SIZE_RE})?\\s*[:：]?\\s*((?=[0-9OolIS.]*\\d)[0-9OolIS]{1,5}(?:\\.\\d+)?)(?![A-Za-z\\u4e00-\\u9fff]*\\d)`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const rawNum = m[3];
    // 數字前面緊接著英文字母（例如品名 A1、B2 的編號）不是價格
    const before = line.slice(0, m.index + m[0].indexOf(rawNum));
    if (!m[2] && /[A-Za-z]$/.test(before)) continue;
    const decimal = rawNum.includes(".");
    const { text, fuzzy } = fixDigits(rawNum.split(".")[0]);
    const value = /^\d+$/.test(text) ? Number(text) : null;
    out.push({ start: m.index, end: m.index + m[0].length, label: m[2] || "", value, fuzzy: fuzzy || (value !== null && value >= 1000), decimal, plus: Boolean(m[1]) });
  }
  return out;
}

function cleanName(s: string): string {
  return s
    .replace(/^[\s\-–—•·・*#.。、,，:：]+/, "")
    .replace(/^(\d{1,2}[.、)）]|[①-⑳])\s*/, "")
    .replace(/[\s\-–—•·・*.。、,，:：/／+]+$/, "")
    .trim();
}

function sizeHeader(line: string): string[] | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return null;
  const all = new RegExp(`^(${SIZE_RE})$`);
  return tokens.every((t) => all.test(t)) ? tokens : null;
}

export interface ParseResult extends Menu {
  /** 略過的雜訊行（電話、地址…），讓主揪知道哪些沒用上 */
  skipped: string[];
}

export function parseMenuText(text: string, kind: Kind): ParseResult {
  const items: MenuItem[] = [];
  const addons: Addon[] = [];
  const skipped: string[] = [];
  let category = "";
  let headerSizes: string[] | null = null;
  let inAddonSection = false;

  const lines = text.split(/\r?\n/).map(normalizeLine).filter((l) => l.length > 0);

  // 照片辨識時信心不足的行，行尾帶「 ??」記號；那一行產生的品項標「待確認：辨識信心低」
  let pendingLow = -1;
  const flushLow = () => {
    if (pendingLow < 0) return;
    for (let i = pendingLow; i < items.length; i++) if (!items[i].flags.includes(FLAG.lowConf)) items[i].flags.push(FLAG.lowConf);
    pendingLow = -1;
  };
  for (const rawLine of lines) {
    flushLow();
    const lowConf = /\s\?\?$/.test(rawLine);
    const line = lowConf ? rawLine.replace(/\s\?\?$/, "") : rawLine;
    if (lowConf) pendingLow = items.length;
    if (NOISE_RE.test(line)) {
      skipped.push(line);
      continue;
    }
    const hdr = sizeHeader(line);
    if (hdr) {
      headerSizes = hdr;
      continue;
    }
    const prices = findPrices(line);

    if (prices.length === 0) {
      const cat = line.match(CATEGORY_RE);
      const looksCategory = cat && (/^[【\[〔(（<《]/.test(line) || /(類|系列|區|專區|系|主餐|飲品|飲料|加料|配料|小菜|點心|甜點|湯品)[:：]?$/.test(line) || /[:：]$/.test(line));
      if (looksCategory) {
        category = cleanName(cat![1]);
        inAddonSection = /加料|配料|加購/.test(category);
        headerSizes = null;
        continue;
      }
      const name = cleanName(line);
      // 太短或沒有中英文字的殘渣直接略過
      if (name.length < 2 || !/[一-鿿A-Za-z]/.test(name)) {
        skipped.push(line);
        continue;
      }
      items.push({ id: uid(), category, name, variants: [{ id: uid(), label: "", price: null }], flags: [FLAG.missing] });
      continue;
    }

    // 一行裡有多段「品名 價格」→ 多欄菜單，拆成多個品項
    const segments: { name: string; prices: PriceToken[] }[] = [];
    let cursor = 0;
    let current: { name: string; prices: PriceToken[] } | null = null;
    for (const p of prices) {
      const between = line.slice(cursor, p.start);
      const nameText = cleanName(between);
      if (/[一-鿿A-Za-z]{2,}/.test(nameText) && !(current && new RegExp(`^(${SIZE_RE})$`).test(nameText))) {
        current = { name: nameText, prices: [p] };
        segments.push(current);
      } else if (current) {
        current.prices.push(p);
      } else {
        current = { name: nameText, prices: [p] };
        segments.push(current);
      }
      cursor = p.end;
    }
    const multiCol = segments.filter((s) => s.name).length > 1;

    for (const seg of segments) {
      const flags: string[] = [];
      if (multiCol) flags.push(FLAG.multiCol);
      if (seg.prices.some((p) => p.fuzzy || p.decimal || p.value === null)) flags.push(FLAG.fuzzy);
      const isCombo = /套餐|套價|加\s*\d|\+\s*\d|升級|配/.test(line) && seg.prices.length > 1;
      if (isCombo) flags.push(FLAG.combo);

      // 加料區或「+10」形式 → 加料選項（只對飲料或明確的加料區）
      const isAddon = inAddonSection || (kind === "drink" && (seg.prices[0].plus || /^加/.test(seg.name)) && seg.prices.length === 1);
      if (isAddon && seg.name) {
        const v = seg.prices[0];
        addons.push({ id: uid(), name: seg.name.replace(/^加/, "") || seg.name, price: v.decimal ? null : v.value });
        continue;
      }

      if (!seg.name) {
        // 只有價格沒有品名：先建立待確認品項，最後由 pairColumns 依順序配給前面缺價的品名
        items.push({
          id: uid(),
          category,
          name: "（未辨識品名）",
          variants: seg.prices.map((p, i) => ({ id: uid(), label: p.label || (seg.prices.length > 1 ? `規格${i + 1}` : ""), price: p.decimal ? null : p.value })),
          flags: [FLAG.pairing],
        });
        continue;
      }

      let labels = seg.prices.map((p) => p.label);
      if (seg.prices.length > 1 && labels.some((l) => !l)) {
        if (headerSizes && headerSizes.length === seg.prices.length) {
          labels = headerSizes.slice();
        } else if (kind === "drink" && seg.prices.length === 2) {
          labels = ["中杯", "大杯"];
          flags.push(FLAG.sizes);
        } else {
          labels = labels.map((l, i) => l || `規格${i + 1}`);
          flags.push(FLAG.sizes);
        }
      } else if (seg.prices.length === 1 && headerSizes && headerSizes.length > 1 && !labels[0]) {
        flags.push(FLAG.pairing);
      }
      if (seg.prices.length > 3) flags.push(FLAG.multiCol);

      items.push({
        id: uid(),
        category,
        name: seg.name,
        variants: seg.prices.map((p, i) => ({ id: uid(), label: labels[i], price: p.decimal ? null : p.value })),
        flags: [...new Set(flags)],
      });
    }
  }

  flushLow();
  pairColumns(items);
  for (const it of items) {
    if (it.variants.some((v) => v.price === null) && !it.flags.includes(FLAG.missing)) it.flags.push(FLAG.missing);
  }
  return { items, addons, skipped };
}

/**
 * OCR 有時把「品名欄」和「價格欄」分開讀：先一串沒有價格的品名，再一串只有價格的行。
 * 依順序配對，並全部標「配對不明」讓主揪對照原圖確認。
 */
function pairColumns(items: MenuItem[]) {
  const isNameOnly = (it: MenuItem) => it.name !== "（未辨識品名）" && it.variants.every((v) => v.price === null);
  const isPriceOnly = (it: MenuItem) => it.name === "（未辨識品名）";
  let i = 0;
  while (i < items.length) {
    if (!isNameOnly(items[i])) {
      i++;
      continue;
    }
    let j = i;
    while (j < items.length && isNameOnly(items[j])) j++;
    // 名字串與價格串之間可能夾著店名等雜項（有價但不是待配對的）
    let k = j;
    while (k < items.length && !isPriceOnly(items[k]) && k - j < 3) k++;
    let e = k;
    while (e < items.length && isPriceOnly(items[e])) e++;
    const names = items.slice(i, j);
    const prices = items.slice(k, e);
    if (names.length >= 1 && prices.length >= 1) {
      const n = Math.min(names.length, prices.length);
      for (let x = 0; x < n; x++) {
        names[x].variants = prices[x].variants;
        names[x].flags = [...new Set([...names[x].flags.filter((f) => f !== FLAG.missing), ...prices[x].flags, FLAG.pairing])];
      }
      items.splice(k, n);
      i = j;
    } else i = j;
  }
}
