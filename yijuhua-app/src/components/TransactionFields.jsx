import { PAYMENT_METHODS, categoriesForType, useCategoriesVersion } from "@/lib/categories";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "expense", label: "支出" },
  { value: "income", label: "收入" },
  { value: "transfer", label: "轉帳" },
];

const field =
  "h-12 w-full rounded-xl border border-input bg-white px-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export function FieldLabel({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-muted-foreground">
      {children}
    </label>
  );
}

// 可編輯的帳目欄位（確認卡片與手動記帳共用）
export default function TransactionFields({ value, onChange, idPrefix = "tx", highlight = {}, compact = false }) {
  useCategoriesVersion();
  const set = (patch) => onChange({ ...value, ...patch });
  const categories = categoriesForType(value.type);
  // 已刪除的自訂分類：舊帳目仍保留原名稱，選單裡也照樣顯示
  const missing = value.categoryName && !categories.some((c) => c.name === value.categoryName) ? value.categoryName : "";

  const changeType = (type) => {
    const list = categoriesForType(type);
    const keep = list.some((c) => c.name === value.categoryName);
    set({ type, categoryName: keep ? value.categoryName : list[list.length - 1].name });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="類型">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={value.type === t.value}
            onClick={() => changeType(t.value)}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold transition-colors",
              value.type === t.value
                ? t.value === "income"
                  ? "bg-primary text-primary-foreground"
                  : t.value === "expense"
                    ? "bg-red-600 text-white"
                    : "bg-slate-600 text-white"
                : "text-muted-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel htmlFor={`${idPrefix}-amount`}>金額（NT$）</FieldLabel>
          <input
            id={`${idPrefix}-amount`}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="例如 350"
            value={value.amount ?? ""}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^\d.]/g, "");
              set({ amount: digits === "" ? null : Number(digits) });
            }}
            className={cn(field, "text-lg font-semibold", highlight.amount && "border-red-500 ring-2 ring-red-200")}
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${idPrefix}-date`}>日期</FieldLabel>
          <input
            id={`${idPrefix}-date`}
            type="date"
            value={value.transactionDate || ""}
            onChange={(e) => set({ transactionDate: e.target.value, transactionTime: "" })}
            className={cn(field, highlight.date && "border-amber-500 ring-2 ring-amber-200")}
          />
        </div>
      </div>

      <div className={cn("grid gap-3", value.type === "expense" ? "grid-cols-2" : "grid-cols-1")}>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-category`}>分類</FieldLabel>
        <select
          id={`${idPrefix}-category`}
          value={value.categoryName || ""}
          onChange={(e) => set({ categoryName: e.target.value })}
          disabled={value.type === "transfer"}
          className={cn(field, highlight.category && "border-amber-500 ring-2 ring-amber-200")}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.icon} {c.name}
            </option>
          ))}
          {missing && <option value={missing}>📦 {missing}</option>}
        </select>
      </div>
      {value.type === "expense" && (
        <div>
          <FieldLabel htmlFor={`${idPrefix}-payment`}>付款方式</FieldLabel>
          <select
            id={`${idPrefix}-payment`}
            value={value.paymentMethod || "現金"}
            onChange={(e) => set({ paymentMethod: e.target.value })}
            className={field}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m === "現金" ? "💵" : m === "信用卡" ? "💳" : "🏦"} {m}
              </option>
            ))}
          </select>
        </div>
      )}
      </div>

      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "grid-cols-2")}>
        <div>
          <FieldLabel htmlFor={`${idPrefix}-item`}>項目</FieldLabel>
          <input
            id={`${idPrefix}-item`}
            value={value.itemName || ""}
            onChange={(e) => set({ itemName: e.target.value.slice(0, 40) })}
            placeholder="例如 午餐、加油"
            className={field}
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${idPrefix}-merchant`}>商家（可空白）</FieldLabel>
          <input
            id={`${idPrefix}-merchant`}
            value={value.merchant || ""}
            onChange={(e) => set({ merchant: e.target.value.slice(0, 40) })}
            placeholder="例如 全聯"
            className={field}
          />
        </div>
      </div>

      <div>
        <FieldLabel htmlFor={`${idPrefix}-note`}>備註（可空白）</FieldLabel>
        <input
          id={`${idPrefix}-note`}
          value={value.note || ""}
          onChange={(e) => set({ note: e.target.value.slice(0, 100) })}
          className={field}
        />
      </div>
    </div>
  );
}
