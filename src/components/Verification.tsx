"use client";

import { CircleCheck, CircleHelp, CircleMinus, ExternalLink, Info, TriangleAlert, type LucideIcon } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { formatDateTime, safeExternalUrl } from "@/lib/format";
import { toStatusKey } from "@/lib/status";
import type { Evidence, EvidenceKind, StatusValue } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export type VerificationView = { status: StatusValue; summary?: string | null; disclaimer?: string | null; checked_at?: string | null };

/** 서버의 status / summary / disclaimer 를 그대로 보여준다. 값이 없을 때만 상태별 기본 설명을 쓴다. */
export function VerificationSummary({ verification, compact, metaLabel }: { verification: VerificationView; compact?: boolean; metaLabel?: string }) {
  const { dict, intl } = useI18n();
  const key = toStatusKey(verification.status);
  return (
    <section className={`verify-summary verify-summary--${key.toLowerCase()} ${compact ? "is-compact" : ""}`} aria-label={dict.status[key].label}>
      <StatusBadge status={verification.status} size="lg" />
      <p className="verify-summary__summary">{verification.summary || dict.status[key].desc}</p>
      {key === "WARNING" && (
        <p className="verify-summary__note">
          <Info size={16} aria-hidden /> {dict.status.warningNotFinal}
        </p>
      )}
      {verification.disclaimer && <p className="verify-summary__disclaimer">{verification.disclaimer}</p>}
      {(metaLabel || verification.checked_at) && (
        <p className="verify-summary__meta">{metaLabel ?? fmt(dict.common.lastChecked, { date: formatDateTime(verification.checked_at, intl) })}</p>
      )}
    </section>
  );
}

const KIND_ICON: Record<EvidenceKind, LucideIcon> = { POSITIVE: CircleCheck, NEGATIVE: TriangleAlert, UNKNOWN: CircleHelp };
const KIND_ORDER: EvidenceKind[] = ["POSITIVE", "NEGATIVE", "UNKNOWN"];

export function EvidenceItem({ ev }: { ev: Evidence }) {
  const { dict, intl } = useI18n();
  const Icon = KIND_ICON[ev.kind] ?? CircleMinus;
  const url = safeExternalUrl(ev.source_url);
  return (
    <li className={`evidence evidence--${(ev.kind ?? "UNKNOWN").toLowerCase()}`}>
      <Icon size={18} className="evidence__icon" aria-hidden />
      <div className="evidence__body">
        <p className="evidence__title">{ev.title}</p>
        <p className="evidence__desc">{ev.description}</p>
        <p className="evidence__meta">
          {ev.source_name && (
            <span>
              {dict.evidence.source}:{" "}
              {url ? (
                <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-link">
                  {ev.source_name}
                  <ExternalLink size={12} aria-hidden />
                  <span className="sr-only"> ({dict.common.external})</span>
                </a>
              ) : (
                ev.source_name
              )}
            </span>
          )}
          <span>{formatDateTime(ev.checked_at, intl)}</span>
        </p>
      </div>
    </li>
  );
}

/** 긍정 / 부정 / 불확실 근거로 나눠 보여준다(분류는 서버의 kind 값). */
export function EvidenceGroups({ evidence }: { evidence: Evidence[] }) {
  const { dict } = useI18n();
  if (!evidence?.length) return <p className="muted">{dict.evidence.none}</p>;
  return (
    <div className="evidence-groups">
      {KIND_ORDER.map((kind) => {
        const list = evidence.filter((e) => e.kind === kind);
        if (!list.length) return null;
        return (
          <div key={kind} className="evidence-group">
            <h4 className="evidence-group__title">
              {dict.evidence[kind]} <span className="count">{list.length}</span>
            </h4>
            <ul className="evidence-list">{list.map((ev) => <EvidenceItem key={ev.id} ev={ev} />)}</ul>
          </div>
        );
      })}
    </div>
  );
}
