"use client";

import { useState } from "react";
import { Copy, ExternalLink as ExternalIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import { safeExternalUrl } from "@/lib/format";
import { Dialog } from "./Dialog";
import { useToast } from "./providers/ToastProvider";

/** 원본 공고 CTA. 유효한 https URL 일 때만 활성화하고, 이동 전 외부 링크임을 알린다. */
export function OriginalLinkButton({ url, className = "" }: { url: string | null | undefined; className?: string }) {
  const { dict } = useI18n();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const safe = safeExternalUrl(url);

  if (!safe) {
    return (
      <button className={`btn btn--primary btn--block ${className}`} disabled aria-disabled>
        {dict.detail.noOriginal}
      </button>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(safe);
      toast.show(dict.common.copied);
    } catch {
      toast.show(safe);
    }
  };

  const host = new URL(safe).host;

  return (
    <>
      <button className={`btn btn--primary btn--block ${className}`} onClick={() => setOpen(true)}>
        {dict.detail.openOriginal}
        <ExternalIcon size={18} aria-hidden />
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={dict.detail.externalTitle}
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setOpen(false)}>{dict.common.cancel}</button>
            <a className="btn btn--primary" href={safe} target="_blank" rel="noopener noreferrer nofollow" onClick={() => setOpen(false)}>
              {dict.detail.open}
              <ExternalIcon size={18} aria-hidden />
            </a>
          </>
        }
      >
        <p className="body-text">{dict.detail.externalBody}</p>
        <div className="url-box">
          <span className="url-box__host">{host}</span>
          <span className="url-box__full">{safe}</span>
          <button className="btn btn--sm btn--ghost" onClick={copy}>
            <Copy size={16} aria-hidden /> {dict.common.copy}
          </button>
        </div>
        <p className="hint">{dict.detail.openFailed}</p>
      </Dialog>
    </>
  );
}
