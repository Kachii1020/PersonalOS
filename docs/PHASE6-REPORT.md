# Phase 6 implementation evidence

## 2026-09-07 measured dialogue follow-up (not yet deployed)

The user requested implementation directly, so the existing spec/report were extended without a new plan document. A separate verifier authored and froze 100 unique synthetic scenarios before baseline: 15 plain reads, 15 filters, 15 task creates, 15 calendar creates, 10 updates, 15 multi-turn and 15 safety cases. Corpus SHA-256 `c08e659b0325776b7171ecd333b497be5d14396d5ecfd8b9a16d17d9b8b8aa8a` stayed unchanged throughout.

| Actual live run | Exact grounded-output matches | Recorded cost | p50 / p95 pipeline latency |
|---|---:|---:|---:|
| Baseline | 73/100 | $0.7987 | 2313 / 3558 ms |
| First improvement | 99/100 | $0.8757 | 2249 / 3648 ms |
| Final improvement | 100/100 | $0.8755 | 2314 / 3530 ms |

Every actual response in all three runs reported model `claude-sonnet-5` through the existing central AI client.

All three runs completed 100 actual responses and 100 local usage records: **300 live model calls, $2.5499 recorded**. This measures the model plus deterministic grounding on a reused development corpus, not independent holdout accuracy, general conversation competence, or executed external actions. Two calls ran concurrently, retries were disabled and each run had a $2 recorded-response-cost stop threshold (in-flight calls can finish). Only corpus strings were sent to the model; no production snapshots or raw profile/event data were used. The runner has no external-action import/call. Baseline's single oracle-inconsistent write proposal was an extra generic word in a title, not an unauthorized external execution. Raw synthetic outcomes remain in ignored test-results; all three summaries and implementation hashes are retained in `docs/evidence/dialogue-eval-20260907.json`.

Changes: broader normal read phrasing; deterministic explicit filters applied in SQL/structured career data before limiting to 20; correct dropped-task labeling; literal title matching via escaped PostgREST `imatch` ([LIKE/ILIKE aliases `*` to `%`](https://docs.postgrest.org/en/v14/references/api/tables_views.html#operators)); full user corrections; cancellation clears UI selection and blocks stale context; unknown calendar modifiers fail closed. Independent review supplied additional non-corpus cases for cancellation/old-title carryover, star matching and ignored filters. User/assistant/source authorization boundaries and immutable approval/execution guards remain unchanged.

Executed verification: TypeScript, ESLint, build and **244 unit tests** passed. Actual isolated SQL filtering gate passed: 25 matches/20 displayed, highest priority item outside the initial 20 selected correctly, JST boundaries, literal `*`/`%`/`_`, dropped status, other owner zero rows and no read-generated draft. Existing G6A DB 9 and G6B DB 12 passed (each retains its explicit separate-gate placeholder). Actual browser selection-cancellation test passed with mocked chat responses; actual G6A browser model→proposal→pending→approval→one task regression also passed using three additional synthetic AI requests, separate from the 300-case comparison. Full G1–G4 external integrations and a new actual iCloud write were not rerun in this follow-up; prior production evidence is separate.

Independent final review: related pure tests 39/39, additional former-defect probes 4/4, frozen corpus/code hashes matched the final run. Supplementary post-run inspection of 9 time-only UPDATE cases confirmed title remained null and the correct existing event ID was retained. This supplements the specified oracle fields; it does not silently change/re-score the fixed 100-case corpus. No additional blocker was found within that bounded review.

Local harness: macOS `rapportd` occupied old API port 54621 and returned non-HTTP data, while Kong was healthy internally. It was not stopped. A separate `personalos-dialogue-eval` stack uses 54721/54722 with synthetic seed and all migrations; no new application migration was added. Existing G6 local gates accept only the two explicit dedicated loopback ports. Initial storage-disabled startup failed because historical migration 0004 requires storage tables; restoring that harness dependency succeeded. A build without network permission failed to fetch the existing Google font; the same build passed with font access.

Reproduce after preparing the guarded local-only `.env.eval.local`: `DIALOGUE_EVAL_ALLOW_LIVE=1 node --env-file=.env.eval.local --conditions=react-server --import tsx scripts/eval-dialogue.ts <new-run-label>`. Results never overwrite an earlier label. Read/filter tests use the same environment and node test runner. Never point this evaluator or fixture gates at production.

Cron audit: initial 15 observed scheduled runs succeeded, with 100.65 / 131.88 / 299.70 minutes between runs (min / median / max). During this work, [actual scheduled run 34128546484](https://github.com/Kachii1020/PersonalOS/actions/runs/34128546484) started at **2026-09-07 13:38:43 UTC** on deployed main `b9d139c` and all five jobs returned HTTP 200. Updated sample: **16/16 successful scheduled runs**, 15 inter-run intervals **100.65 / 131.88 / 367.85 minutes**, not five minutes. Workflow is active and no observed run is queued. Exact provider-side cause is unproven. GitHub documents possible delay/drop under load ([official troubleshooting](https://docs.github.com/en/actions/how-tos/troubleshoot-workflows)); this does not prove the cause of this repository's gap. No cadence/scheduler/provider/production change was made merely to hide the problem. A reliable five-minute delivery requirement needs a separately scoped scheduler/monitoring decision.

## Earlier implementation and rollout boundary

Operational follow-up: the user subsequently authorized production rollout. Actual hosted migrations, flag-bearing READY deployment and cron activation evidence are in G6-PRODUCTION-REPORT.md. The local-increment deployment statements below describe the earlier verification boundary, not the current operational state.

2026-09-07 JST. **Conversation and approval-gated calendar execution implemented and locally verified; production rollout remains pending.** Branch `codex/phase6-conversation-actions`, draft PR #27. Latest main checked at `47d5447`; no incoming main changes or migration-number collision at final fetch.

## Implemented scope

- `/jarvis`: owner-authenticated task/calendar/career snapshots; central budgeted AI returns a typed intent with exact USER-input quotes. User-visible facts, counts, dates and execution fields are computed/validated by the server, not accepted as free-form model claims. Unknown references, source instructions, ambiguous time/target, unsupported filters and corrections fail closed with clarification.
- Task/career reads currently support plain lists; calendar reads support a specified JST date. Context is bounded. Recurrence/truncation/stale synchronization are explicitly marked incomplete, not proof of availability. This is not unrestricted general conversation or perfect understanding.
- Active-screen chat only (last six messages); no permanent raw-chat storage. Model snapshots exclude raw career profile, task notes, event descriptions/attendees and private calendar URLs. Durable drafts contain canonical payload, request hash, minimal field provenance and a 15-minute expiry.
- Explicit “승인함으로 보내기” creates one pending approval, never an executed action. Full payload is shown in conversation and approvals. Existing task approval/execution remains unchanged.
- Calendar CREATE/UPDATE behind repositories: exact configured writable CalDAV target, stable approval-derived CREATE identity, conditional UPDATE with ETag and raw snapshot hash, one durable write allowance, remote read-back and atomic mirror/audit completion. Unknown results expose read-only recovery, never a blind second PUT.
- `0019` drafts/approval guards, `0020` receipts/claims/reconciliation, `0021` sync provenance. Existing `0001`–`0018` and Learn/Quiz feature/test code are unchanged. Ordinary sync retains established app provenance; an intervening sync mirror is adopted only with a consumed receipt and exact content/version proof. App-looking UIDs alone confer no provenance. Only `%40`/`@` aliases are normalized.
- Calendar executor defaults OFF via `JARVIS_CALENDAR_ACTIONS_ENABLED`; optional draft cleanup cron is separately gated by repository variable `JARVIS_DIALOGUE_ENABLED`. Neither production flag was enabled in this increment.

## Executed evidence

All database fixtures used `personalos-phase6-verified`, local API `127.0.0.1:54621`, DB `54622`, synthetic owner `phase5a@example.test`. No Phase 6 migration was applied to the hosted database.

| Check | Actual result |
|---|---|
| TypeScript, ESLint, production build | Exit 0 on final feature code |
| Unit tests | 227 passed, 0 failed/skipped (23 grounding, 14 adapter, 11 calendar-payload tests included) |
| Clean local migration replay | 0001–0021 + seed applied from scratch, exit 0; generated DB types match apart from a trailing blank line |
| G6A local DB | 9 passed, 1 explicit separate-gate placeholder; RLS/owner boundaries, privacy, immutable drafts, concurrent pending approval, task execution/replay, reject/expiry and pruning |
| G6A real AI + browser | 1 passed; 375/1440 Chrome contexts, factual read → proposal → pending → desktop approval → exactly one task; ambiguous calendar time clarified; HTTP 401/403 and authenticated malformed-body 400 checked |
| G6A budget HTTP | Actual isolated budget-exhausted server returned 402; AI usage rows unchanged (separate earlier run) |
| G6B local DB + mock transport | 12 passed, 1 explicit separate-gate placeholder; concurrent claim/replay, lost response, expired read-only recovery, stale/null tokens, 412/hash conflict, mirror rollback, sync provenance and `%40` alias races |
| G6B actual iCloud | 1 passed after final sync fix; CREATE 1, UPDATE 1, replay adds 0 PUT; local mirror count 1; conditional DELETE 1 and exact 404 read-back; cleanup completed |
| G6B owner recovery / target-lock expiry | Expanded real-iCloud/browser gate 1 passed with injected post-PUT read loss; owner-cookie recovery HTTP 200, no extra write, remote ETag unchanged. Separate actual DB lock gate 1 passed after 3024 ms wait; expired approval consumed 0 writes and added 0 executing audits. |
| Existing G5A DB / G5B DB / G5B browser | 10 / 11 / 1 passed; G5B DB retains 1 separate-regression placeholder; public source/AI responses in G5B were synthetic |
| Existing `npm test` component gates | Run serially with a privacy boundary between G1 and G4: unit 227, G1 7, G2 10 (Chrome rerun), G3 5, G4 4 + 5 existing skips, G5A structural 10 passed. Final component results total 263 passed, 0 failed, 5 existing skips; not a claim that one uninterrupted `npm test` process passed. |

Final live dialogue run: 3 actual model calls (`claude-sonnet-5`), recorded total **$0.0213**, complete browser test **16.94 seconds**. These are three synthetic scenarios, not an accuracy benchmark or per-request latency distribution. No general “100% understanding” claim is made.

Final CalDAV evidence: marker `G6B-live-d6e15b7b-cbff-484f-a7a9-59c1fd6757e2`; CREATE approval `9dedec11-f54d-46e9-a000-a0f5f57c5a6d`, UPDATE `16a9a32d-0636-438a-b4fb-41286508ade5`, mirror `1a70132b-1009-4213-899d-b42bf6ffdcd9`. After CREATE, the normal `upsertEvents` sync path received only this test object using a `%40` href; source and stable href survived, then UPDATE verified. No full private-calendar sync was needed for G6B. AI usage stayed 3 → 3. Test duration **24.15 seconds**. This is an API/DB round trip, not physical iPhone observation.

Expanded recovery run: `G6B-live-79aa3c4c-c983-4fc7-8bf6-c501398b470d`, CREATE approval `aabec13b-6677-4889-ad29-0ab7af0f319f`, UPDATE `9ff7bcc0-7d32-4ef4-ae97-72413ee38c49`, mirror `53acc177-4c4f-4e76-a784-fcb3a44a6bae`. Actual UPDATE succeeded, then one synthetic verification-read failure left the receipt uncertain and the approval failed (no false completion). The actual local server was explicitly launched with `JARVIS_CALENDAR_ACTIONS_ENABLED=false`; the owner-cookie browser clicked “실행 결과 다시 확인”, performed read-only recovery and showed “실행 완료”. Verified audit order: requested → approved → executing → failed → executed → verified. CREATE/UPDATE/DELETE were each 1, recovery retained the remote ETag, AI rows stayed 8 → 8, exact 404 and local fixture cleanup confirmed. **17.12 seconds**. This tests a real write plus injected read-response failure, not an actual process crash. `g6b-lock-final.log` separately proves expiry while waiting on a real PostgreSQL target-row lock.

Private raw logs/recovery evidence are ignored under `test-results/`, including `g6-clean-reset-final.log`, `g6a-local-final.log`, `g6a-browser-final.log`, `g6b-local-final.log`, `g6b-live-final.log`, and the marker JSON (0600). Screenshots: `g6a-browser/375-pending.png`, `1440-chat.png`; observed no horizontal overflow and inspected rendered UI. Secrets, sessions, private calendar URLs and raw provider data are not included in the PR.

## Reproduction

Use the existing isolated-stack procedure in PHASE5A-APPLY.md with `tests/fixtures/g6-supabase.toml` (project `personalos-phase6-verified`) and all migrations through 0021. Keep synthetic `allowed_email=phase5a@example.test`, local API 54621, app 3055 and `GATE_ISOLATED_DB=1`. Never run fixture gates against a hosted DB. Existing service credentials were used only for explicitly scoped live/read-only checks, never copied into tracked files.

- `npm run test:g6a:local` and `npm run test:g6b:local`: actual local DB, synthetic interpretation/CalDAV.
- `npm run test:g6a:browser`: local app + explicitly authorized live AI; refuses pre-existing personal task/event/career context.
- `node --import tsx --conditions=react-server --test tests/gates/g6b-lock.test.ts`: same local DB and fixed local Docker container; serial only.
- Explicitly authorized disposable live event only: start the local app with `JARVIS_CALENDAR_ACTIONS_ENABLED=false`, then run `G6_ALLOW_LIVE_CALDAV=1 JARVIS_CALENDAR_ACTIONS_ENABLED=true G6_APP_CALENDAR_ACTIONS_ENABLED=false node --env-file=.env.local --conditions=react-server --import tsx --test tests/gates/g6b-live.test.ts`. Refuses occupied calendar fixtures, records recovery evidence before writes, then conditionally removes only its exact temporary remote event.
- Historical gates use the same local app and `GATE_BROWSER_CHANNEL=chrome`. Remove only the G1-imported local private-calendar mirrors before G4's AI weekly-review check; the executed wrapper checked the DB was initially empty and the mirrors were subsequently absent. Do not send personal calendar context to the model merely to run a regression.

## Failures found and resolved

- Real provider probe initially failed because the installed SDK treated per-resource DAV 404 as a collection-query error. The narrow adapter now distinguishes exact-resource absence from malformed/collection/auth failures using raw multistatus; readonly probe and both real round trips passed after the fix.
- Initial G6B DB failures exposed a SQL variable reference in failure recording; fixed and rerun. Claim-token NULL rejection, post-lock expiry checks and exact UPDATE text preservation were also verified.
- Independent review found regular sync overwrote app provenance with `icloud`, blocking later UPDATE. `0021` fixes this atomically without UID-based backfill and covers a sync-created mirror between PUT and receipt completion. Local and live tests were expanded, not weakened.
- Repeated G6A runs exposed UUID numeric segments misread as UTC offsets. Identifier-aware token boundaries now have deterministic regression fixtures. A stale test expectation for source-snapshot keys was updated to assert every new provenance field and retained the no-raw-chat assertion.
- Local DB reset briefly left the gateway pointing at an old auth container (502); restarting only the dedicated local gateway restored health. G2's first run had 9 passes/1 failure because its default bundled Chromium was absent; its existing `GATE_BROWSER_CHANNEL=chrome` option reran all 10 successfully, with no feature/test change.

## Remaining and release boundary

- No Phase 6 hosted migration, production deployment, executor enablement, draft-pruning cron activation or new physical-device/offline/push test was executed. Existing G4 manual skips remain skips, not passes.
- Cookie-scoped recovery after an injected post-write read failure and actual lock-wait expiry both passed as described above. An operating-system process kill and physical-device recovery were not performed and are not implied by those checks.
- Local G6 acceptance is verified within the stated finite scenarios; production remains a separate reviewed rollout. Apply forward migrations 0019–0021 before exposing the new routes. Keep the executor OFF until target-environment verification. Rollback: disable the executor/cleanup flag and retain drafts, receipts and audits for read-only recovery; never erase a consumed write allowance or replay an uncertain action as a new write.
- Independent verifier inspected authentication, immutable approvals, receipt boundaries and the sync fix; reported blockers were addressed, with no additional blocker in the final reviewed sync scope. This is bounded review, not a universal correctness guarantee.

## Earlier foundation increment (historical)

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
