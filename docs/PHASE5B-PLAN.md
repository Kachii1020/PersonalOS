# Phase 5B — Career Secretary implementation plan

Status: local implementation and G5B verification complete; draft PR / production release tracked separately. Governing spec: JARVIS-SPEC.md §12 / G5B. User explicitly authorized Phase 5B development and isolated local DB verification.

## Contract / scenarios

- US1 / FR-001: save only user-confirmed career facts, with verified/review dates; missing or stale facts remain unknown.
- US2 / FR-002: add an organization and owner-verified official URL prefixes, capture a posting, fetch a bounded public HTTPS snapshot, and prepare evidence-backed requirement candidates.
- US3 / FR-003: deterministically compare each hard requirement with facts. Any fail → not_eligible; unknown/unreviewed/incomplete evidence → at most possibly_eligible; no vacuous eligible result. Closed/stale/unverified postings never appear in ACT_NOW.
- US4 / FR-004: periodically check watched sources with ETag/Last-Modified and semantic hashes. Same URL/hash does not create another opportunity. Meaningful changes emit durable events; disappearance invalidates eligibility.
- US5 / FR-005: user starts an application case with a next action. Preparation tasks use the existing CREATE_TASK approval path and idempotency; no calendar/send/register/submit side effects are added.
- US6 / FR-006: top three eligible actions only; prior reject/defer decisions affect selection. User can review the source, candidate rules, assessment reasons, and last checked date.

## Boundaries

- New migration 0018 only; retain earlier migration files and Learn/Quiz feature code.
- Legacy /apply remains Notion read-only; no mirroring or bidirectional sync. Career application_cases are new JARVIS-managed records referencing opportunities, not copies of Notion records.
- Existing single-user RLS, repository clients, durable event/run model, AI budget guard, and approval executor are reused.
- Public job text may be sent to the central AI client for extraction; private career profile facts are compared locally on the server, not sent for extraction.
- AI output is a candidate. Exact source quotes, typed operators, freshness, and explicit source/rule review are required before a confirmed result. No autonomous legal/visa inference.
- Phase 6+ implementation waits for a completed G5B gate and a concrete specification.

## Technical plan

1. Pure career contracts, input validation, URL canonicalization, evidence/eligibility and ranking functions.
2. Public HTTPS fetcher: validate and pin DNS on every hop; reject private/loopback/link-local/reserved addresses, credentials and non-443 ports; bounded redirects, timeout and response size; no authenticated crawling. Parse main/article/JSON-LD text without running scripts; exclude navigation/footer/script/style noise.
3. 0018: career_profile, company_watchlist, opportunities, opportunity_sources, opportunity_requirements, application_cases. Explicit grants/RLS and owner-only mutations. Derived assessment/source state is worker-owned. Revision guards prevent stale worker results from overwriting newer sources.
4. Repositories + small durable career steps integrated with system_events/agent_runs. Store progress; errors in runs/job_runs and opportunity state. At most one network/AI step per worker request.
5. /career (organizations + cases), /career/profile, /opportunities, /opportunities/[id]; link from navigation and Today. Reuse native components, visible loading/empty/error states.
6. Monitor route queues bounded due refreshes; existing JARVIS worker processes them. Monitoring uses weekly/monthly/window-only cadence and deduplicated events.
7. Verify pure rules and source safety; real local migration/RLS/concurrency; capture→source→review→assessment→application→approval→single task; missing-source downgrade; full regression; browser 375/1440; evidence report and separate PR.

## Implementation decisions

- User profile is initially empty. Do not infer personal facts from prior assistant prose.
- Official trust is an explicit owner-reviewed company URL prefix, not a model claim that an arbitrary host is official.
- Source/rule review is explicit before confirmed_eligible; later unchanged checks preserve review, changed content invalidates it.
- Automatic source checks do not send applications or messages. Only supported CREATE_TASK is executed after user approval.

## Tasks

- [x] T001 US1/US3: pure contracts and eligibility/ranking + boundary tests.
- [x] T002 US2/US4: safe source fetching / canonicalization / semantic snapshot tests.
- [x] T003 US1–US5: migration, typed repos, owner mutation and worker revision guards.
- [x] T004 US2/US4: source extraction, durable steps and due-source monitor.
- [x] T005 US5: application cases + deduplicated approval preparation.
- [x] T006 US1/US2/US3/US6: profile/opportunity/company/case UI + Today selection.
- [x] T007 all: local DB gate, regression, browser verification and G5B report.
- [ ] T008 all: reviewed draft PR using observed results only.
- [ ] T009 all: separately authorized hosted migration, deployment, device checks and career monitoring activation.

The initial authorization blocker was resolved by the user's explicit Phase 5B/local DB approval. Actual results, failures/retries and unexecuted production steps are recorded in G5B-REPORT.md. Queries paginate rather than silently dropping the 201st record; the explicit 10,000-row safety boundary fails visibly. University, opportunity/source classes, watch rationale and source transition metadata implement the corresponding §12 fields.
