# Phase 6 — Conversational JARVIS and approved calendar actions

User scope authorization: 2026-09-07, “phase는 대화형이랑 실행 둘 다 잡아”. The preceding choice defined execution as approval-gated calendar creation/update. Implement both, sequentially; do not expand execution to email, submissions, payments or device control.

## 6A: conversation and proposals

- US1 / FR-601: an authenticated owner can ask about current tasks, calendar events and career opportunities in `/jarvis`. Answers distinguish observed facts, uncertain/missing information and suggestions, with links to the actual records used.
- FR-602: use bounded owner-readable repository snapshots, not direct external SDK calls. Keep raw career-profile facts, event descriptions/attendees, tokens and private documents out of automatically supplied model context. User-entered messages are sent only for the requested conversation.
- FR-603: all model calls use the existing central budget/usage client. Source text is untrusted data; it cannot authorize actions or change policy. Validate source references against the exact snapshot supplied.
- US2 / FR-604: a conversation may propose CREATE_TASK, CREATE_CALENDAR_EVENT or UPDATE_CALENDAR_EVENT. Proposal creation and execution are different actions. Show the exact target, times, content and changes before creating a pending approval. A model cannot approve or execute anything.
- FR-605: unsupported or incomplete requests ask for missing details or explain the limitation; do not invent a target calendar, timezone, date or source. Initially use JST consistently with the existing app; timed, non-recurring events at whole-second precision only. Reject unrepresentable fractional instants before approval rather than silently rounding them during ICS serialization.
- FR-606: no permanent raw-chat memory in this phase. Keep conversation context in the active browser session; persist only the minimal action request/state needed for the existing durable approval workflow. Do not treat conversation claims as verified career facts.

## 6B: calendar execution

- US3 / FR-607: only the configured writable app CalDAV calendar is eligible. ICS/read-only/other calendars are rejected at proposal and execution time. Existing Learn/Quiz and manual calendar behavior remain unchanged.
- FR-608: CREATE uses an approval-derived stable UID/resource identity, create-only preconditions and read-after-write verification. A timeout or replay cannot create a second event. A matching already-created object is reconciled instead of recreated; mismatched content fails visibly.
- US4 / FR-609: UPDATE targets an existing app-created, timed, non-recurring event with expected UID/href/ETag captured for review. Re-read before execution; use If-Match and reject conflicts. Never replace a changed event using a stale approval. No invitations, recurrence edits or deletes.
- FR-610: validate the pending approval's immutable payload, current lease, expiry and target again before external writes. Record attempted/verified/failed/uncertain states. Unknown remote outcomes must be reconciled before a retry; never label an unverified write successful.
- FR-611: retain separate approval requests per external action, existing task idempotency/audit, and visible errors in run/job/audit state. CalDAV adapters remain behind repositories.

## Acceptance gates

### G6A

1. Actual authenticated conversation answers a known fixture question using only allowed source IDs; unrelated/anonymous access is denied.
2. Unknown source citations and unsupported action types are rejected; injected source instructions cannot issue actions.
3. Missing/timezone-ambiguous requests do not create calendar approvals; raw career facts/secrets are absent from captured model context.
4. Proposal remains pending until the owner approves. Reject/expiry produces zero tasks/events.
5. Budget exhaustion and model/network failure are visible, preserve the request safely and cause no execution.
6. 375/1440 browser conversation→proposal→approval flow and G1–G5B regression are actually executed and documented.

### G6B

1. Approved CREATE produces exactly one CalDAV object and one matching mirror entry; concurrent execution and replay do not duplicate it.
2. Simulated response loss after a remote write is reconciled by stable identity/content; no blind retry PUT creates an extra object.
3. Approved UPDATE preserves identity and uses the expected ETag; 412/conflicting external edit leaves remote content intact and requires a new review.
4. ICS/read-only/non-app targets, recurrence/all-day edits, stale/null lease, expired/rejected approvals and injected URLs fail before external writes.
5. Faults between remote write, mirror update and audit completion resume safely and report uncertainty honestly.
6. Full regression, isolated CalDAV fault tests and a separately authorized real dedicated-calendar round trip pass before enabling the new executors in production.

Operational safety questions were waived by the user, not data-protection invariants or truthful verification. Phase 5B production evidence is recorded separately. No Phase 6 UI, AI path or calendar executor is claimed deployed merely because this specification exists.
