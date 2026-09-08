# Phase 7 implementation evidence

Status: limited-release delta locally verified; production migration/deployment and two real integration scenarios pending. **Not a completed G7 acceptance gate.**
Branch: `codex/phase7-work-context`, baseline `70ba754f157bd4506eaf40b91439d99a31e4c6c4`.
Draft PR: https://github.com/Kachii1020/PersonalOS/pull/30 (implementation commit `1d6f614`). Vercel reported its preview check successful; no hosted Phase 7 functional flow is claimed.
Only the dedicated `personalos-dialogue-eval` database (API 54721, DB 54722) is used below. No Phase 7 production DB migration, deployment, cron cutover, or physical-device confirmation has been performed.

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

Limited-release scenario status: save/resume passed in two authenticated browser sessions; concurrent revision passed in actual local DB; individual approval/replay passed with one task; partial-failure preservation passed in DB with mock CalDAV. Real app-calendar create→same-work UPDATE and locked-iPhone direct reminder receipt/open remain pending and block the limited-release completion label.

Regression evidence: `test-results/dialogue-eval-phase7-regression-01/summary.json`; fixed corpus SHA-256 `c08e659b0325776b7171ecd333b497be5d14396d5ecfd8b9a16d17d9b8b8aa8a`, p50 2,563 ms / p95 4,507 ms. Evaluation ran against the uncommitted Phase 7 worktree, so its metadata git SHA is the baseline, not a claim that this code was committed at evaluation time.

Review correction: wake-up timing alone cannot promote automatic notifications. The final SQL uses a **rolling** seven-day window and additionally requires all registered due attention items' actual first-claim ratio ≥99%, with at least 100 samples across seven JST dates. The minimum sample floor is a conservative engineering guard, not a measured result; cancelled/unclaimed due samples remain failures rather than being silently excluded. Actual device display remains separate. Final SQL health body was forward-applied successfully to the isolated DB after the clean reset; this is not a new production migration.

## Still required

- Real 7-day schedule observation including missed slots, actual attention queue delays, failures and denominator; **no 99% timing claim**. Short successful probes cannot replace it.
- 30 independent supported model/browser workflows, physical iPhone/Mac resumption/Push, real work-bound CalDAV UPDATE, production canary and cron cutover.

## Rollout / rollback

Keep `JARVIS_CONTEXT_ENABLED`, `JARVIS_INLINE_APPROVALS_ENABLED`, `JARVIS_ATTENTION_ENABLED`, `JARVIS_AUTOMATIC_ATTENTION_ENABLED` off in production until the corresponding evidence is reviewed. Scheduler installation alone enables no job. Configure the approved worker URL with an existing named Vault secret only after deployment; never commit secret values. Automatic notification promotion requires the seven-day criterion plus actual attention delay audit, not only successful HTTP dispatch.

Rollback: disable context/inline/attention flags and call `configure_work_scheduler(false,'','')` with service authority. Preserve work data and all existing task/event/approval/receipt audit records; do not drop old tables or replay migrations backwards. Existing Phase 6 remains accessible. A push already attempted cannot be recalled by disabling a flag.

Local reproducibility: prepare an ignored `.env.eval.local` for the dedicated 54721 synthetic owner, then use `node scripts/run-g7-local.mjs build`, `dev`, or `test <gate files>`. The runner rejects external execution credentials and serializes fixture gates. Live model evaluation is an explicit separate `eval <unique-label>` invocation with the existing budget guard.

Session cleanup: temporary cron disabled and named test Vault secrets removed by the gates; owned test fixtures cleaned, local app server stopped, original synthetic `.env.local` restored and temporary AI-enabled `.env.eval.local` removed. Evidence logs and the existing exploratory experience plan were preserved. The isolated DB stack is stopped with its data retained; production settings remain unchanged.
