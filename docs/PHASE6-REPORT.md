# Phase 6 foundation evidence

2026-09-07 JST. Status: **foundation increment verified; G6A/G6B not complete**.

The user selected both conversational JARVIS and approved calendar create/update. PHASE6-SPEC.md records that scope; PHASE6-PLAN.md sequences 6A and 6B without adding email/submission/device control.

Implemented:

- Pure dialogue response contract: bounded evidence/quotes, known-source-only citations, supported action allowlist and mandatory approval. Clarification cannot include an execution proposal.
- Pure CREATE/UPDATE calendar payload contract: explicit JST/timezone-qualified valid instants, bounded positive duration, exact permitted fields, immutable update IDs/strong ETag/hash and approval-derived stable UID/filename.
- Independent review identified that accepting subsecond instants loses precision in the installed iCalendar serializer. Nonzero fractions are now rejected before approval; zero fractions normalize losslessly. Actual serializer→parser round trips verify approved instants remain distinct and unchanged. Phase 5B observation timestamps were not modified.

Executed:

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0.
- `npm run test:unit`: 189 passed, 0 failed, 0 skipped (16 new contract tests).
- `npm run test:g5a`: 10 structural tests passed.
- Separate verifier reran both new suites: 16/16 passed; previous precision blocker resolved.
- `git diff --check`: passed.

Not executed/implemented in this increment: conversational AI endpoint/UI, private-context repository filtering, durable proposal persistence, new DB migration, CalDAV write/reconciliation adapter, new executor dispatch, G6 database/browser/external-service gates, full G1–G5B integration rerun, or production deployment. Contract validation is not authorization and has no external side effect.

Phase 5B was already deployed separately; its actual hosted migration, Ready deployment and enabled career monitor evidence are in G5B-PRODUCTION-REPORT.md. The user waived repeated operational questions/device checks; no unexecuted test or learning level is claimed passed.

Next: T603 owner-scoped dialogue snapshot/AI route and privacy tests, followed by explicit pending-approval persistence/UI; then the separately verified calendar adapter/executors.
