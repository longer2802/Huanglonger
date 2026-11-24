import { LAT_RANGE, LNG_RANGE } from "@/lib/mapConfig";
import { isHttpsUrl } from "@/lib/places";
import { normalizeText } from "@/lib/text";
import { normalizeHours, normalizeMealSlots } from "@/lib/hours";

export const BACKUP_APP = "food-map";
export const BACKUP_VERSION = 1;

const VALID_LOCATION = new Set(["confirmed", "pending"]);
const VALID_VISIT = new Set(["want", "visited"]);

function text(value, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function backupFileName(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `美食地圖備份_${year}-${month}-${day}.json`;
}

// Text fields and coordinates only: photos stay on the device.
export function buildBackup(places) {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    count: places.length,
    note: "備份不含照片（照片只存在這台裝置）",
    places: places.map((place) => {
      const record = {
        name: place.name ?? "",
        phone: place.phone ?? "",
        category: place.category ?? "",
        address: place.address ?? "",
        county_code: place.county_code ?? "",
        county_name: place.county_name ?? "",
        town_code: place.town_code ?? "",
        town_name: place.town_name ?? "",
        source_platform: place.source_platform ?? "",
        source_url: place.source_url ?? "",
        note: place.note ?? "",
        tags: Array.isArray(place.tags) ? place.tags : [],
        visit_status: place.visit_status ?? "want",
        location_status: place.location_status ?? "pending",
        created_date: place.created_date ?? null,
      };
      if (typeof place.lat === "number" && typeof place.lng === "number") {
        record.lat = place.lat;
        record.lng = place.lng;
      }
      const hours = normalizeHours(place.hours);
      if (hours) record.hours = hours;
      const slots = normalizeMealSlots(place.meal_slots);
      if (slots.length) record.meal_slots = slots;
      if (place.hours_note) record.hours_note = place.hours_note;
      return record;
    }),
  };
}

export function parseBackup(content) {
  const data = JSON.parse(content);
  const list = Array.isArray(data) ? data : data?.places;
  if (!Array.isArray(list)) throw new Error("backup-format");
  return list;
}

function duplicateKey(name, address) {
  return `${normalizeText(name)}|${normalizeText(address)}`;
}

function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "不是有效的店家資料" };
  }

  const name = text(raw.name, 120);
  if (!name) return { error: "缺少店名" };

  let lat = null;
  let lng = null;
  const hasCoords = (raw.lat != null && raw.lat !== "") || (raw.lng != null && raw.lng !== "");
  if (hasCoords) {
    lat = Number(raw.lat);
    lng = Number(raw.lng);
    const latOk = Number.isFinite(lat) && lat >= LAT_RANGE[0] && lat <= LAT_RANGE[1];
    const lngOk = Number.isFinite(lng) && lng >= LNG_RANGE[0] && lng <= LNG_RANGE[1];
    if (!latOk || !lngOk) return { error: "座標不在臺灣範圍" };
  }

  const locationStatus =
    raw.location_status == null || raw.location_status === ""
      ? lat != null
        ? "confirmed"
        : "pending"
      : raw.location_status;
  if (!VALID_LOCATION.has(locationStatus)) return { error: "定位狀態不合法" };
  if (locationStatus === "confirmed" && lat == null) {
    return { error: "標記為已確認但沒有座標" };
  }

  const visitStatus =
    raw.visit_status == null || raw.visit_status === "" ? "want" : raw.visit_status;
  if (!VALID_VISIT.has(visitStatus)) return { error: "想吃／已吃狀態不合法" };

  const sourceUrl = text(raw.source_url, 500);
  if (sourceUrl && !isHttpsUrl(sourceUrl)) return { error: "來源連結不是 https" };

  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => text(tag, 40)).filter(Boolean).slice(0, 30)
    : [];

  const record = {
    name,
    phone: text(raw.phone, 40),
    category: text(raw.category, 40) || "其他",
    address: text(raw.address, 300),
    county_code: text(raw.county_code, 20),
    county_name: text(raw.county_name, 40),
    town_code: text(raw.town_code, 20),
    town_name: text(raw.town_name, 40),
    source_platform: text(raw.source_platform, 40) || "其他",
    source_url: sourceUrl,
    note: text(raw.note, 2000),
    tags,
    visit_status: visitStatus,
    location_status: locationStatus,
  };

  if (locationStatus === "confirmed" && lat != null) {
    record.lat = lat;
    record.lng = lng;
  }

  // Opening hours are optional; anything malformed is dropped, not rejected.
  const hours = normalizeHours(raw.hours);
  if (hours) record.hours = hours;
  const slots = normalizeMealSlots(raw.meal_slots);
  if (slots.length) record.meal_slots = slots;
  const hoursNote = text(raw.hours_note, 200);
  if (hoursNote) record.hours_note = hoursNote;

  return { record };
}

// Splits the file into what can be created, what duplicates an existing place
// (name + address, normalised) and what is invalid with a reason.
export function validateImport(records, existingPlaces = []) {
  const known = new Set(existingPlaces.map((place) => duplicateKey(place.name, place.address)));
  const seen = new Set();
  const valid = [];
  const duplicates = [];
  const invalid = [];

  records.forEach((raw, index) => {
    const { record, error } = normalizeRecord(raw);
    if (error) {
      invalid.push({ index, name: text(raw?.name, 120), reason: error });
      return;
    }
    const key = duplicateKey(record.name, record.address);
    if (known.has(key) || seen.has(key)) {
      duplicates.push({ index, name: record.name });
      return;
    }
    seen.add(key);
    valid.push(record);
  });

  return { valid, duplicates, invalid };
}
