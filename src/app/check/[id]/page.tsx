"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Briefcase, CircleCheck, CircleDashed, CircleX, Clock, Info, LoaderCircle, LogIn, ScanSearch } from "lucide-react";
import { fmt, label, useI18n } from "@/i18n";
import { api, isAbort, USING_MOCK } from "@/lib/api";
import { countryName, safeExternalUrl } from "@/lib/format";
import { markCheckDone } from "@/lib/prefsLocal";
import { track } from "@/lib/telemetry";
import { CHECK_PROGRESS, type AlternativesResponse, type Extraction, type JobCheck, type JobCheckCompleted, type JobCheckFailed } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { EvidenceGroups, VerificationSummary } from "@/components/Verification";
import { RiskList } from "@/components/RiskList";
import { JobCard, JobCardSkeleton } from "@/components/JobCard";
import { EmptyState, ErrorBanner, ErrorState } from "@/components/States";
import { useAuth } from "@/components/providers/AuthProvider";

const SLOW_AFTER_MS = 45_000;
const MIN_INTERVAL_MS = 1_500;
const MAX_INTERVAL_MS = 8_000;
const isTerminal = (c: JobCheck | null) => c?.status === "COMPLETED" || c?.status === "FAILED";

/** GET /job-checks/{id} 를 제한적으로 폴링한다. 서버의 poll_after_ms 를 우선하고 점차 간격을 늘린다. */
function useJobCheck(id: string, enabled: boolean) {
  const [check, setCheck] = useState<JobCheck | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [slow, setSlow] = useState(false);
  const watchStart = useRef(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoff = useRef(MIN_INTERVAL_MS);
  const ac = useRef<AbortController | null>(null);
  const slowRef = useRef(false);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const fetchOnce = useCallback(async (): Promise<JobCheck | null> => {
    ac.current?.abort();
    const controller = new AbortController();
    ac.current = controller;
    try {
      const res = await api.getCheck(id, controller.signal);
      setCheck(res);
      setError(null);
      return res;
    } catch (e) {
      if (!isAbort(e)) setError(e);
      return null;
    }
  }, [id]);

  const schedule = useCallback(
    (res: JobCheck | null) => {
      clear();
      if (!res || isTerminal(res)) return; // 오류 시 자동 재시도하지 않고 사용자에게 선택지를 준다
      if (Date.now() - watchStart.current > SLOW_AFTER_MS) {
        slowRef.current = true;
        setSlow(true);
        return; // 오래 걸리면 멈추고 사용자 선택을 기다린다 (실패로 단정하지 않음)
      }
      if (document.visibilityState === "hidden") return;
      const serverHint = "poll_after_ms" in res && res.poll_after_ms ? res.poll_after_ms : 0;
      const wait = Math.min(MAX_INTERVAL_MS, Math.max(serverHint, backoff.current));
      backoff.current = Math.min(MAX_INTERVAL_MS, backoff.current * 1.3);
      timer.current = setTimeout(async () => schedule(await fetchOnce()), wait);
    },
    [fetchOnce],
  );

  const refresh = useCallback(async () => schedule(await fetchOnce()), [fetchOnce, schedule]);

  const keepWaiting = useCallback(() => {
    watchStart.current = Date.now();
    backoff.current = 2_000;
    slowRef.current = false;
    setSlow(false);
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    watchStart.current = Date.now();
    void refresh();
    // 앱 전환 후 복귀 시 상태 재조회
    const onVis = () => {
      if (document.visibilityState === "visible" && !slowRef.current) void refresh();
      else clear();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clear();
      ac.current?.abort();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh, enabled]);

  return { check, error, slow, refresh, keepWaiting };
}

export default function CheckResultPage() {
  const { id } = useParams<{ id: string }>();
  const { dict } = useI18n();
  const { session, ready, requireLogin } = useAuth();
  const { check, error, slow, refresh, keepWaiting } = useJobCheck(id, ready && !!session);

  useEffect(() => {
    if (check && isTerminal(check)) {
      markCheckDone(check.check_id);
      track("job_check_finished", { status: check.status });
    }
  }, [check]);

  const done = check?.status === "COMPLETED";

  return (
    <div className="page page--report">
      <TopBar title={done ? dict.report.title : dict.progress.title} backFallback="/check" />
      <div className="page__body">
        {!ready ? null : !session ? (
          <EmptyState
            icon={LogIn}
            title={dict.errors.auth.title}
            body={dict.auth.reason.check}
            action={<button className="btn btn--primary" onClick={() => requireLogin("check")}>{dict.auth.login}</button>}
          />
        ) : !check && error ? (
          <ErrorState error={error} onRetry={refresh} backHref="/check" />
        ) : !check ? (
          <ProgressView status={null} />
        ) : check.status === "FAILED" ? (
          <FailedView check={check} />
        ) : check.status === "COMPLETED" ? (
          <Report check={check} />
        ) : (
          <>
            <ProgressView status={check.status} />
            {error != null && <ErrorBanner error={error} onRetry={refresh} />}
            {slow && (
              <div className="card slow-card" role="status">
                <p className="slow-card__title"><Clock size={18} aria-hidden /> {dict.progress.slowTitle}</p>
                <p className="body-text">{dict.progress.slowBody}</p>
                <div className="btn-row">
                  <button className="btn btn--secondary" onClick={refresh}>{dict.progress.refresh}</button>
                  <button className="btn btn--primary" onClick={keepWaiting}>{dict.progress.keepWaiting}</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const STEPS = ["UPLOAD", ...CHECK_PROGRESS] as const;

function ProgressView({ status }: { status: (typeof CHECK_PROGRESS)[number] | null }) {
  const { dict } = useI18n();
  // 제출(UPLOAD)은 검사 ID 를 받은 시점에 이미 끝난 단계
  const currentIdx = status ? STEPS.indexOf(status) : 1;
  return (
    <section className="card progress" aria-labelledby="progress-h">
      <h2 id="progress-h" className="sr-only">{dict.progress.title}</h2>
      <ol className="steps" aria-live="polite">
        {STEPS.map((s, i) => {
          const state = i < currentIdx ? "done" : i === currentIdx ? "current" : "pending";
          const Icon = state === "done" ? CircleCheck : state === "current" ? LoaderCircle : CircleDashed;
          return (
            <li key={s} className={`step step--${state}`} aria-current={state === "current" ? "step" : undefined}>
              <Icon size={22} aria-hidden className={state === "current" ? "spin" : ""} />
              <span className="step__label">{dict.progress.stages[s]}</span>
              <span className="step__state">{dict.progress[state]}</span>
            </li>
          );
        })}
      </ol>
      <p className="notice"><Info size={16} aria-hidden />{dict.progress.hint}</p>
    </section>
  );
}

function FailedView({ check }: { check: JobCheckFailed }) {
  const { dict } = useI18n();
  return (
    <div className="state" role="alert">
      <span className="state__icon"><CircleX size={28} aria-hidden /></span>
      <p className="state__title">{dict.progress.failedTitle}</p>
      <p className="state__body">
        {dict.progress.failure[check.failure_code] ?? dict.progress.failure.PROCESSING_FAILED} {dict.progress.failedBody}
      </p>
      <p className="state__body">{check.retryable ? dict.progress.failedRetryable : dict.progress.failedNotRetryable}</p>
      <div className="state__actions">
        <Link href="/check" className="btn btn--primary">{dict.progress.backToInput}</Link>
      </div>
    </div>
  );
}

const FIELD_ORDER: (keyof Omit<Extraction, "raw_text">)[] = [
  "employer", "job_title", "location", "country", "work_scope", "salary", "recruiter", "contact_method", "recruitment_fee", "job_duties", "employment_conditions", "source_url",
];

function ExtractedValue({ field, ex }: { field: (typeof FIELD_ORDER)[number]; ex: Extraction }) {
  const { dict, intl } = useI18n();
  const raw = ex[field];
  // 누락값은 추론하지 않고 '확인되지 않음'으로 표시
  if (raw == null || raw === "" || raw === "UNKNOWN") return <dd className="is-unknown">{dict.common.unknown}</dd>;
  if (field === "country") return <dd>{countryName(raw, intl)}</dd>;
  if (field === "work_scope") return <dd>{label(dict.scope, raw)}</dd>;
  if (field === "source_url") {
    const safe = safeExternalUrl(raw);
    return <dd className="break">{safe ? <a className="text-link" href={safe} target="_blank" rel="noopener noreferrer nofollow">{new URL(safe).host}</a> : raw}</dd>;
  }
  return <dd className="pre-line">{raw}</dd>;
}

function Report({ check }: { check: JobCheckCompleted }) {
  const { dict } = useI18n();
  const v = check.verification;

  return (
    <>
      {USING_MOCK && <p className="banner banner--info"><Info size={18} aria-hidden /> <span>{dict.report.demoNotice}</span></p>}
      <VerificationSummary verification={v} />
      {v.policy_version && <p className="muted small">{fmt(dict.report.policy, { v: v.policy_version })}</p>}

      {check.explanation && (
        <section className="section" aria-labelledby="expl-h">
          <h2 id="expl-h" className="section-title">{dict.report.explanation}</h2>
          <p className="card body-text pre-line">{check.explanation}</p>
        </section>
      )}

      <section className="section" aria-labelledby="ex-h">
        <h2 id="ex-h" className="section-title">{dict.report.extracted}</h2>
        <dl className="card kv">
          {FIELD_ORDER.map((k) => (
            <div key={k} className="kv__row">
              <dt>{dict.report.fields[k]}</dt>
              <ExtractedValue field={k} ex={check.extraction} />
            </div>
          ))}
        </dl>
      </section>

      <section className="section" aria-labelledby="risk-h">
        <h2 id="risk-h" className="section-title">
          {dict.report.risks} {v.risk_indicators.length > 0 && <span className="count">{v.risk_indicators.length}</span>}
        </h2>
        {v.risk_indicators.length ? (
          <RiskList risks={v.risk_indicators} evidence={v.evidence} />
        ) : (
          <div className="card">
            <p className="body-text">{dict.report.risksNone}</p>
            <p className="muted small">{dict.report.risksNoneHint}</p>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="ev-h">
        <h2 id="ev-h" className="section-title">{dict.evidence.title}</h2>
        <EvidenceGroups evidence={v.evidence} />
      </section>

      {check.safety_guidance.length > 0 && (
        <section className="section" aria-labelledby="safe-h">
          <h2 id="safe-h" className="section-title">{dict.report.safety}</h2>
          <ol className="card safety-list">
            {check.safety_guidance.map((g, i) => (
              <li key={i}>
                <span className="safety-list__num" aria-hidden>{i + 1}</span>
                <p className="safety-list__desc safety-list__desc--strong">{g}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <Alternatives checkId={check.check_id} />

      <Link href="/check" className="btn btn--secondary btn--block">
        <ScanSearch size={18} aria-hidden /> {dict.report.newCheck}
      </Link>
    </>
  );
}

function Alternatives({ checkId }: { checkId: string }) {
  const { dict, intl } = useI18n();
  const [data, setData] = useState<AlternativesResponse | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    const ac = new AbortController();
    setError(null);
    api
      .getAlternatives(checkId, ac.signal)
      .then(setData) // API 가 반환한 검증 공고만 렌더링
      .catch((e) => !isAbort(e) && setError(e));
    return () => ac.abort();
  }, [checkId]);
  useEffect(() => load(), [load]);

  const c = data?.criteria;
  const criteria = c
    ? [...new Set([c.job_title, c.location, c.country && countryName(c.country, intl)].filter((x): x is string => !!x))].join(" · ")
    : "";

  return (
    <section className="section" aria-labelledby="alt-h">
      <h2 id="alt-h" className="section-title">{dict.report.alternatives}</h2>
      <p className="section-sub">
        {dict.report.alternativesHint}
        {criteria && <> {fmt(dict.report.alternativesCriteria, { criteria })}</>}
      </p>
      {error ? (
        <ErrorBanner error={error} onRetry={load} />
      ) : !data ? (
        <div className="job-list"><JobCardSkeleton /><JobCardSkeleton /></div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={dict.report.alternativesEmpty}
          action={<Link href="/jobs" className="btn btn--primary">{dict.report.alternativesEmptyCta}</Link>}
        />
      ) : (
        <ul className="job-list">{data.items.map((j) => <li key={j.id}><JobCard job={j} /></li>)}</ul>
      )}
    </section>
  );
}
