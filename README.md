# Truework — Frontend (Next.js PWA)

신뢰할 수 있는 출처의 채용 공고를 탐색하고, 의심스러운 채용 제안을 검사하는 모바일 우선 PWA.
요구사항: `Frontend Requirements.md` (Hackathon MVP)

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # 계약·규칙 테스트
npm run build && npm start   # 서비스 워커는 production 에서만 등록
```

### 실제 백엔드 연결 (`API.md` 계약)

`.env.local`에 다음을 넣습니다(`.env.example` 참고).

```
NEXT_PUBLIC_API_BASE_URL=https://<백엔드 origin>     # 클라이언트가 /api/v1 을 붙입니다
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

- 인증은 Supabase Auth(이메일·비밀번호)로 하고, access token 을 `Authorization: Bearer`로 보냅니다.
- 백엔드 `ALLOWED_ORIGINS`에 프런트엔드 origin(예: `http://localhost:3000`)이 등록돼 있어야 합니다(CORS).
- `NEXT_PUBLIC_*` 값은 빌드 시점에 번들에 들어가므로 바꾼 뒤에는 다시 빌드해야 합니다.

`NEXT_PUBLIC_API_BASE_URL`이 비어 있으면 `src/mocks/server.ts`의 **목 API**가 같은 계약을 브라우저 안에서 흉내 냅니다.

### 데모 팁 (목 API)
- 로그인: 아무 이메일 + 8자 이상 비밀번호 (목 인증, 계정 자동 생성)
- 검사 텍스트에 `fee`, `deposit`, `zalo`, `수수료` 등 → WARNING 보고서
- URL에 `employment.gov.example` → OFFICIAL, 그 외 → UNVERIFIED, 스크린샷 → WARNING
- `slow` 포함 → 장시간 처리 UI, `force-fail` → 처리 실패, `force-429` / `force-500` → 오류 상태

## 구조

```
src/
  app/                 라우트 (jobs, jobs/[id], check, check/[id], saved, profile, login, onboarding)
  components/          UI 컴포넌트, providers(Auth·Saved·Toast)
  lib/api.ts           API 클라이언트 (/api/v1, snake_case 그대로, 오류 → ApiError, Idempotency-Key)
  lib/auth.ts          인증 어댑터 (Supabase Auth / 목 인증)
  lib/types.ts         API 계약 타입
  lib/status.ts        서버 상태값 → 표현 매핑만 (재계산 없음, 미지 값은 중립 + 진단 이벤트)
  i18n/                ko / en 문구 사전 (문자열 하드코딩 없음)
  mocks/               데모용 목 백엔드
public/sw.js           앱 셸 캐시 (API 응답은 캐시하지 않음)
```

## 책임 경계 원칙
- `verification.status`, `risk_indicators`, `evidence`, `summary`, `disclaimer`, `safety_guidance`, 대안 공고는 서버 값을 그대로 렌더링
- WARNING 화면에 "확정 판정이 아님"을 항상 표시, 누락 필드는 "확인되지 않음"
- 외부 링크는 https만, 이동 전 확인 모달 + 주소 복사 제공

## 운영 전 TODO
- `occupation`·`work_type`·`source_type`·`industry` 필터 값 목록을 서버 DB 값과 맞추기(`src/lib/jobsQuery.ts`) — 명세에 값 목록이 없음
- 위험 지표 `code` → 제목 사전(`src/i18n/*.ts`의 `risk.codes`)을 서버 코드 목록과 맞추기 — 명세상 지표에 `title` 필드가 없음
- 필터 선택지를 서버 메타 API로 대체, 목록 가상화, 분석 도구 연동(`lib/telemetry.ts`)
- 베트남어(vi) 사전 추가 — `src/i18n/ko.ts`의 `Dict` 타입을 따르면 됨
