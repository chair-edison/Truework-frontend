const COUNTRY_FALLBACK: Record<string, string> = { VN: "Vietnam", KR: "Korea", JP: "Japan", TW: "Taiwan", AU: "Australia" };

export function countryName(code: string, intl: string) {
  try {
    return new Intl.DisplayNames([intl], { type: "region" }).of(code) ?? COUNTRY_FALLBACK[code] ?? code;
  } catch {
    return COUNTRY_FALLBACK[code] ?? code;
  }
}

export function formatLocation(location: string | null | undefined, country: string | null | undefined, intl: string) {
  const c = country ? countryName(country, intl) : "";
  if (location && c && !location.toLowerCase().includes(c.toLowerCase())) return `${location}, ${c}`;
  return location || c || "";
}

export function formatMoney(amount: number, currency: string, intl: string) {
  try {
    return new Intl.NumberFormat(intl, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount.toLocaleString(intl)} ${currency}`;
  }
}

/** 급여는 서버가 준 숫자/통화를 현지 표기로만 바꾼다. 환산·기간 추정을 하지 않는다. */
export function formatSalary(min: number | null | undefined, max: number | null | undefined, currency: string | null | undefined, intl: string): string | null {
  const parts = [min, max].filter((v): v is number => typeof v === "number");
  if (!parts.length) return null;
  const f = (n: number) => (currency ? formatMoney(n, currency, intl) : n.toLocaleString(intl));
  return parts.length === 2 && parts[0] !== parts[1] ? `${f(parts[0])} – ${f(parts[1])}` : f(parts[0]);
}

/** requirements 는 JSON 값이므로 표시 가능한 문자열 목록으로만 정리한다. */
export function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

export function formatDate(isoStr: string | null | undefined, intl: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(intl, { year: "numeric", month: "short", day: "numeric" }).format(d);
}

export function formatDateTime(isoStr: string | null | undefined, intl: string) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(intl, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatRelative(isoStr: string, intl: string) {
  const d = new Date(isoStr).getTime();
  if (Number.isNaN(d)) return "";
  const diff = Math.round((d - Date.now()) / 86_400_000);
  if (Math.abs(diff) > 30) return formatDate(isoStr, intl);
  try {
    return new Intl.RelativeTimeFormat(intl, { numeric: "auto" }).format(diff, "day");
  } catch {
    return formatDate(isoStr, intl);
  }
}

/** 외부로 열 수 있는 URL 인지 확인한다. https 만 허용(개발 편의로 http 는 막는다). */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}
