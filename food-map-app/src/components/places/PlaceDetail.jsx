import { ExternalLink, Loader2, MapPin, Navigation, Pencil, Trash2, Crosshair } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import CoverPhoto from "@/components/places/CoverPhoto";
import HoursSection from "@/components/places/HoursSection";
import { VISIT_STATUSES, isHttpsUrl, placeRegion } from "@/lib/places";
import { cn } from "@/lib/utils";

const ACTION =
  "flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground transition active:scale-[0.98]";

export default function PlaceDetail({
  place,
  photoUrl,
  onEdit,
  onDelete,
  onToggleVisit,
  onRelocate,
  onPlanRoute,
  busy = false,
}) {
  const hasCoords = typeof place.lat === "number" && typeof place.lng === "number";
  const sourceOk = isHttpsUrl(place.source_url);

  return (
    <div className="space-y-3">
      <CoverPhoto url={photoUrl} category={place.category} className="h-32 w-full" />

      <div>
        <h2 className="font-display text-xl font-bold leading-tight text-foreground">
          {place.name}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {[place.category, placeRegion(place)].filter(Boolean).join(" · ") || "尚未填寫地區"}
        </p>
      </div>

      {place.location_status === "pending" ? (
        <p className="rounded-xl bg-secondary px-3 py-2 text-xs leading-relaxed text-foreground">
          這家店還沒有落點，補上位置後就會出現在地圖上。
        </p>
      ) : null}

      <div className="flex gap-1 rounded-full bg-secondary p-1">
        {VISIT_STATUSES.map((status) => (
          <button
            key={status.value}
            type="button"
            disabled={busy}
            onClick={() => onToggleVisit(status.value)}
            className={cn(
              "flex-1 rounded-full py-2 text-[13px] font-semibold transition-colors disabled:opacity-60",
              place.visit_status === status.value
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {status.label}
          </button>
        ))}
      </div>

      <HoursSection key={place.id} place={place} />

      <dl className="space-y-2 rounded-2xl border border-border bg-card p-3 text-sm">
        <div className="flex gap-2">
          <dt className="w-14 shrink-0 text-xs text-muted-foreground">地址</dt>
          <dd className="min-w-0 flex-1 break-words text-foreground">
            {place.address || "尚未填寫"}
          </dd>
        </div>
        {place.phone ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-xs text-muted-foreground">電話</dt>
            <dd className="min-w-0 flex-1 break-words text-foreground">
              <a
                href={`tel:${place.phone}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                {place.phone}
              </a>
            </dd>
          </div>
        ) : null}
        {place.note ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-xs text-muted-foreground">備註</dt>
            <dd className="min-w-0 flex-1 whitespace-pre-wrap break-words text-foreground">
              {place.note}
            </dd>
          </div>
        ) : null}
        {place.source_platform ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 text-xs text-muted-foreground">來源</dt>
            <dd className="min-w-0 flex-1 text-foreground">{place.source_platform}</dd>
          </div>
        ) : null}
      </dl>

      {(place.tags ?? []).length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {place.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {sourceOk ? (
          <a href={place.source_url} target="_blank" rel="noopener noreferrer" className={ACTION}>
            <ExternalLink className="h-4 w-4" />
            查看來源
          </a>
        ) : null}

        <button type="button" onClick={onPlanRoute} className={ACTION}>
          <Navigation className="h-4 w-4" />
          規劃路線
        </button>

        <button type="button" onClick={onEdit} className={ACTION}>
          <Pencil className="h-4 w-4" />
          編輯
        </button>

        <button type="button" onClick={onRelocate} className={ACTION}>
          <Crosshair className="h-4 w-4" />
          重新定位
        </button>
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/5 text-sm font-medium text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            刪除這筆收藏
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <span>{`刪除「${place.name}」？`}</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              這筆收藏與備註會一併刪除，之後無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
              確認刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {hasCoords ? (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3" />
          {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
        </p>
      ) : null}
    </div>
  );
}
