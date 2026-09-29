"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ScanSearch, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { api, isAbort } from "@/lib/api";
import { buildSearch, FILTER_KEYS, hasCriteria as criteriaOf, pickSort, readFilters, toJobsQuery, type FilterKey, type Filters } from "@/lib/jobsQuery";
import type { Job } from "@/lib/types";
import { useAuth } from "@/components/providers/AuthProvider";
import { JobCard, JobCardSkeleton } from "@/components/JobCard";
import { FilterSheet, useFilterLabel } from "@/components/FilterSheet";
import { EmptyState, ErrorBanner, ErrorState, Spinner } from "@/components/States";
import { isOnboarded } from "@/lib/prefsLocal";

type ListState = {
  key: string;
  items: Job[];
  page: number;
  hasNext: boolean;
  total: number;
  resultCap: number | null;
};

// 상세에서 돌아왔을 때 목록·스크롤을 복원하기 위한 메모리 캐시
const listCache = new Map<string, { state: ListState; scrollY: number; at: number }>();
const CACHE_TTL = 5 * 60_000;

function JobsHome() {
  const { dict } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const { session, ready } = useAuth();
  const optionLabel = useFilterLabel();

  const q = sp.get("q") ?? "";
  const filters = useMemo(() => readFilters(sp), [sp]);
  const hasCriteria = criteriaOf(q, filters);
  const recommended = pickSort(q, filters) === "recommended";
  // 토큰이 있으면 추천 결과가 개인화되므로 캐시 키에 로그인 여부를 포함
  const key = `${buildSearch(q, filters)}|${session ? "u" : ""}`;

  const [input, setInput] = useState(q);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [list, setList] = useState<ListState | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  // 첫 방문이면 온보딩으로
  useEffect(() => {
    if (!isOnboarded()) router.replace("/onboarding");
  }, [router]);

  // URL 이 바뀌면(뒤로가기 등) 입력창도 동기화
  useEffect(() => setInput(q), [q]);

  // 검색어 디바운스 → URL 갱신
  useEffect(() => {
    if (input === q) return;
    const t = setTimeout(() => router.replace(`/jobs${buildSearch(input, filters)}`, { scroll: false }), 350);
    return () => clearTimeout(t);
  }, [input, q, filters, router]);

  // 첫 페이지 조회. 늦게 도착한 이전 응답은 seq 로 무시하고, 요청 자체도 취소한다.
  const loadFirst = useCallback(() => {
    if (!ready) return;
    const cached = listCache.get(key);
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      setList(cached.state);
      requestAnimationFrame(() => window.scrollTo(0, cached.scrollY));
      return;
    }
    const mySeq = ++seq.current;
    const ac = new AbortController();
    setError(null);
    setMoreError(null);
    setList((prev) => (prev?.key === key ? prev : null));
    api
      .listJobs(toJobsQuery(q, filters, 1), ac.signal)
      .then((res) => {
        if (mySeq !== seq.current) return;
        setList({ key, items: res.items, page: res.page, hasNext: res.has_more, total: res.total, resultCap: res.result_cap });
      })
      .catch((e) => {
        if (isAbort(e) || mySeq !== seq.current) return;
        setError(e);
      });
    return () => ac.abort();
  }, [key, q, filters, ready]);

  useEffect(() => loadFirst(), [loadFirst]);

  // 캐시 저장 (스크롤 위치 포함)
  useEffect(() => {
    if (!list || list.key !== key) return;
    const at = listCache.get(key)?.state === list ? listCache.get(key)!.at : Date.now();
    const save = () => listCache.set(key, { state: list, scrollY: window.scrollY, at });
    save();
    window.addEventListener("scroll", save, { passive: true });
    return () => {
      save();
      window.removeEventListener("scroll", save);
    };
  }, [list, key]);

  const loadMore = useCallback(async () => {
    if (!list || !list.hasNext || loadingMore || list.key !== key) return;
    setLoadingMore(true);
    setMoreError(null);
    const mySeq = seq.current;
    try {
      const res = await api.listJobs(toJobsQuery(q, filters, list.page + 1));
      if (mySeq !== seq.current) return;
      setList((prev) => {
        if (!prev || prev.key !== key) return prev;
        const seen = new Set(prev.items.map((j) => j.id));
        const fresh = res.items.filter((j) => !seen.has(j.id)); // 중복 카드 방지
        return { ...prev, items: [...prev.items, ...fresh], page: res.page, hasNext: res.has_more };
      });
    } catch (e) {
      if (mySeq === seq.current) setMoreError(e);
    } finally {
      setLoadingMore(false);
    }
  }, [list, loadingMore, key, q, filters]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !list?.hasNext || moreError) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), { rootMargin: "320px" });
    io.observe(el);
    return () => io.disconnect();
  }, [list, loadMore, moreError]);

  const applyFilters = (f: Filters) => {
    setSheetOpen(false);
    router.replace(`/jobs${buildSearch(input, f)}`, { scroll: false });
  };
  const removeFilter = (k: FilterKey) => applyFilters({ ...filters, [k]: undefined });
  const clearAll = () => {
    setInput("");
    router.replace("/jobs", { scroll: false });
  };

  const activeFilters = FILTER_KEYS.filter((k) => filters[k]);
  const summary = [q.trim() && `"${q.trim()}"`, ...activeFilters.map((k) => optionLabel(k, filters[k]!))].filter(Boolean).join(", ");
  const showList = list && list.key === key;

  return (
    <div className="page page--jobs">
      <header className="jobs-header">
        <div className="brand-row">
          <span className="brand">
            <img src="/icons/icon.svg" alt="" width={28} height={28} />
            <span className="brand__name">{dict.app.name}</span>
          </span>
        </div>
        <form className="search-row" role="search" onSubmit={(e) => { e.preventDefault(); router.replace(`/jobs${buildSearch(input, filters)}`, { scroll: false }); }}>
          <label className="search-field">
            <Search size={20} aria-hidden className="search-field__icon" />
            <span className="sr-only">{dict.jobs.searchLabel}</span>
            <input
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={dict.jobs.searchPlaceholder}
              maxLength={100}
            />
            {input && (
              <button type="button" className="icon-btn icon-btn--sm" aria-label={dict.common.reset} onClick={() => setInput("")}>
                <X size={18} aria-hidden />
              </button>
            )}
          </label>
          <button type="button" className={`filter-btn ${activeFilters.length ? "is-active" : ""}`} onClick={() => setSheetOpen(true)} aria-haspopup="dialog">
            <SlidersHorizontal size={20} aria-hidden />
            <span className="sr-only">{dict.jobs.filters}</span>
            {activeFilters.length > 0 && <span className="filter-btn__count" aria-label={fmt(dict.jobs.filterCount, { n: activeFilters.length })}>{activeFilters.length}</span>}
          </button>
        </form>
        {activeFilters.length > 0 && (
          <div className="chip-row chip-row--scroll" aria-label={dict.jobs.filters}>
            {activeFilters.map((k) => (
              <button key={k} className="chip is-selected chip--removable" onClick={() => removeFilter(k)} aria-label={`${dict.filter[k]}: ${optionLabel(k, filters[k]!)} — ${dict.common.reset}`}>
                {optionLabel(k, filters[k]!)}
                <X size={14} aria-hidden />
              </button>
            ))}
            <button className="chip chip--text" onClick={clearAll}>{dict.jobs.clearAll}</button>
          </div>
        )}
      </header>

      <div className="page__body">
        {!hasCriteria && (
          <Link href="/check" className="check-banner">
            <span className="check-banner__icon"><ScanSearch size={22} aria-hidden /></span>
            <span className="check-banner__text">
              <strong>{dict.jobs.checkBanner}</strong>
              <span>{dict.jobs.checkBannerCta}</span>
            </span>
          </Link>
        )}

        <div className="section-head">
          {hasCriteria ? (
            <>
              <h2 className="section-title" aria-live="polite">{showList ? fmt(dict.jobs.results, { n: list!.total.toLocaleString() }) : dict.common.loading}</h2>
              {showList && list!.resultCap != null && list!.total >= list!.resultCap && (
                <p className="section-sub">{fmt(dict.jobs.resultCap, { n: list!.resultCap })}</p>
              )}
            </>
          ) : (
            <>
              <h2 className="section-title">{recommended && session ? dict.jobs.recommended : dict.jobs.latest}</h2>
              <p className="section-sub">{recommended && session ? dict.jobs.recommendedHint : dict.jobs.latestHint}</p>
            </>
          )}
        </div>

        {error && !showList ? (
          <ErrorState error={error} onRetry={loadFirst} />
        ) : !showList ? (
          <div className="job-list" aria-busy="true" aria-label={dict.common.loading}>
            {Array.from({ length: 4 }).map((_, i) => <JobCardSkeleton key={i} />)}
          </div>
        ) : list!.items.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={dict.jobs.noResults}
            body={summary ? fmt(dict.jobs.noResultsHint, { summary }) : undefined}
            action={hasCriteria && <button className="btn btn--primary" onClick={clearAll}>{dict.jobs.clearAll}</button>}
          />
        ) : (
          <>
            {error && <ErrorBanner error={error} onRetry={loadFirst} />}
            <ul className="job-list">
              {list!.items.map((job) => <li key={job.id}><JobCard job={job} /></li>)}
            </ul>
            <div ref={sentinel} className="list-foot">
              {moreError ? (
                <ErrorBanner error={moreError} onRetry={loadMore} />
              ) : loadingMore ? (
                <Spinner label={dict.jobs.loadingMore} />
              ) : list!.hasNext ? (
                <button className="btn btn--ghost" onClick={loadMore}>{dict.common.more}</button>
              ) : (
                <p className="muted small">{dict.jobs.end}</p>
              )}
            </div>
          </>
        )}
      </div>

      <FilterSheet open={sheetOpen} onClose={() => setSheetOpen(false)} value={filters} onApply={applyFilters} />
    </div>
  );
}

export default function JobsPage() {
  return (
    <Suspense fallback={null}>
      <JobsHome />
    </Suspense>
  );
}
