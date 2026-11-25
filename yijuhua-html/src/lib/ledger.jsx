import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { findCategory } from "@/lib/categories";
import { DEFAULT_TZ } from "@/lib/dates";

// 帳本資料層（單一 HTML 版）
// 與線上版相同的「純手機版」邏輯：不登入，紀錄一律存在這台裝置的瀏覽器（localStorage）。
// 線上版的雲端（Base44 資料庫）分支在這個版本拿掉，所以不需要網路。
const LOCAL_KEY = "yijuhua-ledger-v1";
const PREF_KEY = "yijuhua-prefs-v1";

export const DEFAULT_PREFS = {
  currency: "TWD",
  timezone: DEFAULT_TZ,
  autoSave: false,
  voiceLanguage: "zh-TW",
  monthlyBudget: null,
  saveOriginalText: true,
};

const FIELDS = [
  "type",
  "amount",
  "currency",
  "categoryId",
  "categoryName",
  "itemName",
  "merchant",
  "note",
  "transactionDate",
  "transactionTime",
  "timezone",
  "inputMethod",
  "originalText",
  "confidence",
  "status",
  "clientRequestId",
  "paymentMethod",
];

function readJson(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const readLocal = () => {
  const list = readJson(LOCAL_KEY, []);
  if (!Array.isArray(list)) return [];
  // 舊名稱「帳戶轉移」統一改為「轉帳」
  return list.map((r) => {
    let next = r;
    if (r.categoryName === "帳戶轉移") next = { ...next, categoryName: "轉帳", itemName: r.itemName === "帳戶轉移" ? "轉帳" : r.itemName };
    if (r.paymentMethod === "轉帳") next = { ...next, paymentMethod: "銀行轉帳" }; // 付款方式改名
    return next;
  });
};

function sortRecords(list) {
  return [...list].sort(
    (a, b) =>
      (b.transactionDate || "").localeCompare(a.transactionDate || "") ||
      (b.transactionTime || "").localeCompare(a.transactionTime || "") ||
      String(b.created_date || "").localeCompare(String(a.created_date || ""))
  );
}

// 只留資料表欄位，並檢查金額、日期、類型
export function toRecord(draft, prefs) {
  const amount = Math.round(Number(draft.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("金額必須大於 0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.transactionDate || "")) throw new Error("日期格式不正確");
  if (!["expense", "income", "transfer"].includes(draft.type)) throw new Error("類型不正確");
  const record = {};
  for (const field of FIELDS) if (draft[field] !== undefined && draft[field] !== null) record[field] = draft[field];
  record.amount = amount;
  record.currency = record.currency || "TWD";
  record.categoryId = findCategory(record.categoryName)?.id || "";
  record.status = "confirmed";
  if (record.type === "expense") record.paymentMethod = record.paymentMethod || "現金";
  else delete record.paymentMethod;
  record.timezone = record.timezone || prefs.timezone || DEFAULT_TZ;
  if (!prefs.saveOriginalText) delete record.originalText;
  return record;
}

const newLocalId = () =>
  `local-${typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;

const LedgerContext = createContext(null);

export function LedgerProvider({ children }) {
  const user = null;
  const mode = "local";
  const [items, setItems] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const localPending = 0;
  const inflight = useRef(new Set());
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const reload = useCallback(async () => {
    setLoadError(null);
    setPrefs({ ...DEFAULT_PREFS, ...readJson(PREF_KEY, {}) });
    setItems(sortRecords(readLocal()));
    setReady(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const persistLocal = (list) => {
    if (!writeJson(LOCAL_KEY, list)) throw new Error("無法寫入裝置儲存空間（可能是無痕模式或空間已滿）");
  };

  // 新增（語音、文字、手動都走這裡）；同一個 clientRequestId 只會存一次
  const addMany = useCallback(
    async (drafts) => {
      const saved = [];
      for (const draft of drafts) {
        const requestId = draft.clientRequestId;
        if (requestId && (inflight.current.has(requestId) || itemsRef.current.some((r) => r.clientRequestId === requestId))) {
          continue;
        }
        if (requestId) inflight.current.add(requestId);
        try {
          const record = toRecord(draft, prefs);
          const now = new Date().toISOString();
          const local = { ...record, id: newLocalId(), created_date: now, updated_date: now };
          const next = sortRecords([local, ...readLocal()]);
          persistLocal(next);
          setItems(next);
          saved.push(local);
        } finally {
          if (requestId) inflight.current.delete(requestId);
        }
      }
      return saved;
    },
    [prefs]
  );

  const update = useCallback(
    async (id, draft) => {
      const record = toRecord(draft, { ...prefs, saveOriginalText: true });
      const next = sortRecords(
        readLocal().map((r) => (r.id === id ? { ...r, ...record, updated_date: new Date().toISOString() } : r))
      );
      persistLocal(next);
      setItems(next);
      return next.find((r) => r.id === id);
    },
    [prefs]
  );

  const remove = useCallback(async (ids) => {
    const list = Array.isArray(ids) ? ids : [ids];
    const removed = itemsRef.current.filter((r) => list.includes(r.id));
    const next = readLocal().filter((r) => !list.includes(r.id));
    persistLocal(next);
    setItems(sortRecords(next));
    return removed;
  }, []);

  // 撤銷刪除：用原本的內容重新建立
  const restore = useCallback(async (records) => {
    const clean = records.map((r) => ({ ...r, clientRequestId: r.clientRequestId || newLocalId() }));
    const next = sortRecords([...clean, ...readLocal()]);
    persistLocal(next);
    setItems(next);
  }, []);

  const savePrefs = useCallback(
    async (patch) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      writeJson(PREF_KEY, next);
    },
    [prefs]
  );

  const migrateLocal = useCallback(async () => {
    throw new Error("單一 HTML 版不支援登入");
  }, []);

  // 匯入備份：同一筆（相同編號，或日期、時間、類型、分類、項目、金額都相同）不重複匯入
  const importRecords = useCallback(
    (records) => {
      const keyOf = (r) =>
        [r.transactionDate, r.transactionTime || "", r.type, r.categoryName, r.itemName || "", Number(r.amount)].join("|");
      const existing = readLocal();
      const ids = new Set(existing.map((r) => r.clientRequestId).filter(Boolean));
      const keys = new Set(existing.map(keyOf));
      const now = new Date().toISOString();
      const added = [];
      let duplicates = 0;
      for (const r of records) {
        if ((r.clientRequestId && ids.has(r.clientRequestId)) || keys.has(keyOf(r))) {
          duplicates += 1;
          continue;
        }
        const record = toRecord({ ...r, clientRequestId: r.clientRequestId || newLocalId() }, { ...prefs, saveOriginalText: true });
        added.push({ ...record, id: newLocalId(), created_date: now, updated_date: now });
        ids.add(record.clientRequestId);
        keys.add(keyOf(record));
      }
      const next = sortRecords([...added, ...existing]);
      persistLocal(next);
      setItems(next);
      return { added: added.length, duplicates };
    },
    [prefs]
  );

  // 刪除我的所有資料
  const clearAll = useCallback(async () => {
    writeJson(LOCAL_KEY, []);
    setItems([]);
  }, []);

  const value = useMemo(
    () => ({
      items,
      ready,
      loadError,
      mode,
      user,
      prefs,
      localPending,
      addMany,
      update,
      remove,
      restore,
      savePrefs,
      migrateLocal,
      clearAll,
      reload,
      importRecords,
    }),
    [items, ready, loadError, prefs, addMany, update, remove, restore, savePrefs, migrateLocal, clearAll, reload, importRecords]
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger() {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within <LedgerProvider>");
  return ctx;
}
