import { useEffect, useState } from "react";
import { ChevronDown, Share, SquarePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "yijuhua-install-tip-dismissed";

// 第一次使用時提醒「加入主畫面」（資料存在手機時特別重要）
export default function InstallTip({ mode }) {
  const [platform, setPlatform] = useState(null); // ios | android | null
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      // 下載到裝置、直接開檔（file://）時無法加入主畫面，不顯示
      if (window.location.protocol === "file:") return;
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
      if (standalone || window.localStorage.getItem(DISMISS_KEY)) return;
      const ua = window.navigator.userAgent || "";
      if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("ios");
      else if (/Android/i.test(ua)) setPlatform("android");
    } catch {
      /* 無法判斷就不顯示 */
    }
  }, []);

  if (!platform) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setPlatform(null);
  };

  return (
    <div className="relative rounded-2xl border border-primary/30 bg-white px-4 py-3 text-left shadow-sm">
      <button
        type="button"
        onClick={dismiss}
        className="absolute right-2 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground"
        aria-label="不再顯示"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 pr-8 text-left text-base font-semibold"
      >
        把「一句話記帳」加入主畫面
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {!open ? null : platform === "ios" ? (
        <ol className="mt-2 space-y-1.5 text-base text-foreground/90">
          <li className="flex items-center gap-1.5">
            1. 點 Safari 下方的 <Share className="inline h-4 w-4 text-primary" /> 分享
          </li>
          <li className="flex items-center gap-1.5">
            2. 選「<SquarePlus className="inline h-4 w-4 text-primary" /> 加入主畫面」
          </li>
          <li>3. 之後都從主畫面的圖示打開</li>
        </ol>
      ) : (
        <ol className="mt-2 space-y-1.5 text-base text-foreground/90">
          <li>1. 點瀏覽器右上角「⋮」</li>
          <li>2. 選「加到主畫面」或「安裝應用程式」</li>
          <li>3. 之後都從主畫面的圖示打開</li>
        </ol>
      )}
      {open && mode === "local" && (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {platform === "ios"
            ? "紀錄存在這支手機。iPhone 主畫面的 App 和 Safari 分頁各存一份，請固定從同一個地方打開；刪除主畫面圖示會一併刪除紀錄。"
            : "紀錄存在這支手機的瀏覽器裡；清除瀏覽器資料會一併刪除。"}
        </p>
      )}
    </div>
  );
}
