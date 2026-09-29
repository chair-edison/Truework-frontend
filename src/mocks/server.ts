// ⚠️ 데모 전용 목 백엔드. NEXT_PUBLIC_API_BASE_URL 이 비어 있을 때만 로드된다.
// 실제 판정 로직이 아니며, API.md 의 계약(경로·응답 형태·오류·비동기 처리)을 흉내 내기 위한 것이다.
import type {
  CheckStatus,
  CheckVerification,
  Extraction,
  Job,
  JobCheck,
  Preferences,
  Session,
} from "@/lib/types";
import { JOBS } from "./data";

const STORE_KEY = "tw.mock.v2";
type Scenario = "WARNING" | "OFFICIAL" | "UNVERIFIED" | "FAILED";
type Store = {
  users: Record<string, { id: string; name: string; email: string }>;
  tokens: Record<string, { user_id: string; expires_at: string }>;
  saved: Record<string, { job_id: string; saved_at: string }[]>;
  prefs: Record<string, Preferences>;
  uploads: Record<string, { user_id: string; created_at: string; used: boolean }>;
  checks: Record<string, { user_id: string; created_ms: number; scenario: Scenario; duration_ms: number; country: string | null }>;
  idem: Record<string, { check_id: string; body_hash: string }>;
};

const empty = (): Store => ({ users: {}, tokens: {}, saved: {}, prefs: {}, uploads: {}, checks: {}, idem: {} });
function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}
function persist(s: Store) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {}
}

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => ((Math.random() * 16) | 0).toString(16));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------- 응답 헬퍼 ----------

function respond(status: number, body: unknown, requestId: string, extra: Record<string, string> = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "X-Request-Id": requestId, ...extra },
  });
}
function fail(
  requestId: string,
  status: number,
  code: string,
  message: string,
  opts: { field_errors?: { field: string; code: string; message: string }[]; retryable?: boolean; headers?: Record<string, string> } = {},
) {
  return respond(
    status,
    { error: { code, message, field_errors: opts.field_errors ?? [], retryable: opts.retryable ?? status >= 500, request_id: requestId } },
    requestId,
    opts.headers,
  );
}
const invalid = (rid: string, field: string, message = "입력값을 확인해 주세요.") =>
  fail(rid, 422, "INVALID_INPUT", "입력값을 확인해 주세요.", { field_errors: [{ field, code: "INVALID", message }] });

function delay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

// 사용자별·기능별 분당 호출 제한 (기본 30회)
const hits = new Map<string, number[]>();
function rateLimited(userId: string, feature: string, limit = 30) {
  const key = `${userId}:${feature}`;
  const nowMs = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => nowMs - t < 60_000);
  list.push(nowMs);
  hits.set(key, list);
  return list.length > limit;
}

// ---------- 목 인증 (Supabase Auth 대체) ----------

export function mockIssueSession(email: string, name?: string): Session {
  const store = load();
  let user = Object.values(store.users).find((u) => u.email === email);
  if (!user) {
    user = { id: uuid(), name: name?.trim() || email.split("@")[0], email };
    store.users[user.id] = user;
  }
  const token = `mock.${uuid()}`;
  const expires_at = new Date(Date.now() + 3600_000).toISOString();
  store.tokens[token] = { user_id: user.id, expires_at };
  persist(store);
  return { token, expires_at, user };
}

function authUser(store: Store, headers: Record<string, string>) {
  const token = headers.Authorization?.replace(/^Bearer /, "");
  if (!token) return null;
  const t = store.tokens[token];
  if (!t || Date.parse(t.expires_at) < Date.now()) return "INVALID" as const;
  return store.users[t.user_id] ?? ("INVALID" as const);
}

// ---------- 공고 ----------

const isVisible = (j: Job) => j.active && j.sources?.active !== false && (!j.closes_at || Date.parse(j.closes_at) > Date.now());
const VERIFIED = new Set(["OFFICIAL", "VERIFIED_EMPLOYER"]);

function parsePaging(q: URLSearchParams, rid: string): { page: number; limit: number } | Response {
  const page = q.has("page") ? Number(q.get("page")) : 1;
  const limit = q.has("limit") ? Number(q.get("limit")) : 20;
  if (!Number.isInteger(page) || page < 1 || page > 10000) return invalid(rid, "page");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return invalid(rid, "limit");
  return { page, limit };
}

function defaultPrefs(): Preferences {
  return { occupations: [], locations: [], work_scope: "BOTH", experience_level: null, expected_salary_min: null, expected_salary_max: null, currency: null };
}

// ---------- 검사 ----------

function pickScenario(input_type: string, content: string | undefined): Scenario {
  const text = (content ?? "").toLowerCase();
  if (text.includes("force-fail")) return "FAILED";
  if (input_type === "SCREENSHOT") return "WARNING";
  if (/employment\.gov\.example|overseas-labour\.gov\.example/.test(text)) return "OFFICIAL";
  if (/(fee|deposit|phí|đặt cọc|passport|hộ chiếu|guarantee|40m|telegram|zalo|선입금|수수료|보증금|여권)/.test(text)) return "WARNING";
  return "UNVERIFIED";
}

const SAFETY_ALL = [
  "처리비·보증금·교육비 명목으로 돈을 보내기 전에 회사의 공식 채널로 채용 여부를 직접 확인하세요.",
  "정식 계약 전에는 신분증·여권 사진을 채팅 앱으로 보내지 마세요.",
  "근무지, 고용주, 계약서를 확인하기 전에 다른 지역이나 해외로 이동하지 마세요.",
  "제안 내용과 연락처를 가족이나 신뢰할 수 있는 사람과 공유하세요.",
];

function extractionFor(s: Scenario): Extraction {
  const base: Extraction = {
    raw_text: "(제출한 원문)", employer: null, job_title: null, location: null, salary: null, recruiter: null, contact_method: null,
    recruitment_fee: null, job_duties: null, employment_conditions: null, source_url: null, country: null, work_scope: "UNKNOWN",
  };
  if (s === "OFFICIAL")
    return { ...base, employer: "Bac Ninh Precision Electronics", job_title: "Factory Worker – Electronics Assembly", location: "Bac Ninh", salary: "8,500,000 – 11,000,000 VND / 월", contact_method: "공식 포털 지원 페이지", job_duties: "전자 부품 조립 및 검사", source_url: "https://employment.gov.example/jobs/BN-22871", country: "VN", work_scope: "DOMESTIC" };
  if (s === "UNVERIFIED") return { ...base, job_title: "Factory worker", location: "Ho Chi Minh City", country: "VN", work_scope: "DOMESTIC" };
  return { ...base, employer: "Global Work Link", job_title: "Overseas factory worker", location: "Taiwan", salary: "40,000,000 VND / 월", recruiter: "Mr. Tuan", contact_method: "채팅 앱 메시지", recruitment_fee: "처리비 3,000,000 VND 선납", country: "TW", work_scope: "OVERSEAS" };
}

function verificationFor(s: Scenario, checkId: string, at: string): CheckVerification {
  const ev = (n: number, kind: "POSITIVE" | "NEGATIVE" | "UNKNOWN", code: string, title: string, description: string, source_name: string | null = null, source_url: string | null = null) => ({
    id: `${checkId.slice(0, 24)}${String(n).padStart(12, "0")}`, job_check_id: checkId, kind, code, title, description, source_name, source_url, checked_at: at,
  });
  if (s === "OFFICIAL") {
    const e = [
      ev(1, "POSITIVE", "OFFICIAL_SOURCE_MATCH", "공식 포털 원본 확인", "공고 번호 BN-22871이 공식 포털에 게시되어 있습니다.", "National Employment Portal (demo)", "https://employment.gov.example/jobs/BN-22871"),
      ev(2, "POSITIVE", "EMPLOYER_REGISTERED", "기업 등록 정보 확인", "공개 기업 등록부와 일치합니다.", "Business Registry (demo)"),
      ev(3, "UNKNOWN", "SALARY_UNVERIFIED", "급여는 고용주 제출값", "급여는 독립적으로 검증되지 않았습니다."),
    ];
    return { status: "OFFICIAL", summary: "제출한 URL이 공식 고용 포털의 원본 공고와 일치합니다.", disclaimer: "이 결과는 안전 또는 사기 여부를 확정하지 않습니다.", risk_indicators: [], evidence: e, checked_at: at, policy_version: "1" };
  }
  if (s === "UNVERIFIED") {
    const e = [ev(1, "UNKNOWN", "EMPLOYER_UNKNOWN", "고용주 정보 없음", "내용에서 회사 이름을 찾지 못했습니다.")];
    return {
      status: "UNVERIFIED", summary: "충분한 근거를 확인하지 못했습니다.", disclaimer: "이 결과는 안전 또는 사기 여부를 확정하지 않습니다.",
      risk_indicators: [{ code: "UNKNOWN_EMPLOYER", severity: "LOW", explanation: "고용주를 특정할 수 없어 출처를 확인하지 못했습니다. 회사 이름이나 원본 링크를 함께 제출해 보세요.", evidence_ids: [e[0].id] }],
      evidence: e, checked_at: at, policy_version: "1",
    };
  }
  const e = [
    ev(1, "NEGATIVE", "FEE_PHRASE", "선입금 문구 발견", "'처리비 3,000,000 VND 선납' 문구가 확인되었습니다."),
    ev(2, "NEGATIVE", "LICENSE_NOT_FOUND", "라이선스 목록에 없음", "'Global Work Link'가 라이선스 보유 기관 목록에 없습니다.", "Licensed agency list (demo)", "https://overseas-labour.gov.example/licensed-agencies"),
    ev(3, "NEGATIVE", "SALARY_DEVIATION", "급여 편차", "대만 제조업 검증 공고 중앙값 대비 약 2.6배입니다.", "Truework verified job index"),
    ev(4, "UNKNOWN", "CONTACT_CHANNEL", "연락 방식 제한", "사무실 주소나 공식 연락처가 제공되지 않았습니다."),
    ev(5, "POSITIVE", "COUNTRY_PROGRAM_EXISTS", "해당 국가 공식 프로그램 존재", "대만 제조업 분야에는 정부 간 공식 채용 경로가 있습니다.", "Overseas Labour Management Board (demo)", "https://overseas-labour.gov.example"),
  ];
  return {
    status: "WARNING",
    summary: "주의가 필요한 특성 4가지가 발견되었습니다. 지원하거나 송금하기 전에 근거를 확인하세요.",
    disclaimer: "이 결과는 안전 또는 사기 여부를 확정하지 않습니다.",
    risk_indicators: [
      { code: "UPFRONT_FEE", severity: "HIGH", explanation: "메시지에 '처리비 선납' 요구가 포함되어 있습니다. 공식 해외 취업 프로그램은 지원 단계에서 개인에게 선입금을 요구하지 않는 경우가 많습니다.", evidence_ids: [e[0].id] },
      { code: "UNLICENSED_RECRUITER", severity: "HIGH", explanation: "모집자 또는 대행사 이름이 라이선스 보유 기관 목록에서 확인되지 않았습니다.", evidence_ids: [e[1].id] },
      { code: "SALARY_ABOVE_MARKET", severity: "MEDIUM", explanation: "제시된 급여가 같은 국가·직무의 검증된 공고 중앙값보다 크게 높습니다.", evidence_ids: [e[2].id] },
      { code: "OFF_PLATFORM_CONTACT", severity: "LOW", explanation: "공식 이메일이나 사무실 주소 없이 개인 채팅 앱으로만 연락하도록 안내하고 있습니다.", evidence_ids: [e[3].id] },
    ],
    evidence: e,
    checked_at: at,
    policy_version: "1",
  };
}

const LIFECYCLE: CheckStatus[] = ["QUEUED", "EXTRACTING", "VERIFYING", "EXPLAINING"];

function checkView(store: Store, id: string): JobCheck | null {
  const c = store.checks[id];
  if (!c) return null;
  const elapsed = Date.now() - c.created_ms;
  const updated_at = new Date(Math.min(Date.now(), c.created_ms + c.duration_ms)).toISOString();
  if (elapsed < c.duration_ms) {
    const idx = Math.min(LIFECYCLE.length - 1, Math.floor(elapsed / (c.duration_ms / LIFECYCLE.length)));
    return { check_id: id, status: LIFECYCLE[idx] as "QUEUED", updated_at, poll_after_ms: 2000 };
  }
  if (c.scenario === "FAILED") return { check_id: id, status: "FAILED", failure_code: "EXTRACTION_FAILED", retryable: true, updated_at };
  const extraction = extractionFor(c.scenario);
  return {
    check_id: id,
    status: "COMPLETED",
    updated_at,
    extraction,
    verification: verificationFor(c.scenario, id, updated_at),
    explanation:
      c.scenario === "WARNING"
        ? "제출한 내용에서 선입금 요구와 라이선스가 확인되지 않은 모집자가 발견되어 주의 상태로 분류되었습니다. 이는 사기 확정이 아닙니다."
        : c.scenario === "OFFICIAL"
          ? "제출한 링크가 인정된 공식 출처의 원본 공고와 일치합니다."
          : "고용주와 원본 출처를 특정할 정보가 부족해 결론을 내리지 못했습니다.",
    safety_guidance: c.scenario === "OFFICIAL" ? SAFETY_ALL.slice(0, 1) : SAFETY_ALL,
  };
}

async function hashBody(v: unknown) {
  return JSON.stringify(v);
}

// ---------- 라우터 ----------

export async function handleMockRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
): Promise<Response> {
  await delay(250 + Math.random() * 400, signal);
  const rid = uuid();
  const store = load();
  const u = new URL(url, "http://mock");
  const path = u.pathname.replace(/^\/api\/v1/, "");
  const q = u.searchParams;
  const user = authUser(store, headers);
  const optionalUser = user && user !== "INVALID" ? user : null;
  const requireUser = () => (user && user !== "INVALID" ? null : fail(rid, 401, "AUTH_REQUIRED", "로그인이 필요합니다."));
  const uid = () => (user as { id: string }).id;

  // GET /jobs
  if (method === "GET" && path === "/jobs") {
    const paging = parsePaging(q, rid);
    if (paging instanceof Response) return paging;
    const sort = q.get("sort");
    if (sort && !["newest", "relevance", "recommended"].includes(sort)) return invalid(rid, "sort");
    const ws = q.get("work_scope");
    if (ws && ws !== "DOMESTIC" && ws !== "OVERSEAS") return invalid(rid, "work_scope");
    const kw = (q.get("q") ?? "").replace(/[%_\\()]/g, "").trim().slice(0, 100).toLowerCase();
    const eq = (k: string, v: string | null) => !q.get(k) || v === q.get(k);

    let list = JOBS.filter(isVisible).filter(
      (j) =>
        (!kw || `${j.title} ${j.company_name} ${j.occupation ?? ""}`.toLowerCase().includes(kw)) &&
        (!q.get("location") || (j.location ?? "").toLowerCase().includes(q.get("location")!.toLowerCase())) &&
        eq("country", j.country) && eq("work_scope", j.work_scope) && eq("occupation", j.occupation) && eq("work_type", j.work_type) &&
        eq("source_type", j.sources?.type ?? null) && eq("verification_status", j.verification_status) && eq("industry", j.industry),
    );
    let result_cap: number | null = null;
    const byNewest = (a: Job, b: Job) => (b.published_at ?? "").localeCompare(a.published_at ?? "");
    if (sort === "recommended") {
      list = list.filter((j) => VERIFIED.has(j.verification_status));
      const p = optionalUser ? store.prefs[optionalUser.id] : undefined;
      const score = (j: Job) =>
        (p?.occupations.some((o) => j.title.toLowerCase().includes(o.toLowerCase())) ? 3 : 0) +
        (p?.locations.some((l) => (j.location ?? "").toLowerCase().includes(l.toLowerCase())) ? 2 : 0) +
        (p && p.work_scope !== "BOTH" && j.work_scope === p.work_scope ? 1 : 0);
      list = list.slice(0, 500).sort((a, b) => score(b) - score(a) || byNewest(a, b));
      result_cap = 500;
    } else if (sort === "relevance") {
      const score = (j: Job) => (j.title.toLowerCase().startsWith(kw) ? 2 : 0) + (j.title.toLowerCase().includes(kw) ? 1 : 0);
      list = list.slice(0, 500).sort((a, b) => score(b) - score(a) || byNewest(a, b));
      result_cap = 500;
    } else {
      list = list.sort(byNewest);
    }
    const { page, limit } = paging;
    const items = list.slice((page - 1) * limit, page * limit);
    return respond(200, { items, page, limit, total: list.length, has_more: page * limit < list.length, result_cap }, rid);
  }

  // GET /jobs/:id
  let m = path.match(/^\/jobs\/([^/]+)$/);
  if (method === "GET" && m) {
    const id = decodeURIComponent(m[1]);
    if (!UUID_RE.test(id)) return invalid(rid, "id");
    const job = JOBS.find((j) => j.id === id && isVisible(j));
    if (!job) return fail(rid, 404, "NOT_FOUND", "공고를 찾을 수 없습니다.");
    const saved = !!optionalUser && (store.saved[optionalUser.id] ?? []).some((s) => s.job_id === id);
    return respond(200, { job, saved }, rid);
  }

  // POST|DELETE /jobs/:id/save
  m = path.match(/^\/jobs\/([^/]+)\/save$/);
  if (m && (method === "POST" || method === "DELETE")) {
    const denied = requireUser();
    if (denied) return denied;
    const id = decodeURIComponent(m[1]);
    if (!UUID_RE.test(id)) return invalid(rid, "id");
    if (rateLimited(uid(), "saved")) return fail(rid, 429, "RATE_LIMITED", "요청이 많습니다.", { retryable: true, headers: { "Retry-After": "60" } });
    const list = store.saved[uid()] ?? [];
    if (method === "POST") {
      if (!JOBS.some((j) => j.id === id && isVisible(j))) return fail(rid, 404, "NOT_FOUND", "공고를 찾을 수 없습니다.");
      if (!list.some((s) => s.job_id === id)) list.push({ job_id: id, saved_at: new Date().toISOString() });
      store.saved[uid()] = list;
      persist(store);
      return respond(200, { saved: true }, rid);
    }
    store.saved[uid()] = list.filter((s) => s.job_id !== id);
    persist(store);
    return respond(200, { saved: false }, rid);
  }

  // GET /users/me/saved-jobs
  if (method === "GET" && path === "/users/me/saved-jobs") {
    const denied = requireUser();
    if (denied) return denied;
    const paging = parsePaging(q, rid);
    if (paging instanceof Response) return paging;
    const all = [...(store.saved[uid()] ?? [])]
      .sort((a, b) => b.saved_at.localeCompare(a.saved_at))
      .map((s) => ({ saved_at: s.saved_at, job: JOBS.find((j) => j.id === s.job_id && isVisible(j)) }))
      .filter((x): x is { saved_at: string; job: Job } => !!x.job);
    const { page, limit } = paging;
    return respond(200, { items: all.slice((page - 1) * limit, page * limit), page, limit, total: all.length, has_more: page * limit < all.length }, rid);
  }

  // GET|PUT /users/me/preferences
  if (path === "/users/me/preferences" && (method === "GET" || method === "PUT")) {
    const denied = requireUser();
    if (denied) return denied;
    const current = store.prefs[uid()] ?? defaultPrefs();
    if (method === "GET") return respond(200, { preferences: current }, rid);
    if (rateLimited(uid(), "preferences")) return fail(rid, 429, "RATE_LIMITED", "요청이 많습니다.", { retryable: true, headers: { "Retry-After": "60" } });
    const b = (body ?? {}) as Record<string, unknown>;
    const allowed = ["occupations", "locations", "work_scope", "experience_level", "expected_salary_min", "expected_salary_max", "currency"];
    for (const k of Object.keys(b)) if (!allowed.includes(k)) return invalid(rid, k);
    for (const k of ["occupations", "locations"]) {
      const v = b[k];
      if (v !== undefined && (!Array.isArray(v) || v.length > 20 || v.some((x) => typeof x !== "string" || x.length > 100))) return invalid(rid, k);
    }
    if (b.work_scope !== undefined && !["DOMESTIC", "OVERSEAS", "BOTH"].includes(b.work_scope as string)) return invalid(rid, "work_scope");
    for (const k of ["expected_salary_min", "expected_salary_max"]) {
      const v = b[k];
      if (v !== undefined && v !== null && (typeof v !== "number" || v < 0)) return invalid(rid, k);
    }
    const next = { ...current, ...b } as Preferences;
    if (next.expected_salary_min != null && next.expected_salary_max != null && next.expected_salary_max < next.expected_salary_min)
      return invalid(rid, "expected_salary_max", "최댓값은 최솟값 이상이어야 합니다.");
    if (b.currency !== undefined && b.currency !== null && !/^[A-Z]{3}$/.test(b.currency as string)) return invalid(rid, "currency");
    store.prefs[uid()] = next;
    persist(store);
    return respond(200, { preferences: next }, rid);
  }

  // POST /uploads/job-checks — 원시 이미지 바이트
  if (method === "POST" && path === "/uploads/job-checks") {
    const denied = requireUser();
    if (denied) return denied;
    if (rateLimited(uid(), "uploads")) return fail(rid, 429, "RATE_LIMITED", "요청이 많습니다.", { retryable: true, headers: { "Retry-After": "60" } });
    const blob = body as Blob | undefined;
    const type = headers["Content-Type"] ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return fail(rid, 415, "UNSUPPORTED_IMAGE", "지원하지 않는 이미지 형식입니다.");
    if (!blob || blob.size === 0) return fail(rid, 415, "INVALID_IMAGE", "이미지를 읽을 수 없습니다.");
    if (blob.size > 4 * 1024 * 1024) return fail(rid, 413, "FILE_TOO_LARGE", "파일이 너무 큽니다.");
    await delay(500, signal);
    const upload_id = uuid();
    store.uploads[upload_id] = { user_id: uid(), created_at: new Date().toISOString(), used: false };
    persist(store);
    return respond(201, { upload_id, expires_at: new Date(Date.now() + 24 * 3600_000).toISOString() }, rid);
  }

  // POST /job-checks
  if (method === "POST" && path === "/job-checks") {
    const denied = requireUser();
    if (denied) return denied;
    if (rateLimited(uid(), "job-checks")) return fail(rid, 429, "RATE_LIMITED", "요청이 많습니다.", { retryable: true, headers: { "Retry-After": "60" } });
    const b = (body ?? {}) as { input_type?: string; content?: string; upload_id?: string };
    if (JSON.stringify(b).length > 21_000) return fail(rid, 413, "BODY_TOO_LARGE", "본문이 너무 큽니다.");
    const lang = q.get("language");
    if (lang !== null && !["english", "korean", "vietnamese"].includes(lang)) return invalid(rid, "language");
    const key = headers["Idempotency-Key"];
    if (key !== undefined && !/^[A-Za-z0-9_-]{8,128}$/.test(key)) return invalid(rid, "Idempotency-Key");

    if (b.input_type === "TEXT") {
      if (b.upload_id !== undefined) return invalid(rid, "upload_id");
      if (typeof b.content !== "string" || b.content.trim().length < 20) return invalid(rid, "content", "20자 이상 입력해 주세요.");
      if (b.content.length > 20_000) return invalid(rid, "content", "20,000자 이하로 입력해 주세요.");
    } else if (b.input_type === "URL") {
      if (b.upload_id !== undefined) return invalid(rid, "upload_id");
      try {
        const parsed = new URL(b.content ?? "");
        if (parsed.protocol !== "https:" || parsed.port || parsed.username || parsed.password) throw new Error();
      } catch {
        return invalid(rid, "content", "HTTPS 주소를 입력해 주세요.");
      }
    } else if (b.input_type === "SCREENSHOT") {
      if (b.content !== undefined) return invalid(rid, "content");
      const up = b.upload_id ? store.uploads[b.upload_id] : undefined;
      if (!b.upload_id || !UUID_RE.test(b.upload_id)) return invalid(rid, "upload_id");
      if (!up || up.user_id !== uid() || up.used || Date.parse(up.created_at) + 24 * 3600_000 < Date.now())
        return fail(rid, 409, "UPLOAD_UNAVAILABLE", "업로드를 사용할 수 없습니다.");
    } else {
      return invalid(rid, "input_type");
    }
    if ((b.content ?? "").includes("force-429")) return fail(rid, 429, "RATE_LIMITED", "요청이 많습니다.", { retryable: true, headers: { "Retry-After": "60" } });
    if ((b.content ?? "").includes("force-500")) return fail(rid, 500, "INTERNAL_ERROR", "서버 오류", { retryable: true });

    const bodyHash = await hashBody(b);
    if (key) {
      const prev = store.idem[`${uid()}:${key}`];
      if (prev && prev.body_hash !== bodyHash) return fail(rid, 409, "IDEMPOTENCY_CONFLICT", "같은 키로 다른 요청이 있습니다.");
      if (prev) {
        const view = checkView(store, prev.check_id)!;
        return respond(202, { check_id: prev.check_id, status: view.status, poll_after_ms: 2000 }, rid);
      }
    }
    const check_id = uuid();
    store.checks[check_id] = {
      user_id: uid(),
      created_ms: Date.now(),
      scenario: pickScenario(b.input_type, b.content),
      duration_ms: (b.content ?? "").includes("slow") ? 90_000 : 8_000,
      country: null,
    };
    if (b.input_type === "SCREENSHOT") store.uploads[b.upload_id!].used = true;
    if (key) store.idem[`${uid()}:${key}`] = { check_id, body_hash: bodyHash };
    persist(store);
    return respond(202, { check_id, status: "QUEUED", poll_after_ms: 2000 }, rid);
  }

  // GET /job-checks/:id(/alternatives)
  m = path.match(/^\/job-checks\/([^/]+)(\/alternatives)?$/);
  if (method === "GET" && m) {
    const denied = requireUser();
    if (denied) return denied;
    const id = decodeURIComponent(m[1]);
    if (!UUID_RE.test(id)) return invalid(rid, "id");
    if (store.checks[id]?.user_id !== uid()) return fail(rid, 404, "NOT_FOUND", "검사를 찾을 수 없습니다.");
    const view = checkView(store, id)!;
    if (!m[2]) return respond(200, view, rid);
    if (view.status !== "COMPLETED") return fail(rid, 409, "CHECK_NOT_COMPLETE", "검사가 아직 완료되지 않았습니다.");
    const country = view.extraction.country;
    const title = view.extraction.job_title;
    const items = JOBS.filter(isVisible)
      .filter((j) => VERIFIED.has(j.verification_status) && (!country || j.country === country) && j.source_url !== view.extraction.source_url)
      .sort((a, b) => Number(b.occupation === "MANUFACTURING") - Number(a.occupation === "MANUFACTURING"))
      .slice(0, 10);
    return respond(200, { items, criteria: { country, job_title: title, location: view.extraction.location } }, rid);
  }

  return fail(rid, 404, "NOT_FOUND", "Not found");
}
