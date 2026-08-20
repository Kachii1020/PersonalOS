# G4 판정: 미완료 (8만 남음)

실기기 1·4·5는 2026-08-19 운영자 iPhone 보고.
라이브 잡 2·6은 2026-08-20 운영자가 Actions `cron` 네 잡(sync-calendar, generate-briefing, generate-weekly-review, fetch-news) 전부 성공으로 보고.
단위 테스트 3·7은 통과.
**조건 8은 아직. G4 전체를 통과라고 하지 않는다.**

| # | 조건 | 결과 | 증거 |
|---|---|---|---|
| 1 | 푸시 구독 왕복 | 수동 통과 | 2026-08-19 운영자. 홈 화면 앱 `/settings` 구독 → 테스트 알림 |
| 2 | 브리핑 푸시 실패가 잡을 안 죽임 | 라이브 통과 | 2026-08-20 Actions `generate-briefing` 성공. `sendPush`는 throw하지 않음 |
| 3 | 410이면 구독 삭제, 잡 계속 | 통과 | `tests/push.test.ts` — gone 1 / sent 1 / 행 삭제 |
| 4 | 오프라인 폴백 + 표시 | 수동 통과 | 2026-08-19 운영자. 비행기 모드 + 배너 |
| 5 | 온라인은 네트워크 우선 | 수동 통과 | 2026-08-19 운영자. 온라인 새로고침이 캐시를 가리지 않음 |
| 6 | 주간 리뷰 ready + ai_usage 1행 | 라이브 통과 | 2026-08-20 Actions `generate-weekly-review` 성공 |
| 7 | 정답률·태스크·커밋 = 수기 | 통과 | `tests/weekly-stats.test.ts` — 3/5=60, 2/3=66.7, 커밋 4 |
| 8 | 예산 소진 402, ready 없음 | 미실행 | Vercel `AI_MONTHLY_BUDGET_USD=0` 후 주간 리뷰 1회. `docs/SHIP.md` 4절 5항 |

```
npm run typecheck  → 0 errors
npm run lint       → 0 errors
npm run test:unit  → 21/21 (wrap 스택 기준)
```

## 남은 것

조건 8만. 예산 0 → `generate-weekly-review` → HTTP 402, 새 `ready` 없음 → 예산을 `10`으로 되돌린다.
