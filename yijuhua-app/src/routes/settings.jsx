import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, Download, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import CategoryManager from "@/components/CategoryManager";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { restoreMissingCategories } from "@/lib/categories";
import { downloadCsv, parseBackupCsv } from "@/lib/csv";
import { useLedger } from "@/lib/ledger";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "設定｜一句話記帳" }] }),
  component: SettingsPage,
});

function Row({ title, description, children }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium">{title}</p>
        {description && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SettingsPage() {
  const { mode, prefs, savePrefs, items, clearAll, importRecords } = useLedger();
  const fileRef = useRef(null);

  const handleImport = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("檔案太大（超過 5 MB）");
      return;
    }
    setBusy("import");
    try {
      const { records, skipped } = parseBackupCsv(await file.text());
      if (!records.length) throw new Error("檔案裡沒有可以匯入的紀錄");
      const { added, duplicates } = importRecords(records);
      const restored = restoreMissingCategories(records);
      toast.success(
        `已匯入 ${added} 筆${duplicates ? `，${duplicates} 筆已存在所以略過` : ""}${skipped ? `，${skipped} 筆格式不對略過` : ""}${restored ? `，補回 ${restored} 個自訂分類` : ""}`
      );
    } catch (error) {
      toast.error(error?.message || "匯入失敗");
    } finally {
      setBusy("");
    }
  };
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    setBudget(prefs.monthlyBudget ? String(prefs.monthlyBudget) : "");
  }, [prefs.monthlyBudget]);

  useEffect(() => {
    if (window.location.hash === "#my-categories") {
      document.getElementById("my-categories")?.scrollIntoView({ block: "start" });
    }
  }, []);

  const run = async (key, task, success) => {
    setBusy(key);
    try {
      const result = await task();
      if (success) toast.success(typeof success === "function" ? success(result) : success);
    } catch (error) {
      toast.error(error?.message || "操作失敗，請再試一次");
    } finally {
      setBusy("");
    }
  };

  return (
    <main className="mx-auto min-h-[100dvh] max-w-md px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-2">
        <Link to="/" aria-label="回首頁" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">設定</h1>
      </header>

      <div className="mt-5 rounded-2xl bg-secondary px-4 py-3 text-sm leading-relaxed text-secondary-foreground">
        記帳紀錄只存在這支手機裡，不需要註冊或登入，別人也看不到。換手機、刪除主畫面圖示或清除瀏覽器資料前，請先用下方的「匯出」備份；到新手機再用「匯入備份」放回來。
      </div>

      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted-foreground">記帳方式</h2>
      <section className="divide-y divide-border overflow-hidden rounded-2xl bg-white shadow-sm">
        <Row title="快速自動儲存" description="辨識很確定時直接儲存，不再跳確認卡片；存後 6 秒內可以撤銷。">
          <Switch checked={Boolean(prefs.autoSave)} onCheckedChange={(v) => run("auto", () => savePrefs({ autoSave: v }))} />
        </Row>
        <Row title="保存說話原文" description="在帳目裡留下當時說的那句話，方便日後查看。">
          <Switch
            checked={prefs.saveOriginalText !== false}
            onCheckedChange={(v) => run("orig", () => savePrefs({ saveOriginalText: v }))}
          />
        </Row>
        <div className="px-4 py-4">
          <label htmlFor="budget" className="text-base font-medium">
            每月預算（NT$）
          </label>
          <p className="mt-0.5 text-sm text-muted-foreground">設定後帳本會顯示進度，超過 80% 會提醒。留空代表不設定。</p>
          <div className="mt-2 flex gap-2">
            <input
              id="budget"
              inputMode="numeric"
              value={budget}
              onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="例如 20000"
              className="h-11 min-w-0 flex-1 rounded-xl border border-input px-3"
            />
            <Button
              type="button"
              onClick={() => run("budget", () => savePrefs({ monthlyBudget: budget ? Number(budget) : null }), "已儲存預算")}
              disabled={busy === "budget"}
              className="h-11 rounded-xl"
            >
              儲存
            </Button>
          </div>
        </div>
      </section>

      <CategoryManager />

      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted-foreground">備份與刪除</h2>
      <section className="divide-y divide-border overflow-hidden rounded-2xl bg-white shadow-sm">
        <Row title="匯出全部資料（CSV）" description={`共 ${items.length} 筆，可用 Excel 或 Google 試算表開啟。換手機前建議先備份。`}>
          <Button
            type="button"
            variant="outline"
            disabled={!items.length}
            onClick={() => downloadCsv(items, "一句話記帳_全部資料.csv")}
            className="h-11 shrink-0 rounded-xl"
          >
            <Download className="mr-1 h-4 w-4" />
            匯出
          </Button>
        </Row>
        <Row title="匯入備份" description="換新手機時，選擇之前匯出的 CSV 檔，紀錄就會回來；已經有的同一筆不會重複。">
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy === "import"}
            className="h-11 shrink-0 rounded-xl"
          >
            {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
            匯入
          </Button>
        </Row>
        <div className="px-4 py-4">
          <p className="text-base font-medium text-red-700">刪除我的所有記帳資料</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {mode === "cloud" ? "會刪除帳號裡的所有紀錄與設定，無法復原。" : "會刪除這支手機裡的所有紀錄，無法復原。"}請輸入「刪除」確認。
          </p>
          <div className="mt-2 flex gap-2">
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="輸入 刪除"
              className="h-11 min-w-0 flex-1 rounded-xl border border-input px-3"
            />
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText !== "刪除" || busy === "clear"}
              onClick={() => run("clear", clearAll, "已刪除所有資料").then(() => setConfirmText(""))}
              className="h-11 rounded-xl"
            >
              {busy === "clear" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-1 h-4 w-4" />}
              刪除
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-6 space-y-2 px-1 text-sm leading-relaxed text-muted-foreground">
        <p>一句話記帳是 AI 數位森林旗下的免費生活效率工具。</p>
        <p>語音轉文字由手機瀏覽器（iPhone 為 Apple、Android 為 Google）提供；App 不錄音、不保存音訊。記帳內容的分類在你的手機上完成，不使用付費 AI。</p>
      </section>
    </main>
  );
}
