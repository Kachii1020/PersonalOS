Phase 0 — caldav-spike 진행 중

## 준비 완료

- 스펙·하네스 배치 완료 (`SPEC.md`, `CLAUDE.md`, `docs/AGENTS.md`)
- 서브에이전트 9개 분할 완료 (`.claude/agents/`)
- `scripts/spike-caldav.ts` 타입 검증 완료 — tsdav 2.3.1 시그니처 일치, `npm run typecheck` 통과

## 남은 것: 사람이 해야 하는 사전 준비

스파이크 실행 전에 아래 둘이 필요하다. 지금은 `APPLE_ID`가 비어 있어 1단계 전에 멈춘다.

1. Apple ID 앱 전용 암호 발급 → `.env.local`의 `APPLE_ID`, `APPLE_APP_PASSWORD` 입력
2. 아이폰 캘린더 앱에서 iCloud 계정 아래에 `Personal OS` 캘린더 생성

그 다음:

```bash
npx tsx scripts/spike-caldav.ts
```

판정을 `docs/DECISIONS.md`에 기록하고 Phase 1로 넘어간다.
