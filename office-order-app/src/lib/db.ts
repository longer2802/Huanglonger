import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Order, StoredPhoto, VendorTemplate } from "./types";

// 所有資料只存在這台裝置的這個瀏覽器（IndexedDB），不上傳任何地方。

interface Schema extends DBSchema {
  orders: { key: string; value: Order };
  templates: { key: string; value: VendorTemplate };
  photos: { key: string; value: StoredPhoto; indexes: { byOrder: string } };
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = openDB<Schema>("office-group-order", 1, {
      upgrade(d) {
        d.createObjectStore("orders", { keyPath: "id" });
        d.createObjectStore("templates", { keyPath: "id" });
        const photos = d.createObjectStore("photos", { keyPath: "id" });
        photos.createIndex("byOrder", "orderId");
      },
    });
  }
  return dbPromise;
}

export async function listOrders(): Promise<Order[]> {
  const all = await (await db()).getAll("orders");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getOrder(id: string): Promise<Order | undefined> {
  return (await db()).get("orders", id);
}

export async function putOrder(order: Order): Promise<void> {
  await (await db()).put("orders", order);
}

export async function deleteOrder(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(["orders", "photos"], "readwrite");
  await tx.objectStore("orders").delete(id);
  const keys = await tx.objectStore("photos").index("byOrder").getAllKeys(id);
  for (const k of keys) await tx.objectStore("photos").delete(k);
  await tx.done;
}

export async function listTemplates(): Promise<VendorTemplate[]> {
  const all = await (await db()).getAll("templates");
  return all.sort((a, b) => b.savedAt - a.savedAt);
}

export async function putTemplate(t: VendorTemplate): Promise<void> {
  await (await db()).put("templates", t);
}

export async function deleteTemplate(id: string): Promise<void> {
  await (await db()).delete("templates", id);
}

export async function putPhoto(p: StoredPhoto): Promise<void> {
  await (await db()).put("photos", p);
}

export async function getPhoto(id: string): Promise<StoredPhoto | undefined> {
  return (await db()).get("photos", id);
}

export async function deletePhoto(id: string): Promise<void> {
  await (await db()).delete("photos", id);
}

export async function listAllPhotos(): Promise<StoredPhoto[]> {
  return (await db()).getAll("photos");
}

// ---- JSON 備份與還原 ----

interface BackupFile {
  app: "office-group-order";
  version: 1;
  exportedAt: string;
  orders: Order[];
  templates: VendorTemplate[];
  photos: { id: string; orderId: string; kind: StoredPhoto["kind"]; name: string; type: string; dataUrl: string }[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

export async function exportBackup(includePhotos: boolean): Promise<Blob> {
  const [orders, templates, photos] = await Promise.all([listOrders(), listTemplates(), includePhotos ? listAllPhotos() : Promise.resolve([])]);
  const file: BackupFile = {
    app: "office-group-order",
    version: 1,
    exportedAt: new Date().toISOString(),
    orders,
    templates,
    photos: await Promise.all(photos.map(async (p) => ({ id: p.id, orderId: p.orderId, kind: p.kind, name: p.name, type: p.blob.type, dataUrl: await blobToDataUrl(p.blob) }))),
  };
  return new Blob([JSON.stringify(file)], { type: "application/json" });
}

export async function importBackup(text: string): Promise<{ orders: number; templates: number; photos: number }> {
  let data: BackupFile;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("這不是有效的 JSON 檔");
  }
  if (!data || data.app !== "office-group-order" || !Array.isArray(data.orders)) throw new Error("這不是「辦公室揪訂」的備份檔");
  const d = await db();
  const photos = Array.isArray(data.photos) ? data.photos : [];
  const blobs = await Promise.all(photos.map((p) => dataUrlToBlob(p.dataUrl)));
  const tx = d.transaction(["orders", "templates", "photos"], "readwrite");
  for (const o of data.orders) if (o && typeof o.id === "string") await tx.objectStore("orders").put(o);
  const templates = Array.isArray(data.templates) ? data.templates : [];
  for (const t of templates) if (t && typeof t.id === "string") await tx.objectStore("templates").put(t);
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    await tx.objectStore("photos").put({ id: p.id, orderId: p.orderId, kind: p.kind, name: p.name, blob: blobs[i] });
  }
  await tx.done;
  return { orders: data.orders.length, templates: templates.length, photos: photos.length };
}
