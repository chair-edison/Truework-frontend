"use client";

import { ChevronDown, SignalHigh, SignalLow, SignalMedium, type LucideIcon } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import type { Evidence, RiskIndicator, Severity } from "@/lib/types";
import { EvidenceItem } from "./Verification";

const SEV_ICON: Record<Severity, LucideIcon> = { HIGH: SignalHigh, MEDIUM: SignalMedium, LOW: SignalLow };

export function SeverityTag({ severity }: { severity: Severity }) {
  const { dict } = useI18n();
  const Icon = SEV_ICON[severity] ?? SignalLow;
  const text = dict.severity[severity] ?? severity;
  return (
    <span className={`sev sev--${String(severity).toLowerCase()}`}>
      <Icon size={14} strokeWidth={2.5} aria-hidden />
      {fmt(dict.severity.label, { level: text })}
    </span>
  );
}

/** 서버가 보낸 위험 지표를 순서 그대로 표시. 심각도를 재계산하거나 정렬 기준을 바꾸지 않는다. */
export function RiskList({ risks, evidence }: { risks: RiskIndicator[]; evidence: Evidence[] }) {
  const { dict } = useI18n();
  const byId = new Map(evidence.map((e) => [e.id, e]));
  return (
    <ul className="risk-list">
      {risks.map((r) => {
        const related = r.evidence_ids.map((id) => byId.get(id)).filter((e): e is Evidence => !!e);
        return (
          <li key={r.code} className={`risk risk--${String(r.severity).toLowerCase()}`}>
            <div className="risk__head">
              <SeverityTag severity={r.severity} />
              <p className="risk__title">{dict.risk.codes[r.code] ?? dict.risk.fallback}</p>
            </div>
            <details className="risk__details">
              <summary>
                {dict.report.why}
                <ChevronDown size={18} aria-hidden className="risk__chev" />
              </summary>
              <p className="risk__explain">{r.explanation}</p>
              {related.length > 0 && (
                <>
                  <p className="risk__sub">{dict.report.relatedEvidence}</p>
                  <ul className="evidence-list">{related.map((ev) => <EvidenceItem key={ev.id} ev={ev} />)}</ul>
                </>
              )}
            </details>
          </li>
        );
      })}
    </ul>
  );
}
