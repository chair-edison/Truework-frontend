// 인증 어댑터. 실제 환경은 Supabase Auth, 목 API 모드는 로컬 목 인증을 쓴다.
// API 요청에는 Supabase access token 을 Bearer 로 보낸다(API.md 공통 규칙).
import { createClient, type SupabaseClient, type Session as SbSession } from "@supabase/supabase-js";
import { USING_MOCK } from "./api";
import type { Session } from "./types";

export type SignUpResult = { session: Session | null; needsEmailConfirm: boolean };

export interface AuthAdapter {
  getSession(): Promise<Session | null>;
  getToken(): Promise<string | null>;
  signIn(email: string, password: string): Promise<Session>;
  signUp(name: string, email: string, password: string): Promise<SignUpResult>;
  signOut(): Promise<void>;
  onChange(cb: (s: Session | null) => void): () => void;
}

export class AuthError extends Error {
  constructor(public code: "INVALID_CREDENTIALS" | "EMAIL_NOT_CONFIRMED" | "WEAK_PASSWORD" | "NOT_CONFIGURED" | "UNKNOWN", message?: string) {
    super(message ?? code);
  }
}

// ---------- Supabase ----------

function toSession(s: SbSession | null): Session | null {
  if (!s) return null;
  const meta = (s.user.user_metadata ?? {}) as { name?: string };
  return {
    token: s.access_token,
    expires_at: new Date((s.expires_at ?? 0) * 1000).toISOString(),
    user: { id: s.user.id, email: s.user.email ?? "", name: meta.name || (s.user.email ?? "").split("@")[0] },
  };
}

function mapSbError(e: { message?: string; code?: string } | null): AuthError {
  const code = e?.code ?? "";
  if (code === "invalid_credentials") return new AuthError("INVALID_CREDENTIALS");
  if (code === "email_not_confirmed") return new AuthError("EMAIL_NOT_CONFIRMED");
  if (code === "weak_password") return new AuthError("WEAK_PASSWORD");
  return new AuthError("UNKNOWN", e?.message);
}

function supabaseAdapter(client: SupabaseClient): AuthAdapter {
  return {
    async getSession() {
      const { data } = await client.auth.getSession();
      return toSession(data.session);
    },
    async getToken() {
      // getSession 은 만료 임박 시 자동 갱신된 토큰을 돌려준다.
      const { data } = await client.auth.getSession();
      return data.session?.access_token ?? null;
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw mapSbError(error);
      return toSession(data.session)!;
    },
    async signUp(name, email, password) {
      // 인증 메일 링크가 이 앱의 로그인 화면으로 돌아오게 한다(Supabase Redirect URLs 에 등록 필요).
      const emailRedirectTo = typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
      const { data, error } = await client.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo } });
      if (error) throw mapSbError(error);
      return { session: toSession(data.session), needsEmailConfirm: !data.session };
    },
    async signOut() {
      await client.auth.signOut({ scope: "local" });
    },
    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, s) => cb(toSession(s)));
      return () => data.subscription.unsubscribe();
    },
  };
}

// ---------- Mock (NEXT_PUBLIC_API_BASE_URL 미설정 시) ----------

const MOCK_KEY = "tw.session";

function mockAdapter(): AuthAdapter {
  const listeners = new Set<(s: Session | null) => void>();
  const read = (): Session | null => {
    try {
      const s = JSON.parse(localStorage.getItem(MOCK_KEY) ?? "null") as Session | null;
      return s && new Date(s.expires_at).getTime() > Date.now() ? s : null;
    } catch {
      return null;
    }
  };
  const write = (s: Session | null) => {
    try {
      s ? localStorage.setItem(MOCK_KEY, JSON.stringify(s)) : localStorage.removeItem(MOCK_KEY);
    } catch {}
    listeners.forEach((l) => l(s));
  };
  const issue = async (email: string, password: string, name?: string) => {
    if (password.length < 8) throw new AuthError("WEAK_PASSWORD");
    const { mockIssueSession } = await import("@/mocks/server");
    const s = mockIssueSession(email, name);
    write(s);
    return s;
  };
  return {
    getSession: async () => read(),
    getToken: async () => read()?.token ?? null,
    signIn: (email, password) => issue(email, password),
    signUp: async (name, email, password) => ({ session: await issue(email, password, name), needsEmailConfirm: false }),
    signOut: async () => write(null),
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

// ---------- 선택 ----------

const SB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const SB_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

function unconfiguredAdapter(): AuthAdapter {
  const fail = async (): Promise<never> => {
    throw new AuthError("NOT_CONFIGURED");
  };
  return { getSession: async () => null, getToken: async () => null, signIn: fail, signUp: fail, signOut: async () => {}, onChange: () => () => {} };
}

let adapter: AuthAdapter | null = null;
export function getAuthAdapter(): AuthAdapter {
  if (adapter) return adapter;
  if (SB_URL && SB_KEY) {
    adapter = supabaseAdapter(createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } }));
  } else if (USING_MOCK) {
    adapter = mockAdapter();
  } else {
    adapter = unconfiguredAdapter();
  }
  return adapter;
}
