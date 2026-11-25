import { useState } from "react";
import { Download, Laptop } from "lucide-react";
import { toast } from "sonner";
import { Btn, Card, Fold } from "@/components/kit";

// 離線版（單一 HTML 檔）放在 Base44 媒體庫；下載時取回內容，存成 .html 檔
const FILE_URL = "https://media.base44.com/files/public/6b03d4092f1493715a7d2e40/122317b7511846fff08c03479eeb5b7b_mama-handbook-offline.txt";
const FILE_NAME = "mama-handbook.html";

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
    <Fold title="下載區：離線版 App" icon={Laptop}>
      <Card className="space-y-3 text-[15px] leading-relaxed">
        <p>把媽媽手冊E版存成一個 HTML 檔，放到平板或電腦，點兩下就能用，完全不需要網路。</p>
        <p className="text-[13px] text-muted-foreground">離線版的資料和這裡分開存放；要搬資料，請用上方的「備份與還原」。</p>
        <Btn className="w-full" disabled={busy} onClick={handle}>
          <Download className="h-5 w-5" /> {busy ? "下載中…" : "下載離線版（HTML）"}
        </Btn>
      </Card>
    </Fold>
  );
}
