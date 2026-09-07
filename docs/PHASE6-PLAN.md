# Phase 6 implementation plan

Status: foundation work started on `codex/phase6-conversation-actions`, from main `e6d4c9f22665be364e0b522d926bb01f18e7c440` (Phase 5B merge). Scope: PHASE6-SPEC.md.
The branch was fast-forwarded to main `47d5447` (production-evidence PR #26) before implementation.

## Design

1. Pure dialogue/source-reference and timed-calendar payload contracts first. No network/DB behavior in this increment.
2. 6A: owner repository snapshot → central structured AI answer/proposal → deterministic validator → conversation UI. An explicit owner action creates a durable pending approval. Existing task execution stays unchanged.
3. 6B: add a new migration (0019 or next free number after checking main) for external execution receipt/reconciliation state. Preserve prior migrations. Reuse claim/approval/audit primitives but do not pretend a DB transaction includes a CalDAV write.
4. Add a narrow CalDAV adapter/repository for create-only stable UID writes, GET reconciliation and If-Match updates. Existing `createAppEvent` generates a fresh UID and is not directly suitable for replay-safe approval execution.
5. Extend executor dispatch only after simulated failure/replay/concurrency tests. Enable production separately after the gates; do not modify the existing manual calendar UI merely to add agent execution.

Independent review reproduced precision loss in installed `ical-generator`: a subsecond-only duration becomes identical DTSTART/DTEND. The calendar contract therefore accepts only lossless whole-second instants; this does not change Phase 5B source-observation timestamp precision.

## Tasks

- [x] T601 FR-601–606: pure dialogue contracts and source-reference/policy tests (6 tests).
- [x] T602 FR-605/607–610: timed calendar payload/stable-UID contracts and boundary tests (10 tests, including actual local iCalendar serialization).
- [ ] T603 FR-601–606: owner snapshot repo, budgeted AI dialogue schema/route, privacy and prompt-injection tests.
- [ ] T604 FR-604/610: durable proposal-to-pending-approval repository and migration with exact payload/revision guards.
- [ ] T605 FR-601/604: `/jarvis` conversation/proposal UI with loading/empty/error and explicit approval handoff.
- [ ] T606 G6A: real local DB + browser flow and historical regression, independent review/report.
- [ ] T607 FR-607–611: CalDAV create/reconcile/update adapter and execution receipts; fault-injection tests before executor wiring.
- [ ] T608 G6B: concurrency/replay/response-loss/412 and dedicated-calendar round trip, independent report.
- [ ] T609: separate reviewed PR/release; expose deployment and unexecuted checks honestly.

Do not confuse completed contract tests with completed conversation or calendar execution. Raw chat retention, email, invitations, recurrence edits, payments, finance operations, native apps and file/device control remain out of scope.
