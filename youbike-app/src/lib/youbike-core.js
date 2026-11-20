import { cityForStationNo, formatDistance, haversineMeters } from "@/lib/youbike";

// 共用邏輯：瀏覽器與伺服器都可使用（三個服務皆允許跨網域 CORS）。
// 全部使用免費、免金鑰的開放服務：
// - 站點：YouBike 官方公開 JSON
// - 路線：FOSSGIS 公益 OSRM 伺服器（OpenStreetMap 路網，自行車／步行）
// - 地址：OpenStreetMap Nominatim
// 不使用 Google Maps，因此不會產生任何 API 費用。
export const FEED_URL = "https://apis.youbike.com.tw/json/station-yb2.json";
const OSRM_BASE = "https://routing.openstreetmap.de";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";

// 路線服務失敗時的備援速度（公尺/秒）
const FALLBACK_SPEED = { bike: 14000 / 3600, walk: 4500 / 3600 };
const DETOUR_FACTOR = 1.3;

const isBrowser = typeof window !== "undefined";
// 瀏覽器不允許自訂 User-Agent，只在伺服器端加上
const requestHeaders = isBrowser
  ? {}
  : {
      "User-Agent": "Mozilla/5.0 (compatible; YouBikeRoutePlanner/1.0)",
      Accept: "application/json",
      Referer: "https://www.youbike.com.tw/",
    };

export async function loadFeed() {
  const response = await fetch(FEED_URL, {
    headers: requestHeaders,
    ...(isBrowser ? { cache: "no-store" } : {}),
  });
  if (!response.ok) throw new Error(`YouBike 站點資料暫時無法取得（${response.status}）`);
  const payload = await response.json();
  return parseFeed(payload);
}

export function parseFeed(payload) {
  const raw = Array.isArray(payload) ? payload : payload?.stations || [];

  const stations = raw
    .map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return {
        id: String(item.station_no || ""),
        name: item.name_tw || "",
        city: cityForStationNo(item.station_no),
        district: item.district_tw || "",
        address: item.address_tw || "",
        lat,
        lng,
        bikes: Number(item.available_spaces_detail?.yb2 || 0),
        ebikes: Number(item.available_spaces_detail?.eyb || 0),
        empty: Number(item.empty_spaces || 0),
        total: Number(item.parking_spaces || 0),
        status: Number(item.status ?? 1),
      };
    })
    .filter((station) => station && station.id && station.name);

  return { stations, fetchedAt: new Date().toISOString() };
}

export function findNearest(stations, point, need) {
  let best = null;
  let bestDistance = Infinity;

  for (const station of stations) {
    if (station.status !== 1) continue;
    const bikes = station.bikes + station.ebikes;
    if (need === "bikes" && bikes <= 0) continue;
    if (need === "docks" && station.empty <= 0) continue;
    const distance = haversineMeters(point, station);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = station;
    }
  }

  if (best) return { station: best, distanceMeters: bestDistance, fallback: false };

  for (const station of stations) {
    if (station.status !== 1) continue;
    const distance = haversineMeters(point, station);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = station;
    }
  }

  return best ? { station: best, distanceMeters: bestDistance, fallback: true } : null;
}

// ---------- 轉彎說明（OSRM steps → 中文） ----------

const MODIFIER_TEXT = {
  left: "左轉",
  right: "右轉",
  "slight left": "稍微靠左",
  "slight right": "稍微靠右",
  "sharp left": "向左急轉",
  "sharp right": "向右急轉",
  straight: "直行",
  uturn: "迴轉",
};

function roadName(step) {
  const name = (step.name || "").trim();
  return name ? `「${name}」` : "";
}

function stepInstruction(step, verb) {
  const { type, modifier, exit } = step.maneuver || {};
  const road = roadName(step);
  const distance = formatDistance(step.distance);

  if (type === "depart") {
    return road ? `沿${road}${verb} ${distance}` : `出發後${verb} ${distance}`;
  }
  if (type === "roundabout" || type === "rotary" || type === "exit roundabout") {
    return `進入圓環，從第 ${exit || 1} 個出口離開${road ? `至${road}` : ""}，${verb} ${distance}`;
  }
  const turn = MODIFIER_TEXT[modifier] || "繼續前進";
  if (type === "new name" || type === "continue") {
    return road ? `${modifier && modifier !== "straight" ? turn + "，" : ""}沿${road}${verb} ${distance}` : `${turn}，${verb} ${distance}`;
  }
  if (type === "fork") {
    return `在岔路${turn}${road ? `，進入${road}` : ""}，${verb} ${distance}`;
  }
  if (type === "end of road") {
    return `道路盡頭${turn}${road ? `進入${road}` : ""}，${verb} ${distance}`;
  }
  return `${turn}${road ? `進入${road}` : ""}，${verb} ${distance}`;
}

function buildSteps(rawSteps, mode) {
  const verb = mode === "bike" ? "騎行" : "步行";
  const merged = [];

  for (const step of rawSteps || []) {
    const type = step.maneuver?.type;
    if (type === "arrive") continue;
    const last = merged[merged.length - 1];
    const sameRoad = last && (step.name || "") === (last.name || "");
    const passive = type === "continue" || type === "new name";
    // 合併同一條路上的連續直行段，或距離極短的段落，避免說明過於瑣碎
    if (last && ((sameRoad && passive) || step.distance < 15)) {
      last.distance += step.distance;
      last.duration += step.duration;
      continue;
    }
    merged.push({
      name: step.name || "",
      distance: Number(step.distance || 0),
      duration: Number(step.duration || 0),
      maneuver: step.maneuver || {},
    });
  }

  return merged.slice(0, 40).map((step) => ({
    text: stepInstruction(step, verb),
    distanceMeters: Math.round(step.distance),
  }));
}

// ---------- 路線 ----------

// 一次請求即可規劃多個停靠點（起點 → 中繼點 → 終點），回傳每一段的路線
async function osrmRoute(mode, points) {
  const service = mode === "bike" ? "routed-bike" : "routed-foot";
  const coords = points.map((point) => `${point.lng},${point.lat}`).join(";");
  const url = new URL(`${OSRM_BASE}/${service}/route/v1/driving/${coords}`);
  url.searchParams.set("overview", "false");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "true");

  const response = await fetch(url, { headers: requestHeaders });
  if (!response.ok) throw new Error(`OSRM ${response.status}`);
  const payload = await response.json();
  const route = payload?.routes?.[0];
  if (payload?.code !== "Ok" || !Array.isArray(route?.legs) || route.legs.length !== points.length - 1) {
    throw new Error("OSRM no route");
  }

  return route.legs.map((leg) => {
    const coordinates = [];
    for (const step of leg.steps || []) {
      for (const [lng, lat] of step.geometry?.coordinates || []) {
        const last = coordinates[coordinates.length - 1];
        if (!last || last[0] !== lat || last[1] !== lng) coordinates.push([lat, lng]);
      }
    }
    if (coordinates.length < 2) throw new Error("OSRM no geometry");
    return {
      coordinates,
      distanceMeters: Number(leg.distance || 0),
      durationSeconds: Number(leg.duration || 0),
      steps: buildSteps(leg.steps, mode),
      estimated: false,
    };
  });
}

function straightLineRoute(mode, from, to) {
  const distanceMeters = haversineMeters(from, to) * DETOUR_FACTOR;
  return {
    coordinates: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    distanceMeters,
    durationSeconds: distanceMeters / FALLBACK_SPEED[mode],
    steps: [
      {
        text: `朝目的地方向${mode === "bike" ? "騎行" : "步行"}約 ${formatDistance(distanceMeters)}（概估）`,
        distanceMeters: Math.round(distanceMeters),
      },
    ],
    estimated: true,
  };
}

async function routeLegs(mode, points) {
  try {
    return await osrmRoute(mode, points);
  } catch (error) {
    console.error("OSRM route failed, using estimate", error?.message);
    return points.slice(1).map((point, index) => straightLineRoute(mode, points[index], point));
  }
}

// ---------- 地址搜尋 ----------

export async function geocodeQuery(query) {
  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("countrycodes", "tw");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "zh-TW");

  let response;
  try {
    response = await fetch(url, { headers: requestHeaders });
  } catch {
    throw new Error("無法連線到地址搜尋服務，請檢查網路後再試。");
  }

  if (!response.ok) {
    console.error("Nominatim error", response.status);
    if (response.status === 429) throw new Error("地址搜尋太頻繁，請稍候幾秒再試。");
    throw new Error("地址搜尋暫時無法使用，請改用站名搜尋或地圖選點。");
  }

  const payload = await response.json();
  const results = (Array.isArray(payload) ? payload : [])
    .map((item) => ({
      label: item.display_name || item.name || query,
      lat: Number(item.lat),
      lng: Number(item.lon),
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng))
    .slice(0, 5);
  return results;
}

function publicStation(station) {
  return {
    id: station.id,
    name: station.name,
    city: station.city,
    district: station.district,
    address: station.address,
    lat: station.lat,
    lng: station.lng,
    bikes: station.bikes,
    ebikes: station.ebikes,
    empty: station.empty,
    total: station.total,
    status: station.status,
  };
}

function minutesOf(seconds) {
  return Math.max(1, Math.round(seconds / 60));
}

export async function buildRoutePlan(stations, { points }) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new Error("請至少設定起點與終點。");
  }
  const warnings = [];
  const first = points[0];
  const last = points[points.length - 1];
  const byId = (id) => (id ? stations.find((station) => station.id === id) : null);

  let startStation = byId(first.stationId);
  if (startStation) {
    if (startStation.bikes + startStation.ebikes <= 0) warnings.push("起點站點目前沒有可借車輛。");
  } else {
    const nearest = findNearest(stations, first, "bikes");
    if (!nearest) throw new Error("附近找不到可借車的 YouBike 站點。");
    startStation = nearest.station;
    if (nearest.fallback) warnings.push("最近的站點目前沒有可借車輛，已改選其他站點。");
    if (nearest.distanceMeters > 1200) {
      warnings.push(`最近的借車站點距離約 ${formatDistance(nearest.distanceMeters)}。`);
    }
  }

  let endStation = byId(last.stationId);
  if (endStation) {
    if (endStation.empty <= 0) warnings.push("終點站點目前沒有可還空位。");
  } else {
    const nearest = findNearest(stations, last, "docks");
    if (!nearest) throw new Error("附近找不到可還車的 YouBike 站點。");
    endStation = nearest.station;
    if (nearest.fallback) warnings.push("最近的站點目前沒有可還空位，已改選其他站點。");
    if (nearest.distanceMeters > 1200) {
      warnings.push(`最近的還車站點距離約 ${formatDistance(nearest.distanceMeters)}。`);
    }
  }

  const vias = points.slice(1, -1).map((point, index) => {
    const station = byId(point.stationId);
    return station
      ? { role: "via", name: station.name, lat: station.lat, lng: station.lng, station: publicStation(station) }
      : { role: "via", name: point.label || `中繼點 ${index + 1}`, lat: point.lat, lng: point.lng, station: null };
  });

  const stops = [
    { role: "start", name: startStation.name, lat: startStation.lat, lng: startStation.lng, station: publicStation(startStation) },
    ...vias,
    { role: "end", name: endStation.name, lat: endStation.lat, lng: endStation.lng, station: publicStation(endStation) },
  ];

  for (let index = 0; index < stops.length - 1; index += 1) {
    if (haversineMeters(stops[index], stops[index + 1]) < 15) {
      throw new Error(`「${stops[index].name}」與下一站相同，請調整站點。`);
    }
  }

  const startWalkMeters = haversineMeters(first, startStation);
  const endWalkMeters = haversineMeters(endStation, last);
  const originName = first.label || "起點";
  const destinationName = last.label || "終點";

  const [walkIn, bikeLegs, walkOut] = await Promise.all([
    startWalkMeters > 50 ? routeLegs("walk", [first, startStation]).then((list) => list[0]) : null,
    routeLegs("bike", stops),
    endWalkMeters > 50 ? routeLegs("walk", [endStation, last]).then((list) => list[0]) : null,
  ]);

  const legs = [];
  if (walkIn) {
    legs.push({
      mode: "walk",
      label: "步行至借車站",
      from: originName,
      to: startStation.name,
      minutes: minutesOf(walkIn.durationSeconds),
      distanceMeters: walkIn.distanceMeters,
      coordinates: walkIn.coordinates,
      steps: walkIn.steps,
    });
  }
  bikeLegs.forEach((leg, index) => {
    legs.push({
      mode: "bike",
      segment: index,
      lastSegment: index === bikeLegs.length - 1,
      label: bikeLegs.length > 1 ? `騎乘第 ${index + 1} 段` : "YouBike 騎乘",
      from: stops[index].name,
      to: stops[index + 1].name,
      minutes: minutesOf(leg.durationSeconds),
      distanceMeters: leg.distanceMeters,
      coordinates: leg.coordinates,
      steps: leg.steps,
    });
  });
  if (walkOut) {
    legs.push({
      mode: "walk",
      label: "步行至目的地",
      from: endStation.name,
      to: destinationName,
      minutes: minutesOf(walkOut.durationSeconds),
      distanceMeters: walkOut.distanceMeters,
      coordinates: walkOut.coordinates,
      steps: walkOut.steps,
    });
  }

  const bikeMeters = bikeLegs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
  if (bikeMeters > 20000) {
    warnings.push(
      `騎乘距離約 ${formatDistance(bikeMeters)}，已超過一般 YouBike 使用範圍，請確認站點是否選對（例如不同縣市的同名站點）。`
    );
  }
  if (startStation.city && endStation.city && startStation.city !== endStation.city) {
    warnings.push(`借車站在${startStation.city}、還車站在${endStation.city}，部分縣市之間無法跨區還車，請先確認。`);
  }
  if ([walkIn, ...bikeLegs, walkOut].some((leg) => leg?.estimated)) {
    warnings.push("免費路線服務暫時忙碌，部分路段改以直線距離概估。");
  }

  const totalMinutes = legs.reduce((sum, leg) => sum + leg.minutes, 0);
  const totalDistanceMeters = legs.reduce((sum, leg) => sum + leg.distanceMeters, 0);

  return {
    startStation: publicStation(startStation),
    endStation: publicStation(endStation),
    stops,
    legs,
    totalMinutes,
    totalDistanceKm: Number((totalDistanceMeters / 1000).toFixed(1)),
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
