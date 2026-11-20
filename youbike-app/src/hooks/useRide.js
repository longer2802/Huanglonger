import { useCallback, useEffect, useRef, useState } from "react";
import { haversineMeters } from "@/lib/youbike";

// 騎乘模式：計時、（選用）瀏覽器免費定位追蹤、各段距離與時間統計。
// 定位使用瀏覽器內建 Geolocation API，不需金鑰也不收費。
const MAX_ACCURACY_METERS = 50; // 精度太差的定位點不計入距離
const MIN_STEP_METERS = 5; // 小於此距離視為原地飄移
const MAX_SPEED_MPS = 16; // 約 58 km/h，超過視為定位跳點

export default function useRide() {
  const [ride, setRide] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [position, setPosition] = useState(null);
  const [track, setTrack] = useState([]);
  const [meters, setMeters] = useState(0);
  const [geoError, setGeoError] = useState(null);

  const watchRef = useRef(null);
  const lastRef = useRef(null);
  const metersRef = useRef(0);
  const wakeRef = useRef(null);

  const releaseResources = useCallback(() => {
    if (watchRef.current != null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    if (wakeRef.current) {
      wakeRef.current.release?.().catch(() => {});
      wakeRef.current = null;
    }
  }, []);

  useEffect(() => releaseResources, [releaseResources]);

  useEffect(() => {
    if (ride?.status !== "riding") return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ride?.status]);

  // 切回前景時重新要求螢幕常亮（瀏覽器在背景會自動釋放）
  useEffect(() => {
    if (ride?.status !== "riding") return undefined;
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && !wakeRef.current && navigator.wakeLock) {
        navigator.wakeLock.request("screen").then((lock) => (wakeRef.current = lock)).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [ride?.status]);

  const handlePosition = useCallback((pos) => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    const time = pos.timestamp || Date.now();
    setPosition({ lat, lng, accuracy });
    setGeoError(null);
    if (accuracy > MAX_ACCURACY_METERS) return;

    const last = lastRef.current;
    if (!last) {
      lastRef.current = { lat, lng, time };
      setTrack([[lat, lng]]);
      return;
    }
    const step = haversineMeters(last, { lat, lng });
    if (step < MIN_STEP_METERS) return;
    const seconds = Math.max(1, (time - last.time) / 1000);
    lastRef.current = { lat, lng, time };
    if (step / seconds > MAX_SPEED_MPS) return;
    metersRef.current += step;
    setMeters(metersRef.current);
    setTrack((list) => [...list, [lat, lng]]);
  }, []);

  const handleGeoError = useCallback((error) => {
    setGeoError(
      error?.code === 1
        ? "定位權限被拒絕，本次只計時；距離改以規劃路線計算。"
        : "暫時收不到定位訊號，恢復後會自動繼續記錄。"
    );
  }, []);

  const start = useCallback(
    (trip, useGps) => {
      releaseResources();
      const startedAt = Date.now();
      metersRef.current = 0;
      lastRef.current = null;
      setMeters(0);
      setTrack([]);
      setPosition(null);
      setGeoError(null);
      setNow(startedAt);
      setRide({
        status: "riding",
        trip,
        gps: Boolean(useGps),
        startedAt,
        segIndex: 0,
        segStartAt: startedAt,
        segStartMeters: 0,
        results: [],
      });

      if (typeof navigator !== "undefined" && navigator.wakeLock) {
        navigator.wakeLock.request("screen").then((lock) => (wakeRef.current = lock)).catch(() => {});
      }
      if (useGps && typeof navigator !== "undefined" && navigator.geolocation) {
        watchRef.current = navigator.geolocation.watchPosition(handlePosition, handleGeoError, {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 20000,
        });
      }
    },
    [handleGeoError, handlePosition, releaseResources]
  );

  // 按下「抵達」：結算這一段，回傳該段結果
  const arrive = useCallback(() => {
    if (!ride || ride.status !== "riding") return null;
    const arrivedAt = Date.now();
    const { stops, legs } = ride.trip;
    const bikeLegs = legs.filter((leg) => leg.mode === "bike");
    const target = stops[ride.segIndex + 1];
    const gpsMeters = ride.gps && lastRef.current ? metersRef.current - ride.segStartMeters : null;
    const result = {
      index: ride.segIndex,
      from: stops[ride.segIndex].name,
      to: target.name,
      role: target.role,
      seconds: Math.round((arrivedAt - ride.segStartAt) / 1000),
      meters: gpsMeters,
      plannedMeters: bikeLegs[ride.segIndex]?.distanceMeters ?? null,
    };
    const finished = ride.segIndex + 1 >= stops.length - 1;
    if (finished) releaseResources();
    setNow(arrivedAt);
    setRide({
      ...ride,
      results: [...ride.results, result],
      segIndex: ride.segIndex + 1,
      segStartAt: arrivedAt,
      segStartMeters: metersRef.current,
      status: finished ? "done" : "riding",
      endedAt: finished ? arrivedAt : undefined,
    });
    return { ...result, finished };
  }, [ride, releaseResources]);

  const reset = useCallback(() => {
    releaseResources();
    setRide(null);
    setTrack([]);
    setPosition(null);
    setMeters(0);
    setGeoError(null);
  }, [releaseResources]);

  return { ride, now, position, track, meters, geoError, start, arrive, reset };
}
