import { useEffect, useState } from "react";
import { deletePhoto, getPhoto, listTemplates, putPhoto, putTemplate } from "../lib/db";
import { uid } from "../lib/id";
import { FLAG, parseMenuText } from "../lib/menuParser";
import { cloneMenu, menuProblems, newItem } from "../lib/orders";
import { isValidPrice } from "../lib/pricing";
import { KIND_LABEL, type Kind, type Menu, type MenuItem, type StoredPhoto, type VendorTemplate } from "../lib/types";
import type { StepProps } from "./OrderEditor";
import { Modal, PriceInput, useObjectUrl, useToast } from "./ui";

export default function MenuEditor({ order, update, goStep }: StepProps) {
  const noneEnabled = !order.meal.enabled && !order.drink.enabled;
  return (
    <div className="stack">
      <div className="card stack">
        <h2 className="bold">基本資料</h2>
        <div className="row">
          <label className="field grow" style={{ minWidth: 180 }}>
            <span>訂單名稱</span>
            <input type="text" value={order.title} maxLength={30} onChange={(e) => update((o) => void (o.title = e.target.value))} placeholder="例如 午餐、週五下午茶" />
          </label>
          <label className="field" style={{ width: 170 }}>
            <span>日期</span>
            <input type="date" value={order.date} onChange={(e) => update((o) => void (o.date = e.target.value))} />
          </label>
        </div>
        <div className="row">
          {(["meal", "drink"] as Kind[]).map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={order[k].enabled} onChange={(e) => update((o) => void (o[k].enabled = e.target.checked))} />
              訂{KIND_LABEL[k]}
            </label>
          ))}
        </div>
        {noneEnabled ? <div className="banner warn">請至少勾選「訂餐點」或「訂飲料」其中一項。</div> : null}
      </div>

      {(["meal", "drink"] as Kind[]).map((k) => (order[k].enabled ? <VendorPanel key={k} kind={k} order={order} update={update} goStep={goStep} /> : null))}

      {!noneEnabled ? (
        <button type="button" className="btn primary block" onClick={() => goStep("people")}>
          菜單好了，下一步：建立名單 →
        </button>
      ) : null}
    </div>
  );
}

interface Candidate {
  menu: Menu;
  skipped: string[];
  rawText: string;
  photoIds: string[];
}

function VendorPanel({ kind, order, update }: StepProps & { kind: Kind }) {
  const toast = useToast();
  const section = order[kind];
  const [templates, setTemplates] = useState<VendorTemplate[]>([]);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [ocr, setOcr] = useState<{ stage: string; progress: number; index: number; total: number } | null>(null);
  const [ocrError, setOcrError] = useState("");
  const [showMenu, setShowMenu] = useState(true);
  const label = KIND_LABEL[kind];

  useEffect(() => {
    listTemplates()
      .then((ts) => setTemplates(ts.filter((t) => t.kind === kind)))
      .catch(() => {});
  }, [kind]);

  const setMenu = (fn: (m: Menu) => void) => update((o) => fn(o[kind].menu));
  const problems = menuProblems(section.menu);

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: string[] = [];
    for (const f of Array.from(files)) {
      if (!/^image\/(jpeg|png|jpg)$/i.test(f.type) && !/\.(jpe?g|png)$/i.test(f.name)) {
        toast(`「${f.name}」不是 JPG／PNG，已略過`, "error");
        continue;
      }
      const p: StoredPhoto = { id: uid("ph"), orderId: order.id, kind, name: f.name || "菜單.jpg", blob: f };
      await putPhoto(p);
      added.push(p.id);
    }
    if (added.length) {
      update((o) => void (o[kind].photoIds = [...o[kind].photoIds, ...added]));
      toast(`已加入 ${added.length} 張${label}菜單照片，按「辨識」轉成品項`);
    }
  };

  const runOcr = async (photoIds: string[]) => {
    setOcrError("");
    setOcr({ stage: "載入辨識工具", progress: 0, index: 0, total: photoIds.length });
    try {
      const { recognizeImage } = await import("../lib/ocr");
      const texts: string[] = [];
      for (let i = 0; i < photoIds.length; i++) {
        const photo = await getPhoto(photoIds[i]);
        if (!photo) continue;
        const text = await recognizeImage(photo.blob, (p) => setOcr({ stage: p.stage, progress: p.progress, index: i, total: photoIds.length }));
        texts.push(text);
      }
      const rawText = texts.join("\n");
      const parsed = parseMenuText(rawText, kind);
      if (!parsed.items.length && !parsed.addons.length) {
        setOcrError("照片裡沒有辨識出品項。可以換一張更清楚、正面拍攝的照片，或改用「貼上文字」「手動新增」。");
      }
      setCandidate({ menu: { items: parsed.items, addons: parsed.addons }, skipped: parsed.skipped, rawText, photoIds });
    } catch (e) {
      console.error(e);
      setOcrError(`辨識失敗：${(e as Error)?.message || "未知錯誤"}。可以重試，或改用「貼上文字」「手動新增」。`);
    } finally {
      setOcr(null);
    }
  };

  const applyCandidate = (mode: "append" | "replace") => {
    if (!candidate) return;
    const keep = candidate.menu.items.filter((it) => it.name.trim() || it.variants.some((v) => v.price !== null));
    update((o) => {
      const m = o[kind].menu;
      if (mode === "replace") o[kind].menu = { items: keep, addons: candidate.menu.addons };
      else o[kind].menu = { items: [...m.items, ...keep], addons: [...m.addons, ...candidate.menu.addons] };
    });
    setCandidate(null);
    const missing = keep.filter((it) => it.variants.some((v) => !isValidPrice(v.price))).length;
    toast(`已套用 ${keep.length} 個品項${missing ? `，其中 ${missing} 項缺價，補價前不能點` : ""}`);
  };

  const saveTemplate = async () => {
    if (!section.vendorName.trim()) return toast("請先填店家名稱", "error");
    if (!section.menu.items.length) return toast("菜單是空的", "error");
    if (problems.missing.length || problems.addonMissing.length) return toast(`還有 ${problems.missing.length + problems.addonMissing.length} 項缺價或缺品名，請補齊或刪除後再存成模板`, "error");
    const existing = templates.find((t) => t.vendorName === section.vendorName.trim());
    const t: VendorTemplate = { id: existing?.id ?? uid("t"), kind, vendorName: section.vendorName.trim(), menu: cloneMenu(section.menu), savedAt: Date.now() };
    await putTemplate(t);
    setTemplates((ts) => [t, ...ts.filter((x) => x.id !== t.id)]);
    toast(existing ? `已更新模板「${t.vendorName}」` : `已存成模板「${t.vendorName}」，下次可直接載入`);
  };

  const loadTemplate = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if (section.menu.items.length && !window.confirm(`載入「${t.vendorName}」會取代目前的${label}菜單，確定嗎？（已點的明細金額不受影響）`)) return;
    update((o) => {
      o[kind].vendorName = t.vendorName;
      o[kind].menu = cloneMenu(t.menu);
    });
    toast(`已載入「${t.vendorName}」模板`);
  };

  return (
    <section className="card stack" aria-label={`${label}菜單`}>
      <div className="spread">
        <h2 className="bold">
          {kind === "meal" ? "🍱" : "🧋"} {label}
        </h2>
        <span className="small muted">
          {section.menu.items.length} 項{problems.missing.length ? <span className="chip missing" style={{ marginLeft: 6 }}>{problems.missing.length} 項缺價</span> : null}
          {problems.flagged.length ? <span className="chip flag" style={{ marginLeft: 6 }}>{problems.flagged.length} 項待確認</span> : null}
        </span>
      </div>
      <label className="field">
        <span>{label}店家</span>
        <input type="text" value={section.vendorName} maxLength={30} onChange={(e) => update((o) => void (o[kind].vendorName = e.target.value))} placeholder={kind === "meal" ? "例如 好吃便當" : "例如 茶飲店"} />
      </label>

      {templates.length ? (
        <label className="field">
          <span>載入店家模板</span>
          <select value="" onChange={(e) => e.target.value && loadTemplate(e.target.value)} aria-label={`載入${label}店家模板`}>
            <option value="">選擇已存的店家…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.vendorName}（{t.menu.items.length} 項）
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="row">
        <label className="btn file-btn">
          📷 拍照
          <input type="file" accept="image/jpeg,image/png" capture="environment" aria-label={`拍${label}菜單`} onChange={(e) => (addPhotos(e.target.files), (e.target.value = ""))} />
        </label>
        <label className="btn file-btn">
          🖼 上傳照片
          <input type="file" accept="image/jpeg,image/png" multiple aria-label={`上傳${label}菜單照片`} onChange={(e) => (addPhotos(e.target.files), (e.target.value = ""))} />
        </label>
        <button type="button" className="btn" onClick={() => setPasteOpen(true)}>
          📋 貼上文字
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setMenu((m) => m.items.push(newItem(m.items[m.items.length - 1]?.category ?? "")));
            setShowMenu(true);
          }}
        >
          ＋ 手動新增品項
        </button>
      </div>

      {section.photoIds.length ? (
        <div className="stack">
          <div className="photo-strip">
            {section.photoIds.map((id) => (
              <PhotoThumb
                key={id}
                id={id}
                disabled={Boolean(ocr)}
                onOcr={() => runOcr([id])}
                onRemove={async () => {
                  await deletePhoto(id);
                  update((o) => void (o[kind].photoIds = o[kind].photoIds.filter((x) => x !== id)));
                }}
              />
            ))}
          </div>
          {section.photoIds.length > 1 ? (
            <button type="button" className="btn sm" disabled={Boolean(ocr)} onClick={() => runOcr(section.photoIds)}>
              全部照片一起辨識
            </button>
          ) : null}
        </div>
      ) : null}

      {ocr ? (
        <div className="stack" role="status" aria-live="polite">
          <div className="small">
            辨識中（第 {ocr.index + 1}／{ocr.total} 張）：{ocr.stage} {Math.round(ocr.progress * 100)}%
          </div>
          <div className="progress">
            <div style={{ width: `${Math.round(((ocr.index + ocr.progress) / ocr.total) * 100)}%` }} />
          </div>
          <p className="hint">第一次辨識需要下載約 5 MB 的辨識資料，之後會快很多。辨識全部在這台裝置上進行。</p>
        </div>
      ) : null}
      {ocrError ? <div className="banner bad">{ocrError}</div> : null}

      {section.menu.items.length || section.menu.addons.length ? (
        <div className="stack">
          <div className="spread">
            <h3 className="bold">目前菜單</h3>
            <button type="button" className="btn sm" onClick={() => setShowMenu((v) => !v)}>
              {showMenu ? "收合" : "展開編輯"}
            </button>
          </div>
          {problems.missing.length ? <div className="banner bad">有 {problems.missing.length} 項缺價（紅框）：缺價品項不能點餐也不會出單，請補上價格或刪除。0 元請直接輸入 0。</div> : null}
          {showMenu ? <MenuItemsEditor menu={section.menu} kind={kind} onChange={(fn) => setMenu(fn)} /> : null}
          <button type="button" className="btn sm" onClick={saveTemplate}>
            💾 存成店家模板
          </button>
        </div>
      ) : (
        <p className="hint">還沒有品項。可以拍照或上傳菜單照片辨識、貼上菜單文字，或手動新增；也可以完全手動建立整份菜單。</p>
      )}

      {pasteOpen ? (
        <PasteModal
          kind={kind}
          onClose={() => setPasteOpen(false)}
          onParse={(text) => {
            const parsed = parseMenuText(text, kind);
            setPasteOpen(false);
            if (!parsed.items.length && !parsed.addons.length) return toast("沒有讀到品項，請確認每行有品名和價格", "error");
            setCandidate({ menu: { items: parsed.items, addons: parsed.addons }, skipped: parsed.skipped, rawText: text, photoIds: [] });
          }}
        />
      ) : null}

      {candidate ? <ProofreadModal kind={kind} candidate={candidate} setCandidate={setCandidate} onApply={applyCandidate} hasMenu={section.menu.items.length > 0} /> : null}
    </section>
  );
}

function PhotoThumb({ id, onOcr, onRemove, disabled }: { id: string; onOcr: () => void; onRemove: () => void; disabled: boolean }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    getPhoto(id).then((p) => setBlob(p?.blob ?? null));
  }, [id]);
  const url = useObjectUrl(blob);
  return (
    <div className="thumb">
      {url ? <img src={url} alt="菜單照片" /> : <div style={{ width: 92, height: 92 }} />}
      <button type="button" className="x" aria-label="刪除照片" onClick={onRemove}>
        ✕
      </button>
      <button type="button" className="btn sm ocr" disabled={disabled} onClick={onOcr}>
        辨識
      </button>
    </div>
  );
}

function PasteModal({ kind, onClose, onParse }: { kind: Kind; onClose: () => void; onParse: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <Modal
      title={`貼上${KIND_LABEL[kind]}菜單文字`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            取消
          </button>
          <button type="button" className="btn primary" disabled={!text.trim()} onClick={() => onParse(text)}>
            轉成品項
          </button>
        </>
      }
    >
      <p className="hint">一行一個品項，品名後面接價格。大小杯可以寫「紅茶 中30 大35」或「紅茶 M30 L35」；分類可以寫成【便當類】。</p>
      <textarea
        aria-label="菜單文字"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={kind === "meal" ? "【便當類】\n雞腿便當 110\n排骨便當 95" : "中杯 大杯\n紅茶 30 35\n珍珠奶茶 50 60\n【加料】\n珍珠 10"}
        style={{ marginTop: 8, minHeight: 200 }}
      />
    </Modal>
  );
}

function ProofreadModal({ kind, candidate, setCandidate, onApply, hasMenu }: { kind: Kind; candidate: Candidate; setCandidate: (c: Candidate | null) => void; onApply: (mode: "append" | "replace") => void; hasMenu: boolean }) {
  const [view, setView] = useState<"orig" | "table">("table");
  const [photoIdx, setPhotoIdx] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const photoId = candidate.photoIds[photoIdx];
  useEffect(() => {
    if (!photoId) return;
    getPhoto(photoId).then((p) => setBlob(p?.blob ?? null));
  }, [photoId]);
  const url = useObjectUrl(blob);
  const hasPhoto = candidate.photoIds.length > 0;
  const missing = candidate.menu.items.filter((it) => it.variants.some((v) => !isValidPrice(v.price))).length;
  const flagged = candidate.menu.items.filter((it) => it.flags.some((f) => f !== FLAG.missing)).length;

  return (
    <Modal
      wide
      title={`校對${KIND_LABEL[kind]}候選清單`}
      onClose={() => setCandidate(null)}
      footer={
        <>
          <button type="button" className="btn" onClick={() => setCandidate(null)}>
            取消
          </button>
          {hasMenu ? (
            <button type="button" className="btn" onClick={() => onApply("replace")}>
              取代整份菜單
            </button>
          ) : null}
          <button type="button" className="btn primary" onClick={() => onApply("append")}>
            {hasMenu ? "加入菜單" : "套用到菜單"}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="banner info">
          共 {candidate.menu.items.length} 個候選品項{candidate.menu.addons.length ? `、${candidate.menu.addons.length} 個加料` : ""}。
          {flagged ? ` ${flagged} 項標「待確認」，請對照原圖。` : ""}
          {missing ? ` ${missing} 項缺價，補價前不能點餐。` : ""}
        </div>
        {hasPhoto ? (
          <div className="seg only-mobile" role="group" aria-label="切換檢視">
            <button type="button" aria-pressed={view === "orig"} onClick={() => setView("orig")}>
              原圖
            </button>
            <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
              校對表
            </button>
          </div>
        ) : null}
        <div className={`proof ${hasPhoto ? "split" : ""}`}>
          {hasPhoto ? (
            <div className={`orig ${view === "orig" ? "" : "hide-mobile"}`}>
              {candidate.photoIds.length > 1 ? (
                <div className="row" style={{ marginBottom: 6 }}>
                  {candidate.photoIds.map((id, i) => (
                    <button key={id} type="button" className="btn sm" aria-pressed={i === photoIdx} onClick={() => setPhotoIdx(i)}>
                      第 {i + 1} 張
                    </button>
                  ))}
                </div>
              ) : null}
              {url ? <img src={url} alt="菜單原圖" /> : null}
            </div>
          ) : null}
          <div className={view === "table" || !hasPhoto ? "" : "hide-mobile"}>
            <MenuItemsEditor menu={candidate.menu} kind={kind} onChange={(fn) => {
              const next = structuredClone(candidate.menu);
              fn(next);
              setCandidate({ ...candidate, menu: next });
            }} />
            <button type="button" className="btn sm ghost" style={{ marginTop: 8 }} onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? "隱藏" : "查看"}辨識原文
            </button>
            {showRaw ? <pre className="small" style={{ whiteSpace: "pre-wrap", background: "#fff", padding: 10, borderRadius: 10, border: "1px solid var(--line)" }}>{candidate.rawText}</pre> : null}
            {candidate.skipped.length ? <p className="hint">略過的行（電話、地址等）：{candidate.skipped.join("／")}</p> : null}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function MenuItemsEditor({ menu, kind, onChange }: { menu: Menu; kind: Kind; onChange: (fn: (m: Menu) => void) => void }) {
  const edit = (id: string, fn: (it: MenuItem) => void) =>
    onChange((m) => {
      const it = m.items.find((x) => x.id === id);
      if (it) fn(it);
    });
  return (
    <div className="stack">
      <div className="items">
        {menu.items.map((it, idx) => {
          const missing = !it.name.trim() || it.variants.length === 0 || it.variants.some((v) => !isValidPrice(v.price));
          const otherFlags = it.flags.filter((f) => f !== FLAG.missing);
          return (
            <div key={it.id} className={`item ${missing ? "missing" : otherFlags.length ? "flagged" : ""}`} data-testid="menu-item">
              <div className="item-grid">
                <input type="text" aria-label={`第${idx + 1}項分類`} placeholder="分類" value={it.category} onChange={(e) => edit(it.id, (x) => void (x.category = e.target.value))} />
                <div className="row nowrap">
                  <input type="text" aria-label={`第${idx + 1}項品名`} placeholder="品名" value={it.name} onChange={(e) => edit(it.id, (x) => void (x.name = e.target.value))} />
                  <button type="button" className="icon-btn" aria-label={`刪除${it.name || "品項"}`} onClick={() => onChange((m) => void (m.items = m.items.filter((x) => x.id !== it.id)))}>
                    🗑
                  </button>
                </div>
              </div>
              {it.variants.map((v, vi) => (
                <div key={v.id} className="variant">
                  <input
                    type="text"
                    aria-label={`${it.name || "品項"}規格${vi + 1}`}
                    placeholder={it.variants.length > 1 ? "規格（如大杯）" : "規格（可空白）"}
                    value={v.label}
                    onChange={(e) => edit(it.id, (x) => void (x.variants[vi].label = e.target.value))}
                  />
                  <PriceInput
                    label={`${it.name || "品項"}${v.label}單價`}
                    value={v.price}
                    onChange={(p) =>
                      edit(it.id, (x) => {
                        x.variants[vi].price = p;
                        if (x.variants.every((vv) => isValidPrice(vv.price))) x.flags = x.flags.filter((f) => f !== FLAG.missing);
                      })
                    }
                  />
                  <button type="button" className="icon-btn" aria-label="刪除這個規格" disabled={it.variants.length <= 1} onClick={() => edit(it.id, (x) => void (x.variants = x.variants.filter((_, j) => j !== vi)))}>
                    −
                  </button>
                </div>
              ))}
              <div className="row" style={{ marginTop: 6 }}>
                <button type="button" className="btn sm ghost" onClick={() => edit(it.id, (x) => void x.variants.push({ id: uid("v"), label: kind === "drink" ? "大杯" : "", price: null }))}>
                  ＋規格
                </button>
                {missing ? <span className="chip missing">缺價</span> : null}
                {otherFlags.map((f) => (
                  <span key={f} className="chip flag">
                    待確認：{f}
                  </span>
                ))}
                {otherFlags.length ? (
                  <button type="button" className="btn sm" onClick={() => edit(it.id, (x) => void (x.flags = x.flags.filter((f) => f === FLAG.missing)))}>
                    ✓ 已核對
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn sm" onClick={() => onChange((m) => void m.items.push(newItem(m.items[m.items.length - 1]?.category ?? "")))}>
        ＋ 新增品項
      </button>

      <div className="stack" style={{ marginTop: 8 }}>
        <div className="spread">
          <h4 className="bold small">加料／加價選項{kind === "drink" ? "（珍珠、椰果…）" : "（加飯、加蛋…）"}</h4>
          <button type="button" className="btn sm" onClick={() => onChange((m) => void m.addons.push({ id: uid("a"), name: "", price: null }))}>
            ＋ 加料
          </button>
        </div>
        {menu.addons.length === 0 ? <p className="hint">會影響價格的配料要在這裡設定金額，點餐時才能選。</p> : null}
        {menu.addons.map((a, i) => (
          <div key={a.id} className="variant" style={{ gridTemplateColumns: "1fr 96px 36px" }}>
            <input
              type="text"
              aria-label={`加料${i + 1}名稱`}
              placeholder="加料名稱"
              value={a.name}
              onChange={(e) => onChange((m) => void (m.addons[i].name = e.target.value))}
            />
            <PriceInput label={`${a.name || "加料"}加價`} value={a.price} onChange={(p) => onChange((m) => void (m.addons[i].price = p))} />
            <button type="button" className="icon-btn" aria-label={`刪除加料${a.name}`} onClick={() => onChange((m) => void (m.addons = m.addons.filter((x) => x.id !== a.id)))}>
              🗑
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
