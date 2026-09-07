# Phase 6 implementation plan

Status: conversation and calendar execution implemented locally; final regression/release pending on `codex/phase6-conversation-actions`. Started from main `e6d4c9f22665be364e0b522d926bb01f18e7c440` (Phase 5B merge). Scope: PHASE6-SPEC.md.
The branch was fast-forwarded to main `47d5447` (production-evidence PR #26) before implementation.

## Design

### Agreed delivery contract — lightweight planning update

User direction: ground conversation and execution in objective data and repeatable checks, without promising perfect understanding or error-free autonomy. Reuse this plan and the existing spec; do not create parallel planning artifacts for each increment. The following was the implementation contract; actual evidence and limitations are in PHASE6-REPORT.md.

- Facts: carry record ID, typed values, query time, upstream observation/sync time and revision. Display authoritative counts/dates/statuses from server data or deterministic calculations. An existing quote is not proof that every free-text model claim is true; classify model commentary as interpretation/suggestion, and do not use it as execution input without validation.
- Requests: resolve intent, target and time against the current owner-readable records and a captured reference clock/JST rule. Missing or ambiguous fields lead to clarification, never guessed executable values. Record which fields came from explicit user input, observed data or an approved normalization rule.
- Proposals: server-owned canonical payload and source/revision references; user-edited drafts must be revalidated. Re-read relevant state before creating approval and before execution. Stale snapshots cannot establish current availability or eligibility.
- Execution: approval, expiry, lease and target checks; stable CREATE identity; conditional UPDATE; remote read-back, mirror and audit verification. A DB transaction does not cover CalDAV. A lost response stays uncertain/reconciling until resolved, not successful or blindly retried.
- Acceptance: use synthetic scenarios with fixed clocks and expected structured fields, side-effect counts and final states. Include ambiguity, stale data, invented citations, conflicting edits, duplicate requests, lost responses and budget failures. Require zero forbidden writes, duplicate creates and false completions in the executed acceptance corpus; this is a finite test gate, not a universal guarantee. Report intent/clarification accuracy, latency and cost separately, with sample size and failures; do not invent baseline scores or use an LLM judge as the sole oracle.

Next implementation order within T603–T604:

1. Add the scenario fixtures/oracles and owner snapshot/provenance boundary (`tests/fixtures/dialogue/`, `tests/dialogue-grounding.test.ts`, `lib/repos/jarvis-dialogue.ts`). Verify privacy filtering, freshness labels and exact fact values without an AI call.
2. Add grounded answer/intent handling (`lib/jarvis/dialogue-grounding.ts`, `lib/ai/prompts/dialogue.ts`, `app/api/jarvis/chat/route.ts`) through the existing budgeted client. Evolve the foundation response contract where required; preserve prior tests and add semantic-field tests rather than treating citation validation as sufficient.
3. Add immutable proposal persistence and explicit approval handoff (`lib/repos/jarvis-dialogue.ts`, next available migration, then `/jarvis` UI). Verify altered/stale drafts and repeated clicks before wiring any calendar executor. Runtime CalDAV URLs must match the authoritative configured calendar, not merely a client-supplied or mutable mirrored href.

Each increment updates only its relevant task/evidence. Expand documentation or rerun broader tests when a change, failure or unresolved risk justifies it.

1. Pure dialogue/source-reference and timed-calendar payload contracts first. No network/DB behavior in this increment.
2. 6A: owner repository snapshot → central structured AI answer/proposal → deterministic validator → conversation UI. An explicit owner action creates a durable pending approval. Existing task execution stays unchanged.
3. Migrations: 0019 immutable dialogue drafts/pending approvals; 0020 external execution receipts/read-only reconciliation; 0021 normal-sync provenance and exact receipt-proven mirror adoption. Preserve 0001–0018. A DB transaction does not include a CalDAV write.
4. Add a narrow CalDAV adapter/repository for create-only stable UID writes, GET reconciliation and If-Match updates. Existing `createAppEvent` generates a fresh UID and is not directly suitable for replay-safe approval execution.
5. Extend executor dispatch only after simulated failure/replay/concurrency tests. Enable production separately after the gates; do not modify the existing manual calendar UI merely to add agent execution.

Independent review reproduced precision loss in installed `ical-generator`: a subsecond-only duration becomes identical DTSTART/DTEND. The calendar contract therefore accepts only lossless whole-second instants; this does not change Phase 5B source-observation timestamp precision.

## Tasks

- [x] T601 FR-601–606: pure dialogue contracts and source-reference/policy tests (6 tests).
- [x] T602 FR-605/607–610: timed calendar payload/stable-UID contracts and boundary tests (10 tests, including actual local iCalendar serialization).
- [x] T603 FR-601–606: owner snapshot repo, budgeted AI intent schema/route, deterministic user-visible facts, privacy and prompt-injection tests.
- [x] T604 FR-604/610: durable proposal-to-pending-approval repository and migration with exact payload/revision guards.
- [x] T605 FR-601/604: `/jarvis` conversation/proposal UI with loading/empty/error and explicit approval handoff.
- [x] T606 G6A: real local DB + browser flow and historical regression, independent review/report (existing manual skips remain explicit).
- [x] T607 FR-607–611: CalDAV create/reconcile/update adapter and execution receipts; fault-injection tests and executor wiring verified locally.
- [x] T608 G6B: concurrency/replay/response-loss/412, actual target-lock expiry, dedicated-calendar round trip and owner-cookie read-only recovery; independent review/report.
- [ ] T609: separate reviewed PR/release; expose deployment and unexecuted checks honestly.

Do not confuse completed contract tests with completed conversation or calendar execution. Raw chat retention, email, invitations, recurrence edits, payments, finance operations, native apps and file/device control remain out of scope.
