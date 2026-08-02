/**
 * scripts/spike-caldav.ts
 *
 * iCloud CalDAV 연결 가능성 판정용 일회성 스파이크.
 * 프로덕션 코드가 아니다. 판정이 끝나면 삭제한다.
 *
 * 실행: npx tsx scripts/spike-caldav.ts
 *
 * 주의: 아래 tsdav API 시그니처는 검증이 필요하다.
 * 실행 전에 https://tsdav.vercel.app 문서에서 현재 시그니처를 확인할 것.
 * 함수명이 다르면 스크립트를 고치는 게 맞고, 그건 CalDAV 실패가 아니다.
 */

import { createDAVClient } from "tsdav";
import ical from "ical-generator";
import { config } from "dotenv";

config({ path: ".env.local" });

const APPLE_ID = required("APPLE_ID");
const APP_PASSWORD = required("APPLE_APP_PASSWORD").replace(/\s|-/g, "");
const TARGET_CALENDAR = process.env.APP_CALENDAR_NAME ?? "Personal OS";

function required(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`환경변수 ${key} 없음`);
  return v;
}

const results: { step: string; ok: boolean; detail: string }[] = [];
function record(step: string, ok: boolean, detail: string) {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}\n      ${detail}\n`);
}

async function main() {
  // ---------- 1. 로그인 ----------
  let client;
  try {
    client = await createDAVClient({
      serverUrl: "https://caldav.icloud.com",
      credentials: { username: APPLE_ID, password: APP_PASSWORD },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    record("1. 로그인", true, "인증 성공");
  } catch (e) {
    record("1. 로그인", false, String(e));
    return verdict();
  }

  // ---------- 2. 캘린더 목록 ----------
  let calendars;
  try {
    calendars = await client.fetchCalendars();
    const names = calendars.map((c) => `${String(c.displayName)} (ctag=${c.ctag ?? "none"})`);
    record("2. 캘린더 목록", calendars.length > 0, `${calendars.length}개\n      ${names.join("\n      ")}`);
  } catch (e) {
    record("2. 캘린더 목록", false, String(e));
    return verdict();
  }

  // ---------- 3. 대상 캘린더 확인 ----------
  const target = calendars.find((c) => String(c.displayName) === TARGET_CALENDAR);
  if (!target) {
    record("3. 대상 캘린더", false, `'${TARGET_CALENDAR}' 없음. 아이폰 캘린더 앱에서 iCloud 아래에 먼저 만들 것`);
    return verdict();
  }
  record("3. 대상 캘린더", true, `url=${target.url}`);

  // ---------- 4. 이벤트 쓰기 ----------
  const uid = `spike-${Date.now()}@personal-os`;
  const filename = `${uid}.ics`;
  const start = new Date(Date.now() + 86_400_000);
  const cal = ical({ name: "spike" });
  cal.createEvent({
    id: uid,
    start,
    end: new Date(start.getTime() + 3_600_000),
    summary: "SPIKE TEST — 자동 삭제됨",
  });

  try {
    const res = await client.createCalendarObject({
      calendar: target,
      filename,
      iCalString: cal.toString(),
    });
    record("4. 이벤트 PUT", res.ok !== false, `filename=${filename}`);
  } catch (e) {
    record("4. 이벤트 PUT", false, String(e));
    return verdict();
  }

  // ---------- 5. 되읽기 ----------
  let created;
  try {
    const objects = await client.fetchCalendarObjects({ calendar: target });
    created = objects.find((o) => o.data?.includes(uid));
    record("5. 되읽기", Boolean(created), created ? `etag=${created.etag}` : "PUT한 uid를 못 찾음");
  } catch (e) {
    record("5. 되읽기", false, String(e));
  }

  // ---------- 6. 삭제 ----------
  if (created) {
    try {
      await client.deleteCalendarObject({ calendarObject: created });
      const after = await client.fetchCalendarObjects({ calendar: target });
      const gone = !after.some((o) => o.data?.includes(uid));
      record("6. 삭제", gone, gone ? "정상 제거" : "삭제 후에도 남아있음");
    } catch (e) {
      record("6. 삭제", false, String(e));
    }
  }

  // ---------- 7. ctag 안정성 ----------
  try {
    const a = await client.fetchCalendars();
    await new Promise((r) => setTimeout(r, 2000));
    const b = await client.fetchCalendars();
    const ca = a.find((c) => c.url === target.url)?.ctag;
    const cb = b.find((c) => c.url === target.url)?.ctag;
    record(
      "7. ctag 안정성",
      Boolean(ca) && ca === cb,
      ca ? `ctag 동일: ${ca === cb}` : "ctag가 노출되지 않음 (증분 동기화 불가)"
    );
  } catch (e) {
    record("7. ctag 안정성", false, String(e));
  }

  verdict();
}

function verdict() {
  const at = (n: number) => results.find((r) => r.step.startsWith(String(n)))?.ok ?? false;
  console.log("\n========== 판정 ==========");
  if (!at(1) || !at(2)) {
    console.log("ICS 구독 폴백 채택 — CalDAV 인증/조회 자체가 안 됨");
  } else if (!at(4) || !at(5) || !at(6)) {
    console.log("읽기 전용 + 로컬 쓰기 폴백 채택 — 읽기는 되지만 쓰기가 안 됨");
  } else if (!at(7)) {
    console.log("CalDAV 직결 채택, 단 증분 동기화 불가 — 매번 전체 조회 (폴링 간격을 늘릴 것)");
  } else {
    console.log("CalDAV 직결 채택 — 6단계 전부 통과");
  }
  console.log("이 판정을 docs/DECISIONS.md에 기록할 것.");
}

main().catch((e) => {
  console.error("스파이크 중단:", e);
  process.exit(1);
});
