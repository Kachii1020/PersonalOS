# SPEC.md Phase 4 개정안 — 승인 대기

**상태**: 제안. 승인 답변이 오기 전에는 Phase 4 코드를 쓰지 않는다 (CLAUDE.md).
**근거**: `docs/ROADMAP.md` Track 2.0
**이 파일이 하는 일**: 아래 텍스트를 승인 후 `SPEC.md`에 그대로 반영한다. SPEC.md 자체는 이 PR에서 고치지 않는다.

---

## 승인하면 바뀌는 것 / 안 바뀌는 것

바뀜: 5.5 호출 지점 표, 5.6·5.7 신설, 6.1 한 줄, 6.2 설정 행 보강, 7절 Phase 4+G4, 8절 환경변수 2개.

안 바뀜: 데이터 소유권(Notion 읽기 전용), 6.4 12규칙, G1–G3 조건, 대시보드 위젯 배치, CalDAV 절대 규칙.

---

## 해석이 갈리는 3곳 (승인 시 골라 주세요)

기본값은 ROADMAP이 고른 쪽이다. 침묵하면 기본값으로 반영한다.

| # | 항목 | 기본 (권장) | 대안 |
|---|---|---|---|
| A | 도메인 레슨 | 4번째 호출 지점으로 **소급 승인**. `ai_usage.purpose = 'domain_lesson'` | 계속 `purpose='quiz'`로 기록 (호출 지점은 인정하되 용도 구분을 안 함) |
| B | 주간 리뷰 UI | `/briefing` 하단 섹션. 대시보드 그리드·글래스 0변경 | 새 라우트 `/review` / 대시보드 위젯 추가 |
| C | 푸시 발송 시점 | 브리핑 ready, 퀴즈 생성 후 복습 대기 건수, sync 실패 전환 | 브리핑만 / 마감 임박 태스크 추가 |

---

## 반영할 텍스트

### 1) 5.5 — 호출 지점 표를 교체

지금:

```
**호출하는 곳은 3군데뿐이다.**
| 용도 | 빈도 | 배치 방식 |
| 브리핑 생성 | 1일 1회 | ...
| 퀴즈 생성 | 1일 1회 | ...
| 강의자료 요약 | 수동 | ...
```

교체:

```
**호출하는 곳은 아래 5군데뿐이다.** 네 곳을 넘기려면 이 표를 먼저 개정한다.
모든 호출은 `lib/ai/client.ts`의 단일 함수를 경유한다. 이 제약은 불변이다.

| 용도 | purpose | 빈도 | 배치 방식 |
|---|---|---|---|
| 브리핑 생성 | briefing | 1일 1회 | 5개 섹터 전부를 **1회 호출**에 넣는다 |
| 퀴즈 생성 | quiz | 1일 1회 | 5문제를 1회 호출로 |
| 강의자료 요약 | material_summary | 수동 | 버튼 클릭 시에만 |
| 도메인 레슨 | domain_lesson | 수동 스크립트 | 도메인당 1회. 이미 있으면 건너뛴다 |
| 주간 리뷰 | weekly_review | 주 1회 (일 21:00 JST) | 집계는 SQL, AI는 서술만. **1회 호출** |

도메인 레슨은 post-gate에서 `scripts/gen-lessons.ts`로 이미 들어왔다. 이 개정으로 소급 승인한다.
주간 리뷰의 숫자(정답률, 완료 태스크, 커밋 수)는 서버가 SQL로 계산해 프롬프트에 넣는다. AI가 숫자를 만들면 반려.
```

비용 가드 문단은 그대로 둔다.

### 2) 5.5 뒤에 5.6 · 5.7 삽입

```
### 5.6 Web Push

iOS 16.4+ 에서 홈 화면에 추가된 PWA만 구독할 수 있다. 권한 요청은 반드시 `/settings`의 버튼 클릭(사용자 제스처)에서 한다.

- 구독은 `push_subscriptions`에 저장한다 (endpoint 유니크, p256dh, auth).
- 발송은 서버에서만. 라이브러리는 `web-push`, VAPID. 공개키만 `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- 발송 시점: 브리핑 `ready`, 퀴즈 생성 직후 복습 대기 건수, `sync_state`가 ok→failed로 바뀔 때.
- **발송 실패는 잡을 실패시키지 않는다.** `job_runs.meta`에 기록한다.
- 구독이 HTTP 410이면 해당 행을 지우고 잡은 계속한다.
- `public/sw.js`의 `push` / `notificationclick`이 알림을 띄우고 해당 화면으로 연다 (브리핑 → `/briefing`).

### 5.7 오프라인

기존 결정("HTML·API를 캐시하지 않는다")을 **부분 번복**한다. 원래 우려(낡은 미러를 신선한 데이터로 착각)는 아래 조건으로 지킨다.

- 내비게이션(HTML)은 **network-first**. 온라인이면 캐시는 응답하지 않는다.
- 네트워크가 실패했을 때만 마지막 HTML을 폴백한다. 이때 화면에 "오프라인 — 마지막 동기화 데이터"를 띄운다.
- `/_next/static` 해시 자산은 지금처럼 캐시-우선.
- API·Supabase 요청은 캐시하지 않는다.
- 캐시 이름을 올려 activate에서 구버전을 지운다.
```

### 3) 6.1 — 레이아웃 설명 끝에 한 줄

```
주간 리뷰는 대시보드에 위젯을 추가하지 않는다. `/briefing` 하단 섹션으로 붙인다. 글래스는 쓰지 않는다 (6.4 규칙 1: 글래스는 달력·브리핑 카드만).
```

### 4) 6.2 — `/settings` 행을 보강

설정 페이지 설명에 다음을 더한다: `푸시 알림 구독/해제`.

`/more`는 PWA 브랜치의 모바일 IA일 뿐 Phase 4 범위가 아니다. 이 개정에 넣지 않는다.

### 5) 7절 — Phase 3 뒤에 Phase 4 추가

```
### Phase 4 — 앱처럼 행동하기 (게이트 G4)

범위: Web Push, 오프라인 폴백, 주간 리뷰.

실행 순서: db-architect → push(서버=ingest 패턴, 구독 UI·SW=ui-shell) → offline(ui-shell) → weekly-review(ai-pipeline) → verifier(G4)

**G4 통과 조건**
- [ ] `/settings`에서 푸시 구독 → `push_subscriptions`에 1행 → 테스트 발송 → 기기에 알림 수신 (구독 왕복)
- [ ] 브리핑 잡이 `ready`로 끝나면 푸시가 발송되고, 발송 실패가 브리핑 잡 자체를 실패시키지 않는다
- [ ] 만료된 구독(HTTP 410)은 발송 시 해당 행이 삭제되고 잡은 계속된다
- [ ] 온라인으로 대시보드를 1회 방문한 뒤 네트워크를 끊고 재실행 → 마지막 데이터 + 오프라인 표시로 렌더 (백지·500 없음)
- [ ] 온라인 상태에서는 항상 네트워크 응답이 우선이다 (캐시가 신선한 데이터를 가리지 않는다)
- [ ] 주간 리뷰 잡 1회 실행 → `weekly_reviews` 1행 `ready` + `ai_usage` 정확히 1행 (`purpose='weekly_review'`)
- [ ] 주간 리뷰의 퀴즈 정답률·완료 태스크 수·커밋 수가 SQL 수기 집계와 일치한다
- [ ] 월 예산 소진 상태에서 주간 리뷰 잡 실행 → 402, `weekly_reviews`에 `ready` 행이 남지 않는다
```

조건 1은 실기기라 G2 조건 2처럼 수동 판정으로 남겨도 된다.

### 6) 4절 스키마 — 테이블 2개 (마이그레이션은 Trust의 `0008_event_exdates` 다음 번호)

```sql
create table push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  created_at    timestamptz not null default now()
);

create table weekly_reviews (
  id            uuid primary key default gen_random_uuid(),
  week_start    date not null unique,          -- 그 주 월요일 (JST)
  status        text not null default 'pending', -- pending | ready | failed
  content       jsonb,
  created_at    timestamptz not null default now()
);
```

RLS는 기존과 같다 (`is_allowed_user()`). service_role GRANT를 이 두 테이블에 따로 준다 (0005 전례 — 0001의 `GRANT ALL ON ALL TABLES`는 당시 테이블만 커버).

### 7) 8절 환경변수 — 목록 끝에 추가

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

---

## 승인 후 에이전트가 할 일

1. 위 텍스트를 `SPEC.md`에 반영하는 커밋 (이 제안 PR이 아니라 별도).
2. `docs/DECISIONS.md`에 3건: 호출 지점 5개 정식화 / SW HTML 캐시 부분 번복 / 주간 리뷰 표시 위치.
3. `docs/CURRENT_PHASE.md`를 Phase 4로.
4. ROADMAP Track 2.1부터 에이전트 순서로 구현. 코드는 그 다음이다.

---

## 이 개정에 넣지 않는 것

커맨드 팔레트, 실보유 종목, 퀴즈 분석, 지원 파이프라인 Notion 쓰기, 스플래시·풀투리프레시·탭 커스터마이즈. `docs/ROADMAP.md` 마지막 절과 같다.
