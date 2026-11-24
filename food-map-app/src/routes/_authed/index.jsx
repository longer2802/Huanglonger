import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { ClientOnly, Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Info, Loader2, MapPin, Plus, SearchX, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";
import { deletePlace, updatePlace } from "@/lib/localPlaces";
import SearchBar from "@/components/home/SearchBar";
import FilterChips from "@/components/home/FilterChips";
import FilterControls from "@/components/home/FilterControls";
import FilterSheet from "@/components/home/FilterSheet";
import ViewTabs from "@/components/home/ViewTabs";
import EmptyState from "@/components/home/EmptyState";
import PlaceList from "@/components/home/PlaceList";
import PendingList from "@/components/home/PendingList";
import AddGuide from "@/components/home/AddGuide";
import MapSkeleton from "@/components/map/MapSkeleton";
import TileErrorNotice from "@/components/map/TileErrorNotice";
import PlaceSheet from "@/components/places/PlaceSheet";
import AddPlaceMenu from "@/components/places/AddPlaceMenu";
import { useAtlas } from "@/hooks/useAtlas";
import { useMyLocation } from "@/hooks/useMyLocation";
import { useFoodPlaces } from "@/hooks/useFoodPlaces";
import useCloseThenAct from "@/hooks/useCloseThenAct";
import { useCoverPhotos } from "@/hooks/useCoverPhotos";
import DeviceOnlyNotice from "@/components/settings/DeviceOnlyNotice";
import { deleteCover } from "@/lib/photoStore";
import { distanceMeters } from "@/lib/distance";
import { matchesQuery } from "@/lib/text";
import { matchesMeal, mealSlot, taipeiNow } from "@/lib/hours";

const FoodMap = lazy(() => import("@/components/map/FoodMap"));
const LocationPicker = lazy(() => import("@/components/places/LocationPicker"));
const RoutePlanner = lazy(() => import("@/components/places/RoutePlanner"));

export const Route = createFileRoute("/_authed/")({
  ssr: false,
  validateSearch: (search) => ({
    place: typeof search.place === "string" ? search.place : undefined,
  }),
  head: () => ({
    meta: [
      { title: "吃遍台灣美食地圖" },
      { name: "description", content: "把想吃與吃過的台灣美食收藏在地圖上，依縣市鄉鎮與分類快速找到。" },
    ],
  }),
  component: HomePage,
});

const EMPTY_FILTERS = { category: "", county: "", town: "", visit: "", meal: "", day: "today" };

function HomePage() {
  const { place: selectedId } = Route.useSearch();
  const navigate = useNavigate();
  const closeThenAct = useCloseThenAct();

  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState("map");
  const [sort, setSort] = useState("recent");
  const [filterOpen, setFilterOpen] = useState(false);
  const [tileError, setTileError] = useState(false);
  const [pickerPlace, setPickerPlace] = useState(null);
  const [routePlace, setRoutePlace] = useState(null);
  const [busy, setBusy] = useState(false);
  const [distanceWanted, setDistanceWanted] = useState(false);

  const { atlas } = useAtlas();
  const { me, locating, error: locationError, request: requestLocation } = useMyLocation();
  const { places, loading, error, refresh } = useFoodPlaces();
  const { urls: photoUrls, reload: reloadPhotos } = useCoverPhotos(places);

  useEffect(() => {
    if (locationError) {
      toast.error(locationError);
      setDistanceWanted(false);
    }
  }, [locationError]);

  // "我的位置" in the list: once the fix arrives, sort by distance.
  useEffect(() => {
    if (me && distanceWanted) {
      setSort("distance");
      setDistanceWanted(false);
    }
  }, [me, distanceWanted]);

  const locateForDistance = useCallback(() => {
    setDistanceWanted(true);
    requestLocation();
  }, [requestLocation]);

  const selected = useMemo(
    () => places.find((item) => item.id === selectedId) ?? null,
    [places, selectedId],
  );

  const setSelected = useCallback(
    (id) => {
      navigate({ to: "/", search: id ? { place: id } : {}, replace: true });
    },
    [navigate],
  );

  const updateFilters = useCallback((patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);

  const filtered = useMemo(() => {
    const now = taipeiNow();
    return places.filter((place) => {
      if (filters.category && place.category !== filters.category) return false;
      if (filters.county && place.county_code !== filters.county) return false;
      if (filters.town && place.town_code !== filters.town) return false;
      if (filters.visit && place.visit_status !== filters.visit) return false;
      if (filters.meal && !matchesMeal(place, filters.meal, filters.day, now)) return false;
      return matchesQuery(place, query);
    });
  }, [places, filters, query]);

  const sorted = useMemo(() => {
    if (sort !== "distance" || !me) return filtered;
    return [...filtered].sort((a, b) => {
      const da =
        typeof a.lat === "number" && typeof a.lng === "number"
          ? distanceMeters(me, { lat: a.lat, lng: a.lng })
          : Number.POSITIVE_INFINITY;
      const db =
        typeof b.lat === "number" && typeof b.lng === "number"
          ? distanceMeters(me, { lat: b.lat, lng: b.lng })
          : Number.POSITIVE_INFINITY;
      return da - db;
    });
  }, [filtered, sort, me]);

  const pending = useMemo(
    () =>
      places
        .filter((place) => place.location_status === "pending")
        .filter((place) => matchesQuery(place, query)),
    [places, query],
  );

  const confirmed = useMemo(
    () =>
      filtered.filter(
        (place) =>
          place.location_status === "confirmed" &&
          typeof place.lat === "number" &&
          typeof place.lng === "number",
      ),
    [filtered],
  );

  const filterCount = [filters.category, filters.county, filters.town, filters.visit, filters.meal].filter(
    Boolean,
  ).length;
  const mealLabel = filters.meal ? mealSlot(filters.meal)?.label : "";
  const countyName = filters.county ? atlas?.countyByCode.get(filters.county)?.name : "";
  const townName = filters.town ? atlas?.townByCode.get(filters.town)?.name : "";
  const hasQuery = Boolean(query.trim());
  const narrowed = hasQuery || filterCount > 0;

  const handleTileError = useCallback(() => setTileError(true), []);

  const handleToggleVisit = async (next) => {
    if (!selected || next === selected.visit_status) return;
    setBusy(true);
    try {
      await updatePlace(selected.id, { visit_status: next });
      await refresh();
    } catch {
      toast.error("更新狀態失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const deletedId = selected.id;
    setBusy(true);
    try {
      await deletePlace(deletedId);
      setSelected(null);
      await refresh();
      await deleteCover(deletedId).catch(() => {});
      reloadPhotos();
      toast.success("已刪除這筆收藏");
    } catch {
      toast.error("刪除失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  };

  const handleSetCoords = useCallback(
    async (targetPlace, result) => {
      const patch = { lat: result.lat, lng: result.lng, location_status: "confirmed" };
      if (result.county_code) {
        patch.county_code = result.county_code;
        patch.county_name = result.county_name;
        patch.town_code = result.town_code;
        patch.town_name = result.town_name;
      }
      await updatePlace(targetPlace.id, patch);
      await refresh();
    },
    [refresh],
  );

  const handleRelocateConfirm = async (result) => {
    if (!pickerPlace) return;
    try {
      await handleSetCoords(pickerPlace, result);
      setPickerPlace(null);
      toast.success("已更新落點");
    } catch {
      toast.error("更新落點失敗，請再試一次");
    }
  };

  // The card lives in a portal: close it, then leave on the next commit.
  const handleEditPlace = useCallback(() => {
    if (!selected) return;
    const id = selected.id;
    closeThenAct(
      () => setSelected(null),
      () => navigate({ to: "/place/$placeId/edit", params: { placeId: id } }),
    );
  }, [selected, closeThenAct, navigate, setSelected]);

  const handlePlanRoute = useCallback(() => {
    if (!selected) return;
    const target = selected;
    closeThenAct(() => setSelected(null), () => setRoutePlace(target));
  }, [selected, closeThenAct, setSelected]);

  const handleRelocatePlace = useCallback(() => {
    if (!selected) return;
    const target = selected;
    closeThenAct(() => setSelected(null), () => setPickerPlace(target));
  }, [selected, closeThenAct, setSelected]);

  const emptyList = (
    <EmptyState
      icon={narrowed ? SearchX : MapPin}
      title={narrowed ? "找不到符合的店家" : "還沒有收藏的店家"}
      description={
        narrowed
          ? mealLabel
            ? `沒有${filters.day === "today" ? "今天" : ""}${mealLabel}時段營業的店。到店家卡片的「營業時間」填上時間，或勾選適合的時段。`
            : "換個關鍵字，或清除篩選再試一次。"
          : "把想吃、吃過的店都放進來，從第一個開始。"
      }
      action={
        narrowed ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              clearFilters();
            }}
            className="h-10 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground"
          >
            清除搜尋與篩選
          </button>
        ) : (
          <Link
            to="/place/quick"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
            新增第一家
          </Link>
        )
      }
    />
  );

  const pendingEmpty = (
    <EmptyState
      icon={MapPin}
      title="沒有待定位的店家"
      description="每一筆收藏都有落點了。新增時若先跳過定位，會出現在這裡。"
    />
  );

  const listBlock = (
    <PlaceList
      places={sorted}
      loading={loading}
      error={error}
      me={me}
      sort={sort}
      onSortChange={setSort}
      onLocateForDistance={locateForDistance}
      locating={locating}
      onSelect={(place) => setSelected(place.id)}
      photoUrls={photoUrls}
      emptyNode={emptyList}
    />
  );

  const pendingBlock = (
    <PendingList
      places={pending}
      loading={loading}
      error={error}
      onSelect={(place) => setSelected(place.id)}
      onRelocate={(place) => setPickerPlace(place)}
      emptyNode={pendingEmpty}
    />
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background">
      <aside className="hidden w-[380px] shrink-0 flex-col border-r border-border bg-background md:flex">
        <div className="flex items-start justify-between gap-2 px-5 pb-3 pt-5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              我的美食收藏
            </p>
            <h1 className="font-display text-xl font-bold text-primary">吃遍台灣美食地圖</h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              to="/settings"
              aria-label="設定"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground"
            >
              <SettingsIcon className="h-4 w-4" />
            </Link>
            <Link
              to="/about"
              aria-label="關於"
              className="grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-foreground"
            >
              <Info className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="space-y-3 px-5">
          <SearchBar value={query} onChange={setQuery} />
          <FilterControls filters={filters} onChange={updateFilters} atlas={atlas} />
          <ViewTabs view={view} onChange={setView} pendingCount={pending.length} showMap={false} />
          <AddPlaceMenu variant="rail" />
        </div>

        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <AddGuide variant="rail" className="mb-3" />
          <DeviceOnlyNotice variant="compact" className="mb-3" />
          {view === "pending" ? pendingBlock : listBlock}
        </div>
      </aside>

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <ClientOnly fallback={<MapSkeleton />}>
            <Suspense fallback={<MapSkeleton />}>
              <FoodMap
                places={confirmed}
                photoUrls={photoUrls}
                me={me}
                locating={locating}
                onLocate={requestLocation}
                onSelectPlace={setSelected}
                onTileError={handleTileError}
              />
            </Suspense>
          </ClientOnly>
        </div>

        {tileError ? <TileErrorNotice onDismiss={() => setTileError(false)} /> : null}

        <div className="absolute inset-x-0 top-0 z-30 px-3 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] md:hidden">
          <SearchBar
            value={query}
            onChange={setQuery}
            onOpenFilters={() => setFilterOpen(true)}
            filterCount={filterCount}
            showAbout
            showSettings
          />
          <div className="mt-2">
            <FilterChips
              filters={filters}
              countyName={countyName}
              townName={townName}
              onChange={updateFilters}
              onClear={clearFilters}
              onOpenFilters={() => setFilterOpen(true)}
            />
          </div>
        </div>

        {loading ? (
          <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top,0px)+8.75rem)] z-20 -translate-x-1/2 rounded-full bg-card/95 px-3 py-1.5 text-xs text-muted-foreground shadow-md backdrop-blur md:top-3">
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              載入收藏…
            </span>
          </div>
        ) : null}

        {!loading && places.length === 0 && view === "map" ? (
          <div className="absolute inset-x-4 top-1/2 z-20 -translate-y-1/2 md:hidden">{emptyList}</div>
        ) : null}

        {view !== "map" ? (
          <div className="absolute inset-0 z-20 overflow-y-auto bg-background px-3 pb-[calc(env(safe-area-inset-bottom,0px)+6rem)] pt-[calc(env(safe-area-inset-top,0px)+8.75rem)] md:hidden">
            <DeviceOnlyNotice variant="compact" className="mb-3" />
            {view === "pending" ? pendingBlock : listBlock}
          </div>
        ) : null}

        <AddGuide
          variant="floating"
          className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+4.75rem)] z-30 md:hidden"
        />

        <div className="absolute inset-x-0 bottom-0 z-30 md:hidden">
          <div className="mx-3 mb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] flex items-center gap-2 rounded-2xl border border-border bg-card/95 p-1.5 shadow-[0_10px_30px_rgba(38,50,40,0.18)] backdrop-blur">
            <ViewTabs view={view} onChange={setView} pendingCount={pending.length} />
            <AddPlaceMenu variant="toolbar" />
          </div>
        </div>
      </div>

      <FilterSheet
        open={filterOpen}
        onOpenChange={setFilterOpen}
        filters={filters}
        onChange={updateFilters}
        onClear={clearFilters}
        atlas={atlas}
      />

      <PlaceSheet
        place={selected}
        photoUrl={selected ? photoUrls[selected.id] : null}
        busy={busy}
        onClose={() => setSelected(null)}
        onEdit={handleEditPlace}
        onDelete={handleDelete}
        onToggleVisit={handleToggleVisit}
        onRelocate={handleRelocatePlace}
        onPlanRoute={handlePlanRoute}
      />

      {routePlace ? (
        <Suspense fallback={null}>
          <RoutePlanner
            place={routePlace}
            places={places}
            atlas={atlas}
            onClose={() => {
              const id = routePlace.id;
              setRoutePlace(null);
              if (id) setSelected(id);
            }}
            onSetCoords={(result) => handleSetCoords(routePlace, result)}
          />
        </Suspense>
      ) : null}

      {pickerPlace ? (
        <Suspense fallback={null}>
          <LocationPicker
            initial={
              typeof pickerPlace.lat === "number" && typeof pickerPlace.lng === "number"
                ? { lat: pickerPlace.lat, lng: pickerPlace.lng }
                : null
            }
            atlas={atlas}
            onCancel={() => setPickerPlace(null)}
            onConfirm={handleRelocateConfirm}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
