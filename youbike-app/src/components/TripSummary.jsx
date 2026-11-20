import { AlertTriangle, Bike, Footprints, ListOrdered, MapPin, Route } from "lucide-react";
import { formatDistance } from "@/lib/youbike";
import { cn } from "@/lib/utils";

function tripNarrative(legs = []) {
  return legs
    .map((leg) => {
      if (leg.mode !== "bike") {
        return `從「${leg.from}」步行 ${formatDistance(leg.distanceMeters)}（約 ${leg.minutes} 分鐘）到「${leg.to}」`;
      }
      const prefix = leg.segment === 0 ? `在「${leg.from}」借車，` : "";
      const suffix = leg.lastSegment ? "還車" : "（中繼點）";
      return `${prefix}騎 ${formatDistance(leg.distanceMeters)}（約 ${leg.minutes} 分鐘）到「${leg.to}」${suffix}`;
    })
    .join("，");
}

function RouteDirections({ legs = [] }) {
  if (!legs.some((leg) => leg.steps?.length)) return null;
  let order = 0;
  return (
    <div className="border-t border-border/70 p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
        <ListOrdered className="h-3.5 w-3.5 text-route-bike" />
        路線文字說明
      </p>
      <div className="space-y-3">
        {legs.map((leg, legIndex) => (
          <div key={`dir-${legIndex}`}>
            <p
              className={cn(
                "mb-1 text-[11px] font-semibold",
                leg.mode === "bike" ? "text-route-bike" : "text-route-walk"
              )}
            >
              {leg.mode === "bike"
                ? `🚲 ${leg.segment === 0 ? `在「${leg.from}」借車` : `從中繼點「${leg.from}」`} → 騎到「${leg.to}」${leg.lastSegment ? "還車" : ""}`
                : `🚶 從「${leg.from}」步行到「${leg.to}」`}
              <span className="ml-1 font-normal text-muted-foreground">
                （{formatDistance(leg.distanceMeters)} · {leg.minutes} 分）
              </span>
            </p>
            <ol className="space-y-1 border-l-2 border-border pl-3">
              {(leg.steps || []).map((step, stepIndex) => {
                order += 1;
                return (
                  <li
                    key={`step-${legIndex}-${stepIndex}`}
                    className="flex gap-2 text-[11px] leading-relaxed text-foreground/85"
                  >
                    <span className="w-4 shrink-0 text-right font-display text-[10px] text-muted-foreground">
                      {order}.
                    </span>
                    <span>{step.text}</span>
                  </li>
                );
              })}
              <li className="flex gap-2 text-[11px] leading-relaxed text-foreground/85">
                <span className="w-4 shrink-0" />
                <span className="font-medium">
                  {leg.mode === "bike" && leg.lastSegment
                    ? `抵達「${leg.to}」，請將車輛歸還站點`
                    : leg.mode === "bike"
                      ? `抵達中繼點「${leg.to}」`
                      : `抵達「${leg.to}」`}
                </span>
              </li>
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TripSummary({ trip }) {
  if (!trip) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-5 text-center">
        <Route className="mx-auto h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">設定起點與終點</p>
        <p className="mt-1 text-xs text-muted-foreground">
          系統會自動找出最近的 YouBike 站點
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-start justify-between gap-2 border-b border-border/70 p-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">預估總時間</p>
          <p className="mt-0.5 font-display text-[28px] font-bold leading-none tracking-tight">
            {trip.totalMinutes}
            <span className="ml-1 font-body text-sm font-medium text-muted-foreground">分鐘</span>
          </p>
        </div>
        <div className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {trip.totalDistanceKm} km
        </div>
      </div>

      {trip.legs?.length > 0 && (
        <p className="border-b border-border/70 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
          {tripNarrative(trip.legs)}。
        </p>
      )}

      <div className="space-y-2.5 p-4">
        {trip.legs.map((leg, index) => (
          <div key={`${leg.mode}-${index}`} className="flex items-center gap-2.5">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                leg.mode === "bike"
                  ? "bg-route-bike/10 text-route-bike"
                  : "bg-route-walk/10 text-route-walk"
              )}
            >
              {leg.mode === "bike" ? (
                <Bike className="h-3.5 w-3.5" />
              ) : (
                <Footprints className="h-3.5 w-3.5" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{leg.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {leg.from} → {leg.to}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-display text-sm font-semibold">{leg.minutes} 分</p>
              <p className="text-[10px] text-muted-foreground">
                {formatDistance(leg.distanceMeters)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <RouteDirections legs={trip.legs} />

      {trip.warnings?.length > 0 && (
        <div className="mx-4 mb-3 space-y-1.5 rounded-xl bg-brand/10 p-2.5">
          {trip.warnings.map((warning, index) => (
            <p
              key={index}
              className="flex gap-1.5 text-[10px] leading-relaxed text-foreground/80"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-brand-active" />
              {warning}
            </p>
          ))}
        </div>
      )}

      <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-[10px] text-muted-foreground">
        <MapPin className="h-3.5 w-3.5" />
        路線已標示在地圖上（按「看地圖」查看）
      </div>

      <p className="px-4 pb-3 text-[10px] text-muted-foreground">
        距離與時間依 OpenStreetMap 開放路網（OSRM）估算，不含借還車時間
      </p>
    </div>
  );
}