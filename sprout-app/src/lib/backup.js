import { DB_VERSION, STORES } from "./db";
import { KINDS } from "./records";

// Encrypted backup file. The password never leaves the phone; without it the
// file cannot be read. AES-GCM also detects any change to the file.
export const BACKUP_FORMAT = "sprout-backup";
export const BACKUP_FORMAT_VERSION = 1;
const ITERATIONS = 250000;

const b64 = {
  enc(bytes) {
    let s = "";
    const arr = new Uint8Array(bytes);
    for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
    return btoa(s);
  },
  dec(text) {
    const s = atob(text);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
    return out;
  },
};

async function deriveKey(password, salt, iterations) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function summarize(snapshot) {
  const family = (snapshot.meta || []).find((m) => m.key === "family");
  const babies = (snapshot.people || []).filter((p) => p.role === "baby");
  return {
    stage: family?.stage === "born" ? "寶寶已出生" : family ? "孕期" : "尚未設定",
    babies: babies.map((b) => b.nickname),
    records: (snapshot.records || []).length,
    todos: (snapshot.todos || []).length,
    answers: (snapshot.answers || []).length,
  };
}

export async function createBackup(snapshot, password) {
  if (!password || password.length < 6) throw new Error("備份密碼至少 6 個字。");
  const payload = JSON.stringify({ dbVersion: DB_VERSION, createdAt: new Date().toISOString(), data: snapshot });
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(payload));
  return JSON.stringify({
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    dbVersion: DB_VERSION,
    createdAt: new Date().toISOString(),
    kdf: { name: "PBKDF2-SHA256", iterations: ITERATIONS, salt: b64.enc(salt) },
    cipher: { name: "AES-GCM", iv: b64.enc(iv) },
    checksum: await sha256(payload),
    data: b64.enc(cipher),
  });
}

function fail(message) {
  throw new Error(message);
}

// Reads and checks a backup without touching the stored data. Returns the
// decrypted snapshot and a summary for the confirmation screen.
export async function readBackup(text, password) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    fail("這不是小芽的備份檔，或檔案已損壞。");
  }
  if (!file || file.format !== BACKUP_FORMAT) fail("這不是小芽的備份檔。");
  if (file.formatVersion !== BACKUP_FORMAT_VERSION) fail(`備份檔格式版本 ${file.formatVersion} 不支援，請更新 App 後再試。`);
  if (!Number.isInteger(file.dbVersion) || file.dbVersion > DB_VERSION) fail("這個備份來自較新版本的小芽，請先更新 App。");
  if (!file.kdf?.salt || !file.cipher?.iv || typeof file.data !== "string" || !file.checksum) fail("備份檔內容不完整。");

  let payload;
  try {
    const key = await deriveKey(password, b64.dec(file.kdf.salt), Number(file.kdf.iterations) || ITERATIONS);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.dec(file.cipher.iv) }, key, b64.dec(file.data));
    payload = new TextDecoder().decode(plain);
  } catch {
    fail("密碼不正確，或備份檔已損壞。原本的資料沒有變動。");
  }
  if ((await sha256(payload)) !== file.checksum) fail("備份檔完整性檢查失敗。原本的資料沒有變動。");

  const parsed = JSON.parse(payload);
  const snap = parsed.data;
  validateSnapshot(snap);
  return { snapshot: snap, summary: summarize(snap), createdAt: parsed.createdAt };
}

export function validateSnapshot(snap) {
  if (!snap || typeof snap !== "object") fail("備份內容格式不正確。");
  for (const name of STORES) {
    if (!Array.isArray(snap[name])) fail(`備份缺少「${name}」資料。`);
  }
  const ids = new Set();
  for (const p of snap.people) {
    if (!p.id || !["mother", "baby"].includes(p.role)) fail("家人資料格式不正確。");
    ids.add(p.id);
  }
  for (const r of snap.records) {
    if (!r.id || !KINDS[r.kind] || !ids.has(r.subjectId)) fail("紀錄資料格式不正確，或對應不到家人。");
  }
  for (const t of snap.todos) {
    if (!t.id || !ids.has(t.subjectId)) fail("待辦資料對應不到家人。");
  }
  for (const m of snap.meta) {
    if (!m.key) fail("設定資料格式不正確。");
  }
  return true;
}

export function backupFileName(today) {
  return `sprout-backup-${today}.sproutbackup`;
}
