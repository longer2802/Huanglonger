// 依座標整理 OCR 結果：只留「中文品名」和「價格數字」，英文副標、圖片雜訊、店家資訊全部丟掉，
// 再把每個品名配上它的價格。支援：
// - 海報式：品名正下方是價格（便當店常見）
// - 表格式：品名右邊同一列有一個或多個價格，上方有「中杯 大杯」「M L」表頭（飲料店常見）
// - 行內規格：「M35 / L45」「35/45」
// - 加料：「珍珠 +10」
// - 左右並排的多個表格、深色底、色塊標題

export interface OcrSegment {
  text: string;
  /** 0–100 */
  conf: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CJK_CLASS = "\\u3400-\\u9fff\\uf900-\\ufaff";
const CJK = new RegExp(`[${CJK_CLASS}]`, "g");
const NOISE = /(電話|地址|營業|外送|專線|訂購|統編|時間|週[一二三四五六日]|星期|網址|粉絲|甜度|冰塊|冰量|可調|另加|建議|售完|為止|限定|僅供|外帶|內用|含稅|價格|LINE|IG|FB)/i;
// 規格字（表頭或價格前綴）
const SIZE_TOKEN = /^(特大杯|大杯|中杯|小杯|特大|大|中|小|XL|L|M|S|冰|熱|溫|瓶|罐)$/i;
const SIZE_PREFIX = "特大杯|大杯|中杯|小杯|特大|XL|L|M|S|大|中|小|冰|熱";

function cjkCount(s: string): number {
  return (s.match(CJK) ?? []).length;
}

function half(s: string): string {
  return s.replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/　/g, " ");
}

/** 只留中文、數字和括號／加號等品名常見符號；英文字母全部拿掉 */
export function chineseOnly(s: string): string {
  return half(s)
    .replace(/[A-Za-z]+/g, " ")
    .replace(new RegExp(`[^${CJK_CLASS}0-9()（）+＋、/\\s]`, "g"), " ")
    .replace(/\s+/g, " ")
    .replace(new RegExp(`([${CJK_CLASS}]) (?=[${CJK_CLASS}])`, "g"), "$1")
    .replace(/\(\s*\)|（\s*）/g, "")
    .trim();
}

/** 整段只有一個價格：2～4 位數字，可帶 $、元；容許 O→0、l→1 這類誤認 */
export function priceOf(s: string): number | null {
  const t = half(s)
    .replace(/\s+/g, "")
    .replace(/^[$NT]+/i, "")
    .replace(/(元|圓|TC|7T)$/, "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1");
  if (!/^\d{2,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 10 && n <= 5000 ? n : null;
}

interface PriceTok {
  value: number;
  label: string;
  plus: boolean;
  /** 在原段落文字中的位置（0–1），用來估計 x 座標 */
  at: number;
}

/** 從一段文字裡找出所有價格（含「M35」「中杯30」「+10」「35/45」） */
function priceTokens(text: string): { tokens: PriceTok[]; rest: string } {
  const t = half(text);
  const re = new RegExp(`(\\+)?\\s*(${SIZE_PREFIX})?\\s*[:：]?\\s*[$]?\\s*(\\d{2,4})\\s*(?:元|圓)?`, "gi");
  const tokens: PriceTok[] = [];
  let rest = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const n = Number(m[3]);
    if (!(n >= 5 && n <= 5000)) continue;
    // 電話、時間這類數字不是價格
    const around = t.slice(Math.max(0, m.index - 1), m.index + m[0].length + 1);
    if (/[\d][-:~]|[-:~][\d]/.test(around)) continue;
    tokens.push({ value: n, label: m[2] ?? "", plus: Boolean(m[1]), at: (m.index + m[0].length / 2) / Math.max(1, t.length) });
    rest += t.slice(last, m.index) + " ";
    last = m.index + m[0].length;
  }
  rest += t.slice(last);
  return { tokens, rest };
}

interface Name {
  seg: OcrSegment;
  name: string;
  used: boolean;
  category?: boolean;
  /** 同一段裡已經帶著的價格（「紅茶 M35 L45」） */
  inline: PriceTok[];
}

interface Price {
  seg: OcrSegment;
  /** 估計的這個價格的中心 x */
  cx: number;
  value: number;
  label: string;
  plus: boolean;
  used: boolean;
  /** 和其他價格來自同一段（例如「35/45」） */
  group: number;
}

interface Header {
  label: string;
  cx: number;
  y: number;
  h: number;
}

const cx = (s: OcrSegment) => (s.x0 + s.x1) / 2;
const cy = (s: OcrSegment) => (s.y0 + s.y1) / 2;
const hgt = (s: OcrSegment) => Math.max(1, s.y1 - s.y0);

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((p, q) => p - q);
  return a[Math.floor(a.length / 2)];
}

export function layoutMenuText(segments: OcrSegment[]): string {
  const names: Name[] = [];
  const prices: Price[] = [];
  const headers: Header[] = [];
  const addons: { name: string; price: number; low: boolean; y: number }[] = [];
  let group = 0;

  for (const seg of segments) {
    const text = half(seg.text).trim();
    if (!text) continue;

    // 規格表頭：整段都是規格字（「中杯 大杯」「M L」「冰 熱」）；OCR 常把「中杯」拆成「中 杯」，先把中文字接起來
    const words = text
      .replace(/[|｜「」『』:：.,，。'"`’”_\-]+/g, " ")
      .replace(new RegExp(`([${CJK_CLASS}]) (?=[${CJK_CLASS}])`, "g"), "$1")
      .replace(/(中|大|小|特大)(杯)/g, "$1$2")
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((w) => w.match(/特大杯|大杯|中杯|小杯|[^\s]/g)?.join("") === w && /^(特大杯|大杯|中杯|小杯)+$/.test(w) ? w.match(/特大杯|大杯|中杯|小杯/g)! : [w]);
    if (words.length && words.every((w) => SIZE_TOKEN.test(w)) && seg.conf >= 35) {
      const step = (seg.x1 - seg.x0) / words.length;
      words.forEach((w, i) => headers.push({ label: w.toUpperCase() === w ? w.toUpperCase() : w, cx: seg.x0 + step * (i + 0.5), y: cy(seg), h: hgt(seg) }));
      continue;
    }

    // 只有價格的段（一個或多個）
    const single = priceOf(text);
    if (single !== null && seg.conf >= 30) {
      prices.push({ seg, cx: cx(seg), value: single, label: "", plus: false, used: false, group: group++ });
      continue;
    }
    const { tokens, rest } = priceTokens(text);
    const restCjk = cjkCount(chineseOnly(rest));
    if (tokens.length && restCjk === 0 && !/[A-Za-z]{3,}/.test(rest) && seg.conf >= 30) {
      const g = group++;
      for (const tk of tokens) prices.push({ seg, cx: seg.x0 + (seg.x1 - seg.x0) * tk.at, value: tk.value, label: tk.label, plus: tk.plus, used: false, group: g });
      continue;
    }

    if (NOISE.test(text.replace(/\s+/g, ""))) continue;

    // 加料列：「加料：珍珠 +10 椰果 +10」
    if (tokens.some((tk) => tk.plus)) {
      const body = half(seg.text).replace(/\s+/g, "").replace(/^[^:：]*加料[^:：]*[:：]/, "");
      const re = new RegExp(`([${CJK_CLASS}]{1,6})[^${CJK_CLASS}\\d+]*\\+\\s*(\\d{1,3})`, "g");
      let m: RegExpExecArray | null;
      let found = false;
      while ((m = re.exec(chineseOnly(body).replace(/\s+/g, "")))) {
        addons.push({ name: m[1].replace(/^加/, ""), price: Number(m[2]), low: seg.conf < 85, y: seg.y0 });
        found = true;
      }
      if (found) continue;
    }

    const cn = chineseOnly(rest);
    const nCjk = cjkCount(cn);
    if (nCjk < 2) continue; // 英文副標、圖片雜訊
    // 中文字要佔這段大部分非空白字元，避免把英文行裡零星誤認的中文當品名
    const nonSpace = rest.replace(/[\s\d$+/:：.]+/g, "").length;
    if (nCjk / Math.max(1, nonSpace) < 0.45) continue;
    if (seg.conf < 40) continue;
    // 括號開頭的是附註（例如「(使用某某肉)」），不是品名
    if (/^[(（]/.test(cn)) continue;
    const clean = cn.replace(/[\d+/]+/g, " ").replace(/\s+/g, "").trim();
    if (cjkCount(clean) < 2) continue;
    // 分類標題（【便當類】、麵食系列）
    if (/[【】[\]]/.test(seg.text) || /(類|系列|專區)$/.test(clean)) {
      names.push({ seg, name: clean, used: true, category: true, inline: [] });
      continue;
    }
    names.push({ seg, name: clean, used: false, inline: tokens.filter((tk) => !tk.plus) });
  }

  // 價格位數檢查：同一張圖的價格字寬差不多，多出來的尾數（例如 115 讀成 1156、70 讀成 700）去掉並標待確認
  const lowPrice = new Set<Price>();
  {
    const singles = prices.filter((p) => p.seg.conf >= 85 && prices.filter((q) => q.group === p.group).length === 1);
    const digitW = median(singles.map((p) => (p.seg.x1 - p.seg.x0) / String(p.value).length));
    if (digitW) {
      for (const p of prices) {
        if (prices.filter((q) => q.group === p.group).length !== 1) continue;
        const digits = String(p.value).length;
        const fit = Math.round((p.seg.x1 - p.seg.x0) / digitW);
        if (digits >= 3 && fit < digits && fit >= 2) {
          p.value = Number(String(p.value).slice(0, fit));
          lowPrice.add(p);
        }
      }
    }
  }

  // 同一列有規格表頭的中文段，是區塊標題（「奶茶　中杯　大杯」）
  for (const n of names) {
    if (n.category || n.inline.length) continue;
    if (headers.some((h) => Math.abs(h.y - cy(n.seg)) < Math.max(h.h, hgt(n.seg)) * 0.7)) {
      n.category = true;
      n.used = true;
    }
  }

  const rows: { seg: OcrSegment; line: string; low: boolean }[] = [];
  const labelFor = (p: Price): string => {
    if (p.label) return p.label;
    // 價格上方、同一欄最近的規格表頭
    let best: Header | null = null;
    for (const h of headers) {
      if (h.y > cy(p.seg)) continue;
      const tol = Math.max(hgt(p.seg) * 2.2, (p.seg.x1 - p.seg.x0) * 0.9);
      if (Math.abs(h.cx - p.cx) > tol) continue;
      if (!best || h.y > best.y) best = h;
    }
    return best?.label ?? "";
  };
  const fmt = (ps: { value: number; label: string }[]) => ps.map((p) => `${p.label}${p.value}`).join(" ");

  // 1) 品名同一段就帶著價格
  for (const n of names) {
    if (n.category || !n.inline.length) continue;
    n.used = true;
    rows.push({ seg: n.seg, line: `${n.name} ${fmt(n.inline)}`, low: n.seg.conf < 85 });
  }

  // 2) 同一列右邊的價格：一路往右收，遇到下一個品名就停（左右並排的兩個表格不會互相搶）
  const free = names.filter((n) => !n.used);
  for (const n of free) {
    const unit = hgt(n.seg);
    const rowY = cy(n.seg);
    const nextNameX = Math.min(
      ...names.filter((o) => o !== n && !o.category && Math.abs(cy(o.seg) - rowY) < unit * 0.7 && o.seg.x0 > n.seg.x1).map((o) => o.seg.x0),
      Infinity,
    );
    const mine = prices
      .filter((p) => !p.used && Math.abs(cy(p.seg) - rowY) < Math.max(unit, hgt(p.seg)) * 0.6 && p.seg.x0 >= n.seg.x1 - unit * 0.3 && p.cx < nextNameX && p.seg.x0 - n.seg.x1 < unit * 25)
      .sort((a, b) => a.cx - b.cx)
      .filter((_p, i, arr) => i === 0 || arr.slice(1, i + 1).every((q, k) => q.seg.x0 - arr[k].seg.x1 < unit * 6))
      .slice(0, 4);
    if (!mine.length) continue;
    n.used = true;
    for (const p of mine) p.used = true;
    const plus = mine.every((p) => p.plus);
    const low = n.seg.conf < 85 || mine.some((p) => p.seg.conf < 88 || lowPrice.has(p));
    if (plus) addons.push({ name: n.name, price: mine[0].value, low, y: n.seg.y0 });
    else rows.push({ seg: n.seg, line: `${n.name} ${fmt(mine.map((p) => ({ value: p.value, label: labelFor(p) })))}`, low });
  }

  // 3) 正下方的價格（海報式）：價格頂端在品名下方 4.5 行高以內、水平對齊
  type Cand = { n: Name; p: Price; score: number };
  const cands: Cand[] = [];
  for (const n of names) {
    if (n.used) continue;
    const nh = hgt(n.seg);
    const nw = n.seg.x1 - n.seg.x0;
    for (const p of prices) {
      if (p.used) continue;
      const unit = Math.max(nh, hgt(p.seg));
      const below = p.seg.y0 >= n.seg.y0 + nh * 0.5 && p.seg.y0 - n.seg.y1 <= unit * 4.5;
      const xOverlap = Math.min(n.seg.x1, p.seg.x1) - Math.max(n.seg.x0, p.seg.x0);
      const aligned = xOverlap > 0 || Math.abs(cx(n.seg) - p.cx) < nw * 0.6;
      if (below && aligned) cands.push({ n, p, score: Math.max(0, p.seg.y0 - n.seg.y1) + Math.abs(cx(n.seg) - p.cx) * 0.3 });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  for (const c of cands) {
    if (c.n.used || c.p.used) continue;
    // 同一段的多個價格（「35/45」）一起配給這個品名
    const sameGroup = prices.filter((p) => p.group === c.p.group && !p.used);
    const low = c.n.seg.conf < 85 || c.p.seg.conf < 90 || lowPrice.has(c.p);
    c.n.used = true;
    for (const p of sameGroup) p.used = true;
    rows.push({ seg: c.n.seg, line: `${c.n.name} ${fmt(sameGroup.sort((a, b) => a.cx - b.cx).map((p) => ({ value: p.value, label: labelFor(p) })))}`, low });
  }

  // 4) 沒配到價格的中文行：
  //    在第一個有價品項上方的是店名、標語，略過；字級差太多（大標題、小附註）也略過；
  //    短短的、緊接在有價品項上方的，當成分類標題
  const priced = rows.map((r) => r.seg);
  const typical = median(priced.map(hgt));
  const firstItemY = priced.length ? Math.min(...priced.map((s) => s.y0)) : -Infinity;
  for (const n of names) {
    if (n.used || n.category) continue;
    if (n.seg.y0 < firstItemY - (typical || 0) * 0.5) continue;
    if (typical && !(hgt(n.seg) > typical * 0.6 && hgt(n.seg) < typical * 1.6)) continue;
    if (n.name.length > 16) continue;
    const below = priced.filter((s) => s.y0 > n.seg.y1 && s.y0 - n.seg.y1 < (typical || hgt(n.seg)) * 2.5 && Math.abs(s.x0 - n.seg.x0) < (typical || hgt(n.seg)) * 3);
    if (n.name.length <= 6 && below.length) {
      n.category = true;
      continue;
    }
    rows.push({ seg: n.seg, line: n.name, low: n.seg.conf < 85 });
  }
  for (const n of names) if (n.category) rows.push({ seg: n.seg, line: `【${n.name}】`, low: false });

  // 依欄、再依上下排序輸出；信心不足的行在行尾加「 ??」讓解析器標成待確認
  const colWidth = median(rows.map((r) => r.seg.x1 - r.seg.x0)) || 1;
  const byCenter = [...rows].sort((a, b) => cx(a.seg) - cx(b.seg));
  const colOf = new Map<(typeof rows)[number], number>();
  let col = -1;
  let colCenter = -Infinity;
  for (const r of byCenter) {
    if (cx(r.seg) - colCenter > colWidth * 0.5) {
      col++;
      colCenter = cx(r.seg);
    }
    colOf.set(r, col);
  }
  rows.sort((a, b) => colOf.get(a)! - colOf.get(b)! || a.seg.y0 - b.seg.y0);
  const out = rows.map((r) => `${r.line}${r.low ? " ??" : ""}`);
  if (addons.length) {
    out.push("【加料】");
    for (const a of addons) out.push(`${a.name} +${a.price}${a.low ? " ??" : ""}`);
  }
  return out.join("\n");
}
