import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useRouterState } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Small, dependency-free building blocks sized for one-handed phone use.

export function Btn({ variant = "primary", size = "lg", className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition active:scale-[0.98] disabled:opacity-50",
        size === "lg" && "min-h-[52px] px-5 text-base",
        size === "md" && "min-h-[44px] px-4 text-[15px]",
        size === "sm" && "min-h-[36px] px-3 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground shadow-sm",
        variant === "soft" && "bg-secondary text-secondary-foreground",
        variant === "apricot" && "bg-accent text-accent-foreground",
        variant === "outline" && "border border-border bg-card text-foreground",
        variant === "ghost" && "text-primary",
        variant === "danger" && "bg-destructive text-destructive-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <section className={cn("rounded-3xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(60,70,55,0.06)]", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }) {
  return (
    <div className="mb-2 flex items-end justify-between gap-2 px-1">
      <h2 className="text-[17px] font-bold text-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function Pill({ tone = "sage", children, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        tone === "sage" && "bg-secondary text-secondary-foreground",
        tone === "apricot" && "bg-accent text-accent-foreground",
        tone === "alert" && "bg-destructive text-destructive-foreground",
        tone === "line" && "border border-border bg-card text-muted-foreground",
        tone === "done" && "bg-primary text-primary-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}

// High-contrast warning block: colour plus a symbol plus words.
export function AlertBox({ title, items = [], action, children }) {
  return (
    <div role="alert" className="rounded-2xl border-2 border-destructive bg-[hsl(var(--alert-bg))] p-3 text-[hsl(var(--alert-fg))]">
      <p className="flex items-center gap-1.5 text-[15px] font-bold">
        <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span>⚠ {title}</span>
      </p>
      {items.length ? (
        <ul className="mt-1.5 list-disc space-y-0.5 pl-6 text-[15px] leading-relaxed">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      ) : null}
      {action ? <p className="mt-2 rounded-xl bg-destructive px-3 py-2 text-[15px] font-bold text-destructive-foreground">{action}</p> : null}
      {children}
    </div>
  );
}

export function Field({ label, hint, error, children, required }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      {label ? (
        <label htmlFor={id} className="block text-[15px] font-semibold text-foreground">
          {label}
          {required ? <span className="ml-1 text-destructive">*</span> : <span className="ml-1 text-xs font-normal text-muted-foreground">選填</span>}
        </label>
      ) : null}
      {typeof children === "function" ? children(id) : children}
      {hint ? <p className="text-[13px] leading-relaxed text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-[13px] font-semibold text-destructive">{error}</p> : null}
    </div>
  );
}

export const inputClass =
  "block w-full min-h-[48px] rounded-2xl border border-input bg-background px-3.5 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring";

export function Sheet({ open, onClose, title, children, footer, tall = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn("flex w-full max-w-lg flex-col rounded-t-3xl bg-background shadow-2xl sm:rounded-3xl", tall ? "max-h-[92dvh]" : "max-h-[85dvh]")}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="關閉" className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-border px-4 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function Confirm({ open, title, body, confirmLabel = "確定", danger = false, busy = false, onCancel, onConfirm }) {
  return (
    <Sheet
      open={open}
      onClose={busy ? undefined : onCancel}
      title={title}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="outline" onClick={onCancel} disabled={busy}>
            取消
          </Btn>
          <Btn variant={danger ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Btn>
        </div>
      }
    >
      <div className="text-[15px] leading-relaxed text-foreground">{body}</div>
    </Sheet>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="rounded-3xl border border-dashed border-border bg-card/60 px-5 py-8 text-center">
      {Icon ? <Icon className="mx-auto h-9 w-9 text-primary" aria-hidden="true" /> : null}
      <p className="mt-2 text-base font-semibold">{title}</p>
      {children ? <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div> : null}
    </div>
  );
}

export function FamilyNote() {
  return <span className="text-[11px] font-medium text-muted-foreground">家庭自行記錄</span>;
}

// A titled section that shows only its heading until tapped.
export function Fold({ id, title, icon: Icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const hash = useRouterState({ select: (st) => st.location.hash });
  useEffect(() => {
    const winHash = typeof window !== "undefined" ? window.location.hash.replace("#", "") : "";
    if (id && (hash === id || winHash === id)) {
      setOpen(true);
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 50);
    }
  }, [id, hash]);
  return (
    <section id={id} className="scroll-mt-20">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-[56px] w-full items-center gap-3 rounded-3xl border border-border bg-card px-4 text-left shadow-[0_6px_20px_-10px_hsl(334_70%_60%/0.35)]"
      >
        {Icon ? (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-primary">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <span className="flex-1 text-[16px] font-bold">{title}</span>
        <ChevronDown className={cn("h-5 w-5 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}
