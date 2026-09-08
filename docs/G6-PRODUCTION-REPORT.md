# Phase 6 production rollout

Follow-up observation: actual schedule-triggered run [34128546484](https://github.com/Kachii1020/PersonalOS/actions/runs/34128546484), 2026-09-07 13:38:43 UTC, verified all five jobs HTTP 200. This closes the first-run observation item below, but the preceding gap was 367.85 minutes: it does not establish reliable five-minute delivery. Updated audit and the separate, not-yet-deployed dialogue improvements are in PHASE6-REPORT.md. Earlier statements below preserve rollout-time evidence.

2026-09-07 JST. User explicitly authorized the production DB, deployment and cron transition and requested numerical current/next reporting. Status: **production DB/deployment/activation complete; first new schedule-triggered run remains unobserved**. The user previously waived repetitive teach-back/physical-device checks, not backup, permissions or truthful evidence.

## Baseline observed before changes

- PR #27: head `1bfb5fb0d09e65520931986a6dfa40d1b9811965`, draft/open/mergeable; both Vercel checks successful. Latest main `47d54475364a072656e633eef487f92c7b10e5f2`, no incoming drift.
- Production alias `https://personal-os-nine-rust.vercel.app`: deployment `dpl_DDknf8SghpuXgq6jn6wezgijdMt1`, READY, matching main SHA.
- Hosted Supabase `leitsqwmtxqsgnsvzdfc`: 17 migration records through 0018 (historical numbering omits 0008). Actual dry-run lists exactly 0019, 0020, 0021, without seeds/roles. Both new tables and eight new RPCs are absent before application.
- Domain counts: tasks 2, events 83, quiz questions 129, opportunities 0, course materials 0. Existing approvals: 2 CREATE_TASK executed, no pending calendar approvals.
- Last 24-hour recorded jobs: 36 successful, 0 failed. Current UTC-month recorded AI calls 14, cost $0.5631. These are DB observations, not projected usage or a model-accuracy score.
- `JARVIS_CRON_ENABLED=true` and `JARVIS_CAREER_ENABLED=true`; no dialogue-cleanup variable or production calendar-executor variable. Workflow state active, nominal schedule every 5 minutes.
- Last observed automatic run [34095837900](https://github.com/Kachii1020/PersonalOS/actions/runs/34095837900), 07:30:52 UTC: monitor, system events, approved actions and command brief each HTTP 200. At preflight this was roughly 5.5 hours old. A configured five-minute schedule is not evidence of actual five-minute delivery.

Independent read-only release review found no additional blocker in the reviewed migrations, receipt guards and workflow/flag ordering. Local finite-scenario evidence remains in PHASE6-REPORT.md: 263 final historical component passes, 5 explicit existing skips; separate G6 local/live/recovery/lock gates passed. None of those local results is described as a hosted execution.

## Executed transition

Fresh public-schema and public-data exports completed successfully before mutation. Ignored directory `test-results/production-backup-phase6-20260907/` is 0700, both files 0600. Schema: 103,120 bytes, SHA-256 `1c4ca4c2565ef903f126a52db5ac45de75c1385108e7594908fe764d5b9f37ef`. Data: 6,348,085 bytes, SHA-256 `7d8a0dedd771f90aff7f647921b6626a2d41206746224c2cec6da0732525d528`. Structure: 46 tables, 46 COPY blocks, 46 terminators. No contents were printed or committed.

The data-only dump warned about circular career-table foreign keys; restoring requires appropriate constraint/trigger ordering. No restore drill was run. This is not claimed as a full auth/storage/project backup; normal recovery for this additive rollout is flag disablement and a forward fix, preserving execution receipts.

- Hosted `db push --linked --yes` applied **0019–0021**, exit 0. A subsequent optional CLI catalog-cache export timed out; this warning was not treated as proof of failure or success. The independent Management API catalog read then verified all three migration records, both RLS tables, two owner SELECT policies, all eight RPC grant boundaries, the provenance trigger, and unchanged hashes of five existing execution/queue functions.
- Domain counts remained tasks 2, events 83, quiz questions 129, opportunities 0, materials 0 after migration. No seed/role or fixture data was applied to production.

- PR #27 actually merged at 13:04:37 UTC, commit `d1a3690846d4fae8e66a51e31a21823d309f8474`. The first production build was started from this exact SHA with no calendar-executor variable (default OFF).

- Initial deployment `dpl_6frBPVaUGEPhkr3o3Sg53yApM2Ts` reached READY and owned the canonical alias. Actual hosted HTTP checks: 7 authenticated routes returned 200 (`/jarvis`, `/approvals`, `/calendar`, `/today`, `/career`, `/learn`, `/quiz`); both new tables allowed owner SELECT and denied anon; chat anonymous/wrong-origin/invalid-body returned 401/403/400, nonexistent proposal returned 409. No AI or domain fixture write was used for this smoke check; no physical/browser layout claim is implied by these HTTP checks.
- Production `JARVIS_CALENDAR_ACTIONS_ENABLED=true` was added, and that exact non-secret value was read back through its single-variable API. Redeployment **`dpl_5TdwMhcZgqitbxt1ZdoczEtBPt8D`** / `https://personal-35w2xst2o-circle-connect123.vercel.app` reached READY and owns the canonical alias; Vercel metadata matches merge SHA `d1a3690846d4fae8e66a51e31a21823d309f8474`. An initial 45-second wait timed out while BUILDING; completion was only recorded after the later READY observation. The same hosted 7-page / 2-table / 4-API-guard smoke suite passed again on this final deployment, without AI/domain fixture writes.
- [Manual cleanup run 34125634446](https://github.com/Kachii1020/PersonalOS/actions/runs/34125634446) completed successfully with `prune-dialogue-drafts: HTTP 200`.
- `JARVIS_DIALOGUE_ENABLED=true` was set/read back at 13:09:02 UTC after cleanup verification. Existing `JARVIS_CRON_ENABLED` and `JARVIS_CAREER_ENABLED` remained true. This adds cleanup to the existing five-minute workflow; it does not bypass owner approval.

- [Full activation run 34125889702](https://github.com/Kachii1020/PersonalOS/actions/runs/34125889702) succeeded at 13:10 UTC: cleanup, career monitor, system events, approved actions and command brief **5/5 HTTP 200**. This was `workflow_dispatch`, not a schedule-triggered run.
- Final DB snapshot: 20 migration records through 0021; tasks 2 / events 83 / quiz questions 129 / opportunities 0 / materials 0. Last-24-hour `job_runs`: **39 ok, 0 failed**. This counts stored logs, not every HTTP call (idle/cached paths may not add a row). Current UTC-month AI: **14 calls, $0.5631**, unchanged by the rollout.

No new production calendar/task fixture or private-profile replacement was performed. The enabled executor still requires an immutable owner-approved action; local actual-iCloud write/recovery evidence is in PHASE6-REPORT.md and is not relabeled as a hosted end-to-end write. Physical-device checks and an actual process-kill recovery were not repeated.

Recovery: turn off `JARVIS_CALENDAR_ACTIONS_ENABLED` and redeploy before allowing further calendar writes; turn off `JARVIS_DIALOGUE_ENABLED` to remove cleanup from the workflow. Keep receipts/audits and resolve uncertain results by read-only reconciliation. Do not reset write allowances, remove applied migrations, or overwrite user data to roll back.

## Next measurable work

1. Separate an actual schedule-triggered Phase 6 cleanup run from manual activation evidence; investigate delayed scheduling if no new automatic run is observed. Do not change the existing cadence merely to hide a delivery gap.
2. Expand conversational evaluation from the current 3 live synthetic requests to a proposed 100-case fixed corpus. Measure intent/field accuracy, appropriate clarification, forbidden-write count, latency distribution and cost; this is a future target, not a completed benchmark.
3. Improve multi-turn clarification and supported read filters only against that measured corpus. Keep explicit approval, app-calendar-only targeting and read-only uncertainty recovery. No next-phase feature implementation is included in this production rollout.
