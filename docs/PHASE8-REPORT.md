# Phase 8 implementation evidence

Status: **local implementation and focused integration verification complete**. Production migration, flags, provider spend control, 40-audio accuracy holdout and physical-device acceptance are not complete, so Phase 8 is not declared released.

## Evidence ledger

| Check | Result | Evidence / limit |
|---|---|---|
| Specification | Ready | `docs/PHASE8-SPEC.md` |
| Local migration | Pass | Clean isolated reset applied 0001–0027; final DB gate passed 1/1 |
| Unit/type/lint/build | Pass | 276 unit tests, typecheck, lint and production build; initial sandbox font DNS failure was retried with network and passed |
| DB security/budget | Pass | one active owner session, owner RLS, eight-turn cap, request replay, $5 fail-closed, speech replay and ended-session rejection |
| Voice confirmation/action flow | Pass | Browser-authenticated update stayed revision 1 until signed screen confirmation, then revision 2; approved task executed once on replay; result speech derived from executed state |
| Live transcription/TTS contract | Pass | Real OpenAI PTT and automatic client-secret creation, deterministic Phase 7 turn, and non-empty `audio/pcm` TTS response |
| Browser PTT transport | Pass with accuracy limitation | Real WebRTC delivered and correlated a final transcript. One 1.5 s looping fixture was clipped to `자`; it is transport evidence, not an accuracy pass |
| Browser automatic transport | Pass with accuracy limitation | Real WebRTC plus foreground client RMS detected silence and committed a final transcript; not a 40-audio accuracy result |
| Mobile visual QA | Pass | Authenticated 390×844 screenshot showed no horizontal overflow and kept text input/approval UI available |
| Phase 7 workflow regression | Pass | Fixed v2 corpus 30/30, zero model calls, unauthorized writes, duplicates, false completion and external calendar writes all zero |
| iPhone/Mac | Not run | pending user-assisted run |
| Hosted migration | Pass | Dry-run listed only 0027; remote migration history then matched local through 0027. CLI catalog caching was interrupted after apply, so equality was verified separately |
| Vercel preparation | Pass, disabled | OpenAI key and signing secret stored as sensitive in Production/Preview; voice budget set to 5; both voice flags explicitly false |
| Production feature | Off | Code is not merged or promoted and both voice modes remain unavailable |

Operational seven-day attention observation remains separate from this phase and automatic deadline/stale-work attention remains off.

## Deviations and evidence boundaries

- The first client-secret implementation used the obsolete planned endpoint and received 404. The official current `/v1/realtime/client_secrets` contract then succeeded.
- The current `gpt-live-transcribe` endpoint returned `invalid_value: Turn detection is not supported for this transcription model`. Automatic mode therefore uses Web Audio RMS and an explicit buffer commit; server VAD is not claimed.
- Live provider requests were executed, including short transcription sessions and short TTS generations. Provider-dashboard actual cost was not read, so no dollar total is claimed. Local reservation rows created by gates were removed with their test sessions.
- The OpenAI key is stored in the ignored Phase 8 local env and as a sensitive Vercel Production/Preview variable. The login selected by the user exposed a different OpenAI organization/project from the project that issued this key; that Google account is Free trial with no payment method and offered no matching project spend setting. No new billing method or key was created there. Provider-side $5 spend control for the issuing project remains unconfirmed, so voice stays off.
- Fixed 40-audio accuracy, 24 complete browser conversations, latency percentiles, ten interruption samples and real iPhone/Mac microphone routing remain not run. These are release gates, not inferred from the focused transport checks.
