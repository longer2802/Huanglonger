import { Bike, Loader2, Map as MapIcon, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LocationSuggestions({
  query,
  fieldLabel = "站點",
  stationMatches,
  addressResults,
  geocoding,
  addressError,
  onSelectStation,
  onSelectAddress,
  onGeocode,
  onClose,
  cities = [],
  pickerCity = "",
  onPickerCityChange,
  totalMatches = 0,
  onPickFromMap,
}) {
  const trimmed = query.trim();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/70 px-3 py-2">
        <p className="text-[11px] font-semibold text-muted-foreground">
          選擇「{fieldLabel}」站點或地址
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 rounded-full"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
        <select
          value={pickerCity}
          onChange={(event) => onPickerCityChange?.(event.target.value)}
          className="h-7 flex-1 rounded-lg border border-border bg-card px-2 text-[11px]"
        >
          <option value="">全部縣市</option>
          {cities.map((city) => (
            <option key={city.name} value={city.name}>
              {city.name}（{city.count} 站）
            </option>
          ))}
        </select>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {totalMatches.toLocaleString("zh-TW")} 站
        </span>
        {onPickFromMap && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPickFromMap}
            className="h-7 shrink-0 rounded-lg px-2 text-[11px]"
          >
            <MapIcon className="mr-1 h-3.5 w-3.5" />
            從地圖上選取
          </Button>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto no-scrollbar">
        {stationMatches.length > 0 && (
          <div className="p-1.5">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {trimmed ? "符合的 YouBike 站點" : "站點清單（依可借車數排序）"}
            </p>
            {stationMatches.map((station) => (
              <button
                key={station.id}
                type="button"
                onClick={() => onSelectStation(station)}
                className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-secondary"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/15">
                  <Bike className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{station.name}</span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {station.city} · {station.district} · {station.address}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-xs font-bold text-station-available">
                    {station.bikes + station.ebikes}
                  </span>
                  <span className="block text-[9px] text-muted-foreground">可借</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {trimmed.length >= 2 && (
          <div className="border-t border-border/70 p-1.5">
            <Button
              type="button"
              variant="ghost"
              onClick={onGeocode}
              disabled={geocoding}
              className="h-9 w-full justify-start rounded-xl px-2 text-xs"
            >
              {geocoding ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="mr-2 h-3.5 w-3.5" />
              )}
              使用地址搜尋「{trimmed}」
            </Button>
            {addressError && (
              <p className="px-2 pb-1 text-[10px] text-destructive">{addressError}</p>
            )}
            {addressResults.map((result) => (
              <button
                key={`${result.lat}-${result.lng}-${result.label}`}
                type="button"
                onClick={() => onSelectAddress(result)}
                className="flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-secondary"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-route-bike" />
                <span className="min-w-0 flex-1 text-[11px] leading-relaxed">{result.label}</span>
              </button>
            ))}
          </div>
        )}

        {!trimmed && (
          <p className="border-t border-border/70 px-3 py-2 text-[10px] text-muted-foreground">
            輸入站名、行政區或地址即可篩選，或直接從清單選擇站點
          </p>
        )}

        {!stationMatches.length && !addressResults.length && !addressError && (
          <p className="px-3 py-3 text-[11px] text-muted-foreground">
            {trimmed ? "沒有符合的站點，試試站名、行政區或地址。" : "目前沒有可選擇的站點。"}
          </p>
        )}
      </div>
    </div>
  );
}