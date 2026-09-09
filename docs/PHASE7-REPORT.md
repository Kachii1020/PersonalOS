# Phase 7 implementation evidence

Status: **Phase 7 functional acceptance passed locally** for work continuity, individual approvals and direct reminders. PR/main/production alignment is still pending in this report revision. The separate seven-day automatic-attention gate has not passed and no 99% timing claim is made.
Branch: `codex/phase7-full-acceptance`.
PR: https://github.com/Kachii1020/PersonalOS/pull/32; PR #30 remains the limited-release baseline.
Local gates used the dedicated `personalos-dialogue-eval` database (API 54721, DB 54722). The separately identified production rollout below used the hosted project and current user only; no local fixture was pointed at production.

## Implemented scope

- Confirmed work preview, owner/RLS storage, revision conflict and request replay, resume/select, explicit progress/status, forget and 30-day terminal pruning.
- Work-specific explicit/deadline/resume attention, automatic quiet hours and daily cap, snooze/disable, delivery acceptance/received/opened/ack distinction.
- Individual approval cards and verified action references using the existing task/CalDAV executor. Work selection does not authorize arbitrary calendar selection. Partial results do not mark the whole work complete.
- Default-off feature flags; Supabase Cron/pg_net/Vault wiring, separate dispatch/start/finish records. `attention_items.first_claimed_at` records actual queue entry into processing separately from scheduler wake-up.
- No Learn/Quiz feature changes, no modifications to migrations 0001–0021.

## Executed evidence (2026-09-08 JST)

| Check | Actual result | Limits |
|---|---|---|
| TypeScript and ESLint | Passed | Local static checks |
| Unit suite | 259 passed, 0 failed | Includes limited-release direct-vs-automatic boundary |
| Clean isolated migration reset through 0024 | Exit 0 | Not a hosted migration; generated types read from actual DB |
| Production-mode build | Exit 0 | Local build, not deployment; initial sandbox-only font fetch failed and network-enabled retry succeeded |
| G7 DB gate | 12 passed, 0 failed, 1 explicit skipped acceptance placeholder | Synthetic records and mock CalDAV |
| Restore holdout | 60/60 projections, 30 independent contexts, two authenticated sessions | Not physical devices or 60 browser conversations |
| Workflow holdout | 30/30 DB workflow projections | Not 30 end-to-end model conversations |
| Bound-event privacy/projection checks | 11 passed | No network; actual work-bound calendar UPDATE E2E not covered |
| G5A/G5B/G6A/G6B local regression | 42 passed, 0 failed, 3 explicit external/manual skips | Sequential; real external integrations not exercised |
| Real model/browser vertical flow | 1 passed; 3 real calls, $0.0444 | Two Chrome sessions at 375/1440, not physical iPhone/Mac; approved task created exactly once, calendar remained unapproved/unexecuted |
| Fixed 100-sentence model regression | 100/100 passed, 0 unsafe proposals, 100 calls, $0.8741 recorded | Development corpus, not new holdout or general dialogue accuracy; no external writes |
| Real local cron → worker | 1 passed; 2026-09-08 07:05:00 UTC slot started after 1,029 ms | Actual automatic dispatch, not manual invocation; short sample, no 7-day claim |
| Real cron → due attention → app-ready | 1 passed; 07:07:00 UTC slot started after 130 ms; due item claimed after 28,152 ms | One actual local due item became `ready`; zero device Push subscriptions; cron and fixture removed after test |
| Automatic promotion failure policy | 1 passed | Synthetic timestamps in a rolled-back transaction: healthy wake-ups with missed claims blocked; timely claims allowed; recent wake-up failures blocked |
| Limited-release boundary | Local DB gate 13 passed, 0 failed, 1 full-acceptance skip | Deadline/direct reminder stored; automatic condition rejected with 409 while release config is false |
| Limited-release browser rerun | 1 passed; 3 calls, $0.0443 | UI automatic controls disabled; API rejection creates 0 work rows; two Chrome sessions; exactly one approved task |

Holdout SHA-256: `da2f013cdf196030de27bc7cab2ffe2d1731fe783b508fee5f2066728b012982`. The verifier froze it before evaluation; two pre-evaluation scenarios were corrected to remove out-of-scope dependency behavior from the older exploratory plan. It was not tuned to failing implementation outputs.

Failures investigated: SQLSTATE 40001 caused PostgREST serialization retries on domain revision conflicts; changed new migration RPCs to PT409 and actual concurrent CAS now passes. A workflow fixture initially omitted the new context feature flag and was correctly blocked; fixture setup now enables/restores it. Initial multi-file regression execution collided on test-account login; the new local runner serializes fixture files. G5A/B's exact local URL guard was expanded only to the second dedicated loopback port, 54721.

Raw local logs: `test-results/g7-reset-final.log`, `g7-unit-final.log`, `g7-build-final.log`, `g7-regression-final.log`, `g7-gates-final.log`, `g7-scheduler.log`, `g7-scheduler-attention.log`. Logs are ignored artifacts, not production evidence. Final sequential G7 DB/source/SLO-policy run: 24 passed, 0 failed, 1 explicitly skipped acceptance placeholder.

Browser evidence: `test-results/g7-browser/G7-browser-f65ddc47-a119-44a6-a221-e14b4ad1e671/evidence.json` and screenshots. Task `f91db3a5-7a90-45bf-961a-90bd852c5d82` was created through approval `2b2507d5-130b-4883-bedf-b8d08bdb3494`, then the test's own records were cleaned up. The calendar remaining proposed is **not** a calendar failure or partial-failure injection. Earlier runs remain separate: a framework route-announcer assertion error, and a real-model deadline/reminder misclassification safely clarified ($0.0141). The prompt now explicitly separates notification times from deadlines; the fixed scenario/expected values were not changed.

Limited-release rerun evidence: `test-results/g7-browser/G7-browser-3d35c013-d5b5-4523-9601-299e6a049933/evidence.json`; 3 actual Sonnet calls, $0.0443, no page errors. The harness checks the ledger before each model request and stops before another request once 12 calls or $0.50 recorded cost has been reached; a final call may cross the cost threshold because provider cost is known only after response. The central monthly guard remains authoritative. A preceding UI-harness attempt failed before any model call because it waited for preview-only copy before creating a preview; the order was corrected without changing product expectations.

Pre-production scenario status was four passed and two pending; the production section below records the two actual integrations and closes the limited-release acceptance set.

## Limited production rollout — 2026-09-09 JST

- Production dry-run listed exactly 0022–0024. The hosted push completed, and the subsequent migration list showed local/remote equality through 0024. Before activation: automatic config `false`, scheduler disabled, work contexts 0, anon work-context read denied with 401.
- Code commit `c920415` was first deployed with all four new flags false as `dpl_68hvyvEoq7uqiR12VheAGEo6x4nb` and promoted after READY/guard smoke. Context, inline approval and attention were then set true; automatic attention remained false. PR #30 merged as `641eff936b995e5dc59f5870e513e5d8cda1b397`; final main deployment `dpl_4duWYc7tT6KVPSHLCxEAftHDSggU` reached READY and owns the canonical alias.
- `personalos-work-tick` is the only new cron job. The first three probes returned 401 because a local test secret had overridden the intended production value during Vault setup. The job was immediately disabled. A new random secret was generated, sent without plaintext output to Vercel and GitHub Actions, stored in Vault, and all temporary plaintext files were deleted. After redeploy/re-enable, the 15:37 UTC slot returned HTTP 200, worker start `15:37:02.151187`, finish `15:37:05.110237`; the next stored work-tick result was `idle/ok`. Existing GitHub workflow contents were unchanged.
- Actual app-calendar scenario `G7-LIMITED-0459f1b6-25b4-4315-bcb3-37b17e68f09a`: CREATE then same-work UPDATE both reached verified receipts. Event `49660fc6-fc35-4fd1-955c-a531bdcadbfd` remained one row with the same UID and moved from 03:00–03:15 to 04:00–04:15 JST. Two model calls cost $0.0322. The exact remote test event and mirror row were deleted; work `f561bfda-4023-4256-8c95-eede7761b820` was forgotten/scrubbed; two linked actions, approvals and receipts were preserved.
- Actual direct reminder due `2026-09-09 00:50 JST` was claimed after 2,374 ms and provider state became `accepted`. The user explicitly confirmed iPhone receipt, opening and the correct work destination. Service-worker `received_at/opened_at` callbacks remained null, so automated device telemetry is **not** claimed. Test work `d28e726b-291d-4fc5-bb8e-480da6b146fc` was forgotten/scrubbed and its delivery evidence retained.
- New model use for this limited-release increment: 5 calls / $0.0765 recorded (3 local browser + 2 production calendar), below the 12-call/$0.50 stop rule. The fixed 100-sentence evaluation was not rerun because the shared prompt/grounding path was unchanged.
- Final main smoke: authenticated `/jarvis` returned 200 with the work workspace; an automatic-condition API write returned 409 and changed active work count 0→0. Scheduler remained enabled with exactly one `personalos-work-tick`, automatic DB config remained false, and the latest recorded tick was `idle/ok`.

| Limited-release acceptance | Evidence | Result |
|---|---|---|
| Save and resume | Two authenticated local browser sessions, identical context/revision | Pass |
| Concurrent correction | Actual isolated DB CAS; one winner and one conflict | Pass |
| Individual approval/replay | One approved task, unapproved calendar untouched, replay no duplicate | Pass |
| Partial failure | Isolated DB with mock CalDAV; first verified result preserved | Pass within specified isolated scope |
| Real calendar CREATE→UPDATE | Hosted approval/executor/CalDAV/re-read, one UID and one final event; cleanup succeeded | Pass |
| Real direct reminder | Hosted cron/worker/provider plus explicit locked-iPhone receipt/open/correct-work confirmation | Pass; automatic client callbacks unobserved |

Regression evidence: `test-results/dialogue-eval-phase7-regression-01/summary.json`; fixed corpus SHA-256 `c08e659b0325776b7171ecd333b497be5d14396d5ecfd8b9a16d17d9b8b8aa8a`, p50 2,563 ms / p95 4,507 ms. Evaluation ran against the uncommitted Phase 7 worktree, so its metadata git SHA is the baseline, not a claim that this code was committed at evaluation time.

Review correction: wake-up timing alone cannot promote automatic notifications. The final SQL uses a **rolling** seven-day window and additionally requires all registered due attention items' actual first-claim ratio ≥99%, with at least 100 samples across seven JST dates. The minimum sample floor is a conservative engineering guard, not a measured result; cancelled/unclaimed due samples remain failures rather than being silently excluded. Actual device display remains separate. Final SQL health body was forward-applied successfully to the isolated DB after the clean reset; this is not a new production migration.

## Separate operational follow-up (not a functional or voice blocker)

- Real 7-day schedule observation including missed slots, actual attention queue delays, failures and denominator; **no 99% timing claim**. Short successful probes cannot replace it.
- Automatic deadline/stale-work notification promotion still requires the real seven-day gate. The limited direct-reminder cron is live, but replacement of any older time-sensitive GitHub scheduling path is not claimed or performed.

## Full-acceptance follow-up — 2026-09-09 JST

- Callback diagnosis: the first Phase 7 Push was accepted and manually opened, but production request logs contained zero `/api/jarvis/work-deliveries/*` calls. The callback code had only just shipped, so the observed behavior is consistent with the device running the older installed service worker; it is not evidence of an authenticated callback failure. The follow-up forces no-cache worker update on app load/foreground, verifies a version/capability handshake, and shows readiness in Push settings. Old deliveries are not reconstructed and readiness is not called receipt.
- The original numeric-template 30-case run was rejected as insufficiently independent despite a combined 30/30 after environment corrections. The meaningfully varied frozen v2 corpus hash is `cfd0ee707d8b4d81f9587dbde6a1f199c8da25c6fd1db6cc27477d455d581b50`: 10 preview/save/restore, 10 explicit updates, 5 approved task/replay and 5 task-success/calendar-rejected flows. Its accepted run completed 30 with **22 passed / 8 failed (73.3%)**, below the 90% gate. Reached checks observed unauthorized writes, duplicate effects, false work completion and external writes all 0; the eight early failures did not all reach post-state safety checks, so universal safety-zero is not claimed. The update fixtures also seeded their target values, so a value transition was not proven; the future harness is corrected but not rerun. A final targeted attempt timed out after 5 model calls and was not used as acceptance. All exploratory/interrupted/v2 attempts in this follow-up totaled 82 calls / $1.1497, 52 calls and $0.6997 above the estimate. No further model retry is claimed. Detailed summary: `docs/evidence/workflow-eval-20260909.json`.
- With the seven-day gate separated from functional completion, the fixed v2 corpus was rerun through a strict quoted system grammar with real browser authentication, isolated DB writes, individual approvals and replay checks. The final full run passed **29/30** with zero model calls; C04 alone hit a local DB statement timeout and then passed **1/1** unchanged on the bounded rerun. All 30 distinct cases therefore reached their required post-state, with unauthorized writes, duplicate effects, false whole-work completion and external calendar writes all **0**. Update cases now begin with different values and prove revision/value transitions. This is deterministic system behavior, not 30 human or model conversations. Historical model usage remains 82 calls / $1.1497. Detailed summary: `docs/evidence/workflow-eval-20260909.json`.
- Product boundary decision: actual seven-day timing and automatic `received/opened` telemetry remain operational evidence streams, not functional completion or voice-phase blockers. Automatic deadline/stale-work notifications remain off. The user confirmed actual iPhone notification-center receipt and chose not to require opening the notification for Phase 7 completion.
- Migration 0025 introduces a default-off, service-only silent hourly attention canary. It pre-registers future samples, uses the same attention claim/finish queue, is hidden by owner RLS, takes no daily quota and cannot reserve Push. Health keeps missing/unclaimed samples in the denominator and still requires seven actual elapsed days plus 168 hourly samples. Isolated clean reset passed; actual DB configuration registered 192 future rows, owner visibility 0, manual claims 0, Push reservations 0, observed samples 0 and automatic promotion false. This is configuration evidence, not elapsed observation.
- Production canary observation started `2026-09-09 01:20:38 UTC`. At the first follow-up, expected/registered/claimed/completed were 3/3/3/3, timely ratio 1, missing/unclaimed 0/0 and measurement Push deliveries 0. This is only the first three hours; seven-day status and automatic promotion remained false. A six-hour thread heartbeat reports only failure, required action or final completion.
- Physical cross-device resumption: the user created work `17678124-f7be-45c7-a8c0-cd7561afa3dc` on iPhone with revision 1, progress `iPhone 입력까지 했다`, next step `Mac에서 이어하기`. A visible Mac Chrome session opened the exact `/jarvis?work=...` URL and verified all four values. The first attempt was mistakenly entered into JARVIS Inbox and correctly remained a reference memo rather than a work context; active work count stayed 0 until the user used `/jarvis` and pressed the explicit save button.
- Callback root cause was then observed directly: with the new worker readiness handshake displayed, the 14:03 JST reminder was claimed after 1,867 ms and provider-accepted, and the worker sent `/api/jarvis/work-deliveries/61522052-6b8e-4f2f-a219-853884c3c94b`; production returned 401 because background Service Worker fetch had no owner session. Migration 0026 replaces session dependence with a fresh per-attempt 256-bit bearer capability, stores only its SHA-256 hash with seven-day expiry, and permits only idempotent received/opened timestamps for that delivery. Bad/expired/cross-delivery tokens are indistinguishable generic failures; old tokenless deliveries stay null. Local 0026 reset and transaction gate passed after one Docker-timeout retry and one missing-owner fixture correction. Actual post-deployment iPhone callback remains required.
- Final functional-gate code: typecheck, lint, production build and **272 unit tests** passed; the isolated token rotation/expiry/privilege gate passed. The strict 30-case system workflow reached 30 distinct passing outcomes with zero new model calls. The legacy G1–G4 integration command was also attempted, but its external-credential/server fixtures were intentionally unavailable in this isolated runner; those cancellations are not reported as passes. `opened` also records `received`, but client-reported open is still not independent proof of OS display.

## Rollout / rollback

Production limited-release state: `JARVIS_CONTEXT_ENABLED`, `JARVIS_INLINE_APPROVALS_ENABLED`, and `JARVIS_ATTENTION_ENABLED` are on; `JARVIS_AUTOMATIC_ATTENTION_ENABLED` and DB config `phase7_automatic_attention_enabled` remain false. Automatic notification promotion still requires the seven-day criterion plus actual attention delay audit, not only successful HTTP dispatch.

Rollback: disable context/inline/attention flags and call `configure_work_scheduler(false,'','')` with service authority. Preserve work data and all existing task/event/approval/receipt audit records; do not drop old tables or replay migrations backwards. Existing Phase 6 remains accessible. A push already attempted cannot be recalled by disabling a flag.

Local reproducibility: prepare an ignored `.env.eval.local` for the dedicated 54721 synthetic owner, then use `node scripts/run-g7-local.mjs build`, `dev`, or `test <gate files>`. The runner rejects external execution credentials and serializes fixture gates. Live model evaluation is an explicit separate `eval <unique-label>` invocation with the existing budget guard.

Session cleanup complete: owned local fixtures were cleaned, the test server stopped, the original synthetic `.env.local` restored, temporary `.env.eval.local` removed, and the isolated stack stopped with its volume retained. Production test content was scrubbed/deleted as described while immutable approval/receipt/delivery evidence was retained. Temporary plaintext secret files were deleted and are not recoverable; the active values remain only in Vercel, GitHub Actions and Supabase Vault.
