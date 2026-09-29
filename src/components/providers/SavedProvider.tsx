"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { describeError } from "@/lib/errors";
import { fmt, useI18n } from "@/i18n";
import { useAuth } from "./AuthProvider";
import { useToast } from "./ToastProvider";

type Ctx = {
  isSaved: (id: string) => boolean;
  isPending: (id: string) => boolean;
  toggle: (id: string) => Promise<void>;
  /** 공고 상세 응답의 saved 값으로 로컬 상태를 맞춘다(서버 값 우선). */
  sync: (id: string, saved: boolean) => void;
  version: number; // 저장 목록 재조회 트리거
};

const SavedContext = createContext<Ctx | null>(null);

export function SavedProvider({ children }: { children: ReactNode }) {
  const { session, ready, requireLogin, takePendingAction } = useAuth();
  const { dict } = useI18n();
  const toast = useToast();
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const [version, setVersion] = useState(0);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const setSavedRef = useRef<(id: string, next: boolean) => Promise<void>>(async () => {});

  // 로그인 상태가 바뀌면 서버 저장 목록으로 동기화
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      setIds(new Set());
      return;
    }
    const ac = new AbortController();
    api
      .listSaved(1, 50, ac.signal)
      .then((res) => {
        const serverIds = new Set(res.items.map((it) => it.job.id));
        setIds(serverIds);
        // 로그인 후 원래 하려던 저장 행동을 재개 (동기화가 끝난 뒤에 실행해야 덮어쓰지 않음)
        const action = takePendingAction();
        if (action?.type === "save" && !serverIds.has(action.jobId)) void setSavedRef.current(action.jobId, true);
      })
      .catch(() => {});
    return () => ac.abort();
  }, [session, ready, takePendingAction]);

  const setSaved = useCallback(
    async (id: string, next: boolean, announce = true) => {
      setPending((p) => new Set(p).add(id));
      setIds((prev) => {
        const s = new Set(prev);
        next ? s.add(id) : s.delete(id);
        return s;
      }); // 낙관적 업데이트
      try {
        const res = await (next ? api.saveJob(id) : api.unsaveJob(id));
        if (res && res.saved !== next) {
          setIds((prev) => {
            const s2 = new Set(prev);
            res.saved ? s2.add(id) : s2.delete(id);
            return s2;
          });
        }
        setVersion((v) => v + 1);
        if (announce) toast.show(next ? dict.saved.added : dict.saved.removed);
      } catch (e) {
        setIds((prev) => {
          const s = new Set(prev);
          next ? s.delete(id) : s.add(id);
          return s;
        }); // 롤백
        const info = describeError(e, dict);
        if (info.kind === "auth") requireLogin("expired", next ? { type: "save", jobId: id } : undefined);
        else toast.show(fmt(dict.saved.failed, { reason: info.title }), { tone: "error" });
      } finally {
        setPending((p) => {
          const s = new Set(p);
          s.delete(id);
          return s;
        });
      }
    },
    [dict, toast, requireLogin],
  );

  setSavedRef.current = setSaved;

  const toggle = useCallback(
    async (id: string) => {
      if (!session) {
        requireLogin("save", { type: "save", jobId: id });
        return;
      }
      if (pending.has(id)) return;
      await setSaved(id, !idsRef.current.has(id));
    },
    [session, pending, requireLogin, setSaved],
  );

  const sync = useCallback((id: string, saved: boolean) => {
    if (pendingRef.current.has(id)) return;
    setIds((prev) => {
      if (prev.has(id) === saved) return prev;
      const s = new Set(prev);
      saved ? s.add(id) : s.delete(id);
      return s;
    });
  }, []);

  const value = useMemo<Ctx>(
    () => ({ isSaved: (id) => ids.has(id), isPending: (id) => pending.has(id), toggle, sync, version }),
    [ids, pending, toggle, sync, version],
  );
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error("useSaved must be used within SavedProvider");
  return ctx;
}
