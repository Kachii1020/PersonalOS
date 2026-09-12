# Phase 8 implementation evidence

Status: **implementation, disabled production preparation and provider hard cap complete**. The fixed audio accuracy gate failed and physical-device acceptance is not complete, so Phase 8 is not declared released.

## Evidence ledger

| Check | Result | Evidence / limit |
|---|---|---|
| Specification | Ready | `docs/PHASE8-SPEC.md` |
| Local migration | Pass | Clean isolated reset applied 0001–0027; final DB gate passed 1/1 |
| Unit/type/lint/build | Pass | 277 unit tests, typecheck, lint and production build; initial sandbox font DNS failure was retried with network and passed |
| DB security/budget | Pass | one active owner session, owner RLS, eight-turn cap, request replay, $5 fail-closed, speech replay and ended-session rejection |
| Voice confirmation/action flow | Pass | Browser-authenticated update stayed revision 1 until signed screen confirmation, then revision 2; approved task executed once on replay; result speech derived from executed state |
| Live transcription/TTS contract | Pass | Real OpenAI PTT and automatic client-secret creation, deterministic Phase 7 turn, and non-empty `audio/pcm` TTS response |
| Browser PTT transport | Pass with accuracy limitation | Real WebRTC delivered and correlated a final transcript. One 1.5 s looping fixture was clipped to `자`; it is transport evidence, not an accuracy pass |
| Browser automatic transport | Pass with accuracy limitation | Real WebRTC plus foreground client RMS detected silence and committed a final transcript; not a 40-audio accuracy result |
| Mobile visual QA | Pass | Authenticated 390×844 screenshot showed no horizontal overflow and kept text input/approval UI available |
| Phase 7 workflow regression | Pass | Fixed v2 corpus 30/30, zero model calls, unauthorized writes, duplicates, false completion and external calendar writes all zero |
| Frozen-text synthetic voice 01 | Fail | Frozen text corpus `c4e4d243…`; 28/40 critical-token passes, 12 failures, 40 TTS + 40 Realtime sessions, 270.55 generated audio seconds |
| Frozen-text synthetic voice 02 | Fail | Same text corpus after startup padding and bounded product keyword hints; 29/40, 11 failures, 40 TTS + 40 Realtime sessions, 351.10 generated audio seconds |
| High-accuracy file comparison | Fail | Same 40 texts regenerated to audio and transcribed with `gpt-transcribe`: 31/40, 9 failures, 40 TTS + 40 file transcription calls, 349.50 generated audio seconds. It did not justify adding a second transcription path |
| iPhone/Mac | Not run | pending user-assisted run |
| Hosted migration | Pass | Dry-run listed only 0027; remote migration history then matched local through 0027. CLI catalog caching was interrupted after apply, so equality was verified separately |
| Vercel preparation | Pass, disabled | OpenAI key and signing secret stored as sensitive in Production/Preview; app voice budget set to 5; Production voice flags explicitly false |
| Branch preview | Ready | `dpl_AMZwHAuPU3uNdBqXY6r9L4744YaL`; PTT and automatic flags enabled only for `codex/phase8-voice-jarvis`. Vercel deployment protection prevents an unauthenticated iPhone URL test |
| Production feature | Off | Code is not merged or promoted and both voice modes remain unavailable |

Operational seven-day attention observation remains separate from this phase and automatic deadline/stale-work attention remains off.

## Deviations and evidence boundaries

- The first client-secret implementation used the obsolete planned endpoint and received 404. The official current `/v1/realtime/client_secrets` contract then succeeded.
- The current `gpt-live-transcribe` endpoint returned `invalid_value: Turn detection is not supported for this transcription model`. Automatic mode therefore uses Web Audio RMS and an explicit buffer commit; server VAD is not claimed.
- Live provider requests were executed, including two fixed 40-case TTS→Realtime runs. The visible project spend moved from `$1.01` before the runs to `$1.29` after them; this `$0.28` difference is observational and may include reporting delay, so it is not assigned as exact per-call billing. Local reservation rows created by app gates were removed with their test sessions.
- The OpenAI key is stored in the ignored Phase 8 local env and as a sensitive Vercel Production/Preview variable. After switching to the original Platform login, the visible `Default project` ID matched the key target (`proj_rgSnMAWCWenjcNLHAiohswWq`). The user saved a project spend limit and the page was re-read after all three evaluations showing `$1.30 / $5.00`, hard-limit behavior and a 100% ($5) alert. The page warns enforcement is not instantaneous, so a small overrun remains possible.
- The second Realtime failures were K03/K04/K09/K16, M03/M05/M07/M10 and N03/N07/N10. They include Korean initial-word substitutions, mixed proper nouns and numeric homophones. The file-model failures were K03/K07/K14/K17/M01/M03/M06/M07/M08. No case is relabeled through post-hoc corpus changes.
- These evaluations froze text and scoring before execution, but regenerated TTS audio on every run. They are reproducible synthetic baselines, **not** the spec's fixed recorded-audio holdout or evidence of human microphone accuracy. The required 38/40 fixed-audio gate remains unmet.
- 24 complete browser conversations, latency percentiles, ten interruption samples and real iPhone/Mac microphone routing remain not run. These are release gates, not inferred from the focused transport checks.
