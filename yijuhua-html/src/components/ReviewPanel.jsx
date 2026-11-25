import { useState } from "react";
import { AlertTriangle, Check, Loader2, Mic, Pencil, X } from "lucide-react";
import TransactionFields from "@/components/TransactionFields";
import { Button } from "@/components/ui/button";
import { TYPE_LABELS, categoryIcon } from "@/lib/categories";
import { formatDateLabel } from "@/lib/dates";
import { draftBlockers } from "@/lib/parser";
import { cn } from "@/lib/utils";

export const money = (n) => `NT$${Math.round(Number(n) || 0).toLocaleString("zh-TW")}`;

// 轉帳給他人：使用者選用途後套用
function applyTransferPurpose(draft, option) {
  const issues = (draft.issues || []).filter((i) => i.kind !== "transferPurpose");
  if (option.startsWith("轉帳")) return { ...draft, type: "transfer", categoryName: "轉帳", itemName: "轉帳", paymentMethod: undefined, issues };
  if (option.startsWith("送給")) return { ...draft, type: "expense", categoryName: "人情禮金", issues };
  if (option.startsWith("借給")) return { ...draft, type: "expense", categoryName: "其他支出", note: draft.note || "借出", issues };
  return { ...draft, type: "expense", categoryName: "其他支出", note: draft.note || "還款", issues };
}

function DraftCard({ draft, index, total, onChange, onRemove }) {
  const blockers = draftBlockers(draft);
  const needsAmount = !(Number(draft.amount) > 0);
  const categoryIssue = (draft.issues || []).find((i) => i.kind === "category");
  const transferIssue = (draft.issues || []).find((i) => i.kind === "transferPurpose");
  const dateIssue = (draft.issues || []).find((i) => i.kind === "date");
  const info = (draft.issues || []).find((i) => i.kind === "info");
  const [editing, setEditing] = useState(needsAmount);

  const amountColor = draft.type === "income" ? "text-primary" : draft.type === "transfer" ? "text-slate-600" : "text-red-600";

  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", blockers.length ? "border-amber-300" : "border-border")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          {total > 1 ? `第 ${index + 1} 筆・` : ""}
          {TYPE_LABELS[draft.type]}
        </p>
        {total > 1 && (
          <button
            type="button"
            onClick={onRemove}
            className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
            aria-label="移除這筆"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!editing && (
        <dl className="mt-2 grid grid-cols-[4.5rem_1fr] gap-y-1.5 text-base">
          <dt className="text-muted-foreground">日期</dt>
          <dd>{formatDateLabel(draft.transactionDate)}</dd>
          <dt className="text-muted-foreground">分類</dt>
          <dd>
            {categoryIcon(draft.categoryName)} {draft.categoryName}
          </dd>
          {draft.type === "expense" && (
            <>
              <dt className="text-muted-foreground">付款</dt>
              <dd>{draft.paymentMethod || "現金"}</dd>
            </>
          )}
          <dt className="text-muted-foreground">項目</dt>
          <dd className="break-all">{draft.itemName || "（未填）"}</dd>
          {draft.merchant && (
            <>
              <dt className="text-muted-foreground">商家</dt>
              <dd className="break-all">{draft.merchant}</dd>
            </>
          )}
          {draft.note && (
            <>
              <dt className="text-muted-foreground">備註</dt>
              <dd className="break-all">{draft.note}</dd>
            </>
          )}
          <dt className="text-muted-foreground">金額</dt>
          <dd className={cn("text-2xl font-bold", amountColor)}>{needsAmount ? "—" : money(draft.amount)}</dd>
        </dl>
      )}

      {editing && (
        <div className="mt-3">
          <TransactionFields
            idPrefix={`draft-${index}`}
            value={draft}
            onChange={(next) => {
              const issues = (next.issues || []).filter((i) => {
                if (i.kind === "amount") return !(Number(next.amount) > 0);
                if (i.kind === "category") return next.categoryName === draft.categoryName && next.type === draft.type;
                if (i.kind === "date") return next.transactionDate === draft.transactionDate;
                return true;
              });
              onChange({ ...next, issues });
            }}
            highlight={{ amount: needsAmount, category: Boolean(categoryIssue), date: Boolean(dateIssue) }}
          />
        </div>
      )}

      {needsAmount && (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-base font-medium text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          請補充這筆消費的金額。
        </p>
      )}
      {dateIssue && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{dateIssue.message}</p>}
      {info && <p className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">{info.message}</p>}

      {categoryIssue && !editing && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">{categoryIssue.message}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(categoryIssue.options?.length ? categoryIssue.options : ["飲食", "購物", "生活用品", "其他支出"]).map((name) => (
              <button
                key={name}
                type="button"
                onClick={() =>
                  onChange({ ...draft, categoryName: name, issues: draft.issues.filter((i) => i.kind !== "category") })
                }
                className={cn(
                  "h-10 rounded-full border px-4 text-base",
                  draft.categoryName === name ? "border-primary bg-primary text-primary-foreground" : "border-border bg-white"
                )}
              >
                {categoryIcon(name)} {name}
              </button>
            ))}
            <button type="button" onClick={() => setEditing(true)} className="h-10 rounded-full border border-dashed px-4 text-base">
              其他分類…
            </button>
          </div>
        </div>
      )}

      {transferIssue && (
        <div className="mt-3 rounded-xl bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">{transferIssue.message}（不會自動當成支出）</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {transferIssue.options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange(applyTransferPurpose(draft, option))}
                className="min-h-10 rounded-xl border border-border bg-white px-2 py-1.5 text-sm"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {!editing && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 flex items-center gap-1 text-sm font-medium text-primary"
        >
          <Pencil className="h-3.5 w-3.5" />
          修改這筆
        </button>
      )}
    </div>
  );
}

export default function ReviewPanel({ drafts, onChange, onConfirm, onRetry, onCancel, saving, heard }) {
  const allBlockers = drafts.flatMap((d) => draftBlockers(d));
  const total = drafts.reduce((sum, d) => sum + (d.type === "expense" ? Number(d.amount) || 0 : 0), 0);

  return (
    <section aria-label="記帳確認" className="space-y-3">
      <div className="rounded-2xl bg-secondary px-4 py-3">
        <p className="text-sm text-secondary-foreground/70">記帳完成前確認</p>
        {heard && <p className="mt-0.5 break-all text-base text-secondary-foreground">「{heard}」</p>}
      </div>

      {drafts.map((draft, index) => (
        <DraftCard
          key={draft.clientRequestId}
          draft={draft}
          index={index}
          total={drafts.length}
          onChange={(next) => onChange(drafts.map((d, i) => (i === index ? next : d)))}
          onRemove={() => onChange(drafts.filter((_, i) => i !== index))}
        />
      ))}

      {drafts.length > 1 && (
        <p className="px-1 text-right text-base">
          共 {drafts.length} 筆，支出合計 <span className="text-xl font-bold text-red-600">{money(total)}</span>
        </p>
      )}

      <div className="grid gap-2">
        <Button
          type="button"
          onClick={onConfirm}
          disabled={saving || allBlockers.length > 0 || !drafts.length}
          className="h-14 rounded-2xl text-lg font-bold"
        >
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
          {saving ? "儲存中…" : drafts.length > 1 ? `確認儲存 ${drafts.length} 筆` : "確認儲存"}
        </Button>
        {allBlockers.length > 0 && <p className="text-center text-sm text-red-700">{allBlockers[0]}</p>}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onRetry} disabled={saving} className="h-12 rounded-2xl text-base">
            <Mic className="mr-1.5 h-4 w-4" />
            重新錄音
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="h-12 rounded-2xl text-base">
            取消
          </Button>
        </div>
      </div>
    </section>
  );
}
