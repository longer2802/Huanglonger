import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Map as MapIcon, Play, Route } from "lucide-react";
import NetworkFilter from "@/components/NetworkFilter";
import RoutePointsEditor from "@/components/RoutePointsEditor";
import LocationSuggestions from "@/components/LocationSuggestions";
import TripSummary from "@/components/TripSummary";
import AvailabilityStats from "@/components/AvailabilityStats";
import CityCounts from "@/components/CityCounts";
import CityStationList from "@/components/CityStationList";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { geocodeAddress } from "@/lib/server-fns";
import { geocodeQuery } from "@/lib/youbike-core";
import { pointLabel, stationValue } from "@/lib/youbike";

function formatTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Taipei",
    });
  } catch {
    return "";
  }
}

// 台／臺 視為相同，並忽略「YouBike2.0_」前綴
const norm = (text) => String(text || "").toLowerCase().replace(/臺/g, "台");

export default function PlannerPanel({
  filter,
  onFilterChange,
  stations,
  stationsLoading,
  stationsError,
  onRefresh,
  fetchedAt,
  points,
  onTextChange,
  onSelectValue,
  onAddVia,
  onRemovePoint,
  onReverse,
  onUseMyLocation,
  onPickFromMap,
  trip,
  onPlan,
  planning,
  planError,
  stats,
  cities,
  selectedCity,
  onSelectCity,
  onShowStation,
  useGps,
  onUseGpsChange,
  onStartRide,
  onShowMap,
}) {
  const geocode = useServerFn(geocodeAddress);
  const [activeField, setActiveField] = useState(null);
  const [addressResults, setAddressResults] = useState([]);
  const [addressError, setAddressError] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [pickerCity, setPickerCity] = useState("");
  const comboRef = useRef(null);

  const { stationMatches, totalMatches } = useMemo(() => {
    const pool = pickerCity ? stations.filter((station) => station.city === pickerCity) : stations;
    const keyword = norm(searchTerm.trim()).replace(/^youbike\s*2\.0_?/, "");
    const bikesOf = (station) => station.bikes + station.ebikes;

    if (!keyword) {
      const sorted = [...pool].sort((a, b) => bikesOf(b) - bikesOf(a));
      return { stationMatches: sorted.slice(0, 50), totalMatches: pool.length };
    }

    const terms = keyword.split(/\s+/).filter(Boolean);
    const matches = pool.filter((station) => {
      const haystack = norm(`${station.name} ${station.district} ${station.address} ${station.city}`);
      return terms.every((term) => haystack.includes(term));
    });
    const nameOf = (station) => norm(station.name).replace(/^youbike2\.0_/, "");
    const rank = (station) =>
      nameOf(station).startsWith(terms[0]) ? 0 : nameOf(station).includes(terms[0]) ? 1 : 2;
    matches.sort((a, b) => rank(a) - rank(b) || bikesOf(b) - bikesOf(a));
    return { stationMatches: matches.slice(0, 50), totalMatches: matches.length };
  }, [stations, searchTerm, pickerCity]);

  const closeSuggestions = useCallback(() => {
    setActiveField(null);
    setAddressResults([]);
    setAddressError(null);
    setSearchTerm("");
  }, []);

  const activateField = (index) => {
    if (activeField !== index) setPickerCity(selectedCity || "");
    setActiveField(index);
    setAddressResults([]);
    setAddressError(null);
    setSearchTerm("");
  };

  useEffect(() => {
    if (activeField == null) return undefined;
    const handlePointerDown = (event) => {
      if (comboRef.current && !comboRef.current.contains(event.target)) closeSuggestions();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [activeField, closeSuggestions]);

  // 中繼點被移除時，關閉已不存在欄位的清單
  useEffect(() => {
    if (activeField != null && activeField >= points.length) closeSuggestions();
  }, [points.length, activeField, closeSuggestions]);

  const selectStation = (station) => {
    onSelectValue(activeField, stationValue(station));
    closeSuggestions();
  };

  const selectAddress = (result) => {
    onSelectValue(activeField, {
      label: result.label,
      station: null,
      lat: result.lat,
      lng: result.lng,
      kind: "address",
    });
    closeSuggestions();
  };

  const handleGeocode = async () => {
    const keyword = searchTerm.trim();
    if (keyword.length < 2) return;
    if (keyword.length > 120) {
      setAddressError("地址太長，請縮短關鍵字。");
      return;
    }
    setGeocoding(true);
    setAddressError(null);
    setAddressResults([]);
    try {
      let result;
      try {
        result = { results: await geocodeQuery(keyword), error: null };
      } catch {
        result = await geocode({ data: { query: keyword } });
      }
      if (result?.error) {
        setAddressError(result.error);
        return;
      }
      const results = result?.results || [];
      setAddressResults(results);
      if (!results.length) setAddressError("找不到這個地址，請換個關鍵字。");
    } catch (error) {
      setAddressError(error?.message || "地址搜尋失敗。");
    } finally {
      setGeocoding(false);
    }
  };

  const ready = points.every((point) => point.value?.lat);
  const canPlan = ready && !planning;

  return (
    <div className="space-y-3">
      <NetworkFilter value={filter} onChange={onFilterChange} />

      <div ref={comboRef}>
        <RoutePointsEditor
          points={points}
          activeIndex={activeField}
          onFocus={activateField}
          onTextChange={(index, text) => {
            if (activeField !== index) activateField(index);
            setSearchTerm(text);
            onTextChange(index, text);
          }}
          onToggleList={(index) => (activeField === index ? closeSuggestions() : activateField(index))}
          onPickFromMap={(index) => {
            const city = activeField === index ? pickerCity : selectedCity;
            closeSuggestions();
            onPickFromMap(index, city || null);
          }}
          onRemove={(index) => {
            closeSuggestions();
            onRemovePoint(index);
          }}
          onAddVia={() => {
            closeSuggestions();
            onAddVia();
          }}
          onReverse={() => {
            closeSuggestions();
            onReverse();
          }}
          onUseMyLocation={() => {
            closeSuggestions();
            onUseMyLocation();
          }}
        />

        {activeField != null && (
          <div className="mt-2">
            <LocationSuggestions
              query={searchTerm}
              fieldLabel={pointLabel(activeField, points.length)}
              stationMatches={stationMatches}
              addressResults={addressResults}
              geocoding={geocoding}
              addressError={addressError}
              onSelectStation={selectStation}
              onSelectAddress={selectAddress}
              onGeocode={handleGeocode}
              onClose={closeSuggestions}
              cities={cities}
              pickerCity={pickerCity}
              onPickerCityChange={setPickerCity}
              totalMatches={totalMatches}
              onPickFromMap={() => {
                const index = activeField;
                const city = pickerCity;
                closeSuggestions();
                onPickFromMap(index, city || null);
              }}
            />
          </div>
        )}
      </div>

      <Button
        type="button"
        onClick={() => {
          closeSuggestions();
          onPlan();
        }}
        disabled={!canPlan}
        className="h-11 w-full rounded-xl bg-brand text-foreground hover:bg-brand-active disabled:opacity-50"
      >
        {planning ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Route className="mr-1.5 h-4 w-4" />}
        {planning ? "規劃中…" : trip ? "重新規劃路線" : "規劃路線"}
      </Button>

      {!ready && (
        <p className="px-1 text-[10px] text-muted-foreground">
          用「選站」從清單挑選，或按「地圖」直接在地圖上點站點；起終點也可輸入地址，系統會自動找最近的站點。
        </p>
      )}

      {planError && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-[11px] leading-relaxed text-destructive">{planError}</p>
      )}

      {stationsError && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-destructive/10 px-3 py-2">
          <p className="text-[11px] text-destructive">{stationsError}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRefresh} className="h-7 rounded-lg text-[10px]">
            重試
          </Button>
        </div>
      )}

      {trip && (
        <div className="space-y-2.5 rounded-2xl border-2 border-brand/60 bg-brand/5 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <Switch checked={useGps} onCheckedChange={onUseGpsChange} className="mt-0.5" />
            <span className="text-xs leading-relaxed">
              <span className="font-semibold">開啟定位</span>
              <span className="block text-[10px] text-muted-foreground">
                使用手機內建 GPS（免費）。騎乘時地圖會跟著你移動，並自動記錄路線與每段距離。
              </span>
            </span>
          </label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Button
              type="button"
              onClick={onStartRide}
              className="h-11 rounded-xl bg-station-available text-base font-semibold text-white hover:bg-station-available/90"
            >
              <Play className="mr-1.5 h-4 w-4 fill-current" />
              開始騎乘
            </Button>
            <Button type="button" variant="outline" onClick={onShowMap} className="h-11 rounded-xl text-xs">
              <MapIcon className="mr-1 h-4 w-4" />
              看地圖
            </Button>
          </div>
        </div>
      )}

      <TripSummary trip={trip} />
      <AvailabilityStats stats={stats} loading={stationsLoading} />
      <CityCounts cities={cities} selectedCity={selectedCity} onSelect={onSelectCity} loading={stationsLoading} />
      {selectedCity && (
        <CityStationList key={selectedCity} city={selectedCity} stations={stations} onSelectStation={onShowStation} />
      )}

      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
        站點資料每分鐘更新；路線距離與時間由免費開放的 OSRM 依 OpenStreetMap 路網估算（免金鑰、無 Google Maps 費用），不含借還車時間。
        {fetchedAt ? ` 更新於 ${formatTime(fetchedAt)}` : ""}
      </p>
      <p className="px-1 text-[9px] text-muted-foreground/80">地圖與路網 © OpenStreetMap contributors</p>
    </div>
  );
}
