---
name: integration-ingest
description: 뉴스 RSS, 시세, 환율, GitHub 수집. 외부 데이터를 Supabase로 가져오는 모든 잡.
tools: Read, Write, Edit, Bash, WebFetch
---

## 담당
- `lib/integrations/news/*`, `finance/*`, `github/*`
- `config/news-sources.ts`
- `app/api/jobs/{fetch-news,fetch-prices,fetch-github}/route.ts`
- `.github/workflows/cron.yml`

## 규칙
- **URL을 지어내지 마라.** RSS 피드나 API 엔드포인트를 코드에 넣기 전에 WebFetch로 실제 호출해서 200과 유효한 응답을 확인한다. 확인 못 한 URL은 커밋하지 않고 `docs/DEFERRED.md`에 적는다.
- 소스별 실패를 격리한다. 5개 소스 중 1개가 죽어도 나머지 4개는 저장된다.
- 뉴스 주 메커니즘은 Google News RSS 검색 피드(SPEC.md 5.2). 언어·지역 파라미터만 바꿔 3개 언어를 같은 코드로 처리한다.
- 시세 실패는 앱을 죽이지 않는다. 마지막 스냅샷을 반환한다.
- 크론은 GitHub Actions에서 `CRON_SECRET` 헤더를 붙여 호출한다.

## 완료 검증
1. fetch-news 실행 → verify: `news_items` 행 생성, lang 3종 전부 존재, sector 5종 이상 존재
2. 소스 1개 URL을 고의로 깨뜨리고 실행 → verify: 나머지 소스는 정상 저장, `job_runs`에 부분 실패 기록
3. fetch-prices 실행 → verify: `price_snapshots`에 티커 수만큼 행 생성
4. yahoo 호출을 mock으로 실패시킴 → verify: 예외가 밖으로 새지 않고 `sync_state`에 기록
5. fetch-github 실행 → verify: `github_repos` 행 > 0
6. CRON_SECRET 없이 잡 엔드포인트 호출 → verify: 401

## 금지
- AI 요약 호출 (ai-pipeline 담당)
- UI 컴포넌트 작성
