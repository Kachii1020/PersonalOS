# Phase 8 — 음성으로 업무를 이어받는 JARVIS

Status: approved for implementation. Phase 7 remains the authority for work identity, revision, proposals, approvals, execution and receipts.

## Release contract

- Foreground PWA only, on iPhone and Mac. Both push-to-talk and automatic server VAD ship behind independent default-off flags.
- OpenAI Realtime performs transcription only (`gpt-live-transcribe`). It receives no tools and cannot answer or execute. Existing deterministic/Anthropic Phase 7 work-chat remains the decision path.
- Spoken output uses the server-derived, bounded truth from Phase 7 through `gpt-4o-mini-tts-2025-12-15` (`cedar`, 24 kHz PCM). It never asks another model to summarize or embellish a result.
- Voice cannot approve, forget work, or perform an external action. New work and voice-derived progress/status changes require a visible confirmation. Task/calendar execution continues to require each existing **승인하고 실행** button.
- Raw audio, full transcripts and generated audio are not persisted. Only hashes, request links, status, latency and conservative budget reservations are retained for 30 days.
- Background listening, wake word, biometric voice identity, native apps, new action types, Learn/Quiz changes and full speech-to-speech reasoning are out of scope.

## User and state behavior

Session state is `idle → permission → connecting → listening → transcribing → processing → speaking → listening`; failure, budget exhaustion or backgrounding ends at `stopped` and closes microphone, peer connection and audio context.

- A user gesture starts every session. One owner has at most one active session; a second device must explicitly replace a disconnected/expired session.
- Sessions last at most 300 seconds and eight committed turns. A disconnected inactive session expires after 30 seconds.
- Push-to-talk explicitly commits on stop. Automatic mode uses foreground Web Audio RMS detection (`threshold=.03`, `silence_duration_ms=700`) and sends the same explicit commit. The current `gpt-live-transcribe` endpoint rejected server VAD during the live contract probe, so provider VAD is not claimed. Empty, silent and sub-300 ms turns are ignored.
- Only final transcription events are sent to Phase 7. Deltas are display-only. Events are correlated by provider `item_id`, not arrival order.
- A new user turn immediately stops local speech. It does not claim that a server request or approved action was cancelled. Late results remain visible and are not auto-spoken.
- Multiple work candidates always clarify. A stale revision returns 409 and reloads the exact selected work rather than selecting another work.
- The screen is authoritative. Dates and times are spoken from validated JST values; uncertain/failed/partial action states are named exactly.

## Interfaces and data

- `POST /api/jarvis/voice/sessions`: owner/origin/flag/budget validation; accepts `{mode,contextId?}` and returns a transcription-only ephemeral secret, local session ID, expiry, VAD config and limits.
- `POST /api/jarvis/voice/turns`: accepts session/provider item/request IDs plus the existing bounded messages/context/revision; calls work-chat with mutation policy `confirm`; returns `WorkChatReply` plus a voice turn, signed speech ticket and optional signed work-mutation confirmation.
- `POST /api/jarvis/voice/confirm`: consumes a two-minute signed update/status confirmation and uses the existing revisioned mutation RPC. It cannot approve actions or forget work.
- `POST /api/jarvis/voice/speech`: accepts only a server-signed turn/result text (350 characters maximum), reserves budget once and streams PCM. Arbitrary client text is rejected.
- `POST /api/jarvis/voice/result-speech`: derives speech only from the current action/receipt state after the existing approval endpoint returns.
- `DELETE /api/jarvis/voice/sessions/[id]`: ends the owner session and invalidates future turns/speech.

Migration `0027_voice_sessions.sql` adds owner-RLS `voice_sessions` and `voice_turns`. It enforces one active owner session, request replay, eight turns, expiry and monthly reservation under a transaction lock. Provider IDs and transcript/reply contents are stored only as SHA-256 hashes. Audit receipts remain in their existing tables.

Environment: `JARVIS_VOICE_ENABLED=false`, `JARVIS_VOICE_AUTO_TURN_ENABLED=false`, server-only `OPENAI_API_KEY`, `VOICE_MONTHLY_BUDGET_USD=5`, and a random server-only `VOICE_SIGNING_SECRET`. Existing Anthropic $10 accounting is unchanged. Each session conservatively reserves $0.10 and each TTS attempt $0.02; these reservations are not represented as actual provider charges. Provider-side project spend control remains the final $5 boundary.

## Acceptance

- Fixed audio holdout: 40/40 critical slots either exact or safely clarified; at least 38/40 exact title/date/time/duration; zero executable proposals with altered critical slots.
- Browser flows: 12 PTT and 12 automatic turns match the text baseline's context ID, revision, payload and result. Unauthorized writes, voice approvals, duplicates and false completion are zero.
- Physical devices: five PTT and five automatic turns on each iPhone and Mac; one cross-device resume; one verified task and calendar result; one injected partial failure; ten interruptions with no stale auto-speech.
- Targets: WebRTC connect p95 ≤3 s, final transcript p95 ≤2 s, reply-to-PCM p95 ≤2 s, deterministic speech start p95 ≤5 s, model-backed speech start p95 ≤15 s, interruption p95 ≤300 ms.
- If accuracy/safety fails, voice remains off. If only automatic-mode latency fails, PTT may ship while automatic mode stays off. No test, cost, migration, deployment or physical-device result is claimed without execution evidence in `PHASE8-REPORT.md`.

## Rollout and rollback

Apply 0027 and deploy with both voice flags off. Configure the OpenAI key, app $5 budget, provider $5 project limit and signing secret. Validate preview, then production test-calendar/task flows, and enable both modes only after their gates pass. Roll back with `JARVIS_VOICE_ENABLED=false`; preserve Phase 7 data and all approval/receipt evidence and never reverse old migrations.

The future full speech-to-speech phase may own conversational phrasing, but it still must call the Phase 7 server for work identity, state, approval and receipt truth and must pass the same zero-unsafe-action gate before promotion.
