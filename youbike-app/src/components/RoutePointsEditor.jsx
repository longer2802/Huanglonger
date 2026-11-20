import { ArrowUpDown, ChevronDown, LocateFixed, Map as MapIcon, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_VIAS, pointLabel } from "@/lib/youbike";
import { cn } from "@/lib/utils";

function PointDot({ index, total }) {
  if (index === 0) {
    return <span className="h-3 w-3 shrink-0 rounded-full bg-station-available ring-4 ring-station-available/15" />;
  }
  if (index === total - 1) {
    return <span className="h-3 w-3 shrink-0 rounded-full bg-station-empty ring-4 ring-station-empty/15" />;
  }
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-foreground">
      {index}
    </span>
  );
}

export default function RoutePointsEditor({
  points,
  activeIndex,
  onFocus,
  onTextChange,
  onToggleList,
  onPickFromMap,
  onRemove,
  onAddVia,
  onReverse,
  onUseMyLocation,
}) {
  const total = points.length;
  const viaCount = total - 2;

  return (
    <div className="space-y-2">
      <div className="rounded-2xl border border-border bg-card p-2">
        {points.map((point, index) => {
          const label = pointLabel(index, total);
          const isVia = index > 0 && index < total - 1;
          return (
            <div
              key={point.id}
              className={cn(
                "flex items-center gap-2 rounded-xl px-1.5 py-1",
                activeIndex === index && "bg-secondary/60"
              )}
            >
              <span className="flex w-5 justify-center">
                <PointDot index={index} total={total} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium leading-none text-muted-foreground">{label}</p>
                <Input
                  value={point.value?.label ?? ""}
                  onChange={(event) => onTextChange(index, event.target.value)}
                  onFocus={() => onFocus(index)}
                  placeholder={`搜尋${label}站名或地址`}
                  autoComplete="off"
                  className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                />
              </div>
              <button
                type="button"
                onClick={() => onToggleList(index)}
                title="從清單選擇站點"
                className="flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-border bg-secondary/60 px-2 text-[11px] font-medium hover:bg-secondary"
              >
                選站
                <ChevronDown
                  className={cn("h-3.5 w-3.5 transition-transform", activeIndex === index && "rotate-180")}
                />
              </button>
              <button
                type="button"
                onClick={() => onPickFromMap(index)}
                title="從地圖上選取站點"
                className="flex h-7 shrink-0 items-center gap-0.5 rounded-full border border-border bg-secondary/60 px-2 text-[11px] font-medium hover:bg-secondary"
              >
                <MapIcon className="h-3.5 w-3.5" />
                地圖
              </button>
              {isVia && (
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  title="移除中繼點"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddVia}
          disabled={viaCount >= MAX_VIAS}
          className="h-7 rounded-full px-2.5 text-[11px]"
        >
          <Plus className="mr-1 h-3 w-3" />
          新增中繼站{viaCount >= MAX_VIAS ? `（最多 ${MAX_VIAS} 個）` : ""}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onReverse} className="h-7 rounded-full px-2.5 text-[11px]">
          <ArrowUpDown className="mr-1 h-3 w-3" />
          反轉順序
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={onUseMyLocation} className="h-7 rounded-full px-2.5 text-[11px]">
          <LocateFixed className="mr-1 h-3 w-3" />
          起點用我的位置
        </Button>
      </div>
    </div>
  );
}
