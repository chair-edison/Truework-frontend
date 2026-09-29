import { VERIFICATION_STATUSES, type VerificationStatus } from "./types";
import { track } from "./telemetry";

// 서버가 반환한 상태값을 "표현"에만 매핑한다. 상태를 계산·승격·축소하지 않는다.
export type StatusKey = VerificationStatus | "UNAVAILABLE";

const reported = new Set<string>();

export function toStatusKey(raw: string | null | undefined): StatusKey {
  if (raw && (VERIFICATION_STATUSES as readonly string[]).includes(raw)) return raw as VerificationStatus;
  const value = String(raw);
  if (!reported.has(value)) {
    reported.add(value);
    track("unknown_verification_status", { value });
  }
  return "UNAVAILABLE";
}
