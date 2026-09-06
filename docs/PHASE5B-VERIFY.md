# Phase 5B verification and release boundary

Use `JARVIS-SPEC.md` §12 and `PHASE5B-PLAN.md`. Acceptance evidence belongs in `G5B-REPORT.md`, not inferred from these instructions.

## Isolated local environment

Do not run fixture gates against hosted Supabase. The dedicated stack uses API 54621 / DB 54622 and the existing synthetic gate identity `phase5a@example.test`. Stop any owned G5A test stack using those ports first; do not stop unrelated project stacks.

```sh
mkdir -p test-results/g5b-stack/supabase
cp tests/fixtures/g5b-supabase.toml test-results/g5b-stack/supabase/config.toml
cp -R supabase/migrations test-results/g5b-stack/supabase/
cp tests/fixtures/g5a-seed.sql test-results/g5b-stack/supabase/seed.sql
npx supabase start --workdir test-results/g5b-stack -x realtime
node scripts/setup-g5a-env.mjs test-results/g5b-stack
npm run typecheck
npm run lint
npm run build
npm run start -- --hostname 127.0.0.1 --port 3055
```

The setup script refuses to overwrite an existing `.env.local`. In a second terminal, run gates **serially** because they temporarily replace and restore local fixtures:

```sh
npm run test:g5b:local
GATE_BROWSER_CHANNEL=chrome npm run test:g5b:browser
npm run test:g5a:local
GATE_BROWSER_CHANNEL=chrome npm test
```

The complete historical regression requires the approved CalDAV, AI, Notion and GitHub connections, plus initial news/calendar collection. Do not copy production Supabase connection values into the fixture environment. G1 creates a specifically named test event in the configured writable test calendar; record pre-run object URLs and remove only newly created G1 test objects afterward. Never claim a missing credential or skipped physical-device check passed.

`test:g5b:local` uses actual PostgreSQL/RLS/repositories/approval execution but injects synthetic public source and AI results. The browser gate uses two Chrome contexts (375/1440), not physical devices. It exercises real server actions, restores the previous profile, and removes only its own records. Screenshots in `test-results/g5b-browser/` are ignored and contain synthetic facts.

## Optional real public-source/AI probe

```sh
node --import tsx --conditions=react-server scripts/probe-career-source.ts PUBLIC_HTTPS_URL
# Paid AI, existing monthly budget guard, local usage database only:
node --import tsx --conditions=react-server scripts/probe-career-source.ts PUBLIC_HTTPS_URL --extract
```

The probe sends public text only, not career facts. HTTP 403, unreadable HTML, unsafe destinations, or AI failures remain failures. Do not bypass site access controls. Owner review and requirement completeness are still required after successful extraction.

## Release and recovery

- Migration 0018 is additive; migrations 0001–0017 and Learn/Quiz feature code remain unchanged.
- A draft PR is not a production migration or acceptance of a preview. Apply hosted 0018 only after explicit production authority and verified backup/recovery arrangements.
- `JARVIS_CAREER_ENABLED` stays unset/false until hosted career checks pass. The new workflow option allows a separate manual `monitor-career-sources` deployment check. Existing JARVIS scheduling is otherwise unchanged.
- Application preparation only creates a task after approval. Recording a submitted/interview stage does not actually send, submit, register, or create a calendar event.
- To suspend monitoring, set the career flag false. Preserve cases/evidence and forward-fix failures rather than removing tables or prior migrations. Manual captures still use the existing event worker, so freeze new career captures too during an incident.
- Retrieval paginates rather than silently dropping older records. At the explicit 10,000-row safety boundary it fails visibly instead of recommending from an incomplete set.
- Stop only this test stack with `npx supabase stop --workdir test-results/g5b-stack`; backups are retained. Restore any temporary integration settings and close test browser/server sessions.
