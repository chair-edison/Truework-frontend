"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Bookmark, BookmarkCheck, Building2, CalendarClock, CircleCheck, CircleSlash, Globe, Link2, MapPin, ShieldCheck, Wallet } from "lucide-react";
import { fmt, label, useI18n } from "@/i18n";
import { api, isAbort } from "@/lib/api";
import { formatDate, formatDateTime, formatLocation, formatSalary, safeExternalUrl, toStringList } from "@/lib/format";
import type { Job } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { StatusBadge } from "@/components/StatusBadge";
import { VerificationSummary } from "@/components/Verification";
import { OriginalLinkButton } from "@/components/ExternalLink";
import { ErrorState } from "@/components/States";
import { useSaved } from "@/components/providers/SavedProvider";
import { useAuth } from "@/components/providers/AuthProvider";

const hostOf = (url: string | null | undefined) => {
  const safe = safeExternalUrl(url);
  return safe ? new URL(safe).host : null;
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { dict, intl } = useI18n();
  const { session } = useAuth();
  const saved = useSaved();
  const { sync } = saved;
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(() => {
    const ac = new AbortController();
    setError(null);
    api
      .getJob(id, ac.signal)
      .then((res) => {
        setJob(res.job);
        if (session) sync(res.job.id, res.saved); // 토큰이 있을 때만 saved 가 의미 있음
      })
      .catch((e) => !isAbort(e) && setError(e));
    return () => ac.abort();
  }, [id, session, sync]);
  useEffect(() => load(), [load]);

  const isSaved = saved.isSaved(id);
  const saveBtn = (
    <button
      className={`icon-btn icon-btn--save ${isSaved ? "is-saved" : ""}`}
      onClick={() => saved.toggle(id)}
      aria-pressed={isSaved}
      aria-label={isSaved ? dict.common.unsave : dict.common.save}
      disabled={saved.isPending(id)}
    >
      {isSaved ? <BookmarkCheck size={22} aria-hidden /> : <Bookmark size={22} aria-hidden />}
    </button>
  );

  if (error) {
    return (
      <div className="page">
        <TopBar title={dict.detail.title} backFallback="/jobs" />
        <ErrorState error={error} onRetry={load} backHref="/jobs" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page">
        <TopBar title={dict.detail.title} backFallback="/jobs" />
        <div className="page__body" aria-busy="true" aria-label={dict.common.loading}>
          <div className="card detail-skeleton">
            <span className="sk sk--badge" /><span className="sk sk--title" /><span className="sk sk--line" /><span className="sk sk--line sk--short" />
          </div>
          <div className="card detail-skeleton"><span className="sk sk--line" /><span className="sk sk--line" /><span className="sk sk--line sk--short" /></div>
        </div>
      </div>
    );
  }

  const salary = formatSalary(job.salary_min, job.salary_max, job.currency, intl);
  const requirements = toStringList(job.requirements);
  const originalOk = !!safeExternalUrl(job.source_url);
  const sourceHost = hostOf(job.sources?.base_url) ?? hostOf(job.source_url);
  const companySite = safeExternalUrl(job.companies?.website ?? null);
  const sourceName = job.sources?.name ?? dict.common.unknown;
  const sourceType = job.sources?.source_type ? label(dict.source, String(job.sources.source_type)) : null;

  return (
    <div className="page page--detail">
      <TopBar title={dict.detail.title} backFallback="/jobs" actions={saveBtn} />
      <div className="page__body">
        <section className="card detail-head">
          {/* 카드와 상세 모두 서버의 verification_status 를 그대로 사용 */}
          <StatusBadge status={job.verification_status} />
          <h2 className="detail-head__title">{job.title}</h2>
          <ul className="info-list">
            <li><Building2 size={16} aria-hidden /> {job.company_name}</li>
            {(job.location || job.country) && <li><MapPin size={16} aria-hidden /> {formatLocation(job.location, job.country, intl)}</li>}
            <li className={`info-list__salary ${salary ? "" : "is-muted"}`}><Wallet size={16} aria-hidden /> {salary ?? dict.jobs.noSalary}</li>
            {job.closes_at && <li><CalendarClock size={16} aria-hidden /> {fmt(dict.jobs.closesAt, { date: formatDate(job.closes_at, intl) })}</li>}
          </ul>
          <div className="chip-row">
            {job.work_type && <span className="chip chip--static">{label(dict.employment, job.work_type)}</span>}
            {job.occupation && <span className="chip chip--static">{label(dict.category, job.occupation)}</span>}
            {job.work_scope && <span className="chip chip--static">{label(dict.scope, job.work_scope)}</span>}
          </div>
          {job.published_at && <p className="muted small">{fmt(dict.jobs.postedAt, { date: formatDate(job.published_at, intl) })}</p>}
        </section>

        <section className="section" aria-labelledby="trust-h">
          <h2 id="trust-h" className="section-title">{dict.detail.trust}</h2>
          <h3 className="subsection__title subsection__title--icon"><ShieldCheck size={18} aria-hidden /> {dict.detail.whatVerified}</h3>
          <VerificationSummary
            verification={{ status: job.verification_status, summary: job.verification_summary }}
            metaLabel={job.last_verified_at ? fmt(dict.detail.lastVerified, { date: formatDateTime(job.last_verified_at, intl) }) : dict.detail.notVerifiedYet}
          />

          <div className="card qa">
            <div className="qa__item">
              <p className="qa__q"><Building2 size={16} aria-hidden /> {dict.detail.whoPosted}</p>
              <p className="qa__a">{job.companies?.name ?? job.company_name}</p>
              {companySite && (
                <p className="qa__sub">
                  <a className="text-link" href={companySite} target="_blank" rel="noopener noreferrer nofollow">
                    {dict.detail.companyWebsite} · {new URL(companySite).host}
                  </a>
                </p>
              )}
            </div>
            <div className="qa__item">
              <p className="qa__q"><Globe size={16} aria-hidden /> {dict.detail.whereFrom}</p>
              <p className="qa__a">
                {sourceName}
                {sourceType && <span className="muted"> · {sourceType}</span>}
              </p>
              {(sourceHost || job.retrieved_at) && (
                <p className="qa__sub">
                  {[sourceHost, job.retrieved_at && fmt(dict.detail.retrievedAt, { date: formatDateTime(job.retrieved_at, intl) })].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="qa__item">
              <p className="qa__q"><Link2 size={16} aria-hidden /> {dict.detail.canOpen}</p>
              <p className="qa__a qa__a--icon">
                {originalOk ? <CircleCheck size={16} aria-hidden className="ok" /> : <CircleSlash size={16} aria-hidden className="muted" />}
                {originalOk ? dict.detail.originalAvailable : dict.detail.originalUnavailable}
              </p>
              {originalOk && <p className="qa__sub">{hostOf(job.source_url)}</p>}
            </div>
          </div>
        </section>

        <section className="section card prose" aria-labelledby="about-h">
          <h2 id="about-h" className="section-title">{dict.detail.about}</h2>
          <p className="body-text pre-line">{job.description || dict.common.unknown}</p>
          {requirements.length > 0 && (
            <>
              <h3 className="subsection__title">{dict.detail.requirements}</h3>
              <ul className="bullets">{requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </>
          )}
        </section>
      </div>

      <div className="sticky-cta">
        <OriginalLinkButton url={job.source_url} />
      </div>
    </div>
  );
}
