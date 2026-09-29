"use client";

import { useEffect, useState } from "react";
import { label, useI18n } from "@/i18n";
import { FILTER_KEYS, FILTER_OPTIONS, type FilterKey, type Filters } from "@/lib/jobsQuery";
import { countryName } from "@/lib/format";
import { VERIFICATION_STATUSES, type VerificationStatus } from "@/lib/types";
import { Dialog } from "./Dialog";

export function useFilterLabel() {
  const { dict, intl } = useI18n();
  return (key: FilterKey, value: string) => {
    switch (key) {
      case "work_scope": return label(dict.scope, value);
      case "occupation": return label(dict.category, value);
      case "work_type": return label(dict.employment, value);
      case "source_type": return label(dict.source, value);
      case "industry": return label(dict.industry, value);
      case "verification_status":
        return (VERIFICATION_STATUSES as readonly string[]).includes(value) ? dict.status[value as VerificationStatus].label : value;
      case "country": return countryName(value, intl);
      default: return value;
    }
  };
}

type Props = { open: boolean; onClose: () => void; value: Filters; onApply: (f: Filters) => void };

export function FilterSheet({ open, onClose, value, onApply }: Props) {
  const { dict } = useI18n();
  const optionLabel = useFilterLabel();
  const [draft, setDraft] = useState<Filters>(value);

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
      {FILTER_KEYS.map((key) => (
        <fieldset key={key} className="filter-group">
          <legend className="filter-group__legend">{dict.filter[key]}</legend>
          <div className="chip-row chip-row--wrap">
            <button type="button" aria-pressed={!draft[key]} className={`chip ${!draft[key] ? "is-selected" : ""}`} onClick={() => set(key, undefined)}>
              {dict.filter.all}
            </button>
            {FILTER_OPTIONS[key].map((opt) => {
              const selected = draft[key] === opt;
              return (
                <button key={opt} type="button" aria-pressed={selected} className={`chip ${selected ? "is-selected" : ""}`} onClick={() => set(key, opt)}>
                  {optionLabel(key, opt)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}
    </Dialog>
  );
}
