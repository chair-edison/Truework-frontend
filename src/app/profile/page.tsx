"use client";

import { useCallback, useEffect, useState } from "react";
import { Info, LogIn, LogOut, UserRound } from "lucide-react";
import { LOCALES, useI18n, type Locale } from "@/i18n";
import { api, isAbort, USING_MOCK } from "@/lib/api";
import { describeError } from "@/lib/errors";
import type { Preferences, PreferencesUpdate } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { Dialog } from "@/components/Dialog";
import { ErrorBanner } from "@/components/States";
import { PreferencesForm } from "@/components/PreferencesForm";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToast } from "@/components/providers/ToastProvider";

export default function ProfilePage() {
  const { dict, locale, setLocale } = useI18n();
  const { session, ready, requireLogin, signOut } = useAuth();
  const toast = useToast();
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  const load = useCallback(() => {
    if (!session) return;
    const ac = new AbortController();
    setLoadError(null);
    api.getPreferences(ac.signal).then((r) => setPrefs(r.preferences)).catch((e) => !isAbort(e) && setLoadError(e));
    return () => ac.abort();
  }, [session]);
  useEffect(() => load(), [load]);

  const save = async (p: PreferencesUpdate) => {
    setBusy(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      setPrefs((await api.putPreferences(p)).preferences);
      toast.show(dict.profile.prefsSaved);
    } catch (e) {
      const info = describeError(e, dict);
      if (info.fields) setFieldErrors(info.fields);
      else setSaveError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <TopBar title={dict.profile.title} large />
      <div className="page__body">
        <section className="card profile-card">
          <span className="avatar" aria-hidden><UserRound size={24} /></span>
          {session ? (
            <div className="profile-card__text">
              <p className="profile-card__name">{session.user.name}</p>
              <p className="muted small">{session.user.email}</p>
            </div>
          ) : (
            <div className="profile-card__text">
              <p className="profile-card__name">{dict.profile.guest}</p>
              <p className="muted small">{dict.profile.guestHint}</p>
            </div>
          )}
        </section>
        {ready && !session && (
          <button className="btn btn--primary btn--block" onClick={() => requireLogin("prefs")}>
            <LogIn size={18} aria-hidden /> {dict.auth.login} / {dict.auth.signup}
          </button>
        )}

        {session && (
          <section className="section" aria-labelledby="prefs-h">
            <h2 id="prefs-h" className="section-title">{dict.profile.prefs}</h2>
            <p className="section-sub">{dict.profile.prefsHint}</p>
            {loadError != null && <ErrorBanner error={loadError} onRetry={load} />}
            <div className="card">
              <PreferencesForm initial={prefs} onSubmit={save} submitLabel={dict.profile.savePrefs} fieldErrors={fieldErrors} busy={busy} />
            </div>
            {saveError != null && <ErrorBanner error={saveError} />}
          </section>
        )}

        <section className="section" aria-labelledby="lang-h">
          <h2 id="lang-h" className="section-title section-title--sm">{dict.profile.language}</h2>
          <div className="segmented" role="group" aria-labelledby="lang-h">
            {(Object.keys(LOCALES) as Locale[]).map((l) => (
              <button key={l} className={`segmented__item ${locale === l ? "is-selected" : ""}`} aria-pressed={locale === l} onClick={() => setLocale(l)}>
                {LOCALES[l].label}
              </button>
            ))}
          </div>
        </section>

        <section className="section card about">
          <p className="about__title"><Info size={16} aria-hidden /> {dict.profile.about}</p>
          <p className="muted small">{dict.profile.aboutBody}</p>
          {USING_MOCK && <p className="demo-tag">{dict.profile.demo}</p>}
        </section>

        {session && (
          <button className="btn btn--ghost btn--block btn--danger-text" onClick={() => setConfirmOut(true)}>
            <LogOut size={18} aria-hidden /> {dict.profile.logout}
          </button>
        )}
      </div>

      <Dialog
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        title={dict.profile.logoutConfirm}
        footer={
          <>
            <button className="btn btn--secondary" onClick={() => setConfirmOut(false)}>{dict.common.cancel}</button>
            <button className="btn btn--dark" onClick={async () => { setConfirmOut(false); await signOut(); setPrefs(null); }}>{dict.profile.logout}</button>
          </>
        }
      >
        <p className="body-text">{dict.profile.logoutBody}</p>
      </Dialog>
    </div>
  );
}
