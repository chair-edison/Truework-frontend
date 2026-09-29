"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ScanSearch, ShieldCheck, Target, type LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { setLocalPrefs, setOnboarded } from "@/lib/prefsLocal";
import type { PreferencesUpdate } from "@/lib/types";
import { PreferencesForm } from "@/components/PreferencesForm";
import { useAuth } from "@/components/providers/AuthProvider";

export default function OnboardingPage() {
  const { dict } = useI18n();
  const d = dict.onboarding;
  const router = useRouter();
  const { session } = useAuth();
  const [step, setStep] = useState(0);

  const finish = () => {
    setOnboarded();
    router.replace("/jobs");
  };

  const savePrefs = async (p: PreferencesUpdate) => {
    if (session) await api.putPreferences(p).catch(() => setLocalPrefs(p));
    else setLocalPrefs(p); // 로그인 시 계정으로 옮긴다
    finish();
  };

  const intro: { Icon: LucideIcon; title: string; body: string }[] = [
    { Icon: ShieldCheck, title: d.step1Title, body: d.step1Body },
    { Icon: ScanSearch, title: d.step2Title, body: d.step2Body },
  ];

  return (
    <div className="page page--onboarding">
      <div className="onboarding__top">
        <div className="dots" aria-label={`${step + 1} / 3`}>
          {[0, 1, 2].map((i) => <span key={i} className={`dot ${i === step ? "is-active" : ""}`} />)}
        </div>
        <button className="btn btn--ghost btn--sm" onClick={finish}>{dict.common.skip}</button>
      </div>

      {step < 2 ? (
        <div className="onboarding__slide" aria-live="polite">
          {(() => {
            const { Icon, title, body } = intro[step];
            return (
              <>
                <span className="onboarding__icon"><Icon size={40} strokeWidth={1.75} aria-hidden /></span>
                <h1 className="onboarding__title">{title}</h1>
                <p className="onboarding__body">{body}</p>
              </>
            );
          })()}
          <div className="onboarding__cta">
            <button className="btn btn--primary btn--block" onClick={() => setStep(step + 1)}>{dict.common.next}</button>
          </div>
        </div>
      ) : (
        <div className="onboarding__slide onboarding__slide--form">
          <span className="onboarding__icon onboarding__icon--sm"><Target size={28} strokeWidth={1.75} aria-hidden /></span>
          <h1 className="onboarding__title">{d.step3Title}</h1>
          <p className="onboarding__body">{d.step3Body}</p>
          <div className="card">
            <PreferencesForm
              initial={null}
              onSubmit={savePrefs}
              submitLabel={d.start}
              secondary={<button type="button" className="btn btn--secondary" onClick={finish}>{dict.common.skip}</button>}
            />
          </div>
        </div>
      )}
    </div>
  );
}
