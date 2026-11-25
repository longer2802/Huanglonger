import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import TransactionFields from "@/components/TransactionFields";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useLedger } from "@/lib/ledger";
import { draftBlockers, newRequestId } from "@/lib/parser";
import { zonedParts } from "@/lib/dates";

function blankDraft(timezone) {
  const { date, time } = zonedParts(new Date(), timezone);
  return {
    clientRequestId: newRequestId(),
    type: "expense",
    amount: null,
    currency: "TWD",
    categoryName: "飲食",
    paymentMethod: "現金",
    itemName: "",
    merchant: "",
    note: "",
    transactionDate: date,
    transactionTime: time,
    timezone,
    inputMethod: "manual",
    confidence: 1,
  };
}

// 手動記帳與編輯帳目（同一張表單）
export default function TransactionSheet({ open, onOpenChange, record }) {
  const { addMany, update, remove, restore, prefs } = useLedger();
  const [value, setValue] = useState(() => blankDraft(prefs.timezone));
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const editing = Boolean(record);

  useEffect(() => {
    if (!open) return;
    setValue(record ? { ...record } : blankDraft(prefs.timezone));
  }, [open, record, prefs.timezone]);

  const blockers = draftBlockers(value);

  const handleSave = async () => {
    if (lock.current || blockers.length) return;
    lock.current = true;
    setSaving(true);
    try {
      if (editing) {
        await update(record.id, value);
        toast.success("已更新");
      } else {
        await addMany([value]);
        toast.success("已記帳");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(error?.message || "儲存失敗，請再試一次");
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editing || lock.current) return;
    lock.current = true;
    try {
      const removed = await remove(record.id);
      onOpenChange(false);
      toast("已刪除這筆", {
        duration: 6000,
        action: { label: "撤銷", onClick: () => restore(removed).then(() => toast.success("已復原")) },
      });
    } catch (error) {
      toast.error(error?.message || "刪除失敗");
    } finally {
      lock.current = false;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl px-4 pb-8">
        <SheetHeader className="text-left">
          <SheetTitle className="text-xl">{editing ? "編輯帳目" : "手動記帳"}</SheetTitle>
          <SheetDescription>{editing ? "修改後按儲存；也可以刪除這筆。" : "填好金額與分類就可以儲存。"}</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          <TransactionFields idPrefix="manual" value={value} onChange={setValue} />
        </div>
        {editing && record.originalText && (
          <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">當時說的：「{record.originalText}」</p>
        )}
        <div className="mt-5 grid gap-2">
          <Button type="button" onClick={handleSave} disabled={saving || blockers.length > 0} className="h-14 rounded-2xl text-lg font-bold">
            {saving && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            {editing ? "儲存修改" : "儲存"}
          </Button>
          {blockers.length > 0 && <p className="text-center text-sm text-red-700">{blockers[0]}</p>}
          {editing && (
            <Button type="button" variant="ghost" onClick={handleDelete} className="h-12 rounded-2xl text-base text-red-600 hover:text-red-700">
              <Trash2 className="mr-1.5 h-4 w-4" />
              刪除這筆
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
