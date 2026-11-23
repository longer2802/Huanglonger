// All family data lives in this browser's IndexedDB. Nothing is sent anywhere.
// Schema changes go in MIGRATIONS: each step runs once, in order, when an
// older database is opened.
export const DB_NAME = "sprout-family";
export const DB_VERSION = 1;
export const STORES = ["meta", "people", "records", "todos", "answers"];

const MIGRATIONS = {
  1(db) {
    db.createObjectStore("meta", { keyPath: "key" });
    db.createObjectStore("people", { keyPath: "id" });
    const records = db.createObjectStore("records", { keyPath: "id" });
    records.createIndex("subjectId", "subjectId");
    db.createObjectStore("todos", { keyPath: "id" });
    db.createObjectStore("answers", { keyPath: "id" });
  },
};

let dbPromise = null;

export function openDb() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("這個瀏覽器不支援本機儲存"));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const db = req.result;
        for (let v = event.oldVersion + 1; v <= DB_VERSION; v += 1) MIGRATIONS[v]?.(db, req.transaction);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(req.error || new Error("本機資料庫開啟失敗"));
      req.onblocked = () => reject(new Error("請關閉其他開著小芽的分頁後再試"));
    }).catch((e) => {
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("本機資料寫入失敗"));
    tx.onabort = () => reject(tx.error || new Error("本機資料寫入已取消"));
  });
}

function all(store) {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function loadAll() {
  const db = await openDb();
  const tx = db.transaction(STORES, "readonly");
  const [meta, people, records, todos, answers] = await Promise.all(STORES.map((s) => all(tx.objectStore(s))));
  return { meta, people, records, todos, answers };
}

// One atomic write: { put: { store: [values] }, del: { store: [ids] } }.
export async function write({ put = {}, del = {} }) {
  const names = [...new Set([...Object.keys(put), ...Object.keys(del)])];
  if (!names.length) return;
  const db = await openDb();
  const tx = db.transaction(names, "readwrite");
  for (const [name, values] of Object.entries(put)) {
    const store = tx.objectStore(name);
    for (const v of values) store.put(v);
  }
  for (const [name, ids] of Object.entries(del)) {
    const store = tx.objectStore(name);
    for (const id of ids) store.delete(id);
  }
  await done(tx);
}

// Replaces everything in one transaction: if any write fails, nothing changes.
export async function replaceAll(snapshot) {
  const db = await openDb();
  const tx = db.transaction(STORES, "readwrite");
  for (const name of STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const v of snapshot[name] || []) store.put(v);
  }
  await done(tx);
}

export async function clearAll() {
  await replaceAll({});
}
