Phase 0 — 완료. Phase 1 대기 중.

## 완료

- 스펙·하네스 배치, 서브에이전트 9개 분할
- caldav-spike 7단계 전부 통과 → **CalDAV 직결 채택** (판정 근거는 `docs/DECISIONS.md`)

## Phase 1 시작 전에 필요한 것

AGENTS.md 실행 순서: db-architect → ui-shell → integration-caldav → integration-ingest → ai-pipeline → ui-widgets → verifier(G1)

첫 에이전트인 db-architect가 `supabase db reset`을 돌려야 해서 아래가 먼저 있어야 한다.

1. **Next.js 15 프로젝트 스캐폴드** — 현재 레포에는 `app/`, `lib/`, `components/`가 없다
2. **Supabase 프로젝트** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
3. **`ALLOWED_EMAIL`** — RLS 화이트리스트 1개

Phase 1에서 추가로 필요한 값 (해당 에이전트 차례에):

- ai-pipeline: `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD=10`
- integration-ingest: `CRON_SECRET`

Phase 2·3 전용 값(`NOTION_*`, `GITHUB_*`, `FRED_API_KEY`, `ECOS_API_KEY`, `WASEDA_ICS_URL`)은 지금 필요 없다.
