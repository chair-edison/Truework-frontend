// 개인정보 없는 진단 이벤트만 기록한다.
// 토큰·원문 메시지·스크린샷·이메일은 절대 넘기지 않는다(허용 키만 통과).
const ALLOWED_KEYS = new Set(["value", "status", "code", "request_id", "input_type", "stage", "screen", "result"]);

export function track(event: string, props: Record<string, string | number | boolean | undefined> = {}) {
  const safe: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    if (ALLOWED_KEYS.has(k) && v !== undefined) safe[k] = v;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info("[telemetry]", event, safe);
  }
  // TODO: 분석 도구 연동 지점
}
