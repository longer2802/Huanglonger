import { Flag, LocateFixed, MapPinned, Square, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatClock, formatDistance, formatDurationText } from "@/lib/youbike";
import { cn } from "@/lib/utils";

function SegmentResults({ results }) {
  if (!results.length) return null;
  return (
    <div className="space-y-1.5">
      {results.map((result) => (
        <div
          key={result.index}
          className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-[11px]"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-route-bike text-[10px] font-bold text-white">
            {result.index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {result.from} → {result.to}
          </span>
          <span className="shrink-0 text-right font-medium">
            {formatDurationText(result.seconds)}
            <span className="ml-1 text-muted-foreground">
              ·{" "}
              {result.meters != null
                ? formatDistance(result.meters)
                : `${formatDistance(result.plannedMeters)}（規劃）`}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RideView({ ride, now, meters, geoError, following, onRecenter, onArrive, onStop, onFinish }) {
  const { trip } = ride;
  const stops = trip.stops;
  const done = ride.status === "done";
  const totalSeconds = ((ride.endedAt ?? now) - ride.startedAt) / 1000;
  const segSeconds = (now - ride.segStartAt) / 1000;
  const bikeLegs = trip.legs.filter((leg) => leg.mode === "bike");
  const plannedTotal = bikeLegs.reduce((sum, leg) => sum + leg.distanceMeters, 0);
  const hasGpsDistance = ride.gps && ride.results.every((r) => r.meters != null) && (meters > 0 || done);
  const riddenMeters = ride.gps
    ? meters
    : ride.results.reduce((sum, r) => sum + (r.plannedMeters || 0), 0);

  if (done) {
    const gpsTotal = ride.results.every((r) => r.meters != null)
      ? ride.results.reduce((sum, r) => sum + r.meters, 0)
      : null;
    return (
      <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-brand-active" />
          <p className="font-heading text-base font-semibold">騎乘完成！</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-route-bike/10 p-3">
            <p className="text-[11px] text-muted-foreground">總騎乘時間</p>
            <p className="font-display text-2xl font-bold">{formatClock(totalSeconds)}</p>
          </div>
          <div className="rounded-2xl bg-station-available/10 p-3">
            <p className="text-[11px] text-muted-foreground">
              總距離{gpsTotal == null ? "（規劃路線）" : "（定位實測）"}
            </p>
            <p className="font-display text-2xl font-bold">
              {formatDistance(gpsTotal ?? plannedTotal)}
            </p>
          </div>
        </div>
        <SegmentResults results={ride.results} />
        <Button type="button" onClick={onFinish} className="h-11 rounded-xl bg-brand text-foreground hover:bg-brand-active">
          返回地圖
        </Button>
      </div>
    );
  }

  const nextIndex = ride.segIndex + 1;
  const next = stops[nextIndex];
  const isLast = nextIndex === stops.length - 1;
  const segPlanned = bikeLegs[ride.segIndex]?.distanceMeters;

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground">
            下一站 · {isLast ? "終點" : `中繼點 ${nextIndex}`}（{nextIndex}/{stops.length - 1}）
          </p>
          <p className="line-clamp-2 font-heading text-lg font-semibold leading-snug">{next.name}</p>
        </div>
        {ride.gps && !following && (
          <Button type="button" size="sm" variant="outline" onClick={onRecenter} className="h-8 shrink-0 rounded-full text-[11px]">
            <LocateFixed className="mr-1 h-3.5 w-3.5" />
            跟隨定位
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-secondary/70 p-3">
          <p className="text-[11px] text-muted-foreground">已騎時間</p>
          <p className="font-display text-[28px] font-bold leading-tight tabular-nums">{formatClock(totalSeconds)}</p>
          <p className="text-[10px] text-muted-foreground">本段 {formatClock(segSeconds)}</p>
        </div>
        <div className="rounded-2xl bg-secondary/70 p-3">
          <p className="text-[11px] text-muted-foreground">已騎距離</p>
          <p className="font-display text-[28px] font-bold leading-tight tabular-nums">
            {ride.gps || ride.results.length ? (riddenMeters / 1000).toFixed(2) : "—"}
            <span className="ml-1 text-sm font-medium text-muted-foreground">km</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            {ride.gps ? (hasGpsDistance ? "定位實測" : "等待定位訊號…") : "未開定位，抵達後以規劃距離計"}
            {segPlanned ? ` · 本段規劃 ${formatDistance(segPlanned)}` : ""}
          </p>
        </div>
      </div>

      {geoError && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] text-destructive">{geoError}</p>
      )}

      <Button
        type="button"
        onClick={onArrive}
        className={cn(
          "h-12 rounded-2xl text-base font-semibold",
          isLast
            ? "bg-station-empty text-white hover:bg-station-empty/90"
            : "bg-brand text-foreground hover:bg-brand-active"
        )}
      >
        {isLast ? <Flag className="mr-2 h-5 w-5" /> : <MapPinned className="mr-2 h-5 w-5" />}
        {isLast ? "抵達終點" : "抵達中繼點"}
      </Button>

      <SegmentResults results={ride.results} />

      <button
        type="button"
        onClick={onStop}
        className="mx-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
      >
        <Square className="h-3 w-3" />
        結束騎乘
      </button>
    </div>
  );
}
