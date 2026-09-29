"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CircleAlert, Info, MailCheck } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { AuthError } from "@/lib/auth";
import { getLocalPrefs, setLocalPrefs } from "@/lib/prefsLocal";
import { TopBar } from "@/components/TopBar";
import { safeNextPath, useAuth, type LoginReason } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";

function LoginForm() {
  const { dict } = useI18n();
  const router = useRouter();
  const sp = useSearchParams();
  const { signIn, signUp } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const reason = sp.get("reason") as LoginReason | null;
  const next = safeNextPath(sp.get("next"));
  const e = dict.auth.err;

  const validate = () => {
    const f: Record<string, string> = {};
    if (mode === "signup" && !name.trim()) f.name = e.name;
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) f.email = e.email;
    if (password.length < 8) f.password = e.WEAK_PASSWORD;
    return f;
  };

  const afterSignIn = (userName: string) => {
    // 온보딩에서 입력했던 선호 조건을 계정으로 옮김
    const pending = getLocalPrefs();
    if (pending) api.putPreferences(pending).then(() => setLocalPrefs(null)).catch(() => {});
    toast.show(fmt(dict.auth.welcome, { name: userName }));
    router.replace(next); // 원래 화면으로 복귀 → SavedProvider 가 보류된 저장 행동을 재개
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    const f = validate();
    setFields(f);
    setFormError(null);
    if (Object.keys(f).length) return;
    setBusy(true);
    try {
      if (mode === "login") {
        const s = await signIn(email.trim(), password);
        afterSignIn(s.user.name);
      } else {
        const r = await signUp(name.trim(), email.trim(), password);
        if (r.session) afterSignIn(r.session.user.name);
        else setConfirmSent(true); // Supabase 이메일 인증이 켜진 경우
      }
    } catch (err) {
      const code = err instanceof AuthError ? err.code : "UNKNOWN";
      if (code === "WEAK_PASSWORD") setFields({ password: e.WEAK_PASSWORD });
      else setFormError(e[code]);
    } finally {
      setBusy(false);
    }
  };

  const field = (id: "name" | "email" | "password", labelText: string, props: React.InputHTMLAttributes<HTMLInputElement>, value: string, set: (v: string) => void, hint?: string) => (
    <div className="field">
      <label htmlFor={`f-${id}`} className="field__label">{labelText}</label>
      <input id={`f-${id}`} className={`input ${fields[id] ? "has-error" : ""}`} value={value} onChange={(ev) => set(ev.target.value)}
        aria-invalid={!!fields[id]} aria-describedby={`f-${id}-msg`} {...props} />
      {fields[id] ? <p id={`f-${id}-msg`} className="field-error" role="alert">{fields[id]}</p> : hint ? <p id={`f-${id}-msg`} className="hint">{hint}</p> : null}
    </div>
  );

  return (
    <div className="page page--auth">
      <TopBar title={mode === "login" ? dict.auth.login : dict.auth.signup} backFallback="/jobs" />
      <div className="page__body">
        {reason && dict.auth.reason[reason] && (
          <p className="banner banner--info"><Info size={18} aria-hidden /> <span>{dict.auth.reason[reason]}</span></p>
        )}
        {confirmSent ? (
          <div className="card state">
            <span className="state__icon"><MailCheck size={28} aria-hidden /></span>
            <p className="state__body">{dict.auth.confirmEmail}</p>
            <div className="state__actions">
              <button className="btn btn--primary" onClick={() => { setConfirmSent(false); setMode("login"); }}>{dict.auth.login}</button>
            </div>
          </div>
        ) : (
          <>
            <form className="card form" onSubmit={submit} noValidate>
              {mode === "signup" && field("name", dict.auth.name, { autoComplete: "name", required: true }, name, setName)}
              {field("email", dict.auth.email, { type: "email", autoComplete: "email", inputMode: "email", required: true, autoCapitalize: "off" }, email, setEmail)}
              {field("password", dict.auth.password, { type: "password", autoComplete: mode === "login" ? "current-password" : "new-password", required: true, minLength: 8 }, password, setPassword, dict.auth.passwordHint)}
              {formError && <p className="banner banner--error" role="alert"><CircleAlert size={18} aria-hidden /> <span>{formError}</span></p>}
              <button type="submit" className="btn btn--primary btn--block" disabled={busy} aria-busy={busy}>
                {mode === "login" ? dict.auth.login : dict.auth.signup}
              </button>
            </form>
            <button className="btn btn--ghost btn--block" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setFields({}); setFormError(null); }}>
              {mode === "login" ? dict.auth.toSignup : dict.auth.toLogin}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
