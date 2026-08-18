# G4 판정: 미완료 (로컬 스택 없음)

자동 조건 중 앱·Supabase가 필요한 2·6·8은 이 환경에서 skip.
단위 테스트로 증명 가능한 3·7은 통과.
실기기 조건 1·4·5는 수동.

| # | 조건 | 결과 | 증거 |
|---|---|---|---|
| 1 | 푸시 구독 왕복 | 수동 | `/settings` + 홈 화면 앱. VAPID 키 필요 |
| 2 | 브리핑 푸시 실패가 잡을 안 죽임 | skip | `sendPush`는 throw하지 않음. 라이브 잡은 스택 필요 |
| 3 | 410이면 구독 삭제, 잡 계속 | 통과 | `tests/push.test.ts` — gone 1 / sent 1 / 행 삭제 |
| 4 | 오프라인 폴백 + 표시 | 수동 | `sw.js` network-first, `OfflineBanner` |
| 5 | 온라인은 네트워크 우선 | 수동 | `networkFirstPage`는 fetch 성공 시에만 캐시 갱신, 응답은 네트워크 |
| 6 | 주간 리뷰 ready + ai_usage 1행 | skip | 잡·스키마는 구현됨. 실행은 스택 필요 |
| 7 | 정답률·태스크·커밋 = 수기 | 통과 | `tests/weekly-stats.test.ts` — 3/5=60, 2/3=66.7, 커밋 4 |
| 8 | 예산 소진 402, ready 없음 | skip | 402 분기는 구현됨. 실행은 스택 필요 |

```
npm run typecheck  → 0 errors
npm run lint       → 0 errors
npm run test:unit  → 10/10
npm run test:g4    → 5 pass / 3 skip / 0 fail
```
