import { useEffect, useRef, useState } from "react";
import { uid } from "../lib/id";
import { duplicateKeys, splitNames, type NameDraft } from "../lib/names";
import { newPerson } from "../lib/orders";
import { personState, STATE_LABEL } from "../lib/pricing";
import { onDeviceSpeechStatus, startOnDeviceSpeech, type SpeechSession } from "../lib/speech";
import type { StepProps } from "./OrderEditor";
import { useToast } from "./ui";

export default function PeopleStep({ order, update, goStep }: StepProps) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [drafts, setDrafts] = useState<NameDraft[] | null>(null);
  const [speech, setSpeech] = useState<"checking" | "available" | "unavailable">("checking");
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const session = useRef<SpeechSession | null>(null);

  useEffect(() => {
    let alive = true;
    onDeviceSpeechStatus().then((s) => alive && setSpeech(s));
    return () => {
      alive = false;
      session.current?.stop();
    };
  }, []);

  const toggleMic = () => {
    if (listening) {
      session.current?.stop();
      return;
    }
    try {
      session.current = startOnDeviceSpeech(
        (t, final) => {
          if (final) {
            setText((prev) => (prev.trim() ? `${prev.trim()}\n` : "") + t.trim().replace(/[ 　]+/g, "\n"));
            setInterim("");
          } else setInterim(t);
        },
        (err) => {
          setListening(false);
          setInterim("");
          if (err) toast(err, "error");
        },
      );
      setListening(true);
    } catch (e) {
      toast((e as Error).message, "error");
      setSpeech("unavailable");
    }
  };

  const preview = () => {
    const names = splitNames(text);
    if (!names.length) return toast("請先輸入至少一個姓名", "error");
    setDrafts(names.map((name) => ({ key: uid("d"), name, tag: "" })));
  };

  const dup = drafts ? duplicateKeys(drafts, order.people) : new Set<string>();

  const create = () => {
    if (!drafts) return;
    const valid = drafts.filter((d) => d.name.trim());
    update((o) => void o.people.push(...valid.map((d) => newPerson(d.name, d.tag))));
    toast(`已加入 ${valid.length} 位同事`);
    setDrafts(null);
    setText("");
  };

  const existingDup = duplicateKeys(
    order.people.map((p) => ({ key: p.id, name: p.name, tag: p.tag })),
    [],
  );

  return (
    <div className="stack">
      <div className="card stack">
        <h2 className="bold">輸入同事名單</h2>
        <p className="hint">一行一個，或用逗號「,」、頓號「、」分開。可以從群組名單直接貼上。</p>
        <textarea aria-label="同事名單" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={"阿榮\n小妤\n小陳"} />
        {interim ? <p className="small muted">聽到：{interim}</p> : null}
        <div className="row">
          {speech === "available" ? (
            <button type="button" className={`btn ${listening ? "danger" : ""}`} onClick={toggleMic} aria-pressed={listening}>
              {listening ? "■ 停止聽寫" : "🎤 語音輸入（裝置端）"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={async () => {
              try {
                const t = await navigator.clipboard.readText();
                if (t) setText((prev) => (prev.trim() ? `${prev.trim()}\n` : "") + t);
                else toast("剪貼簿是空的", "error");
              } catch {
                toast("瀏覽器不允許讀取剪貼簿，請在輸入框長按貼上", "error");
              }
            }}
          >
            📋 貼上
          </button>
          <button type="button" className="btn primary grow" onClick={preview} disabled={!text.trim()}>
            預覽名單
          </button>
        </div>
        {speech !== "available" ? (
          <div className="banner info small" data-testid="speech-fallback">
            {speech === "checking"
              ? "檢查語音功能中…"
              : "這個瀏覽器無法確認能在裝置上辨識中文語音，所以不提供 App 內的語音按鈕（避免把聲音送到雲端）。想用說的：點輸入框，再按手機鍵盤上的麥克風聽寫，一次說一個名字、說完換行；或直接貼上名單。"}
          </div>
        ) : (
          <p className="hint">語音只在這台裝置上辨識，不會上傳。也可以用手機鍵盤上的麥克風聽寫。</p>
        )}
      </div>

      {drafts ? (
        <div className="card stack" aria-label="名單預覽">
          <div className="spread">
            <h2 className="bold">預覽（{drafts.length} 人）</h2>
            <button type="button" className="btn sm ghost" onClick={() => setDrafts(null)}>
              取消
            </button>
          </div>
          {dup.size ? <div className="banner warn">有同名的人（黃底）。如果是不同人，請在「辨識標記」填部門或特徵（例如「業務部」），系統會分開記帳。</div> : null}
          {drafts.map((d, i) => (
            <div key={d.key} className="row nowrap" style={dup.has(d.key) ? { background: "var(--warn-soft)", borderRadius: 10, padding: 4 } : undefined}>
              <span className="tiny muted" style={{ width: 22, textAlign: "right" }}>
                {i + 1}
              </span>
              <input type="text" aria-label={`第${i + 1}位姓名`} value={d.name} onChange={(e) => setDrafts(drafts.map((x) => (x.key === d.key ? { ...x, name: e.target.value } : x)))} />
              <input type="text" aria-label={`第${i + 1}位辨識標記`} placeholder="辨識標記" value={d.tag} style={{ maxWidth: 120 }} onChange={(e) => setDrafts(drafts.map((x) => (x.key === d.key ? { ...x, tag: e.target.value } : x)))} />
              <button type="button" className="icon-btn" aria-label={`移除${d.name}`} onClick={() => setDrafts(drafts.filter((x) => x.key !== d.key))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn primary block" onClick={create} disabled={!drafts.some((d) => d.name.trim())}>
            建立 {drafts.filter((d) => d.name.trim()).length} 人{dup.size ? `（含 ${dup.size} 位同名）` : ""}
          </button>
        </div>
      ) : null}

      <div className="card stack">
        <div className="spread">
          <h2 className="bold">目前名單（{order.people.length} 人）</h2>
          {order.people.length ? (
            <button type="button" className="btn sm primary" onClick={() => goStep("order")}>
              開始點餐 →
            </button>
          ) : null}
        </div>
        {order.people.length === 0 ? <p className="hint">還沒有人。在上面輸入名單後按「預覽名單」。</p> : null}
        {existingDup.size ? <div className="banner warn">名單裡有同名同標記的人，建議加上辨識標記以免收錯錢。</div> : null}
        {order.people.map((p, i) => {
          const st = personState(p);
          return (
            <div key={p.id} className="row nowrap">
              <span className="tiny muted" style={{ width: 26, textAlign: "right" }}>
                #{i + 1}
              </span>
              <input type="text" aria-label={`#${i + 1} 姓名`} value={p.name} onChange={(e) => update((o) => void (o.people[i].name = e.target.value))} />
              <input type="text" aria-label={`#${i + 1} 辨識標記`} placeholder="辨識標記" value={p.tag} style={{ maxWidth: 110 }} onChange={(e) => update((o) => void (o.people[i].tag = e.target.value))} />
              <span className={`chip ${st}`}>{STATE_LABEL[st]}</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`刪除${p.name}`}
                onClick={() => {
                  if (p.lines.length && !window.confirm(`${p.name} 已經點了 ${p.lines.length} 項，確定刪除？`)) return;
                  update((o) => void (o.people = o.people.filter((x) => x.id !== p.id)));
                }}
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
