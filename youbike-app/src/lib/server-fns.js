import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { STATION_FIELDS } from "@/lib/youbike";
import { buildRoutePlan, fetchStations, geocodeQuery } from "@/lib/youbike.server";

export const getYouBikeStations = createServerFn({ method: "GET" }).handler(async () => {
  const { stations, fetchedAt } = await fetchStations();
  return {
    stationsJson: JSON.stringify(
      stations.map((station) => STATION_FIELDS.map((field) => station[field]))
    ),
    fetchedAt,
  };
});

export const geocodeAddress = createServerFn({ method: "POST" })
  .validator(z.object({ query: z.string().trim().min(2).max(120) }))
  .handler(async ({ data }) => {
    try {
      const results = await geocodeQuery(data.query);
      return { results, error: null };
    } catch (error) {
      return {
        results: [],
        error: error?.message || "地址搜尋暫時無法使用，請稍後再試。",
      };
    }
  });

const routePointSchema = z.object({
  lat: z.number().min(21.5).max(26.5),
  lng: z.number().min(118).max(123),
  stationId: z.string().max(30).optional(),
  label: z.string().max(120).optional(),
});

export const planYouBikeRoute = createServerFn({ method: "POST" })
  .validator(z.object({ points: z.array(routePointSchema).min(2).max(6) }))
  .handler(async ({ data }) => {
    try {
      const trip = await buildRoutePlan(data);
      return { trip, error: null };
    } catch (error) {
      return {
        trip: null,
        error: {
          code: error?.code || "ROUTE_FAILED",
          message: error?.message || "路線規劃失敗，請稍後再試。",
        },
      };
    }
  });
