# HANDOFF — Claude Code로 옮기기

이 대화에서 확정된 내용은 전부 파일에 들어있다. Claude Code는 이 대화를 못 보므로, **파일 배치가 곧 컨텍스트 전달**이다.

---

## 1. 파일 배치

받은 파일을 이렇게 놓는다.

```
personal-os/
├── SPEC.md              ← 그대로
├── CLAUDE.md            ← 그대로 (Claude Code가 자동으로 읽음)
├── README.md            ← 그대로
├── .gitignore           ← 그대로
├── scripts/
│   └── spike-caldav.ts  ← spike-caldav.ts를 여기로
├── .claude/
│   └── agents/          ← AGENTS.md를 여기로 분할 (아래 2번)
└── docs/
    ├── AGENTS.md        ← 원본 보관용
    ├── CURRENT_PHASE.md
    ├── DECISIONS.md
    └── DEFERRED.md
```

`CLAUDE.md`는 루트에 있으면 Claude Code가 매 세션 자동으로 읽는다. 이게 하네스가 작동하는 방식이라 위치를 바꾸지 마라.

---

## 2. 부트스트랩

```bash
mkdir -p personal-os && cd personal-os
git init
npm init -y
npm i tsdav ical-generator dotenv
npm i -D typescript tsx @types/node
npx tsc --init

mkdir -p scripts docs .claude/agents

# 받은 파일 복사
# SPEC.md CLAUDE.md README.md .gitignore → 루트
# spike-caldav.ts → scripts/
# AGENTS.md → docs/

printf 'Phase 0 — caldav-spike 진행 중\n' > docs/CURRENT_PHASE.md
printf '# 결정 로그\n\n' > docs/DECISIONS.md
printf '# 미룬 것들\n\n' > docs/DEFERRED.md

cat > .env.local <<'EOF'
APPLE_ID=
APPLE_APP_PASSWORD=
APP_CALENDAR_NAME=Personal OS
EOF

git add -A && git commit -m "chore: 스펙과 하네스 배치"
```

`.env.local`은 `.gitignore`에 이미 들어있다. 첫 커밋 전에 `git status`로 안 잡히는지 확인해라.

---

## 3. 첫 프롬프트 — 에이전트 분할

Claude Code를 열고 그대로 붙여넣는다.

```
docs/AGENTS.md를 읽어라.

그 안에 ```markdown 코드블록으로 감싼 에이전트 정의가 9개 있다.
각 블록을 프론트매터의 name 값을 파일명으로 해서
.claude/agents/{name}.md 로 저장해라.

예: name: db-architect → .claude/agents/db-architect.md
블록 내용은 프론트매터를 포함해서 그대로 옮긴다. 편집하지 마라.

저장 후 파일 목록과 각 파일의 첫 5줄을 보여줘라.
다른 파일은 만들지 마라.
```

---

## 4. 두 번째 프롬프트 — 스파이크

에이전트 파일이 만들어진 걸 확인한 뒤:

```
CLAUDE.md와 SPEC.md 5.1절을 읽어라.
.claude/agents/caldav-spike.md의 정의대로 스파이크를 수행한다.

scripts/spike-caldav.ts가 이미 있다. 실행 전에
node_modules/tsdav의 타입 정의를 읽고 함수 시그니처가
실제와 일치하는지 확인해서, 다르면 스크립트를 고쳐라.

그 다음 실행하고 출력을 그대로 보여준 뒤,
판정을 docs/DECISIONS.md에 기록해라.

중요: 라이브러리 API 불일치로 인한 에러는 CalDAV 실패가 아니다.
네트워크/인증 계층 에러와 타입/함수 계층 에러를 구분해서 보고해라.

app/, lib/, components/ 에는 아무것도 만들지 마라.
```

**사전 준비**: Apple ID 앱 전용 암호를 `.env.local`에 넣고, 아이폰 캘린더 앱에서 iCloud 계정 아래에 `Personal OS` 캘린더를 만들어둔다.

---

## 5. 세 번째 프롬프트 — Phase 1 시작

스파이크 판정이 나온 뒤:

```
docs/DECISIONS.md의 CalDAV 판정을 읽어라.
docs/CURRENT_PHASE.md를 "Phase 1"로 바꿔라.

AGENTS.md의 실행 순서대로 진행한다:
db-architect → ui-shell → integration-caldav → integration-ingest
→ ai-pipeline → ui-widgets → verifier(G1)

규칙:
- 한 번에 한 에이전트만. 다음으로 넘어가기 전에
  그 에이전트의 "완료 검증" 항목을 전부 실행하고 출력을 보여줘라.
- 통과했다고 주장하지 말고 실행 결과를 증거로 붙여라.
- Phase 2, 3 기능은 만들지 마라. 필요해 보이면 docs/DEFERRED.md에 적어라.

db-architect부터 시작해라.
```

---

## 6. 세션이 끊겼을 때

Claude Code를 새로 열면 이것만 붙여넣으면 복구된다.

```
CLAUDE.md, SPEC.md, docs/CURRENT_PHASE.md, docs/DECISIONS.md,
docs/DEFERRED.md를 읽고 현재 상태를 요약해라.

그 다음 무엇을 해야 하는지 AGENTS.md의 실행 순서에 비춰
한 문장으로 말하고, 내 확인을 기다려라.
```

대화 히스토리에 의존하지 않고 파일만으로 복구되게 설계돼 있다. 그래서 `DECISIONS.md`와 `DEFERRED.md`를 성실히 쓰는 게 중요하다. 이 두 파일이 비어있으면 다음 세션의 Claude Code는 같은 결정을 처음부터 다시 내린다.

---

## 7. Codex를 섞어 쓸 때

`CLAUDE.md`를 `AGENTS.md`라는 이름으로 루트에 복사해두면 Codex가 같은 규칙을 읽는다. 다만 루트의 `AGENTS.md`(행동 규칙)와 `docs/AGENTS.md`(서브에이전트 정의)가 이름이 겹치니 헷갈리지 않게 주의.

Codex에게 넘기기 좋은 것: UI 컴포넌트 대량 생성, 마이그레이션 SQL 작성, 테스트 케이스 채우기.
Claude Code가 맡아야 하는 것: 스펙 해석, CalDAV 동기화 로직, 게이트 검증.
