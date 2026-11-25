import { aggregateLines, displayName, lineDetail, lineLabel, money, orderTotals, personState, personTotals, STATE_LABEL } from "./pricing";
import { activeKinds, safeFileName, sectionOf, vendorLabel } from "./orders";
import { KIND_LABEL, type Kind, type Order } from "./types";

// 匯出文件：先把內容排成 A4 頁面（150 dpi，1240×1754），每頁一張 Canvas。
// PNG 就是每頁一張圖（長單自動分成有頁碼的多張），PDF 是同樣的頁面放進 A4。
// 表格只在「完整的列」之間換頁，換頁時重畫表頭。

export const PAGE_W = 1240;
export const PAGE_H = 1754;
const M = 72;
const FOOTER = 56;
export const FONT_STACK = '"PingFang TC","Noto Sans TC","Noto Sans CJK TC","Microsoft JhengHei","Heiti TC","WenQuanYi Zen Hei","Source Han Sans TC",sans-serif';

export interface Col {
  title: string;
  /** 寬度比例 */
  w: number;
  align?: "left" | "right" | "center";
}

export type Block =
  | { type: "title"; text: string }
  | { type: "meta"; lines: string[] }
  | { type: "heading"; text: string }
  | { type: "table"; cols: Col[]; rows: string[][]; strong?: boolean[]; muted?: boolean[] }
  | { type: "summary"; pairs: [string, string][] }
  | { type: "note"; text: string };

export interface DocSpec {
  title: string;
  /** 續頁頁首 */
  runningHead: string;
  blocks: Block[];
  fileBase: string;
}

const C = { ink: "#1c1917", muted: "#78716c", line: "#d6d3d1", head: "#fff7ed", accent: "#c2410c", stripe: "#fafaf9" };

function font(size: number, bold = false) {
  return `${bold ? 700 : 400} ${size}px ${FONT_STACK}`;
}

/** 依實際字寬換行（中文逐字、英文單字盡量不拆） */
export function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    const tokens = para.match(/[A-Za-z0-9$.,+()%#-]+|\s+|./gu) ?? [""];
    for (const t of tokens) {
      const next = line + t;
      // 避頭點：逗號、冒號、右括號等不放在行首，允許略超出一點
      const closing = /^[，。、：；！？）」』】,.:;!?)\]]$/.test(t);
      if (ctx.measureText(next).width <= maxW || line === "" || closing) {
        if (ctx.measureText(t).width > maxW) {
          // 單一超長英數字：逐字拆
          for (const ch of t) {
            if (ctx.measureText(line + ch).width > maxW && line) {
              out.push(line);
              line = ch;
            } else line += ch;
          }
        } else line = next;
      } else {
        out.push(line.trimEnd());
        line = t.trimStart();
      }
    }
    out.push(line.trimEnd());
  }
  return out.length ? out : [""];
}

type Op = (ctx: CanvasRenderingContext2D) => void;

interface Page {
  ops: Op[];
}

const BODY = 23;
const LH = Math.round(BODY * 1.45);
const PAD = 10;

export function layout(spec: DocSpec, measureCtx: CanvasRenderingContext2D): Page[] {
  const pages: Page[] = [];
  let page: Page = { ops: [] };
  let y = M;
  const bottom = PAGE_H - M - FOOTER;
  const contentW = PAGE_W - M * 2;

  const newPage = () => {
    pages.push(page);
    page = { ops: [] };
    y = M;
    const head = spec.runningHead;
    const headY = y;
    page.ops.push((ctx) => {
      ctx.font = font(20);
      ctx.fillStyle = C.muted;
      ctx.textBaseline = "top";
      ctx.fillText(`${head}（續）`, M, headY);
    });
    y += 40;
  };

  const ensure = (h: number) => {
    if (y + h > bottom && y > M + 60) newPage();
  };

  const tableHeader = (cols: Col[], widths: number[]) => {
    const yy = y;
    const h = LH + PAD * 2;
    page.ops.push((ctx) => {
      ctx.fillStyle = C.head;
      ctx.fillRect(M, yy, contentW, h);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(M, yy + h);
      ctx.lineTo(M + contentW, yy + h);
      ctx.stroke();
      ctx.font = font(BODY - 2, true);
      ctx.fillStyle = C.ink;
      ctx.textBaseline = "top";
      let x = M;
      cols.forEach((c, i) => {
        drawCell(ctx, c.title, x, yy + PAD, widths[i], c.align);
        x += widths[i];
      });
    });
    y += h;
    return h;
  };

  const drawCell = (ctx: CanvasRenderingContext2D, text: string, x0: number, yy: number, w: number, align: Col["align"]) => {
    const lines = wrap(ctx, text, w - PAD * 2);
    lines.forEach((ln, i) => {
      const tw = ctx.measureText(ln).width;
      const x = align === "right" ? x0 + w - PAD - tw : align === "center" ? x0 + (w - tw) / 2 : x0 + PAD;
      ctx.fillText(ln, x, yy + i * LH);
    });
  };

  for (let bi = 0; bi < spec.blocks.length; bi++) {
    const b = spec.blocks[bi];
    if (b.type === "title") {
      const yy = y;
      page.ops.push((ctx) => {
        ctx.font = font(42, true);
        ctx.fillStyle = C.ink;
        ctx.textBaseline = "top";
        ctx.fillText(b.text, M, yy);
        ctx.fillStyle = C.accent;
        ctx.fillRect(M, yy + 60, 90, 6);
      });
      y += 86;
    } else if (b.type === "meta") {
      measureCtx.font = font(BODY);
      for (const ln of b.lines) {
        const wrapped = wrap(measureCtx, ln, contentW);
        ensure(wrapped.length * LH);
        const yy = y;
        page.ops.push((ctx) => {
          ctx.font = font(BODY);
          ctx.fillStyle = C.ink;
          ctx.textBaseline = "top";
          wrapped.forEach((w, i) => ctx.fillText(w, M, yy + i * LH));
        });
        y += wrapped.length * LH;
      }
      y += 16;
    } else if (b.type === "heading") {
      // 標題至少要和下一段的表頭＋一列在同一頁
      ensure(48 + LH * 3 + PAD * 4);
      const yy = y + 8;
      page.ops.push((ctx) => {
        ctx.font = font(29, true);
        ctx.fillStyle = C.accent;
        ctx.textBaseline = "top";
        ctx.fillText(b.text, M, yy);
      });
      y += 56;
    } else if (b.type === "note") {
      measureCtx.font = font(20);
      const wrapped = wrap(measureCtx, b.text, contentW);
      ensure(wrapped.length * 30);
      const yy = y;
      page.ops.push((ctx) => {
        ctx.font = font(20);
        ctx.fillStyle = C.muted;
        ctx.textBaseline = "top";
        wrapped.forEach((w, i) => ctx.fillText(w, M, yy + i * 30));
      });
      y += wrapped.length * 30 + 12;
    } else if (b.type === "summary") {
      const h = b.pairs.length * (LH + 8) + PAD * 2;
      ensure(h);
      const yy = y;
      page.ops.push((ctx) => {
        ctx.fillStyle = C.head;
        ctx.fillRect(M, yy, contentW, h);
        ctx.textBaseline = "top";
        b.pairs.forEach(([k, v], i) => {
          const ly = yy + PAD + i * (LH + 8);
          ctx.font = font(BODY + 2, true);
          ctx.fillStyle = C.ink;
          ctx.fillText(k, M + 18, ly);
          const tw = ctx.measureText(v).width;
          ctx.fillStyle = C.accent;
          ctx.fillText(v, M + contentW - 18 - tw, ly);
        });
      });
      y += h + 20;
    } else if (b.type === "table") {
      const total = b.cols.reduce((s, c) => s + c.w, 0);
      const widths = b.cols.map((c) => (c.w / total) * contentW);
      measureCtx.font = font(BODY);
      const heights = b.rows.map((r) => Math.max(...r.map((cell, i) => wrap(measureCtx, cell, widths[i] - PAD * 2).length)) * LH + PAD * 2);
      ensure(LH + PAD * 2 + (heights[0] ?? 0));
      tableHeader(b.cols, widths);
      b.rows.forEach((row, ri) => {
        const h = heights[ri];
        if (y + h > bottom) {
          newPage();
          tableHeader(b.cols, widths);
        }
        const yy = y;
        const strong = b.strong?.[ri];
        const muted = b.muted?.[ri];
        page.ops.push((ctx) => {
          if (ri % 2 === 1) {
            ctx.fillStyle = C.stripe;
            ctx.fillRect(M, yy, contentW, h);
          }
          ctx.strokeStyle = C.line;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(M, yy + h);
          ctx.lineTo(M + contentW, yy + h);
          ctx.stroke();
          ctx.font = font(BODY, Boolean(strong));
          ctx.fillStyle = muted ? C.muted : C.ink;
          ctx.textBaseline = "top";
          let x = M;
          row.forEach((cell, i) => {
            drawCell(ctx, cell, x, yy + PAD, widths[i], b.cols[i].align);
            x += widths[i];
          });
        });
        y += h;
      });
      y += 20;
    }
  }
  pages.push(page);
  return pages;
}

export async function renderPages(spec: DocSpec): Promise<HTMLCanvasElement[]> {
  // 匯出前等待字型載入，避免中文字用到錯誤字型
  if (document.fonts?.ready) await document.fonts.ready;
  const measure = document.createElement("canvas").getContext("2d")!;
  const pages = layout(spec, measure);
  const total = pages.length;
  return pages.map((p, i) => {
    const canvas = document.createElement("canvas");
    canvas.width = PAGE_W;
    canvas.height = PAGE_H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    for (const op of p.ops) op(ctx);
    ctx.font = font(19);
    ctx.fillStyle = C.muted;
    ctx.textBaseline = "alphabetic";
    const footer = `第 ${i + 1} / ${total} 頁`;
    ctx.fillText(spec.title, M, PAGE_H - M + 10);
    ctx.fillText(footer, PAGE_W - M - ctx.measureText(footer).width, PAGE_H - M + 10);
    return canvas;
  });
}

// ---- 文件內容 ----

export type LabelMode = "name" | "number";

/** 每人的座號＝名單順序（不訂的人也保留號碼，貼標不會亂） */
function seatLabel(order: Order, personId: string, mode: LabelMode): string {
  const idx = order.people.findIndex((p) => p.id === personId);
  const p = order.people[idx];
  return mode === "number" ? `#${idx + 1}` : `#${idx + 1} ${displayName(p)}`;
}

/** 店家出單的分組：同名店家的餐點與飲料合在同一份 */
export function vendorGroups(order: Order): { key: string; vendor: string; kinds: Kind[] }[] {
  const groups: { key: string; vendor: string; kinds: Kind[] }[] = [];
  for (const k of activeKinds(order)) {
    const name = vendorLabel(order, k);
    const g = groups.find((x) => x.vendor === name && sectionOf(order, k).vendorName.trim());
    if (g) g.kinds.push(k);
    else groups.push({ key: k, vendor: name, kinds: [k] });
  }
  return groups;
}

export function storeDoc(order: Order, kinds: Kind[], mode: LabelMode): DocSpec {
  const vendor = vendorLabel(order, kinds[0]);
  const blocks: Block[] = [];
  blocks.push({ type: "title", text: `${vendor}　訂單` });
  let grand = 0;
  let people = 0;
  for (const p of order.people) if (!p.skip && p.lines.some((l) => kinds.includes(l.kind))) people++;
  blocks.push({ type: "meta", lines: [`日期：${order.date}`, `訂單：${order.title}`, `內容：${kinds.map((k) => KIND_LABEL[k]).join("＋")}　訂購人數：${people} 人`] });

  for (const k of kinds) {
    const rows = aggregateLines(order, k);
    const sum = rows.reduce((s, r) => s + r.amount, 0);
    const qty = rows.reduce((s, r) => s + r.qty, 0);
    grand += sum;
    blocks.push({ type: "heading", text: `${KIND_LABEL[k]}品項彙總` });
    if (!rows.length) {
      blocks.push({ type: "note", text: "（沒有人點）" });
      continue;
    }
    blocks.push({
      type: "table",
      cols: [
        { title: "品名", w: 3 },
        { title: "規格", w: 1.4 },
        { title: "做法／備註", w: 3.4 },
        { title: "單價", w: 1.3, align: "right" },
        { title: "數量", w: 1.1, align: "right" },
        { title: "金額", w: 1.5, align: "right" },
      ],
      rows: [...rows.map((r) => [r.name, r.variant || "—", r.detail || "—", money(r.unitPrice), String(r.qty), money(r.amount)]), [`${KIND_LABEL[k]}小計`, "", "", "", String(qty), money(sum)]],
      strong: [...rows.map(() => false), true],
    });
  }
  blocks.push({ type: "summary", pairs: [["店家合計", money(grand)]] });

  blocks.push({ type: "heading", text: `逐人明細（貼標／分餐對照，依${mode === "name" ? "姓名" : "編號"}）` });
  const rows: string[][] = [];
  for (const p of order.people) {
    if (p.skip) continue;
    for (const l of p.lines) {
      if (!kinds.includes(l.kind)) continue;
      rows.push([seatLabel(order, p.id, mode), lineLabel(l), String(l.qty), lineDetail(l) || "—"]);
    }
  }
  if (rows.length)
    blocks.push({
      type: "table",
      cols: [
        { title: mode === "name" ? "編號／姓名" : "編號", w: mode === "name" ? 2.6 : 1.2 },
        { title: "品項", w: 3.2 },
        { title: "數量", w: 1, align: "right" },
        { title: "做法／備註", w: 4.2 },
      ],
      rows,
    });
  else blocks.push({ type: "note", text: "（沒有明細）" });

  const kindName = kinds.length > 1 ? "餐飲" : KIND_LABEL[kinds[0]];
  return {
    title: `${vendor} 訂單・${order.date}`,
    runningHead: `${vendor}　${kindName}訂單　${order.date}`,
    blocks,
    fileBase: `${safeFileName(order.title)}_${safeFileName(vendor)}_店家單_${order.date}`,
  };
}

export function internalDoc(order: Order): DocSpec {
  const t = orderTotals(order);
  const kinds = activeKinds(order);
  const blocks: Block[] = [];
  blocks.push({ type: "title", text: `${order.title}　內部收款單` });
  blocks.push({
    type: "meta",
    lines: [`日期：${order.date}`, ...kinds.map((k) => `${KIND_LABEL[k]}店家：${vendorLabel(order, k)}`), `人數：${order.people.length} 人（訂購 ${t.orderingPeople.length}、不訂 ${t.skipPeople.length}、待填 ${t.pendingPeople.length}）`],
  });
  const showMeal = kinds.includes("meal");
  const showDrink = kinds.includes("drink");
  const cols: Col[] = [{ title: "#", w: 0.7, align: "right" }, { title: "姓名", w: 2 }];
  if (showMeal) cols.push({ title: "餐點", w: 3.2 });
  if (showDrink) cols.push({ title: "飲料", w: 3.4 });
  if (showMeal) cols.push({ title: "餐點小計", w: 1.5, align: "right" });
  if (showDrink) cols.push({ title: "飲料小計", w: 1.5, align: "right" });
  cols.push({ title: "應收", w: 1.4, align: "right" }, { title: "收款", w: 1.2, align: "center" });
  const rows: string[][] = [];
  const muted: boolean[] = [];
  order.people.forEach((p, i) => {
    const st = personState(p);
    const pt = personTotals(p);
    const desc = (k: Kind) =>
      st === "skip"
        ? "不訂"
        : p.lines
            .filter((l) => l.kind === k)
            .map((l) => `${lineLabel(l)} ×${l.qty}${lineDetail(l) ? `（${lineDetail(l)}）` : ""}`)
            .join("\n") || (st === "pending" ? "待填" : "—");
    const row = [String(i + 1), displayName(p)];
    if (showMeal) row.push(desc("meal"));
    if (showDrink) row.push(desc("drink"));
    if (showMeal) row.push(st === "skip" ? "—" : money(pt.meal));
    if (showDrink) row.push(st === "skip" ? "—" : money(pt.drink));
    row.push(st === "skip" ? "—" : money(pt.due), st === "skip" ? STATE_LABEL.skip : p.paid ? "已收" : "未收");
    rows.push(row);
    muted.push(st === "skip");
  });
  blocks.push({ type: "heading", text: "逐人明細" });
  blocks.push({ type: "table", cols, rows, muted });
  const pairs: [string, string][] = [];
  if (showMeal) pairs.push([`餐點合計（${vendorLabel(order, "meal")}）`, money(t.meal)]);
  if (showDrink) pairs.push([`飲料合計（${vendorLabel(order, "drink")}）`, money(t.drink)]);
  pairs.push(["全單總額", money(t.total)], ["已收", money(t.paid)], ["待收", money(t.unpaid)]);
  blocks.push({ type: "summary", pairs });
  if (t.pendingPeople.length) blocks.push({ type: "note", text: `尚未填寫：${t.pendingPeople.map(displayName).join("、")}` });
  return {
    title: `${order.title} 內部收款單・${order.date}`,
    runningHead: `${order.title}　內部收款單　${order.date}`,
    blocks,
    fileBase: `${safeFileName(order.title)}_內部收款單_${order.date}`,
  };
}

// ---- 輸出 ----

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("產生圖片失敗"))), type, quality));
}

export async function pngFiles(spec: DocSpec, pages: HTMLCanvasElement[]): Promise<File[]> {
  return Promise.all(
    pages.map(async (c, i) => new File([await canvasToBlob(c)], pages.length > 1 ? `${spec.fileBase}_第${i + 1}頁.png` : `${spec.fileBase}.png`, { type: "image/png" })),
  );
}

export async function pdfFile(spec: DocSpec, pages: HTMLCanvasElement[]): Promise<File> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage("a4", "portrait");
    const data = pages[i].toDataURL("image/jpeg", 0.92);
    pdf.addImage(data, "JPEG", 0, 0, 210, 297, undefined, "FAST");
  }
  pdf.setProperties({ title: spec.title, creator: "辦公室揪訂" });
  const blob = pdf.output("blob");
  return new File([blob], `${spec.fileBase}.pdf`, { type: "application/pdf" });
}

export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files });
  } catch {
    return false;
  }
}

export async function shareFiles(files: File[], title: string): Promise<"shared" | "cancelled"> {
  try {
    await navigator.share({ files, title });
    return "shared";
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return "cancelled";
    throw e;
  }
}
