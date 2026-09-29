"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { configureAuth } from "@/lib/api";
import { getAuthAdapter } from "@/lib/auth";
import type { Session } from "@/lib/types";

const PENDING_KEY = "tw.pendingAction";

export type LoginReason = "save" | "saved" | "prefs" | "check" | "expired";
export type PendingAction = { type: "save"; jobId: string };

type Ctx = {
  session: Session | null;
  ready: boolean;
  expired: boolean;
  signIn: (email: string, password: string) => Promise<Session>;
  signUp: (name: string, email: string, password: string) => Promise<{ session: Session | null; needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
  requireLogin: (reason: LoginReason, pending?: PendingAction) => void;
  takePendingAction: () => PendingAction | null;
};

const AuthContext = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const auth = getAuthAdapter();
    configureAuth(
      () => auth.getToken(),
      () => {
        // 401: 토큰이 거부됨 → 로컬 세션 제거 후 재로그인 유도
        void auth.signOut();
        setSession(null);
        setExpired(true);
      },
    );
    let alive = true;
    auth.getSession().then((s) => {
      if (!alive) return;
      setSession(s);
      setReady(true);
    });
    const off = auth.onChange((s) => setSession(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const requireLogin = useCallback<Ctx["requireLogin"]>(
    (reason, pending) => {
      try {
        pending ? sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending)) : sessionStorage.removeItem(PENDING_KEY);
      } catch {}
      const qs = search.toString();
      const next = pathname + (qs ? `?${qs}` : "");
      router.push(`/login?reason=${reason}&next=${encodeURIComponent(next)}`);
    },
    [router, pathname, search],
  );

  const takePendingAction = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
      return raw ? (JSON.parse(raw) as PendingAction) : null;
    } catch {
      return null;
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const s = await getAuthAdapter().signIn(email, password);
    setSession(s);
    setExpired(false);
    return s;
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const r = await getAuthAdapter().signUp(name, email, password);
    if (r.session) {
      setSession(r.session);
      setExpired(false);
    }
    return r;
  }, []);

  const signOut = useCallback(async () => {
    await getAuthAdapter().signOut();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ session, ready, expired, signIn, signUp, signOut, requireLogin, takePendingAction }),
    [session, ready, expired, signIn, signUp, signOut, requireLogin, takePendingAction],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** 로그인 후 돌아갈 경로. 외부 URL 로의 open redirect 를 막는다. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/jobs";
  return next;
}
