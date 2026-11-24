import { Label } from "@/components/ui/label";
import NativeSelect from "@/components/ui/native-select";
import { VISIT_STATUSES } from "@/lib/places";
import { MEAL_SLOTS } from "@/lib/hours";
import { useCategories } from "@/hooks/useCategories";
import { cn } from "@/lib/utils";

export default function FilterControls({ filters, onChange, atlas }) {
  const categories = useCategories();
  const counties = atlas?.counties ?? [];
  const towns = filters.county && atlas ? atlas.townsOf(filters.county) : [];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">分類</Label>
        <NativeSelect
          aria-label="分類"
          value={filters.category}
          onChange={(event) => onChange({ category: event.target.value })}
          className="h-11 rounded-xl bg-card"
        >
          <option value="">全部分類</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">縣市</Label>
          <NativeSelect
            aria-label="縣市"
            value={filters.county}
            onChange={(event) => onChange({ county: event.target.value, town: "" })}
            className="h-11 rounded-xl bg-card"
          >
            <option value="">全臺</option>
            {counties.map((county) => (
              <option key={county.code} value={county.code}>
                {county.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">鄉鎮市區</Label>
          <NativeSelect
            aria-label="鄉鎮市區"
            value={filters.town}
            onChange={(event) => onChange({ town: event.target.value })}
            disabled={!filters.county}
            className="h-11 rounded-xl bg-card disabled:opacity-60"
          >
            <option value="">{filters.county ? "全部鄉鎮" : "先選縣市"}</option>
            {towns.map((town) => (
              <option key={town.code} value={town.code}>
                {town.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">用餐時段</Label>
        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ meal: "" })}
            className={cn(
              "h-12 rounded-xl border text-sm font-medium transition-colors",
              filters.meal === "" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
            )}
          >
            不限
          </button>
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot.key}
              type="button"
              aria-pressed={filters.meal === slot.key}
              onClick={() => onChange({ meal: slot.key })}
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-xl border text-sm font-medium leading-tight transition-colors",
                filters.meal === slot.key ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground",
              )}
            >
              {slot.label}
              <span className="text-[10px] font-normal opacity-75">{slot.range}</span>
            </button>
          ))}
        </div>
        {filters.meal ? (
          <div className="flex gap-2">
            {[
              ["today", "今天有營業"],
              ["any", "不限星期"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ day: value })}
                className={cn(
                  "h-9 flex-1 rounded-xl border text-[13px] font-medium transition-colors",
                  filters.day === value ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          依你填的營業時間篩選；沒填營業時間的店，可在店家卡片的「營業時間」勾選適合的時段。
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">想吃／已吃</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ visit: "" })}
            className={cn(
              "h-10 flex-1 rounded-xl border text-sm font-medium transition-colors",
              filters.visit === ""
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground",
            )}
          >
            全部
          </button>
          {VISIT_STATUSES.map((status) => (
            <button
              key={status.value}
              type="button"
              onClick={() => onChange({ visit: status.value })}
              className={cn(
                "h-10 flex-1 rounded-xl border text-sm font-medium transition-colors",
                filters.visit === status.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
