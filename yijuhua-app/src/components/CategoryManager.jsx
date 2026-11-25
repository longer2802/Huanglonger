import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CUSTOM_ICONS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  MAX_NAME,
  addCustomCategory,
  getCustomCategories,
  removeCustomCategory,
  splitKeywords,
  updateCustomCategory,
  useCategoriesVersion,
} from "@/lib/categories";
import { cn } from "@/lib/utils";

const input = "h-11 w-full min-w-0 rounded-xl border border-input bg-white px-3 text-base";

function IconPicker({ value, onChange, idPrefix }) {
  return (
    <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="選擇圖示">
      {CUSTOM_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          role="radio"
          aria-checked={value === icon}
          aria-label={`圖示 ${icon}`}
          id={`${idPrefix}-${icon}`}
          onClick={() => onChange(icon)}
          className={cn("flex h-10 items-center justify-center rounded-lg text-xl", value === icon ? "bg-primary/15 ring-2 ring-primary" : "bg-muted")}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}

function Editor({ item, onDone }) {
  const [icon, setIcon] = useState(item.icon);
  const [keywords, setKeywords] = useState(item.keywords.join("、"));
  const save = () => {
    try {
      updateCustomCategory(item.id, { icon, keywords: splitKeywords(keywords) });
      toast.success(`已更新「${item.name}」`);
      onDone();
    } catch (error) {
      toast.error(error?.message || "儲存失敗");
    }
  };
  return (
    <div className="space-y-2 bg-secondary/40 px-4 pb-4 pt-1">
      <IconPicker value={icon} onChange={setIcon} idPrefix={`edit-${item.id}`} />
      <label className="block text-sm text-muted-foreground" htmlFor={`kw-${item.id}`}>
        關鍵字（說到這些詞就自動歸到這個分類）
      </label>
      <input id={`kw-${item.id}`} value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="例如 飼料、貓砂、獸醫" className={input} />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onDone} className="h-10 flex-1 rounded-xl">
          <X className="mr-1 h-4 w-4" />
          取消
        </Button>
        <Button type="button" onClick={save} className="h-10 flex-1 rounded-xl">
          <Check className="mr-1 h-4 w-4" />
          儲存
        </Button>
      </div>
    </div>
  );
}

// 設定頁「我的分類」：新增、修改、刪除自訂分類（只存在這支手機）
export default function CategoryManager() {
  useCategoriesVersion();
  const custom = getCustomCategories();
  const [type, setType] = useState("expense");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(CUSTOM_ICONS[0]);
  const [keywords, setKeywords] = useState("");
  const [editing, setEditing] = useState("");
  const [confirmId, setConfirmId] = useState("");

  const add = () => {
    try {
      const item = addCustomCategory({ name, type, icon, keywords: splitKeywords(keywords) });
      toast.success(`已新增分類「${item.name}」`);
      setName("");
      setKeywords("");
    } catch (error) {
      toast.error(error?.message || "新增失敗");
    }
  };

  const remove = (item) => {
    try {
      removeCustomCategory(item.id);
      setConfirmId("");
      toast(`已刪除「${item.name}」`, {
        description: "已記的帳目仍保留這個分類名稱。",
        duration: 6000,
        action: {
          label: "撤銷",
          onClick: () => {
            try {
              addCustomCategory(item);
            } catch (error) {
              toast.error(error?.message || "無法復原");
            }
          },
        },
      });
    } catch (error) {
      toast.error(error?.message || "刪除失敗");
    }
  };

  const builtin = (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).filter((c) => !c.custom);

  return (
    <>
      <h2 id="my-categories" className="mb-2 mt-6 scroll-mt-4 px-1 text-sm font-semibold text-muted-foreground">
        我的分類
      </h2>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm" aria-label="我的分類">
        <div className="space-y-3 px-4 py-4">
          <div>
            <p className="text-base font-medium">新增分類</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">新增後在記帳時的「分類」選單就能選到，也會出現在帳本的統計裡。</p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" role="radiogroup" aria-label="分類類型">
            {[
              ["expense", "支出分類"],
              ["income", "收入分類"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={type === key}
                onClick={() => setType(key)}
                className={cn("h-10 rounded-lg text-sm font-semibold", type === key ? "bg-white text-primary shadow-sm" : "text-muted-foreground")}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <label htmlFor="new-cat-name" className="mb-1 block text-sm text-muted-foreground">
              分類名稱（最多 {MAX_NAME} 個字）
            </label>
            <div className="flex gap-2">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-2xl" aria-hidden="true">
                {icon}
              </span>
              <input
                id="new-cat-name"
                value={name}
                maxLength={MAX_NAME}
                onChange={(e) => setName(e.target.value)}
                placeholder={type === "income" ? "例如 兼職、二手拍賣" : "例如 寵物、孩子、菸酒"}
                className={input}
              />
            </div>
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">圖示</p>
            <IconPicker value={icon} onChange={setIcon} idPrefix="new-icon" />
          </div>
          <div>
            <label htmlFor="new-cat-keywords" className="mb-1 block text-sm text-muted-foreground">
              關鍵字（可空白，用頓號或空白隔開；說到這些詞就自動歸到這個分類）
            </label>
            <input
              id="new-cat-keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder={type === "income" ? "例如 接案、外快" : "例如 飼料、貓砂、獸醫"}
              className={input}
            />
          </div>
          <Button type="button" onClick={add} disabled={!name.trim()} className="h-12 w-full rounded-xl text-base">
            <Plus className="mr-1 h-4 w-4" />
            新增這個分類
          </Button>
        </div>

        {custom.length > 0 && (
          <ul className="divide-y divide-border border-t border-border" aria-label="已新增的分類">
            {custom.map((item) => (
              <li key={item.id}>
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xl">{item.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium">{item.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {item.type === "income" ? "收入" : "支出"}
                      {item.keywords.length ? `・${item.keywords.join("、")}` : ""}
                    </span>
                  </span>
                  {confirmId === item.id ? (
                    <>
                      <Button type="button" variant="ghost" onClick={() => setConfirmId("")} className="h-9 rounded-lg px-2 text-sm">
                        取消
                      </Button>
                      <Button type="button" variant="destructive" onClick={() => remove(item)} className="h-9 rounded-lg px-3 text-sm">
                        確定刪除
                      </Button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditing(editing === item.id ? "" : item.id)}
                        aria-label={`修改${item.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(item.id)}
                        aria-label={`刪除${item.name}`}
                        className="flex h-10 w-10 items-center justify-center rounded-full text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
                {editing === item.id && <Editor key={item.id} item={item} onDone={() => setEditing("")} />}
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-border px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          內建的{type === "income" ? "收入" : "支出"}分類：{builtin.map((c) => `${c.icon}${c.name}`).join("、")}。自訂分類只存在這支手機；匯入備份時，帳目用到的分類會自動補回來。
        </p>
      </section>
    </>
  );
}
