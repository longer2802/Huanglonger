// 依座標整理 OCR 結果：只留「中文品名」和「價格數字」，英文副標、圖片雜訊、店家資訊全部丟掉，
// 再把每個品名配上它正下方（或同一列右邊）最近的價格。適用海報式、多欄、深色底的菜單。

export interface OcrSegment {
  text: string;
  /** 0–100 */
  conf: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const CJK = /[㐀-鿿豈-﫿]/g;
const NOISE = /(電話|地址|營業|外送|專線|訂購|統編|時間|週[一二三四五六日]|星期|網址|粉絲|LINE|IG|FB)/i;

function cjkCount(s: string): number {
  return (s.match(CJK) ?? []).length;
}

/** 只留中文、數字和括號／加號等品名常見符號；英文字母全部拿掉 */
export function chineseOnly(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[A-Za-z]+/g, " ")
    .replace(/[^㐀-鿿豈-﫿0-9()（）+＋、/\s]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([㐀-鿿]) (?=[㐀-鿿])/g, "$1")
    .replace(/\(\s*\)|（\s*）/g, "")
    .trim();
}

/** 這段是不是一個「價格」：2～4 位數字，可帶 $、元；容許 O→0、l→1 這類誤認 */
export function priceOf(s: string): number | null {
  const t = s
    .replace(/\s+/g, "")
    .replace(/^[$＄NT]+/i, "")
    .replace(/(元|圓|TC|7T)$/, "")
    .replace(/[Oo]/g, "0")
    .replace(/[Il|]/g, "1");
  if (!/^\d{2,4}$/.test(t)) return null;
  const n = Number(t);
  return n >= 10 && n <= 5000 ? n : null;
}

interface Name {
  seg: OcrSegment;
  name: string;
  /** 品名後面已經帶著價格（「雞腿便當 110」同一段） */
  inlinePrice: number | null;
  used: boolean;
  /** 分類標題 */
  category?: boolean;
}

interface Price {
  seg: OcrSegment;
  value: number;
  used: boolean;
}

const cx = (s: OcrSegment) => (s.x0 + s.x1) / 2;
const hgt = (s: OcrSegment) => Math.max(1, s.y1 - s.y0);

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const a = [...xs].sort((p, q) => p - q);
  return a[Math.floor(a.length / 2)];
}

export function layoutMenuText(segments: OcrSegment[]): string {
  const names: Name[] = [];
  const prices: Price[] = [];

  for (const seg of segments) {
    const p = priceOf(seg.text);
    if (p !== null && seg.conf >= 30) {
      prices.push({ seg, value: p, used: false });
      continue;
    }
    if (NOISE.test(seg.text)) continue;
    const cn = chineseOnly(seg.text);
    const nCjk = cjkCount(cn);
    if (nCjk < 2) continue; // 英文副標、圖片雜訊
    // 中文字要佔這段大部分非空白字元，避免把英文行裡零星誤認的中文當品名
    const nonSpace = seg.text.replace(/\s+/g, "").length;
    if (nCjk / Math.max(1, nonSpace) < 0.45) continue;
    if (seg.conf < 40) continue;
    // 括號開頭的是附註（例如「(使用某某肉)」），不是品名
    if (/^[(（]/.test(cn)) continue;
    // 分類標題（【便當類】、麵食系列）：不論位置都保留成分類
    if (/[【】[\]]/.test(seg.text) || /(類|系列|專區)$/.test(cn)) {
      names.push({ seg, name: cn.replace(/\s+/g, ""), inlinePrice: null, used: true, category: true });
      continue;
    }
    const m = cn.match(/^(.*?[㐀-鿿）)])\s*(\d{2,4})$/);
    names.push({ seg, name: m ? m[1].trim() : cn, inlinePrice: m ? Number(m[2]) : null, used: false });
  }

  // 1) 品名後面直接帶價格
  const pairs: { name: Name; price: number; priceRef?: Price }[] = [];
  for (const n of names) if (n.inlinePrice !== null) pairs.push({ name: n, price: n.inlinePrice }), (n.used = true);

  // 2) 依距離配對：價格在品名正下方（同一欄）或同一列右邊
  type Cand = { n: Name; p: Price; score: number };
  const cands: Cand[] = [];
  for (const n of names) {
    if (n.used) continue;
    const nh = hgt(n.seg);
    const nw = n.seg.x1 - n.seg.x0;
    for (const p of prices) {
      const ph = hgt(p.seg);
      const unit = Math.max(nh, ph);
      // 正下方：價格頂端在品名下方 4.5 行高以內，水平位置在品名範圍內（或中心接近）
      const below = p.seg.y0 >= n.seg.y0 + nh * 0.5 && p.seg.y0 - n.seg.y1 <= unit * 4.5;
      const xOverlap = Math.min(n.seg.x1, p.seg.x1) - Math.max(n.seg.x0, p.seg.x0);
      const aligned = xOverlap > 0 || Math.abs(cx(n.seg) - cx(p.seg)) < nw * 0.6;
      if (below && aligned) {
        const dy = p.seg.y0 - n.seg.y1;
        const dx = Math.abs(cx(n.seg) - cx(p.seg));
        cands.push({ n, p, score: Math.max(0, dy) + dx * 0.3 });
        continue;
      }
      // 同一列右邊：垂直中心接近，價格在品名右側 25 個字寬以內（有點點引線的菜單間距很寬）
      const sameRow = Math.abs((n.seg.y0 + n.seg.y1) / 2 - (p.seg.y0 + p.seg.y1) / 2) < unit * 0.6;
      const gap = p.seg.x0 - n.seg.x1;
      if (sameRow && gap >= -unit * 0.3 && gap < unit * 25) cands.push({ n, p, score: gap * 0.5 });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  for (const c of cands) {
    if (c.n.used || c.p.used) continue;
    c.n.used = true;
    c.p.used = true;
    pairs.push({ name: c.n, price: c.p.value, priceRef: c.p });
  }

  // 3) 沒配到價格的中文行（標成缺價讓主揪補）：
  //    在第一個有價品項上方的是店名、標語，略過；字級差太多（大標題、小附註）也略過
  const typical = median(pairs.map((x) => hgt(x.name.seg)));
  const firstItemY = pairs.length ? Math.min(...pairs.map((x) => x.name.seg.y0)) : -Infinity;
  const leftovers = names.filter(
    (n) =>
      !n.used &&
      n.seg.y0 >= firstItemY - (typical || 0) * 0.5 &&
      (!typical || (hgt(n.seg) > typical * 0.6 && hgt(n.seg) < typical * 1.6)) &&
      n.name.length <= 16 &&
      !/\d/.test(n.name),
  );

  // 價格位數檢查：同一張圖的價格字寬差不多，多出來的尾數（例如 115 讀成 1156）去掉並標待確認
  const digitW = median(prices.filter((p) => p.seg.conf >= 85).map((p) => (p.seg.x1 - p.seg.x0) / String(p.value).length));
  const priceLow = new Map<Price, boolean>();
  for (const p of prices) {
    let low = p.seg.conf < 90;
    const digits = String(p.value).length;
    if (digitW && digits >= 3) {
      const fit = Math.round((p.seg.x1 - p.seg.x0) / digitW);
      if (fit < digits && fit >= 2) {
        p.value = Number(String(p.value).slice(0, fit));
        low = true;
      }
    }
    priceLow.set(p, low);
  }

  // 依欄、再依上下排序輸出；信心不足的行在行尾加「 ??」讓解析器標成待確認
  type Row = { seg: OcrSegment; line: string };
  const mark = (low: boolean) => (low ? " ??" : "");
  const rows: Row[] = [
    ...pairs.map((x) => ({ seg: x.name.seg, line: `${x.name.name} ${x.priceRef ? x.priceRef.value : x.price}${mark(x.name.seg.conf < 85 || (x.priceRef ? priceLow.get(x.priceRef) === true : false))}` })),
    ...leftovers.map((n) => ({ seg: n.seg, line: `${n.name}${mark(n.seg.conf < 85)}` })),
    ...names.filter((n) => n.category).map((n) => ({ seg: n.seg, line: `【${n.name}】` })),
  ];
  // 依中心點分欄：中心點相差不到半個品名寬就算同一欄（品名常常置中，左緣不齊）
  const colWidth = median(rows.map((r) => r.seg.x1 - r.seg.x0)) || 1;
  const byCenter = [...rows].sort((a, b) => cx(a.seg) - cx(b.seg));
  const colOf = new Map<Row, number>();
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
  return rows.map((r) => r.line).join("\n");
}
