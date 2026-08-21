# G4 판정: 종료 — 7/8 통과, 조건 8은 운영자 면제

실기기 1·4·5는 2026-08-19 운영자 iPhone 보고.
라이브 잡 2·6은 2026-08-20 운영자가 Actions `cron` 네 잡(sync-calendar, generate-briefing, generate-weekly-review, fetch-news) 전부 성공으로 보고.
단위 테스트 3·7은 통과.
조건 8(예산 소진 402)은 **2026-08-20 운영자 결정으로 라이브 실행을 면제** — 실행된 적 없다는 사실은 그대로 남긴다.

| # | 조건 | 결과 | 증거 |
|---|---|---|---|
| 1 | 푸시 구독 왕복 | 수동 통과 | 2026-08-19 운영자. 홈 화면 앱 `/settings` 구독 → 테스트 알림 |
| 2 | 브리핑 푸시 실패가 잡을 안 죽임 | 라이브 통과 | 2026-08-20 Actions `generate-briefing` 성공. `sendPush`는 throw하지 않음 |
| 3 | 410이면 구독 삭제, 잡 계속 | 통과 | `tests/push.test.ts` — gone 1 / sent 1 / 행 삭제 |
| 4 | 오프라인 폴백 + 표시 | 수동 통과 | 2026-08-19 운영자. 비행기 모드 + 배너 |
| 5 | 온라인은 네트워크 우선 | 수동 통과 | 2026-08-19 운영자. 온라인 새로고침이 캐시를 가리지 않음 |
| 6 | 주간 리뷰 ready + ai_usage 1행 | 라이브 통과 | 2026-08-20 Actions `generate-weekly-review` 성공 |
| 7 | 정답률·태스크·커밋 = 수기 | 통과 | `tests/weekly-stats.test.ts` — 3/5=60, 2/3=66.7, 커밋 4 |
| 8 | 예산 소진 402, ready 없음 | **면제** | 아래 사유 |

## 조건 8 면제 사유 (2026-08-20)

- 예산 하드캡 자체는 **G1 조건 6**에서 라이브로 증명됨 (누적 $10 이상 조작 → 다음 AI 호출 차단).
- 주간 리뷰의 402 분기는 코드로 존재: `BudgetExceededError` → 402, `ready` 저장 없음 (`app/api/jobs/generate-weekly-review/route.ts`). `cron.yml`은 402를 경고로 처리.
- 남는 미검증분: Vercel 프로덕션에서의 end-to-end 402 1회. 최악 시나리오는 예산 소진 중 주간 리뷰 1건 생성 — 수 센트 수준.
- 실제 예산 소진이 처음 발생하는 달에 `job_runs`에서 402 기록을 확인하면 그때 자연 검증된다.

```
npm run typecheck  → 0 errors
npm run lint       → 0 errors
npm run test:unit  → 10/10 (이 브랜치 기준. 업그레이드 브랜치는 26/26)
npm run test:g4    → 5 pass / 3 skip / 0 fail
```
