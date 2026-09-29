import type { JobSort, JobsQuery, VerificationStatus, WorkScope } from "./types";

// URL ↔ 쿼리 변환. 검색·필터 상태를 URL 에 두어 뒤로가기·딥링크에서도 유지한다.
// 키 이름은 GET /api/v1/jobs 쿼리 파라미터와 같다.
export const FILTER_KEYS = ["location", "country", "work_scope", "occupation", "work_type", "source_type", "verification_status", "industry"] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];
export type Filters = Partial<Record<FilterKey, string>>;

export const PAGE_LIMIT = 20;

// 필터 선택지. occupation / work_type / source_type / industry 값은 서버 DB 값과 맞춰야 한다.
// (API 명세에 값 목록이 없으므로 서버 메타 API가 생기면 교체)
export const FILTER_OPTIONS: Record<FilterKey, string[]> = {
  location: ["Ho Chi Minh City", "Hanoi", "Da Nang", "Hai Phong", "Bac Ninh", "Binh Duong", "Dong Nai", "Can Tho"],
  country: ["VN", "KR", "JP", "TW"],
  work_scope: ["DOMESTIC", "OVERSEAS"],
  occupation: ["MANUFACTURING", "LOGISTICS", "HOSPITALITY", "CARE", "OFFICE", "AGRICULTURE", "CONSTRUCTION", "RETAIL"],
  work_type: ["FULL_TIME", "PART_TIME", "CONTRACT", "SEASONAL"],
  source_type: ["GOVERNMENT", "EMPLOYER", "PARTNER", "JOB_BOARD"],
  verification_status: ["OFFICIAL", "VERIFIED_EMPLOYER", "UNVERIFIED", "WARNING"],
  industry: ["ELECTRONICS", "TEXTILE", "FOOD", "LOGISTICS", "MACHINERY", "AUTOMOTIVE", "TOURISM", "HEALTHCARE", "CONSTRUCTION", "AGRICULTURE", "IT", "RETAIL"],
};

export function readFilters(sp: URLSearchParams): Filters {
  const f: Filters = {};
  for (const k of FILTER_KEYS) {
    const v = sp.get(k);
    if (v) f[k] = v;
  }
  return f;
}

export function hasCriteria(q: string, f: Filters) {
  return !!q.trim() || FILTER_KEYS.some((k) => f[k]);
}

/** 조건이 없으면 추천(검증된 공고, 토큰이 있으면 선호도 반영), 검색어가 있으면 관련도, 필터만 있으면 최신순. */
export function pickSort(q: string, f: Filters): JobSort {
  if (q.trim()) return "relevance";
  return hasCriteria(q, f) ? "newest" : "recommended";
}

export function toJobsQuery(q: string, f: Filters, page: number): JobsQuery {
  return {
    q: q.trim().slice(0, 100) || undefined,
    location: f.location,
    country: f.country,
    work_scope: f.work_scope as WorkScope | undefined,
    occupation: f.occupation,
    work_type: f.work_type,
    source_type: f.source_type,
    verification_status: f.verification_status as VerificationStatus | undefined,
    industry: f.industry,
    sort: pickSort(q, f),
    page,
    limit: PAGE_LIMIT,
  };
}

export function buildSearch(q: string, f: Filters) {
  const sp = new URLSearchParams();
  if (q.trim()) sp.set("q", q.trim());
  for (const k of FILTER_KEYS) if (f[k]) sp.set(k, f[k]!);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
