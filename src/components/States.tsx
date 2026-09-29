"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Ban, CircleAlert, Clock, FileWarning, SearchX, ServerCrash, WifiOff, type LucideIcon } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { describeError, type ErrorKind } from "@/lib/errors";

const ERROR_ICON: Record<ErrorKind, LucideIcon> = {
  network: WifiOff,
  notFound: SearchX,
  rateLimited: Clock,
  server: ServerCrash,
  validation: CircleAlert,
  auth: CircleAlert,
  unavailable: ServerCrash,
  conflict: Ban,
  tooLarge: FileWarning,
  unsupported: FileWarning,
};

/** 요청 실패 화면. "검증 실패/처리 오류"이며 위험 판정과 무관하다는 것을 시각적으로도 구분(중립 톤). */
export function ErrorState({ error, onRetry, backHref }: { error: unknown; onRetry?: () => void; backHref?: string }) {
  const { dict } = useI18n();
  const info = describeError(error, dict);
  const Icon = ERROR_ICON[info.kind];
  return (
    <div className="state" role="alert">
      <span className="state__icon"><Icon size={28} aria-hidden /></span>
      <p className="state__title">{info.title}</p>
      <p className="state__body">{info.body}</p>
      {info.requestId && <p className="state__meta">{fmt(dict.common.errorId, { id: info.requestId })}</p>}
      <div className="state__actions">
        {onRetry && info.kind !== "notFound" && info.retryable && (
          <button className="btn btn--primary" onClick={onRetry}>{dict.common.retry}</button>
        )}
        {(info.kind === "notFound" || backHref) && (
          <Link className="btn btn--secondary" href={backHref ?? "/jobs"}>{dict.errors.goBack}</Link>
        )}
      </div>
    </div>
  );
}

/** 목록 위에 붙는 얇은 오류 배너. 기존 결과는 그대로 둔다. */
export function ErrorBanner({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { dict } = useI18n();
  const info = describeError(error, dict);
  return (
    <div className="banner banner--error" role="alert">
      <CircleAlert size={18} aria-hidden />
      <div className="banner__text">
        <strong>{info.title}</strong>
        <span>{info.body}{info.requestId ? ` · ${fmt(dict.common.errorId, { id: info.requestId })}` : ""}</span>
      </div>
      {onRetry && info.retryable && <button className="btn btn--sm btn--secondary" onClick={onRetry}>{dict.common.retry}</button>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <span className="state__icon"><Icon size={28} aria-hidden /></span>
      <p className="state__title">{title}</p>
      {body && <p className="state__body">{body}</p>}
      {action && <div className="state__actions">{action}</div>}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="spinner-wrap" role="status">
      <span className="spinner" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
