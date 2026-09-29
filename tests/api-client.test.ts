// API 클라이언트가 API.md 의 전송 형식을 지키는지 가짜 fetch 로 확인한다.
import { test, before } from "node:test";
import assert from "node:assert/strict";

type Call = { url: string; init: RequestInit };
const calls: Call[] = [];
let nextResponse: () => Response = () => new Response("{}", { status: 200 });

let api: typeof import("../src/lib/api").api;
let ApiError: typeof import("../src/lib/api").ApiError;
let configureAuth: typeof import("../src/lib/api").configureAuth;

before(async () => {
  process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.truework.test/";
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return nextResponse();
  }) as typeof fetch;
  ({ api, ApiError, configureAuth } = await import("../src/lib/api"));
});

const last = () => calls[calls.length - 1];
const headers = (c: Call) => c.init.headers as Record<string, string>;

test("모든 요청은 /api/v1 기본 경로를 쓰고 빈 쿼리는 보내지 않는다", async () => {
  nextResponse = () => Response.json({ items: [], page: 1, limit: 20, total: 0, has_more: false, result_cap: null });
  await api.listJobs({ q: "Factory worker", work_scope: "OVERSEAS", location: "", sort: "relevance", page: 1, limit: 20 });
  assert.equal(last().url, "https://api.truework.test/api/v1/jobs?q=Factory+worker&work_scope=OVERSEAS&sort=relevance&page=1&limit=20");
});

test("토큰이 있으면 Bearer 로 보낸다", async () => {
  configureAuth(async () => "tok_123", () => {});
  nextResponse = () => Response.json({ saved: true });
  await api.saveJob("00000000-0000-4000-8000-000000000001");
  assert.equal(last().init.method, "POST");
  assert.equal(headers(last()).Authorization, "Bearer tok_123");
  assert.equal(last().init.body, undefined, "저장은 본문 없음");
  configureAuth(async () => null, () => {});
});

test("스크린샷은 multipart 가 아닌 원시 바이트로 업로드한다", async () => {
  nextResponse = () => Response.json({ upload_id: "u", expires_at: "2026-09-30T00:00:00Z" }, { status: 201 });
  const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
  await api.uploadScreenshot(blob);
  assert.equal(last().url, "https://api.truework.test/api/v1/uploads/job-checks");
  assert.equal(headers(last())["Content-Type"], "image/jpeg");
  assert.ok(last().init.body instanceof Blob);
});

test("검사 생성은 입력 유형에 맞는 필드만 보내고 Idempotency-Key 를 붙인다", async () => {
  nextResponse = () => Response.json({ check_id: "c", status: "QUEUED", poll_after_ms: 2000 }, { status: 202 });
  const res = await api.createCheck({ input_type: "SCREENSHOT", upload_id: "u-1" }, "chk_abcdefgh");
  assert.equal(res.check_id, "c");
  assert.deepEqual(JSON.parse(last().init.body as string), { input_type: "SCREENSHOT", upload_id: "u-1" });
  assert.equal(headers(last())["Idempotency-Key"], "chk_abcdefgh");
  assert.match(headers(last())["Idempotency-Key"], /^[A-Za-z0-9_-]{8,128}$/);
});

test("오류 응답의 field_errors·retryable·request_id·Retry-After 를 해석한다", async () => {
  nextResponse = () =>
    Response.json(
      { error: { code: "INVALID_INPUT", message: "입력값을 확인해 주세요.", field_errors: [{ field: "limit", code: "INVALID", message: "1–50" }], retryable: false, request_id: "rid-1" } },
      { status: 422 },
    );
  await assert.rejects(api.listJobs({ limit: 99 }), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.status, 422);
    assert.equal(e.code, "INVALID_INPUT");
    assert.deepEqual(e.fields, { limit: "1–50" });
    assert.equal(e.retryable, false);
    assert.equal(e.requestId, "rid-1");
    return true;
  });

  nextResponse = () =>
    new Response(JSON.stringify({ error: { code: "RATE_LIMITED", message: "", retryable: true } }), { status: 429, headers: { "Retry-After": "60", "X-Request-Id": "rid-2" } });
  await assert.rejects(api.createCheck({ input_type: "TEXT", content: "x".repeat(30) }), (e: unknown) => {
    assert.ok(e instanceof ApiError);
    assert.equal(e.retryAfterSeconds, 60);
    assert.equal(e.requestId, "rid-2", "본문에 없으면 X-Request-Id 헤더 사용");
    return true;
  });
});

test("401 이고 토큰을 보냈다면 세션 만료 처리를 호출한다", async () => {
  let expired = 0;
  configureAuth(async () => "tok_old", () => expired++);
  nextResponse = () => Response.json({ error: { code: "AUTH_REQUIRED", message: "" } }, { status: 401 });
  await assert.rejects(api.getPreferences());
  assert.equal(expired, 1);
  configureAuth(async () => null, () => {});
});
