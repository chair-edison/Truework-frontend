"use client";

import { useEffect, useState } from "react";
import { label, useI18n } from "@/i18n";
import type { Dict } from "@/i18n/ko";
import { FILTER_KEYS, type FilterKey, type Filters } from "@/lib/jobsQuery";
import { useFilterOptions } from "@/lib/filterOptions";
import { countryName } from "@/lib/format";
import { VERIFICATION_STATUSES, type VerificationStatus } from "@/lib/types";
import { Dialog } from "./Dialog";
import { ErrorBanner, Spinner } from "./States";

/** 출처 유형(예: "Government")은 사전에 있으면 번역하고, 없으면 서버 값을 그대로 보여준다. */
export function sourceTypeLabel(dict: Dict, value: string | null | undefined) {
  if (!value) return "";
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (dict.source as Record<string, string>)[key] ?? value;
}

export function useFilterLabel() {
  const { dict, intl } = useI18n();
  return (key: FilterKey, value: string) => {
    switch (key) {
      case "work_scope": return label(dict.scope, value);
      case "source_type": return sourceTypeLabel(dict, value);
      case "verification_status":
        return (VERIFICATION_STATUSES as readonly string[]).includes(value) ? dict.status[value as VerificationStatus].label : value;
      case "country": return countryName(value, intl);
      // occupation · work_type · industry · location 은 서버의 자유 텍스트를 그대로 표시
      default: return value;
    }
  };
}

type Props = { open: boolean; onClose: () => void; value: Filters; onApply: (f: Filters) => void };

export function FilterSheet({ open, onClose, value, onApply }: Props) {
  const { dict } = useI18n();
  const optionLabel = useFilterLabel();
  const [draft, setDraft] = useState<Filters>(value);
  const { options, error } = useFilterOptions(open);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const set = (k: FilterKey, v?: string) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={dict.filter.title}
      variant="sheet"
      footer={
        <>
          <button className="btn btn--secondary" onClick={() => setDraft({})}>{dict.common.reset}</button>
          <button className="btn btn--primary btn--grow" onClick={() => onApply(draft)}>{dict.filter.showResults}</button>
        </>
      }
    >
      {error != null && !options && <ErrorBanner error={error} />}
      {!options && error == null && <Spinner label={dict.common.loading} />}
      {options &&
        FILTER_KEYS.map((key) => {
          // URL 로 들어온 값이 목록에 없더라도 선택 상태를 보여준다
          const values = draft[key] && !options[key].includes(draft[key]!) ? [...options[key], draft[key]!] : options[key];
          if (!values.length) return null;
          return (
            <fieldset key={key} className="filter-group">
              <legend className="filter-group__legend">{dict.filter[key]}</legend>
              <div className="chip-row chip-row--wrap">
                <button type="button" aria-pressed={!draft[key]} className={`chip ${!draft[key] ? "is-selected" : ""}`} onClick={() => set(key, undefined)}>
                  {dict.filter.all}
                </button>
                {values.map((opt) => {
                  const selected = draft[key] === opt;
                  return (
                    <button key={opt} type="button" aria-pressed={selected} className={`chip ${selected ? "is-selected" : ""}`} onClick={() => set(key, opt)}>
                      {optionLabel(key, opt)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
    </Dialog>
  );
}
