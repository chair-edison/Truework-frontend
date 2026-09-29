// 기기에 남기는 가벼운 상태(민감 정보 없음).
import type { CheckInputType, PreferencesUpdate } from "./types";

const ONBOARD_KEY = "tw.onboarded";
const CHECKS_KEY = "tw.checks";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function isOnboarded() {
  return read<boolean>(ONBOARD_KEY, false);
}
export function setOnboarded() {
  write(ONBOARD_KEY, true);
}

// 검사 ID 만 보존한다(원문 내용은 저장하지 않음). 화면을 벗어나도 복귀 시 재조회 가능.
export type CheckRef = { id: string; input_type: CheckInputType; created_at: string; done?: boolean };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function listCheckRefs(): CheckRef[] {
  return read<CheckRef[]>(CHECKS_KEY, []).filter((r) => UUID_RE.test(r.id));
}
export function addCheckRef(ref: CheckRef) {
  write(CHECKS_KEY, [ref, ...listCheckRefs().filter((r) => r.id !== ref.id)].slice(0, 10));
}
export function markCheckDone(id: string) {
  write(CHECKS_KEY, listCheckRefs().map((r) => (r.id === id ? { ...r, done: true } : r)));
}

// 로그인 전 온보딩에서 입력한 선호 조건. 로그인 시 서버로 옮긴 뒤 지운다.
const LOCAL_PREFS_KEY = "tw.prefs.pending";
export function getLocalPrefs(): PreferencesUpdate | null {
  return read<PreferencesUpdate | null>(LOCAL_PREFS_KEY, null);
}
export function setLocalPrefs(p: PreferencesUpdate | null) {
  if (p) write(LOCAL_PREFS_KEY, p);
  else {
    try {
      localStorage.removeItem(LOCAL_PREFS_KEY);
    } catch {}
  }
}
