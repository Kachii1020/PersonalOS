# 결정 로그

## 2026-08-03 — personalOS를 독립 git 저장소로 초기화

- **결정**: `~/personalOS/`에서 `git init`을 실행해 홈 디렉토리 저장소와 분리했다.
- **이유**: `~` 자체가 커밋 0개짜리 git 저장소로 잡혀 있었다(실수로 만들어진 것으로 보임). 그대로 커밋하면 홈 전체가 추적 대상이 된다.
- **버린 대안**: 홈 저장소에 그대로 커밋 — 무관한 파일 수백 개가 딸려온다.

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
