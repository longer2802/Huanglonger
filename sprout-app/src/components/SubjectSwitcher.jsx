import { Baby, HeartHandshake } from "lucide-react";
import { updateSettings, useSprout } from "@/lib/store";
import { personName } from "./CarePrompt";
import { cn } from "@/lib/utils";

export function useActivePerson() {
  const { people, settings } = useSprout();
  return people.find((p) => p.id === settings.activeSubject) ?? people[0] ?? null;
}

// Chips to pick whose page this is: 媽媽 or one of the babies.
export default function SubjectSwitcher({ allowAll = false, value, onChange }) {
  const { people, settings } = useSprout();
  const current = value ?? settings.activeSubject;
  const pick = (id) => (onChange ? onChange(id) : updateSettings({ activeSubject: id }));
  if (people.length < 2 && !allowAll) return null;
  return (
    <div className="-mx-4 mb-3 overflow-x-auto px-4" role="tablist" aria-label="選擇家人">
      <div className="flex w-max gap-2">
        {allowAll ? (
          <button type="button" role="tab" aria-selected={current === "all"} onClick={() => pick("all")} className={cn("min-h-[44px] rounded-full border px-4 text-[15px] font-semibold", current === "all" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
            全家
          </button>
        ) : null}
        {people.map((p) => {
          const Icon = p.role === "mother" ? HeartHandshake : Baby;
          const on = current === p.id;
          return (
            <button key={p.id} type="button" role="tab" aria-selected={on} onClick={() => pick(p.id)} className={cn("inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card")}>
              <Icon className="h-4 w-4" />
              {personName(p)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
