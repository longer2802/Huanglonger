import { CircleMarker, Polyline, Tooltip } from "react-leaflet";
import { formatDistance } from "@/lib/youbike";

const ROUTE_COLORS = {
  walk: "#65758B",
  bike: "#2563EB",
};

export default function RouteLayer({ trip }) {
  if (!trip?.legs?.length) return null;

  const firstLeg = trip.legs[0];
  const lastLeg = trip.legs[trip.legs.length - 1];
  const origin = firstLeg?.coordinates?.[0];
  const lastCoordinates = lastLeg?.coordinates || [];
  const destination = lastCoordinates[lastCoordinates.length - 1];

  return (
    <>
      {trip.legs.map((leg, index) => (
        <Polyline
          key={`${leg.mode}-${index}-${trip.generatedAt}`}
          positions={leg.coordinates}
          pathOptions={{
            color: ROUTE_COLORS[leg.mode] || ROUTE_COLORS.walk,
            weight: leg.mode === "bike" ? 6 : 4,
            opacity: 0.9,
            dashArray: leg.mode === "walk" ? "6 8" : undefined,
            lineCap: "round",
            lineJoin: "round",
          }}
        >
          {/* 每段路線直接在地圖上標示距離與時間 */}
          <Tooltip permanent direction="center" className="yb-route-tip">
            <span style={{ color: ROUTE_COLORS[leg.mode] }} className="font-semibold">
              {leg.mode === "bike" ? "🚲 騎乘" : "🚶 步行"}
            </span>{" "}
            {formatDistance(leg.distanceMeters)} · {leg.minutes} 分
          </Tooltip>
        </Polyline>
      ))}

      {origin && (
        <CircleMarker
          center={origin}
          radius={7}
          pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#10B981", fillOpacity: 1 }}
        >
          <Tooltip permanent direction="left" offset={[-8, 0]}>
            起點
          </Tooltip>
        </CircleMarker>
      )}
      {destination && (
        <CircleMarker
          center={destination}
          radius={7}
          pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#EF4444", fillOpacity: 1 }}
        >
          <Tooltip permanent direction="right" offset={[8, 0]}>
            終點・全程 {trip.totalDistanceKm} km / {trip.totalMinutes} 分
          </Tooltip>
        </CircleMarker>
      )}

      {(trip.stops || [])
        .filter((stop) => stop.role === "via")
        .map((stop, index) => (
          <CircleMarker
            key={`via-${index}-${stop.lat}`}
            center={[stop.lat, stop.lng]}
            radius={7}
            pathOptions={{ color: "#FFFFFF", weight: 2, fillColor: "#F5B700", fillOpacity: 1 }}
          >
            <Tooltip permanent direction="top" offset={[0, -8]}>
              中繼點 {index + 1}：{stop.name}
            </Tooltip>
          </CircleMarker>
        ))}

      {trip.startStation && (
        <CircleMarker
          center={[trip.startStation.lat, trip.startStation.lng]}
          radius={5}
          pathOptions={{ color: "#2563EB", weight: 3, fillColor: "#FFFFFF", fillOpacity: 1 }}
        >
          <Tooltip permanent direction="top" offset={[0, -8]}>
            借車：{trip.startStation.name}
          </Tooltip>
        </CircleMarker>
      )}
      {trip.endStation && (
        <CircleMarker
          center={[trip.endStation.lat, trip.endStation.lng]}
          radius={5}
          pathOptions={{ color: "#2563EB", weight: 3, fillColor: "#FFFFFF", fillOpacity: 1 }}
        >
          <Tooltip permanent direction="bottom" offset={[0, 8]}>
            還車：{trip.endStation.name}
          </Tooltip>
        </CircleMarker>
      )}
    </>
  );
}
