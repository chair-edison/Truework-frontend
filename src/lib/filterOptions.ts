"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
import { STATIC_OPTIONS, type FilterKey } from "./jobsQuery";
import type { Job } from "./types";

// 서버에 필터 메타 API 가 없어, 최신 공고 일부를 한 번 받아 실제 값으로 선택지를 만든다.
// 결과를 걸러내는 용도가 아니라 "고를 수 있는 값" 목록을 만드는 용도다(필터링은 서버 쿼리로).
const SAMPLE_PAGES = 4;
const SAMPLE_LIMIT = 50;

export type FilterOptions = Record<FilterKey, string[]>;

let cache: Promise<FilterOptions> | null = null;

function collect(jobs: Job[]): FilterOptions {
  const sets: Record<FilterKey, Set<string>> = {
    location: new Set(), country: new Set(), work_scope: new Set(), occupation: new Set(), work_type: new Set(),
    source_type: new Set(), verification_status: new Set(), industry: new Set(),
  };
  const add = (k: FilterKey, v: unknown) => {
    if (typeof v === "string" && v.trim()) sets[k].add(v.trim());
  };
  for (const j of jobs) {
    add("location", j.location);
    add("country", j.country);
    add("occupation", j.occupation);
    add("work_type", j.work_type);
    add("industry", j.industry);
    add("source_type", j.sources?.type);
  }
  const out = {} as FilterOptions;
  for (const k of Object.keys(sets) as FilterKey[]) {
    out[k] = STATIC_OPTIONS[k] ?? [...sets[k]].sort((a, b) => a.localeCompare(b));
  }
  return out;
}

async function load(): Promise<FilterOptions> {
  const jobs: Job[] = [];
  for (let page = 1; page <= SAMPLE_PAGES; page++) {
    const res = await api.listJobs({ page, limit: SAMPLE_LIMIT, sort: "newest" });
    jobs.push(...res.items);
    if (!res.has_more) break;
  }
  return collect(jobs);
}

export function useFilterOptions(enabled: boolean) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (!enabled || options) return;
    cache ??= load();
    let alive = true;
    cache.then(
      (o) => alive && setOptions(o),
      (e) => {
        cache = null; // 다음에 다시 시도
        if (alive) setError(e);
      },
    );
    return () => {
      alive = false;
    };
  }, [enabled, options]);
  return { options, error };
}
