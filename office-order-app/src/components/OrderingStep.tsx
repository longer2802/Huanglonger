import { useState } from "react";
import { activeKinds, makeLine, menuProblems, orderableItems, usableAddons, vendorLabel } from "../lib/orders";
import { displayName, isValidPrice, lineDetail, lineLabel, lineTotal, money, personState, personTotals, STATE_LABEL, type PersonState } from "../lib/pricing";
import { ICE, KIND_LABEL, SWEETNESS, type Kind, type Order, type OrderLine, type Person } from "../lib/types";
import type { StepProps, Update } from "./OrderEditor";
import { QtyStepper, useMedia, useToast } from "./ui";

type Filter = "all" | PersonState;

export default function OrderingStep({ order, update, goStep }: StepProps) {
  const desktop = useMedia("(min-width: 900px)");
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const kinds = activeKinds(order);
  const counts = { all: order.people.length, pending: 0, done: 0, skip: 0 } as Record<Filter, number>;
  for (const p of order.people) counts[personState(p)]++;
  const people = order.people.filter((p) => filter === "all" || personState(p) === filter);

  if (!kinds.length) return <div className="banner warn">請先在「訂單與菜單」勾選要訂餐點或飲料。</div>;
  if (!order.people.length)
    return (
      <div className="card stack">
        <p>還沒有名單。</p>
        <button type="button" className="btn primary" onClick={() => goStep("people")}>
          去建立名單
        </button>
      </div>
    );

  const missingWarn = kinds.map((k) => ({ k, n: menuProblems(order[k].menu).missing.length })).filter((x) => x.n > 0);

  return (
    <div className="stack">
      {kinds.some((k) => orderableItems(order[k].menu).length === 0) ? (
        <div className="banner warn">
          {kinds
            .filter((k) => orderableItems(order[k].menu).length === 0)
            .map((k) => KIND_LABEL[k])
            .join("、")}
          菜單還沒有可點的品項，請先到「訂單與菜單」建立並填好價格。
        </div>
      ) : null}
      {missingWarn.length ? <div className="banner bad small">{missingWarn.map((x) => `${KIND_LABEL[x.k]}有 ${x.n} 項缺價`).join("、")}，補價前不會出現在點餐選項。</div> : null}

      <div className="row" role="group" aria-label="篩選狀態">
        {(["all", "pending", "done", "skip"] as Filter[]).map((f) => (
          <button key={f} type="button" className="opt" style={{ minHeight: 36, padding: "4px 12px" }} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === "all" ? "全部" : STATE_LABEL[f]} {counts[f]}
          </button>
        ))}
      </div>

      {desktop ? (
        <table className="order-table" aria-label="點餐表">
          <thead>
            <tr>
              <th style={{ width: 150 }}>姓名</th>
              <th style={{ width: 80 }}>狀態</th>
              {kinds.includes("meal") ? <th>餐點（{vendorLabel(order, "meal")}）</th> : null}
              {kinds.includes("drink") ? <th>飲料（{vendorLabel(order, "drink")}）</th> : null}
              <th className="money" style={{ width: 90 }}>
                應收
              </th>
              <th style={{ width: 90 }} />
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const st = personState(p);
              const isOpen = open === p.id;
              return [
                <tr key={p.id} className={st === "skip" ? "skip" : ""} data-testid="person-row">
                  <td className="bold">
                    #{order.people.indexOf(p) + 1} {displayName(p)}
                  </td>
                  <td>
                    <span className={`chip ${st}`}>{STATE_LABEL[st]}</span>
                  </td>
                  {kinds.map((k) => (
                    <td key={k}>
                      <LineSummary person={p} kind={k} />
                    </td>
                  ))}
                  <td className="money bold">{st === "skip" ? "—" : money(personTotals(p).due)}</td>
                  <td>
                    <button type="button" className="btn sm" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                      {isOpen ? "收合" : "編輯"}
                    </button>
                  </td>
                </tr>,
                isOpen ? (
                  <tr key={`${p.id}-edit`}>
                    <td colSpan={kinds.length + 4} style={{ background: "#fffcf8" }}>
                      <PersonEditor order={order} person={p} update={update} />
                    </td>
                  </tr>
                ) : null,
              ];
            })}
          </tbody>
        </table>
      ) : (
        <div aria-label="點餐表">
          {people.map((p) => {
            const st = personState(p);
            const t = personTotals(p);
            const isOpen = open === p.id;
            return (
              <div key={p.id} className="person" data-testid="person-card">
                <button type="button" className="person-sum" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : p.id)}>
                  <span className="name">
                    #{order.people.indexOf(p) + 1} {displayName(p)} <span className={`chip ${st}`}>{STATE_LABEL[st]}</span>
                  </span>
                  <span className="money bold" style={{ fontSize: 17 }}>
                    {st === "skip" ? "—" : money(t.due)}
                  </span>
                  <span className="desc">
                    {st === "skip"
                      ? "這次不訂"
                      : st === "pending"
                        ? "點一下開始填寫"
                        : kinds
                            .map((k) => {
                              const ls = p.lines.filter((l) => l.kind === k);
                              return `${k === "meal" ? "🍱" : "🧋"} ${ls.length ? ls.map((l) => `${lineLabel(l)}×${l.qty}`).join("、") : "—"}`;
                            })
                            .join("　")}
                  </span>
                </button>
                {isOpen ? (
                  <div className="person-edit">
                    <PersonEditor order={order} person={p} update={update} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      {counts.pending === 0 && order.people.length ? (
        <button type="button" className="btn primary block" onClick={() => goStep("totals")}>
          大家都填好了，看總計 →
        </button>
      ) : (
        <p className="hint" style={{ textAlign: "center" }}>
          還有 {counts.pending} 人待填。不訂的人請打開後勾選「這次不訂」。
        </p>
      )}
    </div>
  );
}

function LineSummary({ person, kind }: { person: Person; kind: Kind }) {
  if (person.skip) return <span className="muted">不訂</span>;
  const ls = person.lines.filter((l) => l.kind === kind);
  if (!ls.length) return <span className="muted">—</span>;
  return (
    <ul className="line-list">
      {ls.map((l) => (
        <li key={l.id}>
          {lineLabel(l)} ×{l.qty} <span className="money muted small">{money(lineTotal(l))}</span>
          {lineDetail(l) ? <div className="tiny muted">{lineDetail(l)}</div> : null}
        </li>
      ))}
    </ul>
  );
}

function PersonEditor({ order, person, update }: { order: Order; person: Person; update: Update }) {
  const [adding, setAdding] = useState<{ kind: Kind; edit?: OrderLine } | null>(null);
  const idx = order.people.findIndex((p) => p.id === person.id);
  const kinds = activeKinds(order);
  const t = personTotals(person);
  const setPerson = (fn: (p: Person) => void, keepStatus = false) => update((o) => fn(o.people[idx]), { keepStatus });

  return (
    <div className="stack">
      <label className="check">
        <input type="checkbox" checked={person.skip} onChange={(e) => setPerson((p) => void (p.skip = e.target.checked))} />
        這次不訂
      </label>
      {person.skip ? (
        person.lines.length ? (
          <p className="hint">已標記不訂，原本點的 {person.lines.length} 項不會計入金額和出單。</p>
        ) : null
      ) : (
        <>
          {kinds.map((k) => {
            const ls = person.lines.filter((l) => l.kind === k);
            return (
              <div key={k}>
                <div className="spread">
                  <h4 className="bold small">
                    {k === "meal" ? "🍱" : "🧋"} {KIND_LABEL[k]}
                    <span className="muted"> 小計 {money(k === "meal" ? t.meal : t.drink)}</span>
                  </h4>
                  <button type="button" className="btn sm" onClick={() => setAdding({ kind: k })}>
                    ＋ 加{KIND_LABEL[k]}
                  </button>
                </div>
                {ls.map((l) => (
                  <div key={l.id} className="line-row">
                    <div className="grow">
                      <div className="bold">{lineLabel(l)}</div>
                      <div className="tiny muted">
                        單價 {money(l.snapshot.unitPrice)}
                        {l.addons.length ? ` ＋加料 ${money(l.addons.reduce((s, a) => s + a.price, 0))}` : ""}
                        {lineDetail(l) ? `・${lineDetail(l)}` : ""}
                      </div>
                    </div>
                    <QtyStepper label={lineLabel(l)} value={l.qty} onChange={(q) => setPerson((p) => void (p.lines.find((x) => x.id === l.id)!.qty = q))} />
                    <span className="money bold" style={{ minWidth: 56, textAlign: "right", paddingTop: 10 }}>
                      {money(lineTotal(l))}
                    </span>
                    <button type="button" className="icon-btn" aria-label={`修改${lineLabel(l)}`} onClick={() => setAdding({ kind: k, edit: l })}>
                      ✎
                    </button>
                    <button type="button" className="icon-btn" aria-label={`刪除${lineLabel(l)}`} onClick={() => setPerson((p) => void (p.lines = p.lines.filter((x) => x.id !== l.id)))}>
                      🗑
                    </button>
                  </div>
                ))}
                {adding && adding.kind === k ? (
                  <LineForm
                    key={adding.edit?.id ?? "new"}
                    kind={k}
                    order={order}
                    initial={adding.edit}
                    onCancel={() => setAdding(null)}
                    onSave={(line) => {
                      setPerson((p) => {
                        const i = p.lines.findIndex((x) => x.id === line.id);
                        if (i >= 0) p.lines[i] = line;
                        else p.lines.push(line);
                      });
                      setAdding(null);
                    }}
                  />
                ) : null}
              </div>
            );
          })}
          <div className="spread">
            <span className="bold">應收</span>
            <span className="money bold" style={{ fontSize: 20, color: "var(--accent)" }}>
              {money(t.due)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function LineForm({ kind, order, initial, onSave, onCancel }: { kind: Kind; order: Order; initial?: OrderLine; onSave: (l: OrderLine) => void; onCancel: () => void }) {
  const toast = useToast();
  const menu = order[kind].menu;
  const items = orderableItems(menu);
  const addons = usableAddons(menu);
  const [itemId, setItemId] = useState(initial?.itemId && items.some((i) => i.id === initial.itemId) ? initial.itemId : "");
  const item = items.find((i) => i.id === itemId);
  const [variantId, setVariantId] = useState(initial?.variantId ?? "");
  const [qty, setQty] = useState(initial?.qty ?? 1);
  const [sweetness, setSweetness] = useState(initial?.sweetness ?? "");
  const [ice, setIce] = useState(initial?.ice ?? "");
  const [addonIds, setAddonIds] = useState<string[]>(initial?.addons.map((a) => a.id) ?? []);
  const [note, setNote] = useState(initial?.note ?? "");

  const variant = item?.variants.find((v) => v.id === variantId && isValidPrice(v.price)) ?? item?.variants.find((v) => isValidPrice(v.price));
  const chosenAddons = addons.filter((a) => addonIds.includes(a.id));
  const unit = (variant?.price ?? 0) + chosenAddons.reduce((s, a) => s + (a.price as number), 0);
  const categories = [...new Set(items.map((i) => i.category || "未分類"))];

  const save = () => {
    if (!item || !variant) return toast("請先選品項", "error");
    try {
      const line = makeLine(kind, item, variant.id, {
        qty,
        sweetness: kind === "drink" ? sweetness : "",
        ice: kind === "drink" ? ice : "",
        addons: chosenAddons.map((a) => ({ id: a.id, name: a.name.trim(), price: a.price as number })),
        note: note.trim().slice(0, 60),
      });
      // 修改時沿用原本的明細 ID
      if (initial) line.id = initial.id;
      // 修改既有明細但沒換品項／規格時，保留當初的價格快照（模板改價不影響已點的金額）
      if (initial && initial.itemId === item.id && initial.variantId === variant.id) line.snapshot = initial.snapshot;
      onSave(line);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (!items.length) return <div className="banner warn small">{KIND_LABEL[kind]}菜單還沒有可點的品項（可能都缺價）。</div>;

  return (
    <div className="card stack" style={{ marginTop: 8, borderColor: "#fdba74" }} aria-label={`${initial ? "修改" : "新增"}${KIND_LABEL[kind]}`}>
      {categories.map((c) => (
        <div key={c}>
          {categories.length > 1 ? <div className="tiny muted bold" style={{ margin: "4px 0" }}>{c}</div> : null}
          <div className="opt-grid">
            {items
              .filter((i) => (i.category || "未分類") === c)
              .map((i) => {
                const prices = i.variants.filter((v) => isValidPrice(v.price)).map((v) => v.price as number);
                return (
                  <button key={i.id} type="button" className="opt" aria-pressed={itemId === i.id} onClick={() => (setItemId(i.id), setVariantId(""))}>
                    {i.name}
                    <div className="tiny muted">{prices.length > 1 ? `${money(Math.min(...prices))}起` : money(prices[0])}</div>
                  </button>
                );
              })}
          </div>
        </div>
      ))}
      {item && item.variants.length > 1 ? (
        <div>
          <div className="tiny muted bold" style={{ marginBottom: 4 }}>
            規格
          </div>
          <div className="opt-grid">
            {item.variants.map((v) => (
              <button key={v.id} type="button" className="opt" disabled={!isValidPrice(v.price)} aria-pressed={variant?.id === v.id} onClick={() => setVariantId(v.id)}>
                {v.label || "標準"} {isValidPrice(v.price) ? money(v.price) : "（缺價）"}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {kind === "drink" ? (
        <div className="row nowrap">
          <label className="field grow">
            <span>甜度</span>
            <select value={sweetness} onChange={(e) => setSweetness(e.target.value)}>
              {SWEETNESS.map((s) => (
                <option key={s} value={s}>
                  {s || "不指定"}
                </option>
              ))}
            </select>
          </label>
          <label className="field grow">
            <span>冰量</span>
            <select value={ice} onChange={(e) => setIce(e.target.value)}>
              {ICE.map((s) => (
                <option key={s} value={s}>
                  {s || "不指定"}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      {addons.length ? (
        <div>
          <div className="tiny muted bold" style={{ marginBottom: 4 }}>
            加料（每份加價）
          </div>
          <div className="opt-grid">
            {addons.map((a) => (
              <button key={a.id} type="button" className="opt" aria-pressed={addonIds.includes(a.id)} onClick={() => setAddonIds((xs) => (xs.includes(a.id) ? xs.filter((x) => x !== a.id) : [...xs, a.id]))}>
                {a.name} +{money(a.price as number)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <label className="field">
        <span>{kind === "meal" ? "客製備註（不影響價格）" : "備註（不影響價格）"}</span>
        <input type="text" value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} placeholder={kind === "meal" ? "例如 不要辣、飯少" : "例如 分開裝"} />
      </label>
      <div className="spread">
        <QtyStepper label="份數" value={qty} onChange={setQty} />
        <span className="small">
          ({money(variant?.price ?? 0)}
          {chosenAddons.length ? ` + ${money(unit - (variant?.price ?? 0))}` : ""}) × {qty} = <span className="money bold">{money(unit * qty)}</span>
        </span>
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={onCancel}>
          取消
        </button>
        <button type="button" className="btn primary grow" disabled={!item} onClick={save}>
          {initial ? "儲存修改" : "加入"}
        </button>
      </div>
    </div>
  );
}
