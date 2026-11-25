import { useState } from "react";
import { activeKinds, vendorLabel } from "../lib/orders";
import { aggregateLines, displayName, money, orderTotals, personState, personTotals, STATE_LABEL, vendorTotal } from "../lib/pricing";
import { KIND_LABEL, type Order } from "../lib/types";
import type { StepKey, StepProps, Update } from "./OrderEditor";
import { Modal, useToast } from "./ui";

export function PendingPanel({ order, update, goStep, action }: { order: Order; update: Update; goStep: (s: StepKey) => void; action: string }) {
  const t = orderTotals(order);
  if (!t.pendingPeople.length) return null;
  return (
    <div className="banner warn stack" data-testid="pending-panel">
      <div className="bold">
        {action}前，還有 {t.pendingPeople.length} 人沒填：
      </div>
      {t.pendingPeople.map((p) => (
        <div key={p.id} className="spread">
          <span>{displayName(p)}</span>
          <button type="button" className="btn sm" onClick={() => update((o) => void (o.people.find((x) => x.id === p.id)!.skip = true))}>
            標記為不訂
          </button>
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => goStep("order")}>
        回去填寫
      </button>
    </div>
  );
}

export default function TotalsStep({ order, update, goStep }: StepProps) {
  const toast = useToast();
  const [preview, setPreview] = useState(false);
  const t = orderTotals(order);
  const kinds = activeKinds(order);

  return (
    <div className="stack">
      <div className="stats" aria-label="金額統計">
        {kinds.map((k) => (
          <div key={k} className="stat">
            <div className="k">
              {KIND_LABEL[k]}店家合計・{vendorLabel(order, k)}
            </div>
            <div className="v money" data-testid={`vendor-total-${k}`}>
              {money(vendorTotal(order, k))}
            </div>
          </div>
        ))}
        <div className="stat accent">
          <div className="k">全單總額</div>
          <div className="v money" data-testid="grand-total">
            {money(t.total)}
          </div>
        </div>
        <div className="stat ok">
          <div className="k">已收</div>
          <div className="v money" data-testid="paid-total">
            {money(t.paid)}
          </div>
        </div>
        <div className="stat bad">
          <div className="k">待收</div>
          <div className="v money" data-testid="unpaid-total">
            {money(t.unpaid)}
          </div>
        </div>
      </div>

      <PendingPanel order={order} update={update} goStep={goStep} action="確認訂單" />

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
        <table className="order-table" style={{ border: "none" }} aria-label="收款表">
          <thead>
            <tr>
              <th>姓名</th>
              {kinds.includes("meal") ? <th className="money">餐點</th> : null}
              {kinds.includes("drink") ? <th className="money">飲料</th> : null}
              <th className="money">應收</th>
              <th style={{ width: 92 }}>收款</th>
            </tr>
          </thead>
          <tbody>
            {order.people.map((p, i) => {
              const st = personState(p);
              const pt = personTotals(p);
              return (
                <tr key={p.id} className={st === "skip" ? "skip" : ""} data-testid="collect-row">
                  <td>
                    <div className="bold">{displayName(p)}</div>
                    {st !== "done" ? <span className={`chip ${st}`}>{STATE_LABEL[st]}</span> : null}
                  </td>
                  {kinds.includes("meal") ? <td className="money">{st === "skip" ? "—" : money(pt.meal)}</td> : null}
                  {kinds.includes("drink") ? <td className="money">{st === "skip" ? "—" : money(pt.drink)}</td> : null}
                  <td className="money bold">{st === "skip" ? "—" : money(pt.due)}</td>
                  <td>
                    {st === "skip" ? (
                      <span className="muted small">不訂</span>
                    ) : (
                      <label className="check small">
                        <input type="checkbox" aria-label={`${displayName(p)} 已收`} checked={p.paid} onChange={(e) => update((o) => void (o.people[i].paid = e.target.checked), { keepStatus: true })} />
                        {p.paid ? <span className="chip paid">已收</span> : <span className="chip unpaid">未收</span>}
                      </label>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card stack">
        {order.status === "confirmed" ? (
          <div className="banner ok">已確認並儲存為正式訂單{order.confirmedAt ? `（${new Date(order.confirmedAt).toLocaleString("zh-TW", { hour12: false })}）` : ""}。之後若修改內容，會回到草稿狀態。</div>
        ) : (
          <p className="hint">填完後先預覽核對，確認無誤再儲存為正式訂單。</p>
        )}
        <div className="row">
          <button type="button" className="btn grow" onClick={() => setPreview(true)}>
            預覽核對
          </button>
          <button type="button" className="btn primary grow" onClick={() => goStep("export")}>
            去匯出 →
          </button>
        </div>
      </div>

      {preview ? (
        <Modal
          wide
          title="預覽核對"
          onClose={() => setPreview(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setPreview(false)}>
                回去修改
              </button>
              <button
                type="button"
                className="btn ok"
                disabled={t.pendingPeople.length > 0 || t.orderingPeople.length === 0}
                onClick={() => {
                  update(
                    (o) => {
                      o.status = "confirmed";
                      o.confirmedAt = Date.now();
                    },
                    { keepStatus: true },
                  );
                  setPreview(false);
                  toast("已確認並儲存正式訂單");
                }}
              >
                確認並儲存正式訂單
              </button>
            </>
          }
        >
          <div className="stack">
            <PendingPanel order={order} update={update} goStep={(s) => (setPreview(false), goStep(s))} action="確認訂單" />
            {kinds.map((k) => {
              const rows = aggregateLines(order, k);
              return (
                <div key={k} className="card">
                  <div className="spread">
                    <h3 className="bold">
                      {KIND_LABEL[k]}・{vendorLabel(order, k)}
                    </h3>
                    <span className="money bold">{money(vendorTotal(order, k))}</span>
                  </div>
                  {rows.length ? (
                    rows.map((r) => (
                      <div key={r.key} className="spread small" style={{ padding: "4px 0", borderBottom: "1px solid #f0ebe3" }}>
                        <span>
                          {r.name}
                          {r.variant ? `（${r.variant}）` : ""} ×{r.qty}
                          {r.detail ? <div className="tiny muted">{r.detail}</div> : null}
                        </span>
                        <span className="money">{money(r.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="hint">沒有人點</p>
                  )}
                </div>
              );
            })}
            <div className="spread bold" style={{ fontSize: 18 }}>
              <span>全單總額</span>
              <span className="money">{money(t.total)}</span>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
