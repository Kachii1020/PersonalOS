# 결정 로그

## 2026-08-03 — 인증은 Supabase 매직 링크, 방어는 세 겹

- **결정**: 비밀번호 없이 매직 링크(OTP)로 로그인한다. 화이트리스트 검사를 (1) 서버 액션에서 메일 발송 전, (2) 미들웨어 세션 검사, (3) RLS의 `is_allowed_user()` 세 곳에 둔다.
- **이유**: 단일 사용자 앱이라 비밀번호 관리가 순비용이다. 메일 발송 전에 자르지 않으면 아무나 로그인 링크를 받아갈 수 있고, 미들웨어만 믿으면 라우트 하나 빠뜨렸을 때 뚫린다.
- **버린 대안**: 비밀번호 로그인 — 저장·회전 부담만 늘어난다. OAuth — 제공자 하나에 계정을 묶게 된다.

AGENTS.md에 인증 담당 에이전트가 없어서 ui-shell 범위로 넣었다(`app/(dashboard)/layout.tsx`가 "인증된 영역"이므로).

## 2026-08-03 — 서비스 워커는 프로덕션에서만, /_next/static만 캐시

- **결정**: SW 등록을 `NODE_ENV === "production"`으로 제한하고, 캐시 대상을 `/_next/static/` 아래 파일로 좁혔다.
- **이유**: 개발 서버의 청크 경로에는 빌드 해시가 없다. 캐시-우선으로 잡으니 낡은 번들이 계속 살아남아 새로 고쳐도 옛 사이드바가 렌더됐다. 실제로 이 증상을 디버깅하는 데 시간을 썼다.
- **버린 대안**: 캐시 버전을 올려 무효화 — 개발 중 매번 올려야 해서 같은 함정을 반복한다.

## 2026-08-03 — 로컬 개발은 .env.development.local로 분리

- **결정**: 로컬 스택 값을 `.env.development.local`에 두고 `.env.local`(호스티드)은 건드리지 않는다.
- **이유**: Next.js는 `.env.development.local`을 `.env.local`보다 먼저 읽는다. 호스티드에는 아직 마이그레이션이 없어서 개발이 안 된다. `db push` 후 이 파일만 지우면 호스티드로 돌아간다.
- **버린 대안**: `.env.local`을 로컬 값으로 덮어쓰기 — 사용자가 넣은 호스티드 자격증명이 날아간다.

## 2026-08-03 — [승인됨 2026-08-03] SPEC 6.3 토큰 3개 보정

대비 계산 결과 SPEC 6.3 값 그대로는 "모든 텍스트 대비 4.5:1 이상"(ui-shell 완료 검증 2)을 통과하지 못한다. 최소 변경으로 보정했고, 승인받아 SPEC.md 6.3에 반영했다.

| 토큰 | SPEC 값 | 문제 | 적용값 | 결과 |
|---|---|---|---|---|
| 라이트 `--text-muted` | `#64748b` | `--bg` 위에서 4.48:1 (AA에 0.02 부족) | `#63738a` | 4.54:1 |
| 다크 `--positive` | (미정의, 라이트 상속) | `--surface` 위에서 3.40:1 | `#3fbfa0` | 7.62:1 |
| 다크 `--negative` | (미정의, 라이트 상속) | `--surface` 위에서 2.67:1 | `#f2857c` | 7.00:1 |

다크 `--line`도 SPEC에 없어서 `rgba(255,255,255,0.10)`을 넣었다. 텍스트가 아니라 대비 기준(4.5:1) 대상은 아니다.

## 2026-08-03 — 셸 컴포넌트를 components/shell/에 둔다

- **결정**: 사이드바·모바일 네비·테마 토글을 `components/shell/`에 뒀다.
- **이유**: CLAUDE.md의 디렉토리 트리는 `components/ui`(원시 컴포넌트)와 `components/widgets`(대시보드 카드)만 정의한다. 사이드바는 둘 다 아니다. `ui/`에 넣으면 "원시 컴포넌트"의 의미가 흐려진다.
- **버린 대안**: `components/ui/`에 같이 넣기 — 버튼·카드와 셸 레이아웃이 섞인다.

## 2026-08-03 — Pretendard를 npm 패키지로 로드

- **결정**: `pretendard` npm 패키지를 설치하고 `next/font/local`로 `node_modules`의 woff2를 참조한다.
- **이유**: 폰트 2MB를 레포에 커밋하지 않으면서 버전이 고정된다. CDN을 쓰지 않으니 외부 의존과 오프라인 문제도 없다.
- **버린 대안**: CDN `<link>` — 검증되지 않은 외부 URL에 의존하게 된다.

## 2026-08-03 — RLS 화이트리스트를 app_config 테이블 + 생성 seed.sql로 구현

- **결정**: 허용 이메일을 `app_config` 테이블에 담고, `scripts/gen-seed.ts`가 `.env.local`의 `ALLOWED_EMAIL`로 `supabase/seed.sql`을 만든다. seed.sql은 `.gitignore`에 넣었다. 정책은 `public.is_allowed_user()`(security definer)를 호출한다.
- **이유**: 이메일을 마이그레이션에 하드코딩하면 git에 개인정보가 남는다. `current_setting()` 방식은 `db reset`에서 값이 날아가고, 호스티드 Supabase에서는 `alter database`를 못 쓴다. 값이 없으면 함수가 false를 반환해 전부 막힌다(fail-closed).
- **버린 대안**: 마이그레이션에 이메일 직접 기입 — 가장 단순하지만 git에 남는다.

## 2026-08-03 — 마이그레이션에서 GRANT를 명시적으로 준다

- **결정**: `0001_phase1_core.sql`에 `service_role`(전체)과 `authenticated`(9개 테이블 CRUD) GRANT를 넣었다. `anon`에는 아무것도 주지 않는다.
- **이유**: 마이그레이션으로 만든 테이블에는 세 롤 모두 기본 권한이 없다. RLS만 켜면 `42501 permission denied`로 **service_role까지 막혀 잡 엔드포인트가 전부 죽는다.** 검증 중에 실제로 이 상태를 재현했다.
- **버린 대안**: `alter default privileges`에 의존 — 이 CLI 버전에서 적용되지 않는 걸 확인했다.

## 2026-08-03 — Phase 1 마이그레이션에서 course_id 제외

- **결정**: SPEC.md 4절의 `events.course_id`, `tasks.course_id`를 Phase 1 마이그레이션에서 뺐다. Phase 2에서 `alter table`로 추가한다.
- **이유**: 둘 다 `courses(id)`를 참조하는데 `courses`는 Phase 2 테이블이다. SPEC의 SQL은 `events`가 `courses`보다 먼저 정의돼 있어 순서대로 실행하면 그대로는 실패한다.
- **버린 대안**: Phase 2 테이블을 미리 만들기 — 스코프 게이트 위반.

## 2026-08-03 — 로컬 Supabase 포트를 544xx로 이동

- **결정**: `supabase/config.toml`의 api/db/studio/smtp/pooler 포트를 54421/54422/54423/54424/54429로 옮겼다 (shadow 54420).
- **이유**: circle-connect의 로컬 스택이 기본 포트 54321~54324를 점유한 채 돌고 있다. 두 프로젝트를 동시에 띄우려면 겹치면 안 된다.
- **버린 대안**: circle-connect 스택 중지 — 남의 작업 환경을 끄는 셈이다.

## 2026-08-03 — CalDAV 직결 채택 (caldav-spike 판정)

- **결정**: iCloud CalDAV에 직접 읽기/쓰기한다. SPEC.md 5.1의 폴백(읽기 전용 + 로컬 쓰기 / ICS 구독)은 쓰지 않는다.
- **이유**: `scripts/spike-caldav.ts` 7단계 전부 통과. 아래가 실행 증거다.
- **버린 대안**: ICS 구독 폴백 — 쓰기가 되므로 불필요. 코드는 남기지 않는다.

| # | 단계 | 결과 | 증거 |
|---|---|---|---|
| 1 | Basic 인증 로그인 | 통과 | 예외 없이 완료 |
| 2 | 캘린더 목록 | 통과 | 8개, 전부 ctag 노출됨 |
| 3 | 대상 캘린더 확인 | 통과 | `Personal OS` 존재, url=`.../21601290413/calendars/8DDBD57E-6D16-41FC-B170-5EF140A51582/` |
| 4 | 이벤트 PUT | 통과 | `spike-1785690508806@personal-os.ics` |
| 5 | 되읽기 | 통과 | etag=`"msc20v0w"` |
| 6 | DELETE | 통과 | 재조회 시 uid 사라짐 |
| 7 | ctag 안정성 | 통과 | 2초 간격 2회 조회에서 ctag 동일 → **증분 동기화 가능** |

7번이 통과했으므로 integration-caldav의 절대규칙 #2(ctag 미변경 시 이벤트 미조회)를 그대로 구현할 수 있고, G1의 "2회차 0건" 조건도 달성 가능하다.

기존 캘린더 8개 중 앱 전용은 `Personal OS` 하나다. 나머지 7개(`基幹理工学部 年間行事予定`, `わせジュールカレンダー`, `집`, `早稲田大学 年間行事予定`, `미리 알림`, `직장`, `プライベート`)는 `is_writable = false`로 저장한다.

## 2026-08-03 — personalOS를 독립 git 저장소로 초기화

- **결정**: `~/personalOS/`에서 `git init`을 실행해 홈 디렉토리 저장소와 분리했다.
- **이유**: `~` 자체가 커밋 0개짜리 git 저장소로 잡혀 있었다(실수로 만들어진 것으로 보임). 그대로 커밋하면 홈 전체가 추적 대상이 된다.
- **버린 대안**: 홈 저장소에 그대로 커밋 — 무관한 파일 수백 개가 딸려온다.

## 2026-08-03 — Next.js 15 스캐폴드를 임시 디렉토리에서 병합

- **결정**: `create-next-app@15`를 스크래치패드에 돌린 뒤 `app/` `public/` `next.config.ts` `postcss.config.mjs` `eslint.config.mjs` `tsconfig.json`만 복사하고, package.json은 의존성·스크립트만 병합했다.
- **이유**: 레포에 이미 `package.json`, `tsconfig.json`, 스펙 문서가 있어서 제자리 실행이 충돌한다. 생성기의 README·.gitignore가 우리 것을 덮어쓰는 것도 막아야 했다.
- **버린 대안**: 설정 파일을 손으로 작성 — Next 15 + Tailwind v4 표준 구성에서 벗어날 위험이 있다.

결과: Next 15.5.22 / React 19.1.0 / TypeScript 5.9.3 / Tailwind 4.3.3. `typecheck`, `lint`, `build` 전부 통과.

## 2026-08-03 — `"type": "module"` 제거, TypeScript를 5.x로 고정

- **결정**: 앞서 넣었던 `"type": "module"`을 지우고 typescript를 `^7`에서 `^5`로 내렸다. tsconfig는 Next 표준(`module: esnext`, `moduleResolution: bundler`, `jsx: preserve`, `strict: true`)으로 교체했다.
- **이유**: 둘 다 스파이크 전용 임시 조치였는데, Next 15의 표준 구성이 이를 대체한다. `eslint-config-next` 15는 TS 5 기준이다.
- **버린 대안**: ESM 유지 — `tsdav`와 `ical-generator` 모두 CJS 진입점을 제공해서 스파이크 실행에 지장이 없다(로드 확인 완료).

## 2026-08-03 — 홈 디렉토리의 잘못된 git 저장소 삭제

- **결정**: `~/.git`(126GB)을 삭제했다.
- **이유**: mood-menu 원격이 홈 디렉토리에 붙어 있었고, 중단된 `git add`가 loose object 458,712개 + garbage pack 28개를 남겼다. 커밋 0개 / ref 0개 / 추적 파일 0개라 잃을 이력이 없었다. mood-menu 실제 저장소는 `~/workshop-waseda`(커밋 `cd25cd8`)에 따로 있다.
- **버린 대안**: `git gc`로 정리 후 유지 — 애초에 홈을 저장소로 둘 이유가 없다.

## 2026-08-03 — package.json에 `"type": "module"` + tsconfig `types: ["node"]`

- **결정**: 패키지를 ESM으로 선언하고 `@types/node`를 타입에 포함시켰다.
- **이유**: TS 7의 `tsc --init` 기본값이 `verbatimModuleSyntax: true` + `types: []`인데, `spike-caldav.ts`가 ESM 문법이라 TS1295로 막혔고 `process`도 못 찾았다.
- **버린 대안**: `verbatimModuleSyntax`를 끄기 — 스크립트가 이미 ESM이고 `ical-generator` v11도 ESM이라 런타임 의미를 CJS로 되돌릴 이유가 없다.

## 2026-08-03 — 스파이크의 dotenv 로딩 경로를 `.env.local`로 수정

- **결정**: `import "dotenv/config"`를 `config({ path: ".env.local" })`로 바꿨다.
- **이유**: `dotenv/config`는 `.env`만 읽는다. HANDOFF는 자격증명을 `.env.local`에 넣게 하므로, 원본대로면 자격증명이 있어도 "환경변수 APPLE_ID 없음"으로 죽는다. CalDAV 실패로 오인될 수 있는 지점이었다.
- **버린 대안**: `.env` 파일을 따로 만들기 — 비밀값 파일이 두 개가 된다.

## 2026-08-03 — package.json 스크립트를 typecheck만 등록

- **결정**: README에 적힌 `dev` / `lint` / `test`는 아직 넣지 않고 `typecheck`만 등록했다.
- **이유**: Next.js가 아직 설치되지 않았다(Phase 1 범위). 지금 넣으면 실행되지 않는 스크립트가 된다.
- **버린 대안**: 네 개 전부 미리 등록 — 실패하는 명령을 문서화하는 셈이 된다.
