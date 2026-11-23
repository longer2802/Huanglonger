import { useState } from "react";
import { CalendarPlus, Check, ChevronDown, ExternalLink, ListChecks, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { AlertBox, Btn, Card } from "./kit";
import { sourceOf } from "@/lib/sources";
import { addRuleTodo, useSprout } from "@/lib/store";
import { todoId } from "@/lib/rules";
import { cn } from "@/lib/utils";

export function SourceLine({ source, compact = false }) {
  const s = sourceOf(source.id);
  if (!s) return null;
  return (
    <div className={cn("rounded-2xl bg-muted/60 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground", compact && "py-1.5")}>
      <p>
        <span className="font-semibold text-foreground">來源：</span>
        {s.publisher}《{s.name}》{source.section ? `・${source.section}` : ""}
        {source.page ? `・${source.page}` : ""}
      </p>
      {!compact ? (
        <>
          <p>版本：{s.edition}</p>
          <p>
            審核狀態：{s.status === "verified" ? "已對照官方原文" : "待確認"}；內容為小芽自行摘要，未經醫療專業審閱。
          </p>
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-semibold text-primary underline">
            開啟官方原文 <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </>
      ) : null}
    </div>
  );
}

export default function ContentCard({ card, subjectId, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const { todos } = useSprout();

  const add = async (ruleKey) => {
    try {
      await addRuleTodo(subjectId, ruleKey);
      toast.success("已加入行事曆的「建議安排」，請再選實際日期與時間。");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <Card className={cn(card.alert && "border-destructive/50")}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start justify-between gap-3 text-left">
        <div className="min-w-0">
          <h3 className={cn("text-[17px] font-bold leading-snug", card.alert && "text-destructive")}>
            {card.alert ? "⚠ " : ""}
            {card.title}
          </h3>
          <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{card.summary}</p>
        </div>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {card.doNow?.length ? (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-primary">
                <ListChecks className="h-4 w-4" /> 本階段可以做的事
              </p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                {card.doNow.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {card.common?.length ? (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-sm font-bold text-[hsl(var(--apricot-strong))]">
                <Lightbulb className="h-4 w-4" /> 常見狀況
              </p>
              <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
                {card.common.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {card.warnings?.length ? <AlertBox title="需要留意的警訊" items={card.warnings} action={card.warningAction} /> : null}
          {card.actions?.length && subjectId ? (
            <div className="flex flex-wrap gap-2">
              {card.actions.map((a) => {
                const exists = todos.some((t) => t.id === todoId(subjectId, a.ruleKey));
                return (
                  <Btn key={a.ruleKey} size="md" variant={exists ? "outline" : "soft"} disabled={exists} onClick={() => add(a.ruleKey)}>
                    {exists ? <Check className="h-4 w-4" /> : <CalendarPlus className="h-4 w-4" />}
                    {exists ? `${a.label}（已在行事曆）` : a.label}
                  </Btn>
                );
              })}
            </div>
          ) : null}
          <SourceLine source={card.source} />
        </div>
      ) : null}
    </Card>
  );
}
