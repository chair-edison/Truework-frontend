import type {
  AlternativesResponse,
  ApiErrorBody,
  CreateJobCheckRequest,
  CreateJobCheckResponse,
  JobCheck,
  JobDetailResponse,
  JobsListResponse,
  JobsQuery,
  PreferencesResponse,
  PreferencesUpdate,
  SaveResponse,
  SavedJobsResponse,
  UploadResponse,
} from "./types";

const ORIGIN = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
export const USING_MOCK = ORIGIN === "";
const API_PREFIX = "/api/v1";

export class ApiError extends Error {
  status: number; // 0 = 네트워크 오류
  code: string;
  requestId?: string;
  fields?: Record<string, string>;
  retryable: boolean;
  retryAfterSeconds?: number;

  constructor(status: number, body: Partial<ApiErrorBody["error"]>, retryAfterSeconds?: number) {
    super(body.message ?? "Request failed");
    this.status = status;
    this.code = body.code ?? (status === 0 ? "NETWORK_ERROR" : "UNKNOWN");
    this.requestId = body.request_id;
    this.retryable = body.retryable ?? (status === 0 || status === 429 || status >= 500);
    this.retryAfterSeconds = retryAfterSeconds;
    if (body.field_errors?.length) {
      this.fields = Object.fromEntries(body.field_errors.map((f) => [f.field, f.message]));
    }
  }
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";

type Query = Record<string, string | number | boolean | undefined | null>;
type RequestOptions = {
  query?: Query;
  json?: unknown;
  /** 원시 바이트 본문(스크린샷 업로드). Content-Type 은 blob.type 을 쓴다. */
  blob?: Blob;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

// 인증 토큰은 AuthProvider 가 주입한다. 토큰을 로그/분석에 남기지 않는다.
let tokenGetter: () => Promise<string | null> = async () => null;
let unauthorizedHandler: () => void = () => {};
export function configureAuth(getToken: () => Promise<string | null>, onUnauthorized: () => void) {
  tokenGetter = getToken;
  unauthorizedHandler = onUnauthorized;
}

function buildQuery(query?: Query) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = API_PREFIX + path + buildQuery(opts.query);
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  const token = await tokenGetter();
  if (token) headers.Authorization = `Bearer ${token}`;

  let body: BodyInit | undefined;
  if (opts.blob) {
    headers["Content-Type"] = opts.blob.type || "application/octet-stream";
    body = opts.blob;
  } else if (opts.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.json);
  }

  let res: Response;
  try {
    if (USING_MOCK) {
      const { handleMockRequest } = await import("@/mocks/server");
      res = await handleMockRequest(method, url, headers, opts.blob ?? opts.json, opts.signal);
    } else {
      res = await fetch(ORIGIN + url, { method, headers, body, signal: opts.signal });
    }
  } catch (e) {
    if (isAbort(e)) throw e;
    throw new ApiError(0, { message: "Network error" });
  }

  const requestId = res.headers.get("x-request-id") ?? undefined;
  if (res.status === 204) return undefined as T;

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err: Partial<ApiErrorBody["error"]> = (data as ApiErrorBody | null)?.error ?? {};
    const retryAfter = Number(res.headers.get("retry-after"));
    const apiErr = new ApiError(
      res.status,
      { ...err, request_id: err.request_id ?? requestId },
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
    if (res.status === 401 && token) unauthorizedHandler();
    throw apiErr;
  }
  return data as T;
}

export const api = {
  // Jobs — 인증 없이 조회 가능, 토큰이 있으면 개인화·저장 여부 반영
  listJobs: (query: JobsQuery, signal?: AbortSignal) => request<JobsListResponse>("GET", "/jobs", { query, signal }),
  getJob: (id: string, signal?: AbortSignal) => request<JobDetailResponse>("GET", `/jobs/${encodeURIComponent(id)}`, { signal }),

  // Saved (인증 필요)
  listSaved: (page = 1, limit = 50, signal?: AbortSignal) =>
    request<SavedJobsResponse>("GET", "/users/me/saved-jobs", { query: { page, limit }, signal }),
  saveJob: (id: string) => request<SaveResponse>("POST", `/jobs/${encodeURIComponent(id)}/save`),
  unsaveJob: (id: string) => request<SaveResponse>("DELETE", `/jobs/${encodeURIComponent(id)}/save`),

  // Job checks (인증 필요)
  uploadScreenshot: (image: Blob) => request<UploadResponse>("POST", "/uploads/job-checks", { blob: image }),
  createCheck: (body: CreateJobCheckRequest, idempotencyKey?: string) =>
    request<CreateJobCheckResponse>("POST", "/job-checks", {
      json: body,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
    }),
  getCheck: (id: string, signal?: AbortSignal) => request<JobCheck>("GET", `/job-checks/${encodeURIComponent(id)}`, { signal }),
  getAlternatives: (id: string, signal?: AbortSignal) =>
    request<AlternativesResponse>("GET", `/job-checks/${encodeURIComponent(id)}/alternatives`, { signal }),

  // Preferences (인증 필요) — PUT 은 제공한 필드만 갱신
  getPreferences: (signal?: AbortSignal) => request<PreferencesResponse>("GET", "/users/me/preferences", { signal }),
  putPreferences: (body: PreferencesUpdate) => request<PreferencesResponse>("PUT", "/users/me/preferences", { json: body }),
};

/** Idempotency-Key: 영문·숫자·_·- 8~128자 */
export function newIdempotencyKey() {
  const rand = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `chk_${rand}`;
}
