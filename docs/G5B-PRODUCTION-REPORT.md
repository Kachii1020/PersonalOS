# Phase 5B production rollout

Date: 2026-09-07 JST. Status: **operational rollout complete; extended physical-device checks waived by the user**.

The user explicitly requested production DB/deployment/career cron rollout, then waived repeated operational confirmation and selected both conversational JARVIS and approved calendar execution for the next phase. Backup, permission checks and truthful evidence were retained. No user learning level or unexecuted physical-device test is claimed as verified.

## Executed rollout

- Hosted `db push --linked --yes` actually applied **0018 only**, exit 0; no seed/role migration was applied.
- Post-migration checks: six new tables have RLS; authenticated SELECT only; anon access denied; six owner policies; three correctly separated RPC grants. The five pre-existing queue/approval/execution function hashes match the pre-deployment snapshot. Initial career profile is an object at revision 0.
- [PR #25](https://github.com/Kachii1020/PersonalOS/pull/25) merged at `2026-09-07T05:28:14Z`, merge commit `e6d4c9f22665be364e0b522d926bb01f18e7c440`.
- Vercel production deployment `dpl_CwtT7F6KxVcZPowzWgSDEBHHJxFL` / `https://personal-6hsxbmjw1-circle-connect123.vercel.app` reached Ready and owns the canonical production alias.
- Actual authenticated browser reads at 375 and 1440 widths: `/career`, `/career/profile`, `/opportunities`, `/today` all HTTP 200 with expected headings and no horizontal overflow or page errors. Six anonymous table probes were denied. No profile/opportunity/task fixture was written; sessions stayed in memory and browsers were closed. This was not a physical iPhone test.
- [Manual monitor run 34087067769](https://github.com/Kachii1020/PersonalOS/actions/runs/34087067769) succeeded; `monitor-career-sources: HTTP 200`.
- `JARVIS_CAREER_ENABLED=true` was set and read back. [Full activation run 34087162735](https://github.com/Kachii1020/PersonalOS/actions/runs/34087162735) succeeded: monitor, system events, approved actions and command brief each HTTP 200.
- Existing scheduling remains `*/5 * * * *`; GitHub may delay scheduled delivery. The first schedule-triggered run containing career monitoring has not yet been observed; manual activation success is not presented as that observation.

The user waived additional confirmation/device procedures, not approval gates on future actions. No new calendar/email/submission executor was enabled by this rollout. No hosted fixture eligibility or end-to-end career submission is claimed; complete deterministic/DB/browser and public-source AI evidence remains in G5B-REPORT.md.

## Preflight observations (before mutation)

- PR #25 is open/draft, mergeable, head `bfa1c7fb35b885ad2caa5afd2d71c3a401995f4d`. Vercel preview and preview-comment checks report success.
- Remote main remains `0c0ac2173bcf1468f909c305367f8afc6aef990d`.
- Current production alias: `https://personal-os-nine-rust.vercel.app`; deployment `dpl_DbjFyHQUjr2NWGiCrN9KsmbB8nLY`, Ready.
- Hosted Supabase project: `leitsqwmtxqsgnsvzdfc`. Actual migration list shows 0001–0017 (existing numbering omits 0008). Actual dry-run lists **only 0018_career_secretary.sql**; no seed or role changes are pending.
- Catalog query found none of the six new career tables; no pre-existing table-name collision was observed.
- Existing scheduled JARVIS runs `34076553522`, `34068232267`, `34063385548` completed successfully. This establishes recent existing-schedule execution, not execution of the new career monitor.
- Separate read-only verifier review found no additional release-blocking defect in 0018/current code. Apply schema first and keep career monitoring disabled until hosted checks finish.

## Fresh private backup

Both schema and public-data dump commands actually succeeded. Files are ignored under `test-results/production-backup-20260907/`; directory mode 0700 and file modes 0600. Backup content is not committed or printed.

| File | Bytes | SHA-256 |
|---|---:|---|
| schema-before-phase5b.sql | 76,436 | 138bcd8d3148d2d0d7b97398df45a7dd5dfbc6e29a9024ba0e22e18a1033ed42 |
| public-data-before-phase5b.sql | 6,344,761 | 0e0103fb16ef43ebb4031beb0731a8016694ee8484b278accc23c898584f31b0 |

Structure checks found 40 CREATE TABLE statements and 40 data COPY blocks with 40 terminators. **No restore drill was executed**, and this public-schema export is not claimed as a full project/auth/storage backup. Existing data is to be preserved; this additive change's normal recovery is disabling new monitoring/captures and applying a forward fix.

## Remaining / next phase

1. Observe a future scheduled career-monitor run; current evidence is explicit activation plus successful manual execution.
2. Physical-device and actual user career-input flow were not repeated, as requested. Never replace the user's real profile with test facts.
3. Phase 6 covers both conversation and approved calendar create/update, in a separate branch and staged gates. Email/submissions/payments/device control remain out of scope.

The user waived the learn-while-building teach-back checkpoint; engineering safety checks were not waived. Refer to PHASE5B-VERIFY.md for data-preserving recovery and G5B-REPORT.md for completed local evidence.
