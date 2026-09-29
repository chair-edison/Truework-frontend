// Truework API 계약 타입 (API.md, base path /api/v1). 필드는 snake_case 그대로 유지한다.

export const VERIFICATION_STATUSES = [
  "OFFICIAL",
  "VERIFIED_EMPLOYER",
  "UNVERIFIED",
  "WARNING",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
// 서버가 새 enum 을 추가해도 앱이 깨지지 않도록 string 도 허용한다.
export type StatusValue = VerificationStatus | (string & {});

export type EvidenceKind = "POSITIVE" | "NEGATIVE" | "UNKNOWN";
export type Severity = "LOW" | "MEDIUM" | "HIGH";
export type WorkScope = "DOMESTIC" | "OVERSEAS";

// ---------- 공통 오류 ----------

export type FieldError = { field: string; code: string; message: string };

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    field_errors?: FieldError[];
    retryable?: boolean;
    request_id?: string;
  };
};

// ---------- Jobs ----------

/** 출처 정보. 서버가 DB 행을 중첩해 내려주므로 알려진 필드 외에도 올 수 있다. */
export type JobSourceRow = {
  id?: string;
  name?: string | null;
  source_type?: string | null;
  base_url?: string | null;
  active?: boolean;
  [key: string]: unknown;
};

export type CompanyRow = {
  id?: string;
  name?: string | null;
  website?: string | null;
  [key: string]: unknown;
};

export type Job = {
  id: string;
  source_id: string;
  company_id: string | null;
  title: string;
  company_name: string;
  location: string | null;
  country: string | null;
  work_scope: WorkScope | null;
  work_type: string | null;
  occupation: string | null;
  industry: string | null;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  description: string | null;
  requirements: unknown; // JSON 값, 기본 []
  source_url: string | null;
  verification_status: StatusValue;
  verification_summary: string | null;
  published_at?: string | null;
  closes_at?: string | null;
  retrieved_at?: string | null;
  last_verified_at?: string | null;
  active: boolean;
  sources?: JobSourceRow | null;
  companies?: CompanyRow | null;
};

export type JobSort = "newest" | "relevance" | "recommended";

export type JobsQuery = {
  q?: string;
  location?: string;
  country?: string;
  work_scope?: WorkScope;
  occupation?: string;
  work_type?: string;
  source_type?: string;
  verification_status?: VerificationStatus;
  industry?: string;
  sort?: JobSort;
  page?: number;
  limit?: number;
};

export type Paged<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
};

export type JobsListResponse = Paged<Job> & { result_cap: number | null };
export type JobDetailResponse = { job: Job; saved: boolean };
export type SaveResponse = { saved: boolean };
export type SavedJobItem = { saved_at: string; job: Job };
export type SavedJobsResponse = Paged<SavedJobItem>;

// ---------- Preferences ----------

export type Preferences = {
  occupations: string[];
  locations: string[];
  work_scope: WorkScope | "BOTH";
  experience_level: string | null;
  expected_salary_min: number | null;
  expected_salary_max: number | null;
  currency: string | null;
};
export type PreferencesUpdate = Partial<Preferences>;
export type PreferencesResponse = { preferences: Preferences };

// ---------- Job checks ----------

export type CheckInputType = "SCREENSHOT" | "URL" | "TEXT";

export type CreateJobCheckRequest =
  | { input_type: "TEXT" | "URL"; content: string }
  | { input_type: "SCREENSHOT"; upload_id: string };

export type UploadResponse = { upload_id: string; expires_at: string };

export const CHECK_PROGRESS = ["QUEUED", "EXTRACTING", "VERIFYING", "EXPLAINING"] as const;
export type CheckProgressStatus = (typeof CHECK_PROGRESS)[number];
export type CheckStatus = CheckProgressStatus | "COMPLETED" | "FAILED";

export type CreateJobCheckResponse = { check_id: string; status: CheckStatus; poll_after_ms?: number };

export type Evidence = {
  id: string;
  job_check_id?: string;
  kind: EvidenceKind;
  code: string;
  title: string;
  description: string;
  source_name?: string | null;
  source_url?: string | null;
  checked_at: string;
};

export type RiskIndicator = {
  code: string;
  severity: Severity;
  explanation: string;
  evidence_ids: string[];
};

export type CheckVerification = {
  status: StatusValue;
  summary: string;
  disclaimer: string;
  risk_indicators: RiskIndicator[];
  evidence: Evidence[];
  checked_at: string;
  policy_version?: string;
};

export type Extraction = {
  raw_text: string;
  employer: string | null;
  job_title: string | null;
  location: string | null;
  salary: string | null;
  recruiter: string | null;
  contact_method: string | null;
  recruitment_fee: string | null;
  job_duties: string | null;
  employment_conditions: string | null;
  source_url: string | null;
  country: string | null;
  work_scope: WorkScope | "UNKNOWN";
};

export type JobCheckInProgress = {
  check_id: string;
  status: CheckProgressStatus;
  updated_at: string;
  poll_after_ms?: number;
};

export type JobCheckFailed = {
  check_id: string;
  status: "FAILED";
  failure_code: string;
  retryable: boolean;
  updated_at: string;
};

export type JobCheckCompleted = {
  check_id: string;
  status: "COMPLETED";
  updated_at?: string;
  extraction: Extraction;
  verification: CheckVerification;
  explanation: string | null;
  safety_guidance: string[];
};

export type JobCheck = JobCheckInProgress | JobCheckFailed | JobCheckCompleted;

export type AlternativesResponse = {
  items: Job[];
  criteria: { country: string | null; job_title: string | null; location: string | null };
};

// ---------- Auth (Supabase) ----------

export type User = { id: string; email: string; name: string };
export type Session = { token: string; expires_at: string; user: User };
