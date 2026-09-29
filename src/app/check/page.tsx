"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Clock, FileText, ImageUp, Link2, LogIn, ShieldAlert, type LucideIcon } from "lucide-react";
import { fmt, useI18n } from "@/i18n";
import { api, ApiError, newIdempotencyKey } from "@/lib/api";
import { describeError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { prepareScreenshot, validateImage, ACCEPTED_TYPES } from "@/lib/image";
import { addCheckRef, listCheckRefs, type CheckRef } from "@/lib/prefsLocal";
import { track } from "@/lib/telemetry";
import type { CheckInputType, CreateJobCheckRequest } from "@/lib/types";
import { useAuth } from "@/components/providers/AuthProvider";
import { TopBar } from "@/components/TopBar";
import { ErrorBanner } from "@/components/States";

const TEXT_MIN = 20; // 공백 제거 후
const TEXT_MAX = 20_000; // 원문 기준
const METHODS: { type: CheckInputType; Icon: LucideIcon }[] = [
  { type: "SCREENSHOT", Icon: ImageUp },
  { type: "URL", Icon: Link2 },
  { type: "TEXT", Icon: FileText },
];

// 입력 초안은 메모리에만 보관한다(오류·화면 이동 후에도 유지, 디스크에는 남기지 않음).
// uploadId: 업로드 후 검사 생성이 실패했을 때 같은 업로드를 재사용(1회용, 24시간 유효)
// idemKey: 같은 입력으로 재시도하면 같은 키를 보내 중복 검사를 막는다.
const draft: { method: CheckInputType; url: string; text: string; file: File | null; uploadId: string | null; idemKey: string | null } = {
  method: "SCREENSHOT", url: "", text: "", file: null, uploadId: null, idemKey: null,
};

/** API: 사용자 정보와 별도 포트가 없는 HTTPS URL */
function isAcceptableUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.port && !u.username && !u.password;
  } catch {
    return false;
  }
}

type Phase = "idle" | "compressing" | "uploading" | "submitting";

export default function CheckInputPage() {
  const { dict, intl } = useI18n();
  const router = useRouter();
  const { session, ready, requireLogin } = useAuth();
  const [method, setMethod] = useState<CheckInputType>(draft.method);
  const [url, setUrl] = useState(draft.url);
  const [text, setText] = useState(draft.text);
  const [file, setFile] = useState<File | null>(draft.file);
  const [preview, setPreview] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [refs, setRefs] = useState<CheckRef[]>([]);
  const busy = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const errId = useId();

  useEffect(() => setRefs(listCheckRefs()), []);
  // 입력이 바뀌면 새 요청이므로 멱등 키를 버린다.
  useEffect(() => {
    if (draft.method !== method || draft.url !== url || draft.text !== text || draft.file !== file) draft.idemKey = null;
    if (draft.file !== file) draft.uploadId = null;
    Object.assign(draft, { method, url, text, file });
  }, [method, url, text, file]);
  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const e = dict.check.err;

  const validate = (): string | null => {
    if (method === "SCREENSHOT") return file ? null : e.fileRequired;
    if (method === "URL") {
      if (!url.trim()) return e.urlRequired;
      return isAcceptableUrl(url.trim()) ? null : e.urlInvalid;
    }
    if (text.trim().length < TEXT_MIN) return fmt(e.textShort, { min: TEXT_MIN });
    if (text.length > TEXT_MAX) return fmt(e.textLong, { max: TEXT_MAX.toLocaleString(intl) });
    return null;
  };

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    const problem = validateImage(f);
    if (problem) {
      setFieldError(e[problem]);
      return;
    }
    setFieldError(null);
    setFile(f);
  };

  const submit = async () => {
    if (busy.current) return; // 중복 제출 방지
    if (!session) {
      requireLogin("check"); // 입력 초안은 메모리에 남아 로그인 후 그대로 복원된다
      return;
    }
    const problem = validate();
    setFieldError(problem);
    if (problem) return;
    busy.current = true;
    setSubmitError(null);
    try {
      let body: CreateJobCheckRequest;
      if (method === "SCREENSHOT") {
        if (!draft.uploadId) {
          setPhase("compressing");
          const blob = await prepareScreenshot(file!);
          if (!blob) throw new ApiError(413, { code: "FILE_TOO_LARGE" });
          setPhase("uploading");
          draft.uploadId = (await api.uploadScreenshot(blob)).upload_id;
        }
        body = { input_type: "SCREENSHOT", upload_id: draft.uploadId };
      } else {
        body = { input_type: method, content: method === "URL" ? url.trim() : text };
      }
      setPhase("submitting");
      draft.idemKey ??= newIdempotencyKey();
      const res = await api.createCheck(body, draft.idemKey);
      addCheckRef({ id: res.check_id, input_type: method, created_at: new Date().toISOString() });
      track("job_check_created", { input_type: method });
      Object.assign(draft, { url: "", text: "", file: null, uploadId: null, idemKey: null });
      router.push(`/check/${res.check_id}`);
    } catch (err) {
      const info = describeError(err, dict);
      track("job_check_create_failed", { input_type: method, code: info.code, request_id: info.requestId });
      const code = err instanceof ApiError ? err.code : "";
      if (code === "UPLOAD_UNAVAILABLE") draft.uploadId = null;
      if (code === "IDEMPOTENCY_CONFLICT") draft.idemKey = null;
      const mapped: Record<string, string> = {
        FILE_TOO_LARGE: e.fileSize,
        BODY_TOO_LARGE: fmt(e.textLong, { max: TEXT_MAX.toLocaleString(intl) }),
        UNSUPPORTED_IMAGE: e.fileType,
        INVALID_IMAGE: e.invalidImage,
        UPLOAD_UNAVAILABLE: e.uploadUnavailable,
        IDEMPOTENCY_CONFLICT: e.idempotency,
      };
      const fieldMsg = mapped[code] ?? (info.fields && Object.values(info.fields)[0]);
      if (fieldMsg) setFieldError(fieldMsg);
      else setSubmitError(err);
      setPhase("idle");
      busy.current = false;
    }
  };

  const onTabKey = (ev: KeyboardEvent, i: number) => {
    if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
    const next = (i + (ev.key === "ArrowRight" ? 1 : -1) + METHODS.length) % METHODS.length;
    setMethod(METHODS[next].type);
    setFieldError(null);
    tabRefs.current[next]?.focus();
  };

  const pendingRef = refs.find((r) => !r.done);
  const pastRefs = refs.filter((r) => r !== pendingRef).slice(0, 3);
  const phaseLabel = phase === "compressing" ? dict.check.compressing : phase === "uploading" ? dict.check.uploading : dict.check.submitting;

  return (
    <div className="page page--check">
      <TopBar title={dict.check.title} large />
      <div className="page__body">
        <p className="lead">{dict.check.intro}</p>

        {ready && !session && (
          <div className="banner banner--info">
            <LogIn size={18} aria-hidden />
            <span className="banner__text">{dict.check.loginNeeded}</span>
            <button className="btn btn--sm btn--secondary" onClick={() => requireLogin("check")}>{dict.auth.login}</button>
          </div>
        )}

        {pendingRef && (
          <Link href={`/check/${pendingRef.id}`} className="resume-card">
            <Clock size={20} aria-hidden />
            <span className="resume-card__text">
              <strong>{dict.check.resumeTitle}</strong>
              <span>{fmt(dict.check.historyItem, { type: dict.check[pendingRef.input_type], date: formatDateTime(pendingRef.created_at, intl) })}</span>
            </span>
            <span className="resume-card__cta">{dict.check.resumeCta}<ChevronRight size={16} aria-hidden /></span>
          </Link>
        )}

        <div className="card check-form">
          <div className="segmented" role="tablist" aria-label={dict.check.method}>
            {METHODS.map(({ type, Icon }, i) => (
              <button
                key={type}
                ref={(el) => { tabRefs.current[i] = el; }}
                role="tab"
                id={`tab-${type}`}
                aria-selected={method === type}
                aria-controls="check-panel"
                tabIndex={method === type ? 0 : -1}
                className={`segmented__item ${method === type ? "is-selected" : ""}`}
                onClick={() => { setMethod(type); setFieldError(null); }}
                onKeyDown={(ev) => onTabKey(ev, i)}
              >
                <Icon size={18} aria-hidden />
                {dict.check[type]}
              </button>
            ))}
          </div>

          <div id="check-panel" role="tabpanel" aria-labelledby={`tab-${method}`} className="check-panel">
            {method === "SCREENSHOT" && (
              <>
                <input
                  ref={fileInput}
                  type="file"
                  accept={ACCEPTED_TYPES.join(",")}
                  className="sr-only"
                  aria-describedby={fieldError ? errId : undefined}
                  onChange={(ev) => { pickFile(ev.target.files?.[0]); ev.target.value = ""; }}
                  tabIndex={-1}
                />
                {preview ? (
                  <div className="shot-preview">
                    <img src={preview} alt={dict.check.preview} />
                    <div className="shot-preview__actions">
                      <button className="btn btn--sm btn--secondary" onClick={() => fileInput.current?.click()} disabled={phase !== "idle"}>{dict.check.replace}</button>
                      <button className="btn btn--sm btn--ghost" onClick={() => setFile(null)} disabled={phase !== "idle"}>{dict.check.remove}</button>
                    </div>
                  </div>
                ) : (
                  <button
                    className={`dropzone ${fieldError ? "has-error" : ""}`}
                    onClick={() => fileInput.current?.click()}
                    onDragOver={(ev) => ev.preventDefault()}
                    onDrop={(ev) => { ev.preventDefault(); pickFile(ev.dataTransfer.files?.[0]); }}
                  >
                    <ImageUp size={28} aria-hidden />
                    <span className="dropzone__cta">{dict.check.uploadCta}</span>
                    <span className="dropzone__hint">{dict.check.uploadHint}</span>
                  </button>
                )}
                <p className="notice"><ShieldAlert size={16} aria-hidden />{dict.check.privacyShot}</p>
              </>
            )}

            {method === "URL" && (
              <div className="field">
                <label htmlFor="check-url" className="field__label">{dict.check.urlLabel}</label>
                <input
                  id="check-url"
                  className={`input ${fieldError ? "has-error" : ""}`}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={dict.check.urlPlaceholder}
                  value={url}
                  onChange={(ev) => setUrl(ev.target.value)}
                  aria-invalid={!!fieldError}
                  aria-describedby={`${fieldError ? errId : ""} url-hint`}
                />
                <p id="url-hint" className="hint">{dict.check.urlHint}</p>
              </div>
            )}

            {method === "TEXT" && (
              <div className="field">
                <label htmlFor="check-text" className="field__label">{dict.check.textLabel}</label>
                <textarea
                  id="check-text"
                  className={`input textarea ${fieldError ? "has-error" : ""}`}
                  rows={8}
                  placeholder={dict.check.textPlaceholder}
                  value={text}
                  maxLength={TEXT_MAX + 1000}
                  onChange={(ev) => setText(ev.target.value)}
                  aria-invalid={!!fieldError}
                  aria-describedby={`${fieldError ? errId : ""} text-count text-privacy`}
                />
                <p id="text-count" className={`hint hint--right ${text.length > TEXT_MAX ? "is-error" : ""}`}>
                  {fmt(dict.check.textCount, { n: text.length.toLocaleString(intl), max: TEXT_MAX.toLocaleString(intl) })}
                </p>
                <p id="text-privacy" className="notice"><ShieldAlert size={16} aria-hidden />{dict.check.privacy}</p>
              </div>
            )}

            {fieldError && <p id={errId} className="field-error" role="alert">{fieldError}</p>}
          </div>
        </div>

        {submitError != null && <ErrorBanner error={submitError} onRetry={submit} />}

        {pastRefs.length > 0 && (
          <section className="section">
            <h2 className="section-title section-title--sm">{dict.check.history}</h2>
            <ul className="link-list card">
              {pastRefs.map((r) => (
                <li key={r.id}>
                  <Link href={`/check/${r.id}`} className="link-list__item">
                    <span>{fmt(dict.check.historyItem, { type: dict.check[r.input_type], date: formatDateTime(r.created_at, intl) })}</span>
                    <ChevronRight size={18} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="sticky-cta">
        <button className="btn btn--primary btn--block" onClick={submit} disabled={phase !== "idle"} aria-busy={phase !== "idle"}>
          {phase === "idle" ? dict.check.submit : (<><span className="spinner spinner--inline" aria-hidden />{phaseLabel}</>)}
        </button>
      </div>
    </div>
  );
}
