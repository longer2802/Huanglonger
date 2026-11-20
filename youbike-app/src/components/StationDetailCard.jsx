import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function StationDetailCard({ station, onClose, onSetStart, onSetVia, onSetEnd, canAddVia = true }) {
  if (!station) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-heading text-base font-semibold leading-tight">{station.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {station.city} · {station.district}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">取車地點：{station.address}</p>
          {station.status === 0 && (
            <p className="mt-1 text-[11px] font-medium text-destructive">此站目前暫停營運</p>
          )}
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} className="h-7 w-7 shrink-0 rounded-full">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-station-available/10 p-2 text-center">
          <p className="font-display text-lg font-bold text-station-available">{station.bikes}</p>
          <p className="text-[10px] text-muted-foreground">可借</p>
        </div>
        <div className="rounded-xl bg-route-bike/10 p-2 text-center">
          <p className="font-display text-lg font-bold text-route-bike">{station.empty}</p>
          <p className="text-[10px] text-muted-foreground">可還</p>
        </div>
        <div className="rounded-xl bg-brand/15 p-2 text-center">
          <p className="font-display text-lg font-bold">{station.ebikes}</p>
          <p className="text-[10px] text-muted-foreground">電輔車</p>
        </div>
      </div>

      <a
        href={`https://www.openstreetmap.org/?mlat=${station.lat}&mlon=${station.lng}#map=18/${station.lat}/${station.lng}`}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block text-center text-[10px] text-route-bike hover:underline"
      >
        在 OpenStreetMap 開啟此站位置
      </a>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button type="button" size="sm" onClick={onSetStart} className="h-8 rounded-lg bg-station-available px-1 text-xs text-white hover:bg-station-available/90">
          設為起點
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onSetVia}
          disabled={!canAddVia}
          className="h-8 rounded-lg bg-brand px-1 text-xs text-foreground hover:bg-brand-active"
        >
          加入中繼
        </Button>
        <Button type="button" size="sm" onClick={onSetEnd} className="h-8 rounded-lg bg-station-empty px-1 text-xs text-white hover:bg-station-empty/90">
          設為終點
        </Button>
      </div>
    </div>
  );
}