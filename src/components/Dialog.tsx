"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/i18n";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: "sheet" | "modal";
};

/** 네이티브 <dialog> 기반: 포커스 가두기, Esc 닫기, 포커스 복귀를 브라우저가 처리한다. */
export function Dialog({ open, onClose, title, children, footer, variant = "modal" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { dict } = useI18n();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${variant}`}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // 배경 클릭
      }}
    >
      <div className="dialog__panel">
        {variant === "sheet" && <span className="dialog__grabber" aria-hidden />}
        <div className="dialog__header">
          <h2 id={titleId} className="dialog__title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={dict.common.close}>
            <X size={22} aria-hidden />
          </button>
        </div>
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </dialog>
  );
}
