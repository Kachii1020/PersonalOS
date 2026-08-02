Phase 0 — caldav-spike 진행 중

## 블로커: 누락된 파일 3개

HANDOFF.md가 전제하는 파일 중 아래가 아직 없다. 받기 전에는 스파이크도 Phase 1도 시작할 수 없다.

| 파일 | 놓을 위치 | 없으면 막히는 것 |
|---|---|---|
| `SPEC.md` | 루트 | 전부. CLAUDE.md가 매 작업마다 참조한다 |
| `AGENTS.md` | `docs/` | 서브에이전트 9개 분할 (HANDOFF 3절) |
| `spike-caldav.ts` | `scripts/` | CalDAV 쓰기 판정 (HANDOFF 4절) |

## 그 외 사전 준비 (사람이 해야 함)

- Apple ID 앱 전용 암호 발급 → `.env.local`의 `APPLE_APP_PASSWORD`에 입력
- 아이폰 캘린더 앱에서 iCloud 계정 아래에 `Personal OS` 캘린더 생성
