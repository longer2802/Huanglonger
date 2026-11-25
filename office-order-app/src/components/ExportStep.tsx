import { useEffect, useMemo, useState } from "react";
import { canShareFiles, downloadFile, internalDoc, pdfFile, pngFiles, renderPages, shareFiles, storeDoc, vendorGroups, type DocSpec, type LabelMode } from "../lib/exportDoc";
import { orderTotals } from "../lib/pricing";
import { KIND_LABEL } from "../lib/types";
import type { StepProps } from "./OrderEditor";
import { PendingPanel } from "./TotalsStep";
import { useToast } from "./ui";

export default function ExportStep({ order, update, goStep }: StepProps) {
  const toast = useToast();
  const [type, setType] = useState<"store" | "internal">("store");
  const groups = vendorGroups(order);
  const [groupKey, setGroupKey] = useState(groups[0]?.key ?? "");
  const [mode, setMode] = useState<LabelMode>("name");
  const [pages, setPages] = useState<HTMLCanvasElement[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const t = orderTotals(order);
  const group = groups.find((g) => g.key === groupKey) ?? groups[0];

  const spec: DocSpec | null = useMemo(() => {
    if (type === "internal") return internalDoc(order);
    if (!group) return null;
    return storeDoc(order, group.kinds, mode);
  }, [order, type, group, mode]);

  useEffect(() => {
    if (!spec) return;
    let alive = true;
    const timer = setTimeout(async () => {
      const ps = await renderPages(spec);
      if (!alive) return;
      setPages(ps);
      setImages(ps.map((c) => c.toDataURL("image/png")));
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [spec]);

  const run = async (what: "png" | "pdf" | "share-png" | "share-pdf") => {
    if (!spec || !pages.length) return;
    setBusy(what);
    try {
      const files = what.endsWith("pdf") ? [await pdfFile(spec, pages)] : await pngFiles(spec, pages);
      if (what.startsWith("share")) {
        if (canShareFiles(files)) {
          const r = await shareFiles(files, spec.title);
          if (r === "shared") toast("已開啟分享");
        } else {
          files.forEach(downloadFile);
          toast("這個瀏覽器不支援分享檔案，已改為下載");
        }
      } else {
        files.forEach(downloadFile);
        toast(files.length > 1 ? `已下載 ${files.length} 張（長單自動分頁）` : `已下載 ${files[0].name}`);
      }
    } catch (e) {
      toast(`匯出失敗：${(e as Error).message}`, "error");
    } finally {
      setBusy("");
    }
  };

  const shareSupported = typeof navigator.share === "function" && typeof navigator.canShare === "function";

  return (
    <div className="stack">
      <PendingPanel order={order} update={update} goStep={goStep} action="匯出" />
      {t.orderingPeople.length === 0 ? <div className="banner warn">還沒有人點餐，匯出的單會是空的。</div> : null}

      <div className="card stack">
        <div className="seg" role="group" aria-label="匯出類型" style={{ alignSelf: "flex-start" }}>
          <button type="button" aria-pressed={type === "store"} onClick={() => setType("store")}>
            給店家
          </button>
          <button type="button" aria-pressed={type === "internal"} onClick={() => setType("internal")}>
            內部收款
          </button>
        </div>
        {type === "store" ? (
          <div className="row">
            {groups.length > 1 ? (
              <label className="field grow">
                <span>店家</span>
                <select value={group?.key} onChange={(e) => setGroupKey(e.target.value)} aria-label="選擇店家">
                  {groups.map((g) => (
                    <option key={g.key} value={g.key}>
                      {g.vendor}（{g.kinds.map((k) => KIND_LABEL[k]).join("＋")}）
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div>
              <div className="tiny muted bold" style={{ marginBottom: 4 }}>
                逐人明細顯示
              </div>
              <div className="seg" role="group" aria-label="逐人明細顯示">
                <button type="button" aria-pressed={mode === "name"} onClick={() => setMode("name")}>
                  姓名
                </button>
                <button type="button" aria-pressed={mode === "number"} onClick={() => setMode("number")}>
                  編號
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {spec ? <p className="small muted">檔名：{spec.fileBase}.pdf{pages.length > 1 ? `／PNG 共 ${pages.length} 張` : ""}</p> : null}
        <div className="row">
          <button type="button" className="btn primary" disabled={!pages.length || Boolean(busy)} onClick={() => run("png")}>
            {busy === "png" ? "產生中…" : "下載 PNG"}
          </button>
          <button type="button" className="btn primary" disabled={!pages.length || Boolean(busy)} onClick={() => run("pdf")}>
            {busy === "pdf" ? "產生中…" : "下載 PDF"}
          </button>
          {shareSupported ? (
            <>
              <button type="button" className="btn" disabled={!pages.length || Boolean(busy)} onClick={() => run("share-png")}>
                分享 PNG
              </button>
              <button type="button" className="btn" disabled={!pages.length || Boolean(busy)} onClick={() => run("share-pdf")}>
                分享 PDF
              </button>
            </>
          ) : null}
        </div>
        <p className="hint">檔案在這台裝置上產生，不會上傳。{shareSupported ? "分享會開啟系統分享（LINE、郵件等）。" : "這個瀏覽器不支援系統分享，請下載後再傳。"}</p>
      </div>

      <h2 className="section-title">預覽（{pages.length} 頁）</h2>
      <div className="preview-pages" aria-label="匯出預覽">
        {images.map((src, i) => (
          <img key={i} src={src} alt={`預覽第 ${i + 1} 頁`} />
        ))}
      </div>
    </div>
  );
}
