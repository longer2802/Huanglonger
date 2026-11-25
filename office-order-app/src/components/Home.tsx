import { useEffect, useRef, useState } from "react";
import { deleteOrder, deleteTemplate, exportBackup, importBackup, listOrders, listTemplates, putOrder } from "../lib/db";
import { newOrder, sampleOrder, todayISO } from "../lib/orders";
import { money, orderTotals } from "../lib/pricing";
import { KIND_LABEL, type Order, type VendorTemplate } from "../lib/types";
import { downloadFile } from "../lib/exportDoc";
import { useToast } from "./ui";
import type { StepKey } from "./OrderEditor";

export default function Home({ onOpen }: { onOpen: (id: string, step?: StepKey) => void }) {
  const toast = useToast();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [templates, setTemplates] = useState<VendorTemplate[]>([]);
  const [withPhotos, setWithPhotos] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const [o, t] = await Promise.all([listOrders(), listTemplates()]);
      setOrders(o);
      setTemplates(t);
    } catch {
      setOrders([]);
      toast("無法開啟本機資料庫（可能是無痕模式或已封鎖網站資料）", "error");
    }
  };
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const create = async (sample = false) => {
    const o = sample ? sampleOrder() : newOrder();
    await putOrder(o);
    onOpen(o.id, sample ? "order" : "menu");
  };

  const doExport = async () => {
    const blob = await exportBackup(withPhotos);
    downloadFile(new File([blob], `辦公室揪訂_備份_${todayISO()}.json`, { type: "application/json" }));
    toast("已匯出備份檔");
  };

  const doImport = async (file: File) => {
    try {
      const r = await importBackup(await file.text());
      toast(`已還原 ${r.orders} 張訂單、${r.templates} 個店家模板、${r.photos} 張菜單照片`);
      await load();
    } catch (e) {
      toast((e as Error).message || "匯入失敗", "error");
    }
  };

  return (
    <div className="stack">
      <header className="topbar">
        <div className="brand grow">
          <img src="./icon.svg" alt="" />
          <h1>辦公室揪訂</h1>
        </div>
      </header>

      <div className="card stack">
        <p className="hint">拍下菜單、輸入同事名單，自動產生點餐表，算好每人應收，再匯出給店家的訂單和內部收款單。</p>
        <div className="row">
          <button type="button" className="btn primary grow" onClick={() => create(false)}>
            ＋ 開新訂單
          </button>
          <button type="button" className="btn" onClick={() => create(true)}>
            載入範例
          </button>
        </div>
      </div>

      <h2 className="section-title">我的訂單</h2>
      {orders === null ? (
        <p className="muted small">讀取中…</p>
      ) : orders.length === 0 ? (
        <div className="card hint">還沒有訂單。按「開新訂單」開始，或先「載入範例」看看怎麼用。</div>
      ) : (
        orders.map((o) => {
          const t = orderTotals(o);
          const kinds = (["meal", "drink"] as const).filter((k) => o[k].enabled);
          return (
            <div key={o.id} className="card order-card" role="button" tabIndex={0} onClick={() => onOpen(o.id, o.status === "confirmed" ? "totals" : "order")} onKeyDown={(e) => e.key === "Enter" && onOpen(o.id)}>
              <div className="grow">
                <div className="row">
                  <span className="bold">{o.title || "未命名訂單"}</span>
                  {o.sample ? <span className="chip sample">範例</span> : null}
                  <span className={`chip ${o.status}`}>{o.status === "confirmed" ? "已確認" : "草稿"}</span>
                </div>
                <p className="small muted" style={{ marginTop: 4 }}>
                  {o.date}・{kinds.map((k) => `${KIND_LABEL[k]}：${o[k].vendorName || "未填店家"}`).join("・") || "未選餐飲"}
                </p>
                <p className="small" style={{ marginTop: 2 }}>
                  {o.people.length} 人・總額 <span className="money bold">{money(t.total)}</span>・待收 <span className="money">{money(t.unpaid)}</span>
                  {t.pendingPeople.length ? <span className="chip pending" style={{ marginLeft: 6 }}>{t.pendingPeople.length} 人待填</span> : null}
                </p>
              </div>
              <button
                type="button"
                className="icon-btn"
                aria-label={`刪除 ${o.title}`}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (!window.confirm(`刪除「${o.title}」？這張訂單和菜單照片會一起刪除，無法復原。`)) return;
                  await deleteOrder(o.id);
                  await load();
                }}
              >
                🗑
              </button>
            </div>
          );
        })
      )}

      {templates.length > 0 ? (
        <>
          <h2 className="section-title">店家模板</h2>
          <div className="card">
            {templates.map((t) => (
              <div key={t.id} className="spread" style={{ padding: "6px 0" }}>
                <span>
                  <span className="bold">{t.vendorName}</span>
                  <span className="muted small">
                    {" "}
                    ・{KIND_LABEL[t.kind]}・{t.menu.items.length} 項
                  </span>
                </span>
                <button
                  type="button"
                  className="btn sm danger"
                  onClick={async () => {
                    if (!window.confirm(`刪除模板「${t.vendorName}」？已建立的訂單不受影響。`)) return;
                    await deleteTemplate(t.id);
                    await load();
                  }}
                >
                  刪除
                </button>
              </div>
            ))}
            <p className="hint">在訂單的菜單步驟可以直接載入模板。修改模板不會改變歷史訂單的金額。</p>
          </div>
        </>
      ) : null}

      <h2 className="section-title">資料備份</h2>
      <div className="card stack">
        <p className="hint">
          所有菜單照片、名單、訂單和收款資料都只存在<strong>這台裝置的這個瀏覽器</strong>，不會上傳。清除網站資料、換手機或換瀏覽器前，請先匯出 JSON 備份；之後可以在這裡匯入還原。
        </p>
        <label className="check">
          <input type="checkbox" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
          備份包含菜單照片（檔案會比較大）
        </label>
        <div className="row">
          <button type="button" className="btn" onClick={doExport}>
            匯出 JSON 備份
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            匯入還原
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void doImport(f);
            }}
          />
        </div>
      </div>
      <p className="tiny muted" style={{ textAlign: "center", marginTop: 20 }}>
        免登入・免費・不連雲端｜菜單文字辨識在你的裝置上完成
      </p>
    </div>
  );
}
