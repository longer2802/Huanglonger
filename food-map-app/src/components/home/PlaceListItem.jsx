import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import CoverPhoto from "@/components/places/CoverPhoto";
import { StatusPill } from "@/components/places/HoursSection";
import { formatDistance } from "@/lib/distance";
import { placeRegion, visitStatusLabel } from "@/lib/places";
import { cn } from "@/lib/utils";

const ACTION_WIDTH = 88;

// Swipe left to reveal 刪除. Vertical drags still scroll the list; a tap on an
// open row closes it instead of opening the place.
export default function PlaceListItem({ place, photoUrl, distance, onSelect, open = false, onOpenChange, onRequestDelete }) {
  const visited = place.visit_status === "visited";
  const drag = useRef(null);
  const moved = useRef(false);
  const [dragX, setDragX] = useState(null);

  const offset = dragX ?? (open ? -ACTION_WIDTH : 0);

  const onPointerDown = (event) => {
    if (!onRequestDelete) return;
    drag.current = { x: event.clientX, y: event.clientY, base: open ? -ACTION_WIDTH : 0, mode: null, id: event.pointerId };
    moved.current = false;
  };

  const onPointerMove = (event) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x;
    const dy = event.clientY - d.y;
    if (!d.mode) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        d.mode = "x";
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } else if (Math.abs(dy) > 8) {
        d.mode = "y";
      }
    }
    if (d.mode === "x") {
      moved.current = true;
      setDragX(Math.max(-ACTION_WIDTH - 24, Math.min(0, d.base + dx)));
    }
  };

  const finish = () => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.mode !== "x") return;
    const x = dragX ?? d.base;
    setDragX(null);
    onOpenChange?.(x < -ACTION_WIDTH / 2);
  };

  const handleClick = () => {
    if (moved.current) {
      moved.current = false;
      return;
    }
    if (open) {
      onOpenChange?.(false);
      return;
    }
    onSelect(place);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {onRequestDelete ? (
        <button
          type="button"
          onClick={() => onRequestDelete(place)}
          aria-label={`刪除 ${place.name}`}
          tabIndex={open ? 0 : -1}
          className="absolute inset-y-0 right-0 flex w-[88px] flex-col items-center justify-center gap-1 rounded-r-2xl bg-[color:var(--map-pin)] text-sm font-semibold text-white"
        >
          <Trash2 className="h-5 w-5" />
          刪除
        </button>
      ) : null}

      <button
        type="button"
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragX == null ? "transform 180ms ease-out" : "none",
          touchAction: "pan-y",
        }}
        className="relative flex w-full items-stretch gap-3 rounded-2xl border border-border bg-card p-2.5 text-left shadow-sm"
      >
        <CoverPhoto
          url={photoUrl}
          category={place.category}
          className="h-[68px] w-[68px] shrink-0"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-display text-[15px] font-bold leading-snug text-foreground">
              {place.name}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                visited ? "bg-primary/10 text-primary" : "bg-[#FBE6E2] text-[color:var(--map-pin)]",
              )}
            >
              {visitStatusLabel(place.visit_status)}
            </span>
          </div>

          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[place.category, placeRegion(place)].filter(Boolean).join(" · ") || "尚未填寫地區"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {place.address || "尚未填寫地址"}
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {distance != null ? (
              <span className="font-semibold text-primary">{formatDistance(distance)}</span>
            ) : null}
            <StatusPill hours={place.hours} />
            {place.location_status === "pending" ? (
              <span className="rounded-full bg-secondary px-1.5 py-0.5 text-foreground">待定位</span>
            ) : null}
            {(place.tags ?? []).slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full bg-secondary px-1.5 py-0.5">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}
