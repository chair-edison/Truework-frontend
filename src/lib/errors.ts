import { ApiError } from "./api";
import type { Dict } from "@/i18n/ko";
import { fmt } from "@/i18n";

export type ErrorKind =
  | "network"
  | "notFound"
  | "rateLimited"
  | "server"
  | "unavailable"
  | "validation"
  | "auth"
  | "conflict"
  | "tooLarge"
  | "unsupported";

export function errorKind(e: unknown): ErrorKind {
  if (!(e instanceof ApiError)) return "server";
  switch (e.status) {
    case 0: return "network";
    case 401: case 403: return "auth";
    case 404: return "notFound";
    case 409: return "conflict";
    case 413: return "tooLarge";
    case 415: return "unsupported";
    case 400: case 422: return "validation";
    case 429: return "rateLimited";
    case 503: return "unavailable";
    default: return "server";
  }
}

/** 사용자에게 보여줄 안전한 일반 문구. 서버 메시지는 필드 오류에만 연결한다. */
export function describeError(e: unknown, d: Dict) {
  const kind = errorKind(e);
  const apiErr = e instanceof ApiError ? e : null;
  let copy = d.errors[kind === "rateLimited" && !apiErr?.retryAfterSeconds ? "rateLimitedNoTime" : kind];
  if (kind === "rateLimited" && apiErr?.retryAfterSeconds) {
    copy = { ...copy, body: fmt(copy.body, { s: apiErr.retryAfterSeconds }) };
  }
  return {
    kind,
    code: apiErr?.code,
    title: copy.title,
    body: copy.body,
    requestId: apiErr?.requestId,
    fields: apiErr?.fields,
    // 서버가 retryable 을 알려주면 그 값을 따른다.
    retryable: apiErr ? apiErr.retryable : true,
  };
}
