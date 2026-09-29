"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, LogIn } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { api, isAbort } from "@/lib/api";
import { formatRelative } from "@/lib/format";
import type { SavedJobItem } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { JobCard, JobCardSkeleton } from "@/components/JobCard";
import { EmptyState, ErrorBanner, ErrorState, Spinner } from "@/components/States";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSaved } from "@/components/providers/SavedProvider";

const LIMIT = 20;

export default function SavedPage() {
  const { dict, intl } = useI18n();
  const { session, ready, requireLogin } = useAuth();
  const saved = useSaved();
  const [items, setItems] = useState<SavedJobItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    const ac = new AbortController();
    setError(null);
    api
      .listSaved(1, LIMIT, ac.signal)
      .then((r) => {
        setItems(r.items);
        setTotal(r.total);
        setPage(r.page);
        setHasMore(r.has_more);
      })
      .catch((e) => !isAbort(e) && setError(e));
    return () => ac.abort();
  }, [session]);

  // 첫 로드 + 저장/해제 후 재조회
  useEffect(() => load(), [load, saved.version]);

  const loadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const r = await api.listSaved(page + 1, LIMIT);
      setItems((prev) => {
        const seen = new Set((prev ?? []).map((x) => x.job.id));
        return [...(prev ?? []), ...r.items.filter((x) => !seen.has(x.job.id))];
      });
      setPage(r.page);
      setHasMore(r.has_more);
      setTotal(r.total);
    } catch (e) {
      setMoreError(e);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="page">
      <TopBar
        title={dict.saved.title}
        large
        actions={items && total > 0 ? <span className="count count--lg">{fmt(dict.saved.count, { n: total })}</span> : null}
      />
      <div className="page__body">
        {!ready ? null : !session ? (
          <EmptyState
            icon={LogIn}
            title={dict.saved.loginTitle}
            body={dict.auth.reason.saved}
            action={<button className="btn btn--primary" onClick={() => requireLogin("saved")}>{dict.auth.login}</button>}
          />
        ) : error && !items ? (
          <ErrorState error={error} onRetry={load} />
        ) : !items ? (
          <div className="job-list" aria-busy="true">{[0, 1, 2].map((i) => <JobCardSkeleton key={i} />)}</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bookmark}
            title={dict.saved.empty}
            body={dict.saved.emptyHint}
            action={<Link href="/jobs" className="btn btn--primary">{dict.saved.browse}</Link>}
          />
        ) : (
          <>
            <ul className="job-list">
              {items.map((it) => (
                <li key={it.job.id}>
                  <JobCard job={it.job} meta={fmt(dict.saved.savedAt, { date: formatRelative(it.saved_at, intl) })} />
                </li>
              ))}
            </ul>
            {(hasMore || moreError != null) && (
              <div className="list-foot">
                {moreError != null ? (
                  <ErrorBanner error={moreError} onRetry={loadMore} />
                ) : loadingMore ? (
                  <Spinner label={dict.common.loading} />
                ) : (
                  <button className="btn btn--ghost" onClick={loadMore}>{dict.common.more}</button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
