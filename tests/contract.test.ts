import { test } from "node:test";
import assert from "node:assert/strict";
import { toStatusKey } from "../src/lib/status";
import { safeExternalUrl, formatSalary, formatLocation } from "../src/lib/format";
import { VERIFICATION_STATUSES, CHECK_PROGRESS } from "../src/lib/types";
import { JOBS } from "../src/mocks/data";
import ko from "../src/i18n/ko";
import en from "../src/i18n/en";

test("지원 상태는 네 가지 enum 으로 제한된다", () => {
  assert.deepEqual([...VERIFICATION_STATUSES], ["OFFICIAL", "VERIFIED_EMPLOYER", "UNVERIFIED", "WARNING"]);
});

test("서버 상태값을 변형 없이 그대로 매핑한다", () => {
  for (const s of VERIFICATION_STATUSES) assert.equal(toStatusKey(s), s);
});

test("알 수 없는 상태값은 중립 UNAVAILABLE 로 표시한다", () => {
  assert.equal(toStatusKey("SAFE"), "UNAVAILABLE");
  assert.equal(toStatusKey("SCAM"), "UNAVAILABLE");
  assert.equal(toStatusKey(""), "UNAVAILABLE");
  assert.equal(toStatusKey(null), "UNAVAILABLE");
  assert.equal(toStatusKey("official"), "UNAVAILABLE"); // 대소문자도 추론하지 않음
});

test("모든 상태에 라벨·설명과 아이콘용 키가 있다 (ko/en)", () => {
  for (const dict of [ko, en]) {
    for (const s of [...VERIFICATION_STATUSES, "UNAVAILABLE"] as const) {
      assert.ok(dict.status[s].label.length > 0);
      assert.ok(dict.status[s].desc.length > 0);
    }
    for (const st of ["UPLOAD", ...CHECK_PROGRESS] as const) assert.ok(dict.progress.stages[st]);
  }
});

test("UI 문구에 단정적 판정 표현이 없다", () => {
  const banned = [/\bSAFE\b/, /\bSCAM\b/, /인신매매/, /trafficking/i, /안전합니다/, /사기입니다/, /is a scam/i];
  const all = JSON.stringify(ko) + JSON.stringify(en);
  for (const re of banned) assert.equal(re.test(all), false, `banned: ${re}`);
});

test("외부 링크는 https 만 허용한다", () => {
  assert.equal(safeExternalUrl("https://employment.gov.example/jobs/1"), "https://employment.gov.example/jobs/1");
  assert.equal(safeExternalUrl("http://example.com"), null);
  assert.equal(safeExternalUrl("javascript:alert(1)"), null);
  assert.equal(safeExternalUrl("data:text/html,hi"), null);
  assert.equal(safeExternalUrl("https://user:pass@example.com"), null);
  assert.equal(safeExternalUrl("not a url"), null);
  assert.equal(safeExternalUrl(null), null);
});

test("급여는 통화를 환산하지 않고 표기만 바꾼다", () => {
  const s = formatSalary(8_500_000, 11_000_000, "VND", "vi-VN");
  assert.ok(s && s.includes("8.500.000") && s.includes("11.000.000"));
  assert.equal(formatSalary(null, null, "VND", "ko-KR"), null);
  assert.ok(formatSalary(5000, null, null, "en-US")?.includes("5,000"));
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("목 데이터가 Job 계약을 따른다", () => {
  const ids = new Set<string>();
  for (const j of JOBS) {
    assert.match(j.id, UUID_RE);
    assert.ok(!ids.has(j.id), `duplicate id ${j.id}`);
    ids.add(j.id);
    assert.ok((VERIFICATION_STATUSES as readonly string[]).includes(j.verification_status));
    assert.ok(j.work_scope === "DOMESTIC" || j.work_scope === "OVERSEAS");
    assert.ok(j.country === null || /^[A-Z]{2}$/.test(j.country));
    assert.ok(j.source_url === null || j.source_url.startsWith("https://"));
    assert.ok(Array.isArray(j.requirements));
    assert.ok(!j.published_at || !Number.isNaN(Date.parse(j.published_at)));
  }
});

test("location 에 국가명이 이미 있으면 반복하지 않는다", () => {
  assert.equal(formatLocation("Pingtung, Taiwan", "TW", "en-US"), "Pingtung, Taiwan");
  assert.equal(formatLocation("Germany", "DE", "ko-KR"), "Germany");
  assert.equal(formatLocation("Hanoi", "VN", "en-US"), "Hanoi, Vietnam");
  assert.equal(formatLocation(null, "VN", "en-US"), "Vietnam");
});
