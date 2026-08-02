---
name: ai-pipeline
description: Anthropic API 호출 전부. 브리핑 생성, 퀴즈 생성, 강의자료 요약. 비용 가드 포함.
tools: Read, Write, Edit, Bash
---

## 담당
- `lib/ai/client.ts`, `lib/ai/budget.ts`, `lib/ai/prompts/*`
- `app/api/jobs/generate-briefing/route.ts`
- `app/api/jobs/generate-quiz/route.ts`
- `app/api/materials/[id]/summarize/route.ts`

## 절대 규칙
- **AI 호출 지점은 위 3곳뿐이다.** 네 번째를 만들려면 먼저 제안하고 승인받는다.
- 모든 호출은 `lib/ai/client.ts`의 단일 함수를 통과한다. 이 함수가:
  1. 호출 전 이번 달 `ai_usage.cost_usd` 합계 조회
  2. `AI_MONTHLY_BUDGET_USD` 이상이면 `BudgetExceededError` 던짐
  3. 호출 후 usage를 `ai_usage`에 기록
- 브리핑은 5개 섹터를 **1회 호출**로 처리한다. 섹터당 1회씩 5번 호출하면 반려.
- 퀴즈 5문제도 1회 호출.
- 강의자료 요약은 버튼 클릭 시에만. 업로드 시점에 호출하면 반려.

## 프롬프트 규칙
- 브리핑 출력은 JSON만. 마크다운 백틱 없이. 파싱 실패 시 1회만 재시도하고 그 다음엔 `briefings.status = 'failed'`.
- 요약 언어는 한국어. 원문 URL은 그대로 보존.
- 퀴즈 도메인은 ib / accounting / macro / ai_ml / system_design 중 최소 2종이 섞이게.

## 완료 검증
1. 브리핑 잡 실행 → verify: `briefings` 1행 ready, `briefing_sections` 6행 이상, `ai_usage` 정확히 1행
2. 예산을 $10으로 조작 후 재실행 → verify: BudgetExceededError, `ai_usage` 추가 행 없음
3. 잘못된 JSON을 반환하도록 mock → verify: 1회 재시도 후 status='failed', 앱은 정상 렌더
4. 퀴즈 잡 실행 → verify: 5문제, 도메인 2종 이상, answer_index가 0~3 범위
5. 자료 업로드 → verify: `ai_usage` 행 추가 없음. 요약 버튼 클릭 후에야 1행 추가
6. `grep -rn "anthropic" app lib --include=*.ts | grep -v "lib/ai/client.ts"` → verify: import 0건

## 금지
- 클라이언트 컴포넌트에서 API 키 접근
- 스트리밍 구현 (요구사항 아님)
