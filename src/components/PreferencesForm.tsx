"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useI18n } from "@/i18n";
import type { Preferences, PreferencesUpdate } from "@/lib/types";

type Props = {
  initial: Partial<Preferences> | null;
  onSubmit: (p: PreferencesUpdate) => Promise<void> | void;
  submitLabel: string;
  fieldErrors?: Record<string, string>;
  busy?: boolean;
  secondary?: ReactNode;
};

const CURRENCIES = ["VND", "USD", "KRW", "JPY", "TWD"];
const EXPERIENCE = ["NONE", "LT_1", "Y1_3", "Y3_5", "GT_5"];
const MAX_ITEMS = 20;
const MAX_LEN = 100;

/** "a, b , c" → ["a","b","c"] (API: 최대 20개, 항목당 100자) */
const splitList = (v: string) =>
  v.split(",").map((x) => x.trim()).filter(Boolean).slice(0, MAX_ITEMS).map((x) => x.slice(0, MAX_LEN));
const toNumber = (v: string) => (v === "" ? null : Number(v));

export function PreferencesForm({ initial, onSubmit, submitLabel, fieldErrors = {}, busy, secondary }: Props) {
  const { dict } = useI18n();
  const d = dict.profile;
  const [occupations, setOccupations] = useState("");
  const [locations, setLocations] = useState("");
  const [scope, setScope] = useState<Preferences["work_scope"]>("BOTH");
  const [experience, setExperience] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initial) return;
    setOccupations((initial.occupations ?? []).join(", "));
    setLocations((initial.locations ?? []).join(", "));
    setScope(initial.work_scope ?? "BOTH");
    setExperience(initial.experience_level ?? "");
    setSalaryMin(initial.expected_salary_min != null ? String(initial.expected_salary_min) : "");
    setSalaryMax(initial.expected_salary_max != null ? String(initial.expected_salary_max) : "");
    setCurrency(initial.currency ?? "VND");
  }, [initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const occ = splitList(occupations);
    if (!occ.length) errs.occupations = dict.errors.validation.body;
    const min = toNumber(salaryMin);
    const max = toNumber(salaryMax);
    if (min != null && max != null && max < min) errs.expected_salary_max = d.salaryRange;
    setLocalErrors(errs);
    if (Object.keys(errs).length) return;
    const hasSalary = min != null || max != null;
    void onSubmit({
      occupations: occ,
      locations: splitList(locations),
      work_scope: scope,
      experience_level: experience || null,
      expected_salary_min: min,
      expected_salary_max: max,
      currency: hasSalary ? currency : null,
    });
  };

  const err = (k: string) => localErrors[k] ?? fieldErrors[k];
  const errorProps = (k: string, id: string) => ({ "aria-invalid": !!err(k), "aria-describedby": err(k) ? `${id}-err` : undefined });
  const errorText = (k: string, id: string) => err(k) && <p id={`${id}-err`} className="field-error" role="alert">{err(k)}</p>;

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="pf-occ" className="field__label">
          {d.occupations} <span className="req">{dict.common.required}</span>
        </label>
        <input id="pf-occ" className={`input ${err("occupations") ? "has-error" : ""}`} value={occupations} onChange={(e) => setOccupations(e.target.value)}
          placeholder={d.occupationsPh} required aria-required {...errorProps("occupations", "pf-occ")} />
        {err("occupations") ? errorText("occupations", "pf-occ") : <p className="hint">{d.occupationsHint}</p>}
      </div>

      <div className="field">
        <label htmlFor="pf-loc" className="field__label">{d.locations} <span className="opt">{dict.common.optional}</span></label>
        <input id="pf-loc" className={`input ${err("locations") ? "has-error" : ""}`} value={locations} onChange={(e) => setLocations(e.target.value)}
          placeholder={d.locationsPh} {...errorProps("locations", "pf-loc")} />
        {errorText("locations", "pf-loc")}
      </div>

      <fieldset className="field">
        <legend className="field__label">{d.scope} <span className="opt">{dict.common.optional}</span></legend>
        <div className="chip-row">
          {(["DOMESTIC", "OVERSEAS", "BOTH"] as const).map((s) => (
            <button key={s} type="button" className={`chip ${scope === s ? "is-selected" : ""}`} aria-pressed={scope === s} onClick={() => setScope(s)}>
              {dict.scope[s]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="pf-exp" className="field__label">{d.experience} <span className="opt">{dict.common.optional}</span></label>
        <select id="pf-exp" className="input select" value={experience} onChange={(e) => setExperience(e.target.value)}>
          <option value="">{dict.filter.all}</option>
          {EXPERIENCE.map((x) => <option key={x} value={x}>{d.experienceLevels[x]}</option>)}
          {experience && !EXPERIENCE.includes(experience) && <option value={experience}>{experience}</option>}
        </select>
      </div>

      <fieldset className="field">
        <legend className="field__label">{d.salary} <span className="opt">{dict.common.optional}</span></legend>
        <div className="input-group">
          <label className="sr-only" htmlFor="pf-smin">{d.salaryMin}</label>
          <input id="pf-smin" className={`input ${err("expected_salary_min") ? "has-error" : ""}`} inputMode="numeric" placeholder={d.salaryMin}
            value={salaryMin} onChange={(e) => setSalaryMin(e.target.value.replace(/[^\d]/g, ""))} {...errorProps("expected_salary_min", "pf-smin")} />
          <label className="sr-only" htmlFor="pf-smax">{d.salaryMax}</label>
          <input id="pf-smax" className={`input ${err("expected_salary_max") ? "has-error" : ""}`} inputMode="numeric" placeholder={d.salaryMax}
            value={salaryMax} onChange={(e) => setSalaryMax(e.target.value.replace(/[^\d]/g, ""))} {...errorProps("expected_salary_max", "pf-smax")} />
          <label className="sr-only" htmlFor="pf-cur">{d.currency}</label>
          <select id="pf-cur" className="input select input-group__addon" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            {!CURRENCIES.includes(currency) && <option>{currency}</option>}
          </select>
        </div>
        {errorText("expected_salary_min", "pf-smin")}
        {errorText("expected_salary_max", "pf-smax")}
        {errorText("currency", "pf-cur")}
      </fieldset>

      <div className="form__actions">
        {secondary}
        <button type="submit" className="btn btn--primary btn--grow" disabled={busy} aria-busy={busy}>{submitLabel}</button>
      </div>
    </form>
  );
}
