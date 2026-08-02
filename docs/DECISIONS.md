# 결정 로그

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
