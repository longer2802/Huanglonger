import { TYPE_LABELS } from "@/lib/categories";

const COLUMNS = [
  ["transactionDate", "日期"],
  ["transactionTime", "時間"],
  ["type", "類型"],
  ["categoryName", "分類"],
  ["itemName", "項目"],
  ["merchant", "商家"],
  ["amount", "金額"],
  ["paymentMethod", "付款方式"],
  ["currency", "幣別"],
  ["note", "備註"],
  ["inputMethod", "輸入方式"],
  ["originalText", "原始語句"],
  ["clientRequestId", "編號"],
];

const METHOD = { voice: "語音", text: "文字", manual: "手動" };
const TYPE_BY_LABEL = { 支出: "expense", 收入: "income", 轉帳: "transfer", 帳戶轉移: "transfer", expense: "expense", income: "income", transfer: "transfer" };
const METHOD_BY_LABEL = { 語音: "voice", 文字: "text", 手動: "manual", voice: "voice", text: "text", manual: "manual" };

const escape = (value) => {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(records) {
  const header = COLUMNS.map(([, label]) => label).join(",");
  const rows = records.map((r) =>
    COLUMNS.map(([key]) => {
      if (key === "type") return escape(TYPE_LABELS[r.type] || r.type);
      if (key === "inputMethod") return escape(METHOD[r.inputMethod] || r.inputMethod);
      return escape(r[key]);
    }).join(",")
  );
  return [header, ...rows].join("\r\n");
}

// 下載 CSV（加 BOM，Excel 開啟不亂碼）
export function downloadCsv(records, filename) {
  const blob = new Blob(["﻿" + toCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 解析 CSV 文字（支援引號、換行、BOM）
function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/^﻿/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

// 把匯出的備份檔轉回帳目；回傳 { records, skipped }
export function parseBackupCsv(text) {
  const rows = parseCsvText(text);
  if (!rows.length) throw new Error("檔案是空的");
  const header = rows[0].map((h) => h.trim());
  const indexOf = Object.fromEntries(COLUMNS.map(([key, label]) => [key, header.indexOf(label)]));
  if (indexOf.transactionDate < 0 || indexOf.amount < 0 || indexOf.type < 0) {
    throw new Error("這不是一句話記帳匯出的備份檔（找不到日期、類型、金額欄位）");
  }
  const records = [];
  let skipped = 0;
  for (const row of rows.slice(1)) {
    const get = (key) => (indexOf[key] >= 0 ? (row[indexOf[key]] || "").trim() : "");
    const type = TYPE_BY_LABEL[get("type")];
    const amount = Number(get("amount").replace(/,/g, ""));
    const date = get("transactionDate").replace(/\//g, "-");
    if (!type || !(amount > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      skipped += 1;
      continue;
    }
    records.push({
      type,
      amount,
      currency: get("currency") || "TWD",
      categoryName: (get("categoryName") === "帳戶轉移" ? "轉帳" : get("categoryName")) || (type === "income" ? "其他收入" : type === "transfer" ? "轉帳" : "其他支出"),
      itemName: get("itemName"),
      merchant: get("merchant"),
      note: get("note"),
      transactionDate: date,
      transactionTime: get("transactionTime"),
      inputMethod: METHOD_BY_LABEL[get("inputMethod")] || "manual",
      originalText: get("originalText"),
      clientRequestId: get("clientRequestId") || "",
      paymentMethod: type === "expense" ? (get("paymentMethod") === "轉帳" ? "銀行轉帳" : get("paymentMethod")) || "現金" : undefined,
      confidence: 1,
    });
  }
  return { records, skipped };
}
