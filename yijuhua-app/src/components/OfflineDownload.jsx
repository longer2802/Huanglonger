import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// 離線版（單一 HTML 檔）放在 Base44 媒體庫；下載時取回內容，存成 .html 檔
const FILE_URL = "https://media.base44.com/files/public/6b004efcbde4a28f63aa1609/bcf872c67c0d2b499914b17cdf50e406_yijuhua-app-offline.txt";
const FILE_NAME = "yijuhua-app.html";

async function downloadOfflineHtml() {
  const res = await fetch(FILE_URL, { cache: "no-cache" });
  if (!res.ok) throw new Error("下載失敗，請檢查網路後再試一次");
  const blob = new Blob([await res.text()], { type: "text/html;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = FILE_NAME;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 5000);
}

export default function OfflineDownload() {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    try {
      await downloadOfflineHtml();
      toast.success("已開始下載離線版");
    } catch (error) {
      toast.error(error?.message || "下載失敗，請再試一次");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <h2 className="mb-2 mt-6 px-1 text-sm font-semibold text-muted-foreground">下載區</h2>
      <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div className="min-w-0">
            <p className="text-base font-medium">下載離線版 App（HTML 檔）</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              存到平板或電腦，點兩下就能用，打字記帳不需要網路。離線版的紀錄和這裡分開存放，可用上方「匯出／匯入」搬移。
            </p>
          </div>
          <Button type="button" onClick={handle} disabled={busy} className="h-11 shrink-0 rounded-xl">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
            下載
          </Button>
        </div>
      </section>
    </>
  );
}
