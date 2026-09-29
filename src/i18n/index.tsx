"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import ko, { type Dict } from "./ko";
import en from "./en";

export const LOCALES = { ko: { dict: ko, intl: "ko-KR", label: "한국어" }, en: { dict: en, intl: "en-US", label: "English" } } as const;
export type Locale = keyof typeof LOCALES;

type Ctx = { locale: Locale; intl: string; dict: Dict; setLocale: (l: Locale) => void };
const I18nContext = createContext<Ctx | null>(null);
const KEY = "tw.locale";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ko");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as Locale | null;
      if (saved && saved in LOCALES) setLocaleState(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {}
  }, []);
  const value = useMemo(() => ({ locale, intl: LOCALES[locale].intl, dict: LOCALES[locale].dict, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** "{name}" 형태의 자리표시자를 치환한다. */
export function fmt(template: string, vars: Record<string, string | number> = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** 사전에서 동적 키(enum 값)로 라벨을 찾는다. 없으면 원래 값을 그대로 보여준다. */
export function label(map: Record<string, string>, key: string | null | undefined) {
  if (!key) return "";
  return map[key] ?? key;
}
