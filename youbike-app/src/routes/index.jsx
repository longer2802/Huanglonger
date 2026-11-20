import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ChevronLeft, MousePointerClick, Play, RefreshCw, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import PlannerPanel from "@/components/PlannerPanel";
import StationDetailCard from "@/components/StationDetailCard";
import RideView from "@/components/RideView";
import MapUtilities from "@/components/MapUtilities";
import Legend from "@/components/Legend";
import BrandMark from "@/components/BrandMark";
import MapSkeleton from "@/components/map/MapSkeleton";
import { Button } from "@/components/ui/button";
import useStations from "@/hooks/useStations";
import useRide from "@/hooks/useRide";
import { planYouBikeRoute } from "@/lib/server-fns";
import { buildRoutePlan } from "@/lib/youbike-core";
import {
  MAX_VIAS,
  formatDistance,
  formatDurationText,
  pointLabel,
  stationValue,
} from "@/lib/youbike";
import { cn } from "@/lib/utils";

const StationMap = lazy(() => import("@/components/map/StationMap"));

function isInTaiwan(lat, lng) {
  return lat >= 21.5 && lat <= 26.5 && lng >= 118 && lng <= 123;
}

function isDesktop() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

let pointSeq = 0;
const newPoint = (value = null) => ({ id: `pt-${(pointSeq += 1)}`, value });

function boundsOf(list) {
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const [lat, lng] of list) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  }
  return Number.isFinite(minLat) ? [[minLat, minLng], [maxLat, maxLng]] : null;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "YouBike 路線規劃｜全台站點即時地圖" },
      {
        name: "description",
        content:
          "全台 YouBike 站點即時地圖，可設定多個中繼站規劃騎乘路線，並以免費 GPS 計時、記錄每段距離與時間。",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { stations, loading, refreshing, error, fetchedAt, reload } = useStations();
  const planRoute = useServerFn(planYouBikeRoute);
  const rideCtl = useRide();
  const inRide = Boolean(rideCtl.ride);

  const [view, setView] = useState("map"); // map | setup
  const [points, setPoints] = useState(() => [newPoint(), newPoint()]);
  const [filter, setFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [layersOn, setLayersOn] = useState(true);
  const [pickTarget, setPickTarget] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [trip, setTrip] = useState(null);
  const [planError, setPlanError] = useState(null);
  const [focus, setFocus] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [useGps, setUseGps] = useState(false);
  const [follow, setFollow] = useState(true);

  // 桌機預設打開設定面板；手機先看全台地圖
  useEffect(() => {
    if (isDesktop()) setView("setup");
  }, []);

  const visibleStations = useMemo(
    () => (cityFilter ? stations.filter((station) => station.city === cityFilter) : stations),
    [stations, cityFilter]
  );

  const cities = useMemo(() => {
    const groups = new Map();
    for (const station of stations) {
      const name = station.city || "其他";
      let entry = groups.get(name);
      if (!entry) {
        entry = { name, count: 0, bikes: 0 };
        groups.set(name, entry);
      }
      entry.count += 1;
      entry.bikes += station.bikes + station.ebikes;
    }
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [stations]);

  const stats = useMemo(
    () =>
      visibleStations.reduce(
        (acc, station) => ({
          bikes: acc.bikes + station.bikes + station.ebikes,
          empty: acc.empty + station.empty,
          stations: acc.stations + 1,
        }),
        { bikes: 0, empty: 0, stations: 0 }
      ),
    [visibleStations]
  );

  const highlightIds = useMemo(
    () => (trip?.stops || []).map((stop) => stop.station?.id).filter(Boolean),
    [trip]
  );

  const resetPlan = () => {
    setTrip(null);
    setPlanError(null);
  };

  const setPointValue = (index, value) => {
    setPoints((list) => list.map((point, i) => (i === index ? { ...point, value } : point)));
    resetPlan();
  };

  const handleTextChange = (index, text) =>
    setPointValue(index, { label: text, station: null, lat: null, lng: null, kind: "text" });

  const handleAddVia = (value = null) => {
    if (points.length - 2 >= MAX_VIAS) {
      toast.error(`最多可設定 ${MAX_VIAS} 個中繼點`);
      return false;
    }
    setPoints((list) => [...list.slice(0, -1), newPoint(value), list[list.length - 1]]);
    resetPlan();
    return true;
  };

  const handleRemovePoint = (index) => {
    setPoints((list) => list.filter((_, i) => i !== index));
    resetPlan();
  };

  const handleReverse = () => {
    setPoints((list) => [...list].reverse());
    resetPlan();
  };

  const locate = (onSuccess) => {
    if (!navigator.geolocation) {
      toast.error("此瀏覽器不支援定位");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        if (!isInTaiwan(point.lat, point.lng)) {
          toast.error("目前僅支援台灣地區的 YouBike");
          return;
        }
        setUserPos(point);
        onSuccess(point);
      },
      () => toast.error("無法取得你的位置，請確認瀏覽器的定位權限"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleUseMyLocation = () =>
    locate((point) => {
      setPointValue(0, { label: "我的位置", station: null, ...point, kind: "coords" });
      toast.success("已將起點設為你的位置，會自動找最近的借車站");
    });

  const handleLocateOnMap = () =>
    locate((point) => {
      setFocus({ ...point, zoom: 16 });
      if (!isDesktop()) setView("map");
    });

  const handleUseGpsChange = (on) => {
    if (!on) {
      setUseGps(false);
      return;
    }
    locate(() => {
      setUseGps(true);
      toast.success("定位已開啟，按「開始騎乘」後會自動記錄路線");
    });
  };

  const cityBounds = (city) =>
    boundsOf(stations.filter((station) => station.city === city).map((s) => [s.lat, s.lng]));

  // 「從地圖上選取」：收回設定頁、把地圖拉近到要找的地方，再點站點
  const handlePickFromMap = (index, city) => {
    setPickTarget(index);
    setSelected(null);
    setView("map");
    const current = points[index]?.value;
    const other = points.map((point) => point.value).find((value) => value?.lat);
    if (current?.lat) {
      setFocus({ lat: current.lat, lng: current.lng, zoom: 16 });
    } else if (city && cityBounds(city)) {
      setFocus({ bounds: cityBounds(city), maxZoom: 15 });
    } else if (userPos) {
      setFocus({ ...userPos, zoom: 16 });
    } else if (other) {
      setFocus({ lat: other.lat, lng: other.lng, zoom: 15 });
    }
  };

  const assignStation = (station, target) => {
    if (target === "via") {
      if (!handleAddVia(stationValue(station))) return;
      toast.success(`已加入中繼點：${station.name}`);
    } else {
      const index = target === "start" ? 0 : target === "end" ? points.length - 1 : target;
      setPointValue(index, stationValue(station));
      toast.success(`已設為「${pointLabel(index, points.length)}」：${station.name}`);
    }
    setSelected(null);
    setPickTarget(null);
    setView("setup");
  };

  const handleStationClick = (station) => {
    if (inRide) return;
    if (pickTarget != null) {
      assignStation(station, pickTarget);
      return;
    }
    setSelected(station);
  };

  const handleSelectCity = (city) => {
    setFilter("all");
    if (!city) {
      setCityFilter(null);
      setSelected(null);
      setFocus({ lat: 23.7, lng: 120.9, zoom: 8 });
      return;
    }
    const bounds = cityBounds(city);
    if (!bounds) return;
    setCityFilter(city);
    setSelected(null);
    setFocus({ bounds, maxZoom: 15 });
    if (!isDesktop()) setView("map");
  };

  const handleShowStation = (station) => {
    setSelected(station);
    setFocus({ lat: station.lat, lng: station.lng, zoom: 16 });
    if (!isDesktop()) setView("map");
  };

  const fitTrip = (nextTrip) => {
    const bounds = boundsOf(nextTrip.legs.flatMap((leg) => leg.coordinates || []));
    if (bounds) setFocus({ bounds });
  };

  const handlePlan = async () => {
    const values = points.map((point) => point.value);
    const missing = values.findIndex((value) => !value?.lat);
    if (missing >= 0) {
      toast.error(`請先設定「${pointLabel(missing, values.length)}」`);
      return;
    }
    if (values.some((value) => !isInTaiwan(value.lat, value.lng))) {
      toast.error("目前僅支援台灣地區的 YouBike 路線");
      return;
    }
    setPlanning(true);
    setPlanError(null);
    setTrip(null);
    try {
      const params = {
        points: values.map((value) => ({
          lat: value.lat,
          lng: value.lng,
          stationId: value.station?.id,
          label: (value.label || "").slice(0, 120),
        })),
      };
      // 直接在瀏覽器用已載入的站點與免費 OSRM 規劃；站點尚未載入才交給伺服器
      let result;
      if (stations.length) {
        try {
          result = { trip: await buildRoutePlan(stations, params), error: null };
        } catch (localError) {
          result = { trip: null, error: { message: localError?.message } };
        }
      } else {
        result = await planRoute({ data: params });
      }
      if (!result?.trip) {
        const message = result?.error?.message || "路線規劃失敗，請稍後再試";
        setPlanError(message);
        toast.error(message);
        return;
      }
      setTrip(result.trip);
      setSelected(null);
      setCityFilter(null);
      fitTrip(result.trip);
    } catch (planFailure) {
      const message = planFailure?.message || "路線規劃失敗，請稍後再試";
      setPlanError(message);
      toast.error(message);
    } finally {
      setPlanning(false);
    }
  };

  const handleStartRide = () => {
    if (!trip) return;
    setSelected(null);
    setPickTarget(null);
    setFollow(true);
    rideCtl.start(trip, useGps);
    if (!useGps) fitTrip(trip);
    toast.success("開始計時，騎乘愉快！");
  };

  const handleArrive = () => {
    const result = rideCtl.arrive();
    if (!result) return;
    const distance =
      result.meters != null ? formatDistance(result.meters) : `${formatDistance(result.plannedMeters)}（規劃）`;
    toast.success(
      `${result.finished ? "抵達終點" : `抵達中繼點 ${result.index + 1}`}：本段 ${formatDurationText(result.seconds)} · ${distance}`
    );
  };

  const handleStopRide = () => {
    if (rideCtl.ride?.status === "riding" && !window.confirm("確定要結束這次騎乘嗎？紀錄將不會保留。")) return;
    rideCtl.reset();
    setView(isDesktop() ? "setup" : "map");
    if (trip) fitTrip(trip);
  };

  const panelOpen = view === "setup" && !inRide;
  const firstLabel = points[0]?.value?.label;
  const lastLabel = points[points.length - 1]?.value?.label;
  const viaCount = points.length - 2;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      {/* 地圖：騎乘時只佔上半部 */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-0 transition-[bottom] duration-300",
          inRide ? "bottom-[min(46dvh,340px)]" : "bottom-0"
        )}
      >
        <ClientOnly fallback={<MapSkeleton />}>
          <Suspense fallback={<MapSkeleton />}>
            <StationMap
              stations={visibleStations}
              filter={filter}
              showStations={layersOn}
              selectedId={selected?.id}
              highlightIds={highlightIds}
              onSelect={handleStationClick}
              onSelectCity={handleSelectCity}
              focus={focus}
              route={inRide ? rideCtl.ride.trip : trip}
              userPosition={inRide ? rideCtl.position : userPos}
              track={rideCtl.track}
              follow={inRide && rideCtl.ride.gps && follow}
              onUserDrag={() => inRide && setFollow(false)}
              resizeKey={inRide ? "ride" : "full"}
            />
          </Suspense>
        </ClientOnly>
      </div>

      {loading && (
        <div className="pointer-events-none absolute left-1/2 top-20 z-[1000] -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur-xl">
          載入全台站點中…
        </div>
      )}

      {/* ===== 騎乘模式 ===== */}
      {inRide && (
        <div className="absolute inset-x-0 bottom-0 z-[1000] h-[min(46dvh,340px)] rounded-t-2xl border border-b-0 border-border bg-card shadow-[0_-20px_60px_rgba(15,23,42,0.18)]">
          <div className="mx-auto h-full max-w-xl">
            <RideView
              ride={rideCtl.ride}
              now={rideCtl.now}
              meters={rideCtl.meters}
              geoError={rideCtl.geoError}
              following={follow}
              onRecenter={() => setFollow(true)}
              onArrive={handleArrive}
              onStop={handleStopRide}
              onFinish={handleStopRide}
            />
          </div>
        </div>
      )}

      {/* ===== 地圖瀏覽模式 ===== */}
      {!inRide && (
        <>
          <div
            className={cn(
              "pointer-events-auto absolute left-4 right-4 top-4 z-[1000] flex items-center justify-between rounded-2xl border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur-xl lg:right-auto lg:w-[340px]",
              panelOpen && "lg:hidden"
            )}
          >
            <BrandMark />
            <div className="flex items-center gap-1">
              <span className="flex items-center gap-1.5 rounded-full bg-station-available/10 px-2 py-1 text-[10px] font-semibold text-station-available">
                <span className="h-1.5 w-1.5 rounded-full bg-station-available" />
                即時
              </span>
              <Button type="button" variant="ghost" size="icon" onClick={reload} disabled={refreshing} className="h-7 w-7 rounded-full" title="更新站點資料">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </Button>
            </div>
          </div>

          <div className="pointer-events-auto absolute right-4 top-[76px] z-[1000] lg:right-6 lg:top-6">
            <MapUtilities
              compact
              onLocate={handleLocateOnMap}
              onToggleLayers={() => setLayersOn((value) => !value)}
              layersOn={layersOn}
            />
          </div>

          {pickTarget != null && (
            <div className="pointer-events-auto absolute left-1/2 top-[76px] z-[1001] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 lg:top-6">
              <div className="flex items-center gap-2 rounded-2xl border-2 border-brand bg-card px-3 py-2.5 shadow-lg">
                <MousePointerClick className="h-5 w-5 shrink-0 text-brand-active" />
                <p className="min-w-0 flex-1 text-xs leading-snug">
                  點選地圖上的站點，設為「<b>{pointLabel(pickTarget, points.length)}</b>」
                  <span className="block text-[10px] text-muted-foreground">數字泡泡可點擊放大，放大後會顯示個別站點</span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPickTarget(null);
                    setView("setup");
                  }}
                  className="h-8 shrink-0 rounded-lg text-xs"
                >
                  取消
                </Button>
              </div>
            </div>
          )}

          {selected && pickTarget == null && (
            <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-[1002] lg:bottom-auto lg:left-auto lg:right-6 lg:top-32 lg:w-[340px]">
              <StationDetailCard
                station={selected}
                onClose={() => setSelected(null)}
                onSetStart={() => assignStation(selected, "start")}
                onSetVia={() => assignStation(selected, "via")}
                onSetEnd={() => assignStation(selected, "end")}
                canAddVia={points.length - 2 < MAX_VIAS}
              />
            </div>
          )}

          {view === "map" && !selected && pickTarget == null && (
            <div className="pointer-events-auto absolute inset-x-4 bottom-4 z-[1000] lg:left-6 lg:right-auto lg:w-[380px]">
              <div className="space-y-2.5 rounded-2xl border border-border bg-card/95 p-3 shadow-[0_-10px_40px_rgba(15,23,42,0.16)] backdrop-blur-xl">
                <div className="flex items-center gap-2 text-sm">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-station-available" />
                  <span className="min-w-0 flex-1 truncate">{firstLabel || "尚未設定起點"}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="h-2 w-2 shrink-0 rounded-full bg-station-empty" />
                  <span className="min-w-0 flex-1 truncate">{lastLabel || "尚未設定終點"}</span>
                </div>
                {(trip || viaCount > 0) && (
                  <p className="text-[11px] text-muted-foreground">
                    {viaCount > 0 ? `經過 ${viaCount} 個中繼點` : ""}
                    {trip ? `${viaCount > 0 ? " · " : ""}全程 ${trip.totalDistanceKm} km · 約 ${trip.totalMinutes} 分` : ""}
                  </p>
                )}
                <div className={cn("grid gap-2", trip ? "grid-cols-2" : "grid-cols-1")}>
                  <Button
                    type="button"
                    variant={trip ? "outline" : "default"}
                    onClick={() => setView("setup")}
                    className={cn("h-11 rounded-xl", !trip && "bg-brand text-foreground hover:bg-brand-active")}
                  >
                    <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                    {trip ? "調整路線" : "設定路線"}
                  </Button>
                  {trip && (
                    <Button
                      type="button"
                      onClick={handleStartRide}
                      className="h-11 rounded-xl bg-station-available font-semibold text-white hover:bg-station-available/90"
                    >
                      <Play className="mr-1.5 h-4 w-4 fill-current" />
                      開始騎乘
                    </Button>
                  )}
                </div>
                <p className="text-center text-[9px] text-muted-foreground/80">地圖 © OpenStreetMap contributors</p>
              </div>
            </div>
          )}

          {view === "map" && <Legend hasRoute={Boolean(trip)} />}
        </>
      )}

      {/* ===== 設定頁（手機全螢幕，桌機左側面板） ===== */}
      {panelOpen && (
        <div className="fixed inset-0 z-[1100] flex flex-col bg-background lg:inset-y-0 lg:left-0 lg:right-auto lg:w-[420px] lg:border-r lg:border-border lg:shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <BrandMark />
            <div className="flex items-center gap-1">
              <Button type="button" variant="ghost" size="icon" onClick={reload} disabled={refreshing} className="h-8 w-8 rounded-full" title="更新站點資料">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setView("map")} className="h-8 rounded-full px-3 text-xs">
                <ChevronLeft className="mr-0.5 h-4 w-4" />
                收回
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-10 pt-3">
            <PlannerPanel
              filter={filter}
              onFilterChange={setFilter}
              stations={stations}
              stationsLoading={loading}
              stationsError={error}
              onRefresh={reload}
              fetchedAt={fetchedAt}
              points={points}
              onTextChange={handleTextChange}
              onSelectValue={setPointValue}
              onAddVia={() => handleAddVia()}
              onRemovePoint={handleRemovePoint}
              onReverse={handleReverse}
              onUseMyLocation={handleUseMyLocation}
              onPickFromMap={handlePickFromMap}
              trip={trip}
              onPlan={handlePlan}
              planning={planning}
              planError={planError}
              stats={stats}
              cities={cities}
              selectedCity={cityFilter}
              onSelectCity={handleSelectCity}
              onShowStation={handleShowStation}
              useGps={useGps}
              onUseGpsChange={handleUseGpsChange}
              onStartRide={handleStartRide}
              onShowMap={() => setView("map")}
            />
          </div>
        </div>
      )}

      {/* 騎乘中沒有開定位時的小提示 */}
      {inRide && rideCtl.ride.status === "riding" && !rideCtl.ride.gps && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-[1000] -translate-x-1/2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-[10px] shadow-sm">
          未開啟定位：只計時，距離以規劃路線計
        </div>
      )}
    </div>
  );
}
