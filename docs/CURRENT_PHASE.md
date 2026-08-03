Phase 1 — 진행 중

AGENTS.md 실행 순서: ~~db-architect~~ → **ui-shell** → integration-caldav → integration-ingest → ai-pipeline → ui-widgets → verifier(G1)

## 완료

### Phase 0
- 스펙·하네스 배치, 서브에이전트 9개 분할
- caldav-spike 7단계 전부 통과 → **CalDAV 직결 채택**
- Next.js 15 스캐폴드 (Next 15.5.22 / React 19.1.0 / TS 5.9.3 strict / Tailwind 4.3.3)

### db-architect
- `supabase/migrations/0001_phase1_core.sql` — Phase 1 테이블 10개
- `lib/types/database.ts` — 생성된 타입 516줄
- 완료 검증 3개 전부 통과 (증거는 아래)

로컬 스택 포트: API 54421 / DB 54422 / Studio 54423 (circle-connect와 겹치지 않게 이동)

## 다음: ui-shell

`.claude/agents/ui-shell.md` 참조. SPEC.md 6.3 토큰, 6.4의 12개 규칙.
`app/page.tsx`는 아직 create-next-app 기본 페이지다. 여기서 교체한다.

## Phase 1에서 아직 필요한 값

- ai-pipeline: `ANTHROPIC_API_KEY`, `AI_MONTHLY_BUDGET_USD=10`
- integration-ingest: `CRON_SECRET`

## 호스티드 Supabase 반영

로컬에서만 검증했다. `leitsqwmtxqsgnsvzdfc` 프로젝트에는 아직 안 올렸다.

```bash
npx supabase link --project-ref leitsqwmtxqsgnsvzdfc
npx supabase db push
```

`db push`는 마이그레이션만 올린다. 시드는 별도로 넣어야 한다 (`app_config`에 allowed_email 1행).
