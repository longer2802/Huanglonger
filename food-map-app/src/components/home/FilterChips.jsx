import { ChevronDown } from "lucide-react";
import { VISIT_STATUSES } from "@/lib/places";
import { MEAL_SLOTS } from "@/lib/hours";
import { cn } from "@/lib/utils";

const CHIP =
  "flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors";

export default function FilterChips({
  filters,
  countyName,
  townName,
  onChange,
  onClear,
  onOpenFilters,
}) {
  const hasFilters = Boolean(filters.category || filters.county || filters.town || filters.visit || filters.meal);

  return (
    <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
      {MEAL_SLOTS.map((slot) => {
        const active = filters.meal === slot.key;
        return (
          <button
            key={slot.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange({ meal: active ? "" : slot.key })}
            className={cn(
              CHIP,
              active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/95 text-foreground",
            )}
          >
            <span>{slot.label}</span>
          </button>
        );
      })}

      <span className="h-6 w-px shrink-0 self-center bg-border" />

      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          CHIP,
          filters.category
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card/95 text-foreground",
        )}
      >
        <span>{filters.category || "分類"}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          CHIP,
          filters.county
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card/95 text-foreground",
        )}
      >
        <span>{countyName || "縣市"}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      <button
        type="button"
        onClick={onOpenFilters}
        className={cn(
          CHIP,
          filters.town
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card/95 text-foreground",
        )}
      >
        <span>{townName || "鄉鎮市區"}</span>
        <ChevronDown className="h-3.5 w-3.5 opacity-70" />
      </button>

      <span className="h-6 w-px shrink-0 self-center bg-border" />

      {VISIT_STATUSES.map((status) => {
        const active = filters.visit === status.value;
        return (
          <button
            key={status.value}
            type="button"
            onClick={() => onChange({ visit: active ? "" : status.value })}
            className={cn(
              CHIP,
              active
                ? "border-[color:var(--map-pin)] bg-[color:var(--map-pin)] text-white"
                : "border-border bg-card/95 text-foreground",
            )}
          >
            <span>{status.label}</span>
          </button>
        );
      })}

      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="h-9 shrink-0 rounded-full px-2 text-[13px] font-medium text-muted-foreground underline underline-offset-4"
        >
          清除
        </button>
      ) : null}
    </div>
  );
}
