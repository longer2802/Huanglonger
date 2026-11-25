import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { parsePriceInput } from "../lib/pricing";

// ---- Toast ----

interface ToastItem {
  id: number;
  text: string;
  tone: "ok" | "error" | "info";
}

const ToastCtx = createContext<(text: string, tone?: ToastItem["tone"]) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const push = useCallback((text: string, tone: ToastItem["tone"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-1), { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 5000 : 3000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---- Modal ----

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="關閉" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

// ---- 價格輸入：空白＝缺價；負數、小數會被拒絕 ----

export function PriceInput({ value, onChange, label, className = "" }: { value: number | null; onChange: (v: number | null) => void; label: string; className?: string }) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const [error, setError] = useState("");
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) {
      last.current = value;
      setText(value === null ? "" : String(value));
      setError("");
    }
  }, [value]);
  return (
    <span className={`price-input ${className}`}>
      <input
        inputMode="numeric"
        aria-label={label}
        aria-invalid={value === null || Boolean(error)}
        placeholder="缺價"
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          const r = parsePriceInput(t);
          setError(r.error === "缺價" ? "" : r.error);
          last.current = r.value;
          onChange(r.value);
        }}
        className={value === null ? "missing" : ""}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </span>
  );
}

export function QtyStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="qty" role="group" aria-label={label}>
      <button type="button" aria-label="減少" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1}>
        −
      </button>
      <input
        inputMode="numeric"
        aria-label={`${label}數量`}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isInteger(n) && n >= 1 && n <= 999) onChange(n);
        }}
      />
      <button type="button" aria-label="增加" onClick={() => onChange(Math.min(999, value + 1))}>
        ＋
      </button>
    </span>
  );
}

export function useObjectUrl(blob: Blob | null | undefined): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!blob) {
      setUrl("");
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export function useMedia(query: string): boolean {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setM(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return m;
}
