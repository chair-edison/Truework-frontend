"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, Building2, MapPin } from "lucide-react";
import { fmt, label, useI18n } from "@/i18n";
import { formatLocation, formatRelative, formatSalary } from "@/lib/format";
import type { Job } from "@/lib/types";
import { useSaved } from "./providers/SavedProvider";
import { StatusBadge } from "./StatusBadge";

export function JobCard({ job, meta }: { job: Job; meta?: string }) {
  const { dict, intl } = useI18n();
  const saved = useSaved();
  const isSaved = saved.isSaved(job.id);
  const salary = formatSalary(job.salary_min, job.salary_max, job.currency, intl);
  const sourceName = job.sources?.name ?? null;

  return (
    <article className="job-card">
      <div className="job-card__top">
        <StatusBadge status={job.verification_status} size="sm" />
        <button
          className={`icon-btn icon-btn--save ${isSaved ? "is-saved" : ""}`}
          onClick={() => saved.toggle(job.id)}
          aria-pressed={isSaved}
          aria-label={`${isSaved ? dict.common.unsave : dict.common.save}: ${job.title}`}
          disabled={saved.isPending(job.id)}
        >
          {isSaved ? <BookmarkCheck size={22} aria-hidden /> : <Bookmark size={22} aria-hidden />}
        </button>
      </div>
      <h3 className="job-card__title">
        {/* 카드 전체를 누를 수 있도록 링크를 확장(::after)하되, 저장 버튼은 별도 포커스 대상 */}
        <Link href={`/jobs/${job.id}`} className="job-card__link">{job.title}</Link>
      </h3>
      <p className="job-card__meta">
        <span><Building2 size={14} aria-hidden /> {job.company_name}</span>
        {(job.location || job.country) && <span><MapPin size={14} aria-hidden /> {formatLocation(job.location, job.country, intl)}</span>}
      </p>
      <p className={`job-card__salary ${salary ? "" : "is-muted"}`}>{salary ?? dict.jobs.noSalary}</p>
      <div className="job-card__foot">
        {job.work_type && <span className="chip chip--static">{label(dict.employment, job.work_type)}</span>}
        {job.work_scope === "OVERSEAS" && <span className="chip chip--static">{dict.scope.OVERSEAS}</span>}
        {sourceName && <span className="job-card__source">{sourceName}</span>}
        <span className="job-card__date">
          {meta ?? (job.published_at ? fmt(dict.jobs.postedAt, { date: formatRelative(job.published_at, intl) }) : "")}
        </span>
      </div>
    </article>
  );
}

export function JobCardSkeleton() {
  return (
    <div className="job-card job-card--skeleton" aria-hidden>
      <span className="sk sk--badge" />
      <span className="sk sk--title" />
      <span className="sk sk--line" />
      <span className="sk sk--line sk--short" />
      <span className="sk sk--chips" />
    </div>
  );
}
