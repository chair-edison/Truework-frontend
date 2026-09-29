// ⚠️ 데모용 목 데이터. 실제 백엔드가 연결되면 사용되지 않는다.
// 회사·출처 이름은 모두 가상이며 실제 기관과 관계없다.
// 검증 결과는 "백엔드가 이미 산출한 값"을 흉내 낸 고정 데이터다.
import type { Job } from "@/lib/types";

const DAY = 86_400_000;
const now = Date.now();
const iso = (offsetDays: number) => new Date(now - offsetDays * DAY).toISOString();

type Seed = {
  id: string;
  title: string;
  company_name: string;
  v: "OFFICIAL" | "VERIFIED_EMPLOYER" | "UNVERIFIED" | "WARNING";
  location: { city?: string | null; country: string; is_overseas: boolean };
  salary: { min?: number | null; max?: number | null; currency: string; period: string } | null;
  employment_type: string;
  job_category: string;
  industry: string;
  source: { type: string; name: string; url?: string | null };
  posted_by: { name: string; role: string; license_number?: string | null };
  original_url: string | null;
  posted_at: string;
  description: string;
  requirements: string[];
  benefits?: string[];
};

const SUMMARY: Record<Seed["v"], (s: Seed) => string> = {
  OFFICIAL: (s) => `${s.source.name}에 게시된 원본과 일치하며, 원본 URL이 확인되었습니다.`,
  VERIFIED_EMPLOYER: (s) => `${s.company_name}의 회사 정체성과 채용 담당 연락처가 확인되었습니다.`,
  UNVERIFIED: () => "결론을 내릴 만큼 충분한 근거를 찾지 못했습니다.",
  WARNING: () => "선입금 요구와 시장 수준을 크게 웃도는 급여 등 주의가 필요한 특성이 발견되었습니다.",
};

export const mockUuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const seeds: Seed[] = [
  {
    id: "j_001", title: "Factory Worker – Electronics Assembly", company_name: "Bac Ninh Precision Electronics", v: "OFFICIAL",
    location: { city: "Bac Ninh", country: "VN", is_overseas: false },
    salary: { min: 8_500_000, max: 11_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "MANUFACTURING", industry: "ELECTRONICS",
    source: { type: "GOVERNMENT", name: "National Employment Portal (demo)", url: "https://employment.gov.example" },
    posted_by: { name: "Bac Ninh Precision Electronics", role: "EMPLOYER", license_number: null },
    original_url: "https://employment.gov.example/jobs/BN-22871",
    posted_at: iso(1),
    description: "Assemble and inspect electronic components on a production line. Training is provided for new workers. Rotating shifts with overtime paid according to labor law.",
    requirements: ["Age 18–35", "No experience required", "Able to work rotating shifts", "Good eyesight (glasses allowed)"],
    benefits: ["Social, health and unemployment insurance", "Free lunch at canteen", "Dormitory support"],
  },
  {
    id: "j_002", title: "Warehouse Associate", company_name: "Saigon Logistics JSC", v: "VERIFIED_EMPLOYER",
    location: { city: "Ho Chi Minh City", country: "VN", is_overseas: false },
    salary: { min: 7_000_000, max: 9_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "LOGISTICS", industry: "LOGISTICS",
    source: { type: "EMPLOYER", name: "Saigon Logistics Careers", url: "https://careers.saigonlogistics.example" },
    posted_by: { name: "Saigon Logistics JSC", role: "EMPLOYER" },
    original_url: "https://careers.saigonlogistics.example/warehouse-associate",
    posted_at: iso(2),
    description: "Receive, sort and dispatch parcels in our District 7 fulfillment center. Use handheld scanners to track inventory.",
    requirements: ["High school diploma", "Able to lift up to 20 kg", "Basic smartphone skills"],
    benefits: ["13th-month salary", "Transport allowance"],
  },
  {
    id: "j_003", title: "Factory Worker – Food Processing (Korea, EPS)", company_name: "Gyeonggi Fresh Foods Co.", v: "OFFICIAL",
    location: { city: "Gyeonggi", country: "KR", is_overseas: true },
    salary: { min: 2_060_000, max: 2_400_000, currency: "KRW", period: "MONTH" },
    employment_type: "CONTRACT", job_category: "MANUFACTURING", industry: "FOOD",
    source: { type: "GOVERNMENT", name: "Overseas Labour Management Board (demo)", url: "https://overseas-labour.gov.example" },
    posted_by: { name: "Overseas Labour Management Board (demo)", role: "GOVERNMENT" },
    original_url: "https://overseas-labour.gov.example/eps/2026-0412",
    posted_at: iso(3),
    description: "Work in a food packaging plant under the government-to-government employment permit programme. Recruitment is only through the official board; no broker fees are charged.",
    requirements: ["Passed Korean language test (EPS-TOPIK)", "Age 18–39", "Health check certificate"],
    benefits: ["Accommodation provided", "National health insurance", "Return airfare at contract end"],
  },
  {
    id: "j_004", title: "Garment Sewing Operator", company_name: "Binh Duong Textile Co.", v: "VERIFIED_EMPLOYER",
    location: { city: "Binh Duong", country: "VN", is_overseas: false },
    salary: { min: 7_500_000, max: 12_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "MANUFACTURING", industry: "TEXTILE",
    source: { type: "PARTNER", name: "Vieclam Partner Network (demo)", url: "https://partner-jobs.example" },
    posted_by: { name: "Binh Duong Textile Co.", role: "EMPLOYER" },
    original_url: "https://partner-jobs.example/p/88121",
    posted_at: iso(4),
    description: "Operate industrial sewing machines for export garments. Piece-rate bonus on top of base salary.",
    requirements: ["Sewing experience preferred", "Training available for beginners"],
  },
  {
    id: "j_005", title: "Overseas Factory Job – 40M VND/month, no experience", company_name: "Global Work Link", v: "WARNING",
    location: { city: "Taichung", country: "TW", is_overseas: true },
    salary: { min: 40_000_000, max: 45_000_000, currency: "VND", period: "MONTH" },
    employment_type: "CONTRACT", job_category: "MANUFACTURING", industry: "ELECTRONICS",
    source: { type: "JOB_BOARD", name: "Open Job Board (demo)", url: "https://openjobboard.example" },
    posted_by: { name: "Global Work Link", role: "AGENCY", license_number: null },
    original_url: "https://openjobboard.example/post/551902",
    posted_at: iso(1),
    description: "Fast departure within 2 weeks. Pay a processing fee to reserve your slot. Contact via chat app only.",
    requirements: ["No experience", "Processing fee paid in advance"],
  },
  {
    id: "j_006", title: "Hotel Front Desk Receptionist", company_name: "Da Nang Seaside Resort", v: "VERIFIED_EMPLOYER",
    location: { city: "Da Nang", country: "VN", is_overseas: false },
    salary: { min: 9_000_000, max: 12_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "HOSPITALITY", industry: "TOURISM",
    source: { type: "EMPLOYER", name: "Da Nang Seaside Careers", url: "https://careers.danangseaside.example" },
    posted_by: { name: "Da Nang Seaside Resort", role: "EMPLOYER" },
    original_url: "https://careers.danangseaside.example/front-desk",
    posted_at: iso(5),
    description: "Welcome guests, manage check-in/check-out and handle reservations in English.",
    requirements: ["Conversational English", "Customer service mindset", "Shift work"],
  },
  {
    id: "j_007", title: "Delivery Driver (Motorbike)", company_name: "Hanoi QuickShip", v: "UNVERIFIED",
    location: { city: "Hanoi", country: "VN", is_overseas: false },
    salary: null,
    employment_type: "PART_TIME", job_category: "LOGISTICS", industry: "LOGISTICS",
    source: { type: "JOB_BOARD", name: "Open Job Board (demo)", url: "https://openjobboard.example" },
    posted_by: { name: "Hanoi QuickShip", role: "EMPLOYER" },
    original_url: "https://openjobboard.example/post/551020",
    posted_at: iso(6),
    description: "Flexible delivery shifts across inner Hanoi districts. Own motorbike required.",
    requirements: ["Valid A1 license", "Own motorbike and smartphone"],
  },
  {
    id: "j_008", title: "CNC Machine Operator", company_name: "Hai Phong Mechanical Works", v: "OFFICIAL",
    location: { city: "Hai Phong", country: "VN", is_overseas: false },
    salary: { min: 10_000_000, max: 14_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "MANUFACTURING", industry: "MACHINERY",
    source: { type: "GOVERNMENT", name: "National Employment Portal (demo)", url: "https://employment.gov.example" },
    posted_by: { name: "Hai Phong Mechanical Works", role: "EMPLOYER" },
    original_url: "https://employment.gov.example/jobs/HP-10442",
    posted_at: iso(2),
    description: "Set up and operate CNC lathes and milling machines. Read technical drawings and perform quality checks.",
    requirements: ["Vocational certificate in mechanics", "1+ year CNC experience"],
  },
  {
    id: "j_009", title: "Caregiver (Japan, Specified Skilled Worker)", company_name: "Osaka Care Partners", v: "VERIFIED_EMPLOYER",
    location: { city: "Osaka", country: "JP", is_overseas: true },
    salary: { min: 180_000, max: 220_000, currency: "JPY", period: "MONTH" },
    employment_type: "CONTRACT", job_category: "CARE", industry: "HEALTHCARE",
    source: { type: "PARTNER", name: "Vieclam Partner Network (demo)", url: "https://partner-jobs.example" },
    posted_by: { name: "Mekong HR Services", role: "AGENCY", license_number: "LIC-0921/DEMO" },
    original_url: "https://partner-jobs.example/p/90233",
    posted_at: iso(7),
    description: "Support elderly residents with daily living activities at a licensed nursing home.",
    requirements: ["JLPT N4 or above", "Caregiving skills test"],
  },
  {
    id: "j_010", title: "Factory Worker – Shoe Production", company_name: "Dong Nai Footwear Ltd.", v: "OFFICIAL",
    location: { city: "Dong Nai", country: "VN", is_overseas: false },
    salary: { min: 7_800_000, max: 10_500_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "MANUFACTURING", industry: "TEXTILE",
    source: { type: "GOVERNMENT", name: "National Employment Portal (demo)", url: "https://employment.gov.example" },
    posted_by: { name: "Dong Nai Footwear Ltd.", role: "EMPLOYER" },
    original_url: "https://employment.gov.example/jobs/DN-55310",
    posted_at: iso(3),
    description: "Cutting, stitching and finishing for athletic footwear. Day shift, Monday to Saturday.",
    requirements: ["Age 18+", "No experience required"],
  },
  {
    id: "j_011", title: "Customer Support Agent (Vietnamese/English)", company_name: "Mekong Digital Services", v: "VERIFIED_EMPLOYER",
    location: { city: "Ho Chi Minh City", country: "VN", is_overseas: false },
    salary: { min: 11_000_000, max: 15_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "OFFICE", industry: "IT",
    source: { type: "EMPLOYER", name: "Mekong Digital Careers", url: "https://careers.mekongdigital.example" },
    posted_by: { name: "Mekong Digital Services", role: "EMPLOYER" },
    original_url: "https://careers.mekongdigital.example/support",
    posted_at: iso(2),
    description: "Answer customer inquiries via chat and email for an e-commerce platform.",
    requirements: ["Good written English", "Typing speed 40 wpm+"],
  },
  {
    id: "j_012", title: "Seasonal Fruit Picker", company_name: "Highland Orchards", v: "UNVERIFIED",
    location: { city: "Lam Dong", country: "VN", is_overseas: false },
    salary: { min: 250_000, max: 350_000, currency: "VND", period: "HOUR" },
    employment_type: "SEASONAL", job_category: "AGRICULTURE", industry: "AGRICULTURE",
    source: { type: "JOB_BOARD", name: "Open Job Board (demo)", url: "https://openjobboard.example" },
    posted_by: { name: "Highland Orchards", role: "EMPLOYER" },
    original_url: null,
    posted_at: iso(8),
    description: "Harvest strawberries and avocados during peak season.",
    requirements: ["Able to work outdoors"],
  },
  {
    id: "j_013", title: "Construction Worker (Korea) – Guaranteed Visa", company_name: "KV Fast Visa Agency", v: "WARNING",
    location: { city: "Seoul", country: "KR", is_overseas: true },
    salary: { min: 55_000_000, max: 60_000_000, currency: "VND", period: "MONTH" },
    employment_type: "CONTRACT", job_category: "CONSTRUCTION", industry: "CONSTRUCTION",
    source: { type: "JOB_BOARD", name: "Open Job Board (demo)", url: "https://openjobboard.example" },
    posted_by: { name: "KV Fast Visa Agency", role: "AGENCY", license_number: null },
    original_url: "https://openjobboard.example/post/553310",
    posted_at: iso(2),
    description: "Visa guaranteed. Send passport photo and deposit to secure your place.",
    requirements: ["Deposit required", "Passport copy"],
  },
  {
    id: "j_014", title: "Quality Control Inspector", company_name: "Bac Ninh Precision Electronics", v: "OFFICIAL",
    location: { city: "Bac Ninh", country: "VN", is_overseas: false },
    salary: { min: 9_500_000, max: 13_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "MANUFACTURING", industry: "ELECTRONICS",
    source: { type: "GOVERNMENT", name: "National Employment Portal (demo)", url: "https://employment.gov.example" },
    posted_by: { name: "Bac Ninh Precision Electronics", role: "EMPLOYER" },
    original_url: "https://employment.gov.example/jobs/BN-22902",
    posted_at: iso(4),
    description: "Inspect finished modules using gauges and microscopes. Record defects in the MES system.",
    requirements: ["College degree or equivalent experience", "Attention to detail"],
  },
  {
    id: "j_015", title: "Kitchen Assistant", company_name: "Hanoi Old Quarter Kitchen", v: "UNVERIFIED",
    location: { city: "Hanoi", country: "VN", is_overseas: false },
    salary: { min: 6_000_000, max: 7_500_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "HOSPITALITY", industry: "FOOD",
    source: { type: "JOB_BOARD", name: "Open Job Board (demo)", url: "https://openjobboard.example" },
    posted_by: { name: "Hanoi Old Quarter Kitchen", role: "EMPLOYER" },
    original_url: "https://openjobboard.example/post/549881",
    posted_at: iso(9),
    description: "Prep ingredients, wash dishes and keep the kitchen clean.",
    requirements: ["Food hygiene awareness"],
  },
  {
    id: "j_016", title: "Forklift Operator", company_name: "Saigon Logistics JSC", v: "VERIFIED_EMPLOYER",
    location: { city: "Binh Duong", country: "VN", is_overseas: false },
    salary: { min: 10_000_000, max: 12_500_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "LOGISTICS", industry: "LOGISTICS",
    source: { type: "EMPLOYER", name: "Saigon Logistics Careers", url: "https://careers.saigonlogistics.example" },
    posted_by: { name: "Saigon Logistics JSC", role: "EMPLOYER" },
    original_url: "https://careers.saigonlogistics.example/forklift",
    posted_at: iso(5),
    description: "Load and unload containers using counterbalance forklifts.",
    requirements: ["Forklift certificate", "1+ year experience"],
  },
  {
    id: "j_017", title: "Factory Worker – Auto Parts (Japan, Technical Intern)", company_name: "Nagoya Auto Components", v: "OFFICIAL",
    location: { city: "Aichi", country: "JP", is_overseas: true },
    salary: { min: 170_000, max: 190_000, currency: "JPY", period: "MONTH" },
    employment_type: "CONTRACT", job_category: "MANUFACTURING", industry: "AUTOMOTIVE",
    source: { type: "GOVERNMENT", name: "Overseas Labour Management Board (demo)", url: "https://overseas-labour.gov.example" },
    posted_by: { name: "Overseas Labour Management Board (demo)", role: "GOVERNMENT" },
    original_url: "https://overseas-labour.gov.example/tits/2026-0977",
    posted_at: iso(6),
    description: "Press and welding operations for automotive parts under the official technical intern programme.",
    requirements: ["Age 18–30", "Japanese language training (provided)"],
  },
  {
    id: "j_018", title: "Sales Associate – Electronics Store", company_name: "Can Tho Retail Group", v: "UNVERIFIED",
    location: { city: "Can Tho", country: "VN", is_overseas: false },
    salary: { min: 6_500_000, max: 10_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "RETAIL", industry: "RETAIL",
    source: { type: "JOB_BOARD", name: "Open Job Board (demo)", url: "https://openjobboard.example" },
    posted_by: { name: "Can Tho Retail Group", role: "EMPLOYER" },
    original_url: "https://openjobboard.example/post/548002",
    posted_at: iso(10),
    description: "Advise customers on phones and home appliances. Commission on sales.",
    requirements: ["Friendly communication"],
  },
  {
    id: "j_019", title: "Electrician", company_name: "Hai Phong Mechanical Works", v: "VERIFIED_EMPLOYER",
    location: { city: "Hai Phong", country: "VN", is_overseas: false },
    salary: { min: 11_000_000, max: 15_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "CONSTRUCTION", industry: "MACHINERY",
    source: { type: "EMPLOYER", name: "Hai Phong Mechanical Careers", url: "https://careers.hpmw.example" },
    posted_by: { name: "Hai Phong Mechanical Works", role: "EMPLOYER" },
    original_url: "https://careers.hpmw.example/electrician",
    posted_at: iso(3),
    description: "Install and maintain industrial electrical systems in the factory.",
    requirements: ["Electrician certificate", "Safety training"],
  },
  {
    id: "j_020", title: "Packing Staff", company_name: "Binh Duong Textile Co.", v: "OFFICIAL",
    location: { city: "Binh Duong", country: "VN", is_overseas: false },
    salary: { min: 7_000_000, max: 8_500_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "MANUFACTURING", industry: "TEXTILE",
    source: { type: "GOVERNMENT", name: "National Employment Portal (demo)", url: "https://employment.gov.example" },
    posted_by: { name: "Binh Duong Textile Co.", role: "EMPLOYER" },
    original_url: "https://employment.gov.example/jobs/BD-30118",
    posted_at: iso(1),
    description: "Fold, tag and pack finished garments for export shipment.",
    requirements: ["Age 18+", "No experience required"],
  },
  {
    id: "j_021", title: "Housekeeping Staff", company_name: "Da Nang Seaside Resort", v: "VERIFIED_EMPLOYER",
    location: { city: "Da Nang", country: "VN", is_overseas: false },
    salary: { min: 6_500_000, max: 8_000_000, currency: "VND", period: "MONTH" },
    employment_type: "FULL_TIME", job_category: "HOSPITALITY", industry: "TOURISM",
    source: { type: "EMPLOYER", name: "Da Nang Seaside Careers", url: "https://careers.danangseaside.example" },
    posted_by: { name: "Da Nang Seaside Resort", role: "EMPLOYER" },
    original_url: "https://careers.danangseaside.example/housekeeping",
    posted_at: iso(7),
    description: "Clean and prepare guest rooms to hotel standards.",
    requirements: ["Physically fit", "Detail oriented"],
  },
  {
    id: "j_022", title: "Agricultural Worker (Australia) – Pay to Apply", company_name: "Down Under Jobs Express", v: "WARNING",
    location: { city: "Queensland", country: "AU", is_overseas: true },
    salary: { min: 70_000_000, max: 80_000_000, currency: "VND", period: "MONTH" },
    employment_type: "SEASONAL", job_category: "AGRICULTURE", industry: "AGRICULTURE",
    source: { type: "JOB_BOARD", name: "Open Job Board (demo)", url: "https://openjobboard.example" },
    posted_by: { name: "Down Under Jobs Express", role: "AGENCY", license_number: null },
    original_url: "https://openjobboard.example/post/554001",
    posted_at: iso(4),
    description: "Application fee required before interview. Limited slots.",
    requirements: ["Application fee"],
  },
  {
    id: "j_023", title: "Factory Worker – Electronics (Taiwan, G2G programme)", company_name: "Taichung Precision Components", v: "OFFICIAL",
    location: { city: "Taichung", country: "TW", is_overseas: true },
    salary: { min: 27_470, max: 30_000, currency: "TWD", period: "MONTH" },
    employment_type: "CONTRACT", job_category: "MANUFACTURING", industry: "ELECTRONICS",
    source: { type: "GOVERNMENT", name: "Overseas Labour Management Board (demo)", url: "https://overseas-labour.gov.example" },
    posted_by: { name: "Overseas Labour Management Board (demo)", role: "GOVERNMENT" },
    original_url: "https://overseas-labour.gov.example/g2g/tw-2026-0311",
    posted_at: iso(2),
    description: "Assembly line work under the official government-to-government programme. No broker or processing fees are charged to applicants.",
    requirements: ["Age 20–35", "Health check certificate", "Pre-departure orientation (provided)"],
  },
];


const sourceIds = new Map<string, string>();
const companyIds = new Map<string, string>();

export const JOBS: Job[] = seeds.map((s, i) => {
  const sid = sourceIds.get(s.source.name) ?? mockUuid(900 + sourceIds.size);
  sourceIds.set(s.source.name, sid);
  const cid = companyIds.get(s.company_name) ?? mockUuid(500 + companyIds.size);
  companyIds.set(s.company_name, cid);
  const hasCompany = s.v === "OFFICIAL" || s.v === "VERIFIED_EMPLOYER";
  return {
    id: mockUuid(i + 1),
    source_id: sid,
    company_id: hasCompany ? cid : null,
    title: s.title,
    company_name: s.company_name,
    location: s.location.city ?? null,
    country: s.location.country,
    work_scope: s.location.is_overseas ? "OVERSEAS" : "DOMESTIC",
    work_type: s.employment_type,
    occupation: s.job_category,
    industry: s.industry,
    salary_min: s.salary?.min ?? null,
    salary_max: s.salary?.max ?? null,
    currency: s.salary?.currency ?? null,
    description: [s.description, ...(s.benefits?.length ? ["", ...s.benefits.map((b) => `• ${b}`)] : [])].join("\n"),
    requirements: s.requirements,
    source_url: s.original_url,
    verification_status: s.v,
    verification_summary: SUMMARY[s.v](s),
    published_at: s.posted_at,
    closes_at: new Date(Date.parse(s.posted_at) + 30 * DAY).toISOString(),
    retrieved_at: s.posted_at,
    last_verified_at: s.v === "UNVERIFIED" ? null : iso(1),
    active: true,
    sources: {
      id: sid,
      name: s.source.name,
      type: s.source.type.charAt(0) + s.source.type.slice(1).toLowerCase().replace(/_/g, " "), // 예: "Government"
      official_domain: s.source.url ? new URL(s.source.url).host : null,
      verification_level: s.v === "OFFICIAL" ? "OFFICIAL" : null,
      country: s.location.country,
      last_checked_at: iso(1),
      active: true,
    },
    companies: hasCompany ? { id: cid, name: s.company_name, website: null } : null,
  };
});

