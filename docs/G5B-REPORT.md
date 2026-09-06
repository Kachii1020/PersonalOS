# G5B — implementation and verification evidence

Status: **Local G5B gate passed; production release pending.** 2026-09-06 JST.
**DELIVERY_COMPLETE** for the approved development/local-verification scope; this does not claim hosted rollout or physical-device acceptance.

Branch: `codex/phase5b-career-secretary`, created from main `0c0ac2173bcf1468f909c305367f8afc6aef990d`.
The later user request was “그럼 실제 자비스 구현으로 계속 phase 진행”, followed by explicit approval to proceed with “Phase 5B 개발과 격리된 로컬 DB 검증”. Implementation follows JARVIS-SPEC §12; Phase 6 is not started. No Learn/Quiz feature files or legacy `/apply` were changed.

## Implemented and locally verified

- Explicit career facts including university, source/rule review, deterministic fail/unknown handling, bounded top-three ranking and deliverable deduplication.
- Canonical public HTTPS fetch with pinned global DNS, redirect/size/time bounds, semantic snapshots and conditional checks. Redirect destinations must still match the owner's official prefix.
- Additive 0018 with six career tables, authenticated owner RPC, read-only client grants, service-only worker commits, source revision/lease guards and decision history. Opportunity/source classes, organization rationale, immutable HTTP metadata and superseding-source transitions are retained.
- Durable source/extraction events; changed or unavailable source invalidates current eligibility; extraction candidates never imply complete/reviewed evidence.
- Application cases reuse CREATE_TASK approval/idempotency. No email, registration, calendar, or application submission executor was added.
- Career/profile/opportunity/review pages. Today retains its existing three-task list and adds only a career summary/link, not another action list.

## Actually executed

| Check | Observed result |
|---|---|
| Dependency installation | `npm ci` and addition of `cheerio`, `ipaddr.js` succeeded |
| Unit suite | `npm run test:unit`: 173 passed, 0 failed, 0 skipped; includes 38 career rules/extraction/source tests |
| Complete regression | `npm test`: exit 0; 209 passed, 0 failed, 5 explicit existing G4 skips. Breakdown: unit 173, G1 7, G2 10, G3 5, G4 4, G5A structural 10 |
| G5B real local DB | `npm run test:g5b:local`: 11 passed, 0 failed, 1 explicit separate-regression placeholder. Repeated after the final clean migration reset; 25 synthetic fetches and 17 synthetic extractions, real DB/RLS/repository/approval execution |
| G5A real local DB | Final serial `npm run test:g5a:local`: 10 passed, 0 failed, 0 skipped |
| Browser flow | Final `test:g5b:browser` ran twice consecutively: 1 passed each, 0 failed. Two Chrome contexts, 375/1440, actual profile/capture/review/case/approval forms, exactly one task visible on mobile Today; service worker remained enabled |
| Monitor HTTP route | Actual localhost POST: no secret → 401; authorized → 200, queued 0 after fixture cleanup |
| TypeScript | `npm run typecheck`: exit 0 after integration; independent verifier also ran full nonincremental check |
| Lint | `npm run lint`: exit 0; later UI/test-only edits also passed scoped lint |
| Build | First attempt failed on sandbox DNS to Google Fonts. Authorized network retry `npm run build`: exit 0, new routes included. Existing workspace-root/dynamic-cookie diagnostics remained |
| Local migration | New isolated `personalos-phase5b-verified` stack started; migrations 0001–0018 executed. Native CLI full local reset exited 0 again after all final SQL fixes, followed serially by G5B, two browser runs and G5A DB verification |
| Generated types | Native CLI generated types from the actual local database. First attempt timed out; retry after stopping only the owned test storage container succeeded |
| Diff whitespace | `git diff --check`: exit 0 |

Local API was `http://127.0.0.1:54621`, DB port 54622, test identity `phase5a@example.test` to preserve the existing gate contract. This is not the hosted database. No production 0018 migration, deployment, or career cron activation occurred.

## Actual public source probes

These are collection/integration tests, not recommendations or eligibility findings. No personal career profile was transmitted.

- `2026-09-05T17:08:49.539Z`: [Finatext official news](https://finatext.com/hd/news/20260424), HTTP 200 but no readable posting text; returned unavailable, not verified.
- `2026-09-05T17:09:06.125Z`: [Finatext HERP posting](https://herp.careers/v1/finatexthd/1yvMqHK2Qs1I), HTTP 403; returned unavailable. No access-control workaround attempted.
- `2026-09-05T17:09:59.105Z`: [Sony official internship page](https://www.sony.co.jp/recruit/internship/long-internship/), HTTP 200, parsed 733 characters; SHA-256 `b4846b984df7d9f59449f4a1e925ae6be138557791b1114cd9dda7df0b14bee7`. Its current availability/eligibility was not assessed or recommended.
- `2026-09-06T02:04:53.232Z`: the same Sony public page returned HTTP 200 and the same hash. Actual central AI extraction returned one unreviewed candidate, lifecycle unknown, completeness false. Recorded usage cost increased by $0.0101. A subsequent isolated-process budget limit below that spend produced `BudgetExceededError` with unchanged usage cost; no additional AI generation was performed by that check.

## Independent review and failure history

The separate verifier identified PostgreSQL microsecond timestamps, unknown-extraction empty quotes, nullable revision guards, nullable CHECK constraints and expired leases while waiting for a lock. Implementation and tests were updated. Later findings were also fixed and verified: 404 now records a failed run with an error, and paginated reads find a company beyond the first 200 rows (202-company fixture).

- Initial DB execution was blocked by two permission reviews citing the earlier “Do not begin Phase 5B” instruction. Work paused without a bypass; the user subsequently explicitly authorized Phase 5B and isolated local DB verification.
- First authorized DB gate: 5 passed / 4 failed / 1 separate-regression skip. A single-case retry and full retry passed before the cause was isolated. Read-only clock probes then measured the DB clock 31.5–36.1ms ahead of the app, making DB `now()` appear to be future source evidence. The fix stores the collector's actual `checkedAt`, not a widened future-time allowance. 200/304 timestamp preservation was added to the real DB gate; two consecutive runs passed after this fix, followed by the expanded 11-case final gate.
- An early browser run passed; a subsequent run reached the dashboard instead of the expected detail page and timed out. A test-harness attempt to wait for RSC transport EOF then stalled and was cancelled. The harness now waits for the actual POST response and resolved form pending state, with bounded waits; finite animations are completed for screenshots. Test-only data was reset, then the final two consecutive browser flows passed. No authentication or service-worker product code was changed; physical/hosted navigation remains a rollout check.
- The verifier's final read-only review reported no additional blocking defect. Tests were written/executed independently of feature implementation.

## G5B acceptance mapping

| Gate | Evidence |
|---|---|
| 1–2 | Exact source-linked rules persist; missing/stale/unknown/incomplete/unreviewed evidence never confirms eligibility; public live AI returns candidates only |
| 3, 6, 9 | Real assessments and ranking exclude closed/ineligible/rejected/deferred records, deduplicate deliverables, cap at three, retain reasons/history |
| 4–5 | Canonical capture is unique; identical hash reuses immutable snapshot; A→B→A records distinct transition events and preserves superseding evidence |
| 7–8 | One application case and next action; CREATE_TASK waits for approval, executes once, preserves ordered audit and survives replay. Other external action executors remain unsupported, not silently performed |
| 10 | Synthetic official 404 downgrades prior eligibility, excludes ACT_NOW and records the failure |
| 11 | Complete G1–G5A regression exit 0, plus final actual G5A DB gate 10/10. The five existing G4 skips are not claimed as fresh physical-device checks |

Final clean-reset G5B example: case `e9d31ea6-5cf1-454c-b451-64e8e891e7b6` → approval `c2a14e51-8371-4950-b623-816487407104` → task `9bf59768-032e-407d-a105-fd869cdcdb46`, taskCount 1 and requested/approved/executing/executed/verified audit. These are synthetic test records and were cleaned up.

The complete regression ran `2026-09-06T02:11:43.569Z`–`02:13:59.360Z`, with news/calendar preflight HTTP 200. Exactly one newly created remote G1 test event was removed and its absence verified; pre-existing events were preserved. Private logs and screenshots remain ignored in `test-results/`.

## Release boundary

The remaining delivery action is the separate draft PR. Hosted 0018, deployment, physical-device checks and career cron activation are **not executed**. `JARVIS_CAREER_ENABLED` remains unset/false; existing main is unchanged. Follow `PHASE5B-VERIFY.md` for explicit production authority, backup, schema-first rollout and forward recovery. Phase 6 is not started.

Learning status: **LEARNING_PENDING**; safety boundaries were explained, but no user teach-back or exercise was assessed. No learning ledger was created. The migration is additive; production recovery would disable career monitoring and use a forward fix, not delete existing application/source records.

Optional maintenance checkpoint after authority is resolved:

- Prediction: If a previously reviewed source returns 404, should it still appear among the top three?
- Teach-back: Explain the boundary between a source candidate, a reviewed eligibility result, and an approved external action; identify the target environment and forward-fix path before any production change.
- Local exercise (5–15 minutes): add one synthetic unknown hard requirement to an otherwise passing fixture and verify that `node --import tsx --test tests/career-rules.test.ts` excludes it from confirmed eligibility. No production data is needed.
