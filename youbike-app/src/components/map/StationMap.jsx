import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import RouteLayer from "@/components/map/RouteLayer";

const TAIWAN_BOUNDS = [
  [21.8, 119.4],
  [25.4, 122.1],
];

// 縮放層級：縣市總數 → 區域群組 → 個別站點
const CITY_MAX_ZOOM = 10;
const STATION_MIN_ZOOM = 14;

function bikeCount(station, filter) {
  if (filter === "eyb") return station.ebikes || 0;
  if (filter === "yb2") return station.bikes || 0;
  return (station.bikes || 0) + (station.ebikes || 0);
}

function stationColor(station, count) {
  if (station.status === 0) return "bg-muted-foreground";
  if (count <= 0) return "bg-station-empty";
  if (count <= 4) return "bg-brand";
  return "bg-station-available";
}

function stationIcon(station, count, selected) {
  const size = selected ? 34 : 26;
  return L.divIcon({
    className: "yb-marker",
    html: `<div class="flex h-full w-full items-center justify-center rounded-full border-2 border-white ${stationColor(
      station,
      count
    )} font-display text-[11px] font-bold text-white shadow-[0_2px_8px_rgba(15,23,42,0.28)] ${
      selected ? "ring-4 ring-brand/40" : ""
    }">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function groupIcon(bikes, label) {
  const text = bikes.toLocaleString("zh-TW");
  return L.divIcon({
    className: "yb-marker",
    html: `<div class="absolute left-0 top-0 flex w-max -translate-x-1/2 -translate-y-1/2 flex-col items-center whitespace-nowrap rounded-2xl border-2 border-white bg-foreground px-2.5 py-1 text-background shadow-[0_6px_18px_rgba(15,23,42,0.28)] cursor-pointer hover:bg-route-bike">
      <span class="font-display text-[13px] font-bold leading-tight">${text}<span class="ml-0.5 text-[9px] font-medium opacity-80">台</span></span>
      ${label ? `<span class="text-[10px] font-medium leading-tight opacity-90">${label}</span>` : ""}
    </div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function MapEvents({ onChange, onUserDrag }) {
  const map = useMapEvents({
    zoomend: () => onChange(map),
    moveend: () => onChange(map),
    dragstart: () => onUserDrag?.(),
  });

  useEffect(() => {
    onChange(map);
  }, [map]);

  return null;
}

function FlyTo({ focus }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    if (focus.bounds) {
      map.fitBounds(focus.bounds, { padding: [48, 48], maxZoom: focus.maxZoom ?? 16 });
      return;
    }
    if (focus.lat && focus.lng) {
      map.flyTo([focus.lat, focus.lng], focus.zoom ?? Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [focus, map]);
  return null;
}

// 騎乘時像導航 App 一樣：拉近到街道層級並跟隨目前位置
function FollowUser({ position, follow }) {
  const map = useMap();
  const zoomedRef = useRef(false);
  useEffect(() => {
    if (!follow) {
      zoomedRef.current = false;
      return;
    }
    if (!position) return;
    if (!zoomedRef.current || map.getZoom() < 15) {
      map.flyTo([position.lat, position.lng], 17, { duration: 0.8 });
      zoomedRef.current = true;
    } else {
      map.panTo([position.lat, position.lng], { animate: true, duration: 0.5 });
    }
  }, [position, follow, map]);
  return null;
}

// 地圖容器尺寸改變（例如進入騎乘畫面）時重新計算
function ResizeWatcher({ resizeKey }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => map.invalidateSize(), 320);
    return () => clearTimeout(timer);
  }, [resizeKey, map]);
  return null;
}

function emptyGroup(key) {
  return { key, lat: 0, lng: 0, count: 0, bikes: 0, minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 };
}

function addToGroup(group, station, count) {
  group.lat += station.lat;
  group.lng += station.lng;
  group.count += 1;
  group.bikes += count;
  group.minLat = Math.min(group.minLat, station.lat);
  group.maxLat = Math.max(group.maxLat, station.lat);
  group.minLng = Math.min(group.minLng, station.lng);
  group.maxLng = Math.max(group.maxLng, station.lng);
}

function GroupMarker({ group, onSelectCity }) {
  const map = useMap();
  const handleClick = () => {
    if (group.type === "city" && onSelectCity) {
      onSelectCity(group.key);
      return;
    }
    const bounds = [
      [group.minLat, group.minLng],
      [group.maxLat, group.maxLng],
    ];
    if (group.count <= 1 || (group.maxLat - group.minLat < 0.002 && group.maxLng - group.minLng < 0.002)) {
      map.flyTo([group.lat, group.lng], STATION_MIN_ZOOM + 1, { duration: 0.6 });
    } else {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: STATION_MIN_ZOOM + 1 });
    }
  };

  return (
    <Marker
      position={[group.lat, group.lng]}
      icon={groupIcon(group.bikes, group.type === "city" ? group.key : `${group.count} 站`)}
      eventHandlers={{ click: handleClick }}
    >
      <Tooltip direction="top" offset={[0, -24]}>
        {group.type === "city" ? `${group.key}：` : ""}
        {group.count.toLocaleString("zh-TW")} 個站點・可借 {group.bikes.toLocaleString("zh-TW")} 台，點選放大
      </Tooltip>
    </Marker>
  );
}

export default function StationMap({
  stations,
  filter,
  showStations,
  selectedId,
  highlightIds = [],
  onSelect,
  onSelectCity,
  pickMode,
  focus,
  route,
  userPosition,
  track = [],
  follow = false,
  onUserDrag,
  resizeKey,
}) {
  const [zoom, setZoom] = useState(8);
  const [viewport, setViewport] = useState(null);

  const filtered = useMemo(() => {
    if (filter === "eyb") return stations.filter((station) => (station.ebikes || 0) > 0);
    if (filter === "yb2") return stations.filter((station) => (station.bikes || 0) > 0);
    return stations;
  }, [stations, filter]);

  const inView = (lat, lng, pad = 0) =>
    !viewport ||
    (lat <= viewport.north + pad &&
      lat >= viewport.south - pad &&
      lng <= viewport.east + pad &&
      lng >= viewport.west - pad);

  const items = useMemo(() => {
    if (zoom >= STATION_MIN_ZOOM) {
      return filtered
        .filter((station) => inView(station.lat, station.lng))
        .slice(0, 800)
        .map((station) => ({ type: "station", station }));
    }

    const groups = new Map();
    if (zoom <= CITY_MAX_ZOOM) {
      // 各縣市一個泡泡，顯示可借車輛總數
      for (const station of filtered) {
        const key = station.city || "其他";
        if (!groups.has(key)) groups.set(key, emptyGroup(key));
        addToGroup(groups.get(key), station, bikeCount(station, filter));
      }
      return Array.from(groups.values()).map((group) => ({
        ...group,
        type: "city",
        lat: group.lat / group.count,
        lng: group.lng / group.count,
      }));
    }

    const cell = zoom <= 11 ? 0.05 : zoom <= 12 ? 0.025 : 0.012;
    for (const station of filtered) {
      const key = `${Math.floor(station.lat / cell)}:${Math.floor(station.lng / cell)}`;
      if (!groups.has(key)) groups.set(key, emptyGroup(key));
      addToGroup(groups.get(key), station, bikeCount(station, filter));
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        type: "cluster",
        lat: group.lat / group.count,
        lng: group.lng / group.count,
      }))
      .filter((group) => inView(group.lat, group.lng, cell));
  }, [filtered, filter, zoom, viewport]);

  const handleChange = (map) => {
    const bounds = map.getBounds();
    setZoom(map.getZoom());
    setViewport({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  };

  return (
    <MapContainer
      bounds={TAIWAN_BOUNDS}
      boundsOptions={{ padding: [24, 24] }}
      zoomControl={false}
      scrollWheelZoom
      className="h-full w-full"
      style={{ height: "100%", width: "100%", cursor: pickMode ? "crosshair" : undefined }}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        maxZoom={19}
      />
      <ZoomControl position="bottomright" />
      <MapEvents onChange={handleChange} onUserDrag={onUserDrag} />
      <FlyTo focus={focus} />
      <ResizeWatcher resizeKey={resizeKey} />
      <FollowUser position={userPosition} follow={follow} />
      <RouteLayer trip={route} />
      {track.length > 1 && (
        <Polyline
          positions={track}
          interactive={false}
          pathOptions={{ color: "#10B981", weight: 6, opacity: 0.85, lineCap: "round", lineJoin: "round" }}
        />
      )}

      {showStations &&
        items.map((item) =>
          item.type === "station" ? (
            <Marker
              key={item.station.id}
              position={[item.station.lat, item.station.lng]}
              icon={stationIcon(
                item.station,
                bikeCount(item.station, filter),
                item.station.id === selectedId || highlightIds.includes(item.station.id)
              )}
              eventHandlers={{ click: () => onSelect(item.station) }}
            >
              <Tooltip direction="top" offset={[0, -14]}>
                <span className="font-semibold">{item.station.name}</span>
                <br />
                可借 {item.station.bikes} · 電輔 {item.station.ebikes} · 可還 {item.station.empty}
              </Tooltip>
            </Marker>
          ) : (
            <GroupMarker
              key={`${item.type}-${item.key}`}
              group={item}
              onSelectCity={onSelectCity}
            />
          )
        )}
      {userPosition && (
        <>
          {userPosition.accuracy > 15 && (
            <Circle
              center={[userPosition.lat, userPosition.lng]}
              radius={userPosition.accuracy}
              interactive={false}
              pathOptions={{ color: "#2563EB", weight: 1, fillColor: "#2563EB", fillOpacity: 0.08 }}
            />
          )}
          <CircleMarker
            center={[userPosition.lat, userPosition.lng]}
            radius={9}
            interactive={false}
            pathOptions={{ color: "#FFFFFF", weight: 3, fillColor: "#2563EB", fillOpacity: 1 }}
          />
        </>
      )}
    </MapContainer>
  );
}
