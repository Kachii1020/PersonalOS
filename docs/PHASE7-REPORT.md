# Phase 7 implementation evidence

Status: **limited-release verification complete** for work continuity, individual approvals and direct reminders. **Not a completed Phase 7/G7 acceptance gate and no 99% timing claim.**
Branch: `codex/phase7-work-context`, baseline `70ba754f157bd4506eaf40b91439d99a31e4c6c4`.
PR: https://github.com/Kachii1020/PersonalOS/pull/30; limited-release code commit `c920415` plus this evidence update.
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
- Code commit `c920415` was first deployed with all four new flags false as `dpl_68hvyvEoq7uqiR12VheAGEo6x4nb` and promoted after READY/guard smoke. Context, inline approval and attention were then set true; automatic attention remained false. Activated deployments reached READY and the canonical alias; final secret-rotation deployment is `dpl_7UtLpMZKL5UMA7cFL9ZcHLmgL4Tt`.
- `personalos-work-tick` is the only new cron job. The first three probes returned 401 because a local test secret had overridden the intended production value during Vault setup. The job was immediately disabled. A new random secret was generated, sent without plaintext output to Vercel and GitHub Actions, stored in Vault, and all temporary plaintext files were deleted. After redeploy/re-enable, the 15:37 UTC slot returned HTTP 200, worker start `15:37:02.151187`, finish `15:37:05.110237`; the next stored work-tick result was `idle/ok`. Existing GitHub workflow contents were unchanged.
- Actual app-calendar scenario `G7-LIMITED-0459f1b6-25b4-4315-bcb3-37b17e68f09a`: CREATE then same-work UPDATE both reached verified receipts. Event `49660fc6-fc35-4fd1-955c-a531bdcadbfd` remained one row with the same UID and moved from 03:00–03:15 to 04:00–04:15 JST. Two model calls cost $0.0322. The exact remote test event and mirror row were deleted; work `f561bfda-4023-4256-8c95-eede7761b820` was forgotten/scrubbed; two linked actions, approvals and receipts were preserved.
- Actual direct reminder due `2026-09-09 00:50 JST` was claimed after 2,374 ms and provider state became `accepted`. The user explicitly confirmed iPhone receipt, opening and the correct work destination. Service-worker `received_at/opened_at` callbacks remained null, so automated device telemetry is **not** claimed. Test work `d28e726b-291d-4fc5-bb8e-480da6b146fc` was forgotten/scrubbed and its delivery evidence retained.
- New model use for this limited-release increment: 5 calls / $0.0765 recorded (3 local browser + 2 production calendar), below the 12-call/$0.50 stop rule. The fixed 100-sentence evaluation was not rerun because the shared prompt/grounding path was unchanged.

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

## Still required for full Phase 7

- Real 7-day schedule observation including missed slots, actual attention queue delays, failures and denominator; **no 99% timing claim**. Short successful probes cannot replace it.
- 30 independent supported model/browser workflows, physical iPhone/Mac resumption/Push, real work-bound CalDAV UPDATE, production canary and cron cutover.

## Rollout / rollback

Production limited-release state: `JARVIS_CONTEXT_ENABLED`, `JARVIS_INLINE_APPROVALS_ENABLED`, and `JARVIS_ATTENTION_ENABLED` are on; `JARVIS_AUTOMATIC_ATTENTION_ENABLED` and DB config `phase7_automatic_attention_enabled` remain false. Automatic notification promotion still requires the seven-day criterion plus actual attention delay audit, not only successful HTTP dispatch.

Rollback: disable context/inline/attention flags and call `configure_work_scheduler(false,'','')` with service authority. Preserve work data and all existing task/event/approval/receipt audit records; do not drop old tables or replay migrations backwards. Existing Phase 6 remains accessible. A push already attempted cannot be recalled by disabling a flag.

Local reproducibility: prepare an ignored `.env.eval.local` for the dedicated 54721 synthetic owner, then use `node scripts/run-g7-local.mjs build`, `dev`, or `test <gate files>`. The runner rejects external execution credentials and serializes fixture gates. Live model evaluation is an explicit separate `eval <unique-label>` invocation with the existing budget guard.

Local session cleanup: owned test fixtures were cleaned; original synthetic `.env.local` must be restored and the temporary AI-enabled `.env.eval.local` removed at final handoff. Production test content was scrubbed/deleted as described while immutable approval/receipt/delivery evidence was retained.
