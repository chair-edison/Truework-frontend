"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";

type Toast = { id: number; message: string; tone: "default" | "error"; action?: { label: string; onClick: () => void } };
type Ctx = { show: (message: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void };

const ToastContext = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const show = useCallback<Ctx["show"]>(
    (message, opts = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-2), { id, message, tone: opts.tone ?? "default", action: opts.action }]);
      setTimeout(() => dismiss(id), opts.tone === "error" ? 6000 : 3500);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone === "error" ? "toast--error" : ""}`}>
            {t.tone === "error" ? <CircleAlert size={18} aria-hidden /> : <CircleCheck size={18} aria-hidden />}
            <span className="toast__msg">{t.message}</span>
            {t.action && (
              <button className="toast__action" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>
                {t.action.label}
              </button>
            )}
            <button className="icon-btn icon-btn--sm toast__close" aria-label="닫기" onClick={() => dismiss(t.id)}>
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
