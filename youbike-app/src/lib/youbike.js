export const CITY_BY_PREFIX = {
  "5001": "台北市",
  "5002": "新北市",
  "5003": "桃園市",
  "5004": "新竹市",
  "5005": "新竹縣",
  "5006": "台中市",
  "5007": "苗栗縣",
  "5010": "嘉義市",
  "5011": "嘉義縣",
  "5012": "高雄市",
  "5013": "台南市",
  "5014": "屏東縣",
  "5015": "台東縣",
  "5082": "新竹科學園區",
};

export const STATION_FIELDS = [
  "id",
  "name",
  "city",
  "district",
  "address",
  "lat",
  "lng",
  "bikes",
  "ebikes",
  "empty",
  "status",
];

export function cityForStationNo(stationNo) {
  return CITY_BY_PREFIX[String(stationNo || "").slice(0, 4)] || "其他";
}

export function haversineMeters(a, b) {
  const radius = 6371000;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters) {
  if (!Number.isFinite(meters)) return "—";
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export const MAX_VIAS = 3;

export function pointLabel(index, total) {
  if (index === 0) return "起點";
  if (index === total - 1) return "終點";
  return `中繼點 ${index}`;
}

export function stationValue(station) {
  return { label: station.name, station, lat: station.lat, lng: station.lng, kind: "station" };
}

// 1:02:03 或 12:05
export function formatClock(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// 12 分 30 秒
export function formatDurationText(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} 小時 ${m} 分`;
  if (m > 0) return `${m} 分 ${s} 秒`;
  return `${s} 秒`;
}
