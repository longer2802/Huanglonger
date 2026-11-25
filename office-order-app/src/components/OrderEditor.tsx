import { useCallback, useEffect, useRef, useState } from "react";
import { getOrder, putOrder } from "../lib/db";
import { orderTotals, money } from "../lib/pricing";
import type { Kind, Order } from "../lib/types";
import MenuEditor from "./MenuEditor";
import PeopleStep from "./PeopleStep";
import OrderingStep from "./OrderingStep";
import TotalsStep from "./TotalsStep";
import ExportStep from "./ExportStep";
import { useToast } from "./ui";

export const STEPS = [
  { key: "menu", label: "訂單與菜單" },
  { key: "people", label: "名單" },
  { key: "order", label: "點餐" },
  { key: "totals", label: "總計收款" },
  { key: "export", label: "匯出" },
] as const;
export type StepKey = (typeof STEPS)[number]["key"];

export type Update = (mutate: (o: Order) => void, opts?: { keepStatus?: boolean }) => void;

export interface StepProps {
  order: Order;
  update: Update;
  goStep: (s: StepKey) => void;
}

function hhmm(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function OrderEditor({ orderId, step, onStep, onHome }: { orderId: string; step: StepKey; onStep: (s: StepKey) => void; onHome: () => void }) {
  const toast = useToast();
  const [order, setOrder] = useState<Order | null | undefined>(undefined);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirty = useRef(false);
  const latest = useRef<Order | null>(null);

  useEffect(() => {
    getOrder(orderId)
      .then((o) => setOrder(o ?? null))
      .catch(() => setOrder(null));
  }, [orderId]);

  const update: Update = useCallback((mutate, opts) => {
    setOrder((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      mutate(next);
      next.updatedAt = Date.now();
      // 正式訂單被修改 → 回到草稿，提醒重新確認（收款狀態不算修改內容）
      if (next.status === "confirmed" && !opts?.keepStatus) next.status = "draft";
      dirty.current = true;
      return next;
    });
  }, []);

  // 自動存草稿：停止輸入 400ms 後寫入 IndexedDB；離開頁面前也會立刻寫入
  useEffect(() => {
    latest.current = order ?? null;
    if (!order || !dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      putOrder(order)
        .then(() => setSavedAt(Date.now()))
        .catch(() => toast("自動儲存失敗：裝置空間不足或瀏覽器封鎖了網站資料", "error"));
    }, 400);
    return () => clearTimeout(t);
  }, [order, toast]);

  useEffect(() => {
    const flush = () => {
      if (dirty.current && latest.current) {
        dirty.current = false;
        void putOrder(latest.current);
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", flush);
    return () => {
      flush();
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", flush);
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  if (order === undefined) return <p className="muted">讀取中…</p>;
  if (order === null)
    return (
      <div className="card stack">
        <p>找不到這張訂單（可能已刪除，或資料在另一個瀏覽器）。</p>
        <button type="button" className="btn" onClick={onHome}>
          回首頁
        </button>
      </div>
    );

  const totals = orderTotals(order);
  const idx = STEPS.findIndex((s) => s.key === step);
  const props: StepProps = { order, update, goStep: onStep };
  const next = STEPS[idx + 1];
  const prev = STEPS[idx - 1];

  return (
    <div>
      <header className="topbar">
        <button type="button" className="icon-btn" aria-label="回首頁" onClick={onHome}>
          ←
        </button>
        <div className="grow">
          <div className="row nowrap">
            <h1 style={{ fontSize: 19, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.title || "未命名訂單"}</h1>
            {order.sample ? <span className="chip sample">範例</span> : null}
            <span className={`chip ${order.status}`}>{order.status === "confirmed" ? "已確認" : "草稿"}</span>
          </div>
          <p className="save-state">
            {order.date}・{savedAt ? `草稿已自動儲存 ${hhmm(savedAt)}` : "自動儲存在這台裝置"}
          </p>
        </div>
      </header>

      <nav className="steps" aria-label="步驟">
        {STEPS.map((s, i) => (
          <button key={s.key} type="button" className="step" aria-current={s.key === step ? "step" : undefined} onClick={() => onStep(s.key)}>
            <span className="n">{i + 1}</span>
            {s.label}
          </button>
        ))}
      </nav>

      {order.status === "draft" && order.confirmedAt ? (
        <div className="banner warn" style={{ marginBottom: 12 }}>
          這張訂單確認後又修改過，請到「總計收款」重新預覽並確認。
        </div>
      ) : null}

      {step === "menu" && <MenuEditor {...props} />}
      {step === "people" && <PeopleStep {...props} />}
      {step === "order" && <OrderingStep {...props} />}
      {step === "totals" && <TotalsStep {...props} />}
      {step === "export" && <ExportStep {...props} />}

      <div className="bottom-bar">
        <div className="inner">
          {prev ? (
            <button type="button" className="btn" onClick={() => onStep(prev.key)}>
              ← {prev.label}
            </button>
          ) : null}
          <div className="grow small" style={{ textAlign: "center", lineHeight: 1.3 }}>
            <div>
              全單 <span className="money bold">{money(totals.total)}</span>
            </div>
            <div className="tiny muted">
              {order.people.length} 人・待填 {totals.pendingPeople.length}
            </div>
          </div>
          {next ? (
            <button type="button" className="btn primary" onClick={() => onStep(next.key)}>
              {next.label} →
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const kindsOf = (o: Order): Kind[] => (["meal", "drink"] as Kind[]).filter((k) => o[k].enabled);
