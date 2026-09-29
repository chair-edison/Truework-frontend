// 백엔드 프록시: 브라우저 → (same-origin) /api/v1/* → BACKEND_URL/api/v1/*
// - Vercel Deployment Protection 우회 토큰을 서버에만 두고 브라우저 번들에 노출하지 않는다.
// - same-origin 이라 백엔드 CORS(ALLOWED_ORIGINS) 설정 없이도 동작한다.
// 요청·응답 본문은 로그에 남기지 않는다.

const BACKEND_URL = (process.env.BACKEND_URL ?? "").trim().replace(/\/+$/, "");
const BYPASS = (process.env.VERCEL_PROTECTION_BYPASS ?? "").trim();
const TIMEOUT_MS = 30_000;

const FORWARD_REQUEST_HEADERS = ["authorization", "content-type", "accept", "idempotency-key", "accept-language"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "x-request-id", "retry-after", "cache-control"];

function errorResponse(status: number, code: string, message: string, retryable: boolean) {
  const request_id = crypto.randomUUID();
  return Response.json(
    { error: { code, message, field_errors: [], retryable, request_id } },
    { status, headers: { "X-Request-Id": request_id } },
  );
}

async function proxy(request: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!BACKEND_URL) return errorResponse(503, "BACKEND_NOT_CONFIGURED", "BACKEND_URL is not set", false);
  const { path } = await ctx.params;
  const search = new URL(request.url).search;
  const target = `${BACKEND_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${search}`;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  if (BYPASS) headers.set("x-vercel-protection-bypass", BYPASS);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    return errorResponse(timedOut ? 504 : 502, timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_UNREACHABLE", "Backend unreachable", true);
  }

  // Vercel Deployment Protection 은 로그인 페이지로 302 를 보낸다.
  if (upstream.status >= 300 && upstream.status < 400) {
    return errorResponse(503, "BACKEND_PROTECTED", "Backend is behind Vercel Deployment Protection", false);
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  return new Response(upstream.status === 204 ? null : upstream.body, { status: upstream.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
