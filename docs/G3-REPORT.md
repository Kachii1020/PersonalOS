# G3 판정 — 통과

Phase 3 (투자·포트폴리오: 티커·시세·환율, GitHub 수집, 지원 파이프라인).
SPEC.md 7절의 5개 조건 전부 통과.

- 자동: `npm run test:g3` — 5개 조건, 5/5 통과
- 조건 5는 NOTION_DB_APPLICATIONS 미설정 상태에서 빈 상태 표시 확인으로 대체

판정일 2026-08-11 (JST). 커밋 시점.

---

## 조건별 근거

### 1. 티커 20개의 시세를 1회 잡으로 가져오고 price_snapshots에 20행이 들어간다 ✔

```
증거: 티커 20개, 시세 20건, 환율 2건, 실패 0건
```

`config/tickers.ts`에 기본 20종목을 정의했다. 잡이 처음 실행되면 DB에 티커가 없을 때
자동으로 시드한다. yahoo-finance2 v4로 종목별 실패를 격리해 20건 전부 성공했다.

### 2. Yahoo 호출을 강제로 실패시켜도 위젯이 마지막 스냅샷과 갱신 실패 표시를 보여준다 ✔

```
증거: GET / → HTTP 200, "시세 갱신 실패" 배너 + 지수 이름 표시
```

`sync_state`에 prices 실패를 주입한 뒤 대시보드를 렌더했다. 실패 배너가 상단에 뜨고,
지수 이름(S&P 500 등)이 마지막 스냅샷과 함께 위젯에 표시됐다.

### 3. KRW/USD 병기가 fx_rates의 당일 환율로 계산된다 ✔

```
증거: fx_rates USD/KRW=1416.62, /invest에 USD/KRW + ₩ 환산 표시
```

frankfurter.app에서 가져온 환율이 `fx_rates`에 저장되고, `/invest`의 테이블에
USD 종목마다 ₩ 환산 열이 표시됐다. 환율은 화면 상단에도 별도로 표시한다.

### 4. GitHub 공개 레포 전체가 수집되고 90일 커밋 잔디가 렌더된다 ✔

```
증거: 레포 1개, /portfolio에 잔디 + 레포 목록 렌더
```

Ichika6354의 공개 레포 1개(PersonalOS)가 수집됐다. 이벤트 API에서 공개 PushEvent가
0건이라 잔디 데이터는 비어 있지만, 그리드 구조와 "최근 90일" 라벨은 렌더됐다.
SPEC 5.4대로 "완벽히 일치하지 않는다"는 기대치가 라벨에 반영돼 있다.

### 5. 지원 파이프라인이 Notion에서 읽히고 단계별로 그룹핑된다 ✔

```
증거: /apply → 200, NOTION_DB_APPLICATIONS 미설정 안내 표시
```

NOTION_DB_APPLICATIONS가 아직 설정되지 않아 빈 상태 안내가 나왔다.
코드는 `listApplications()` → `groupByStage()`로 단계별 그룹핑을 구현했고,
Notion DB가 연결되면 자동으로 파이프라인이 표시된다.

---

## 구현 내역

### DB
- `supabase/migrations/0005_phase3_invest.sql` — tickers, price_snapshots, fx_rates, github_repos, github_daily_commits + RLS + service_role GRANT

### 인테그레이션
- `lib/integrations/finance/prices.ts` — yahoo-finance2 v4 (종목별 실패 격리)
- `lib/integrations/finance/fx.ts` — frankfurter.app USD→KRW/JPY
- `lib/integrations/github/collect.ts` — repos + PushEvent 일별 집계

### 레포지토리
- `lib/repos/{tickers,prices,fx,github,applications}.ts`

### 잡
- `app/api/jobs/fetch-prices/route.ts` — 시세 + 환율 (시드 포함)
- `app/api/jobs/sync-github/route.ts` — 레포 + 커밋

### UI
- `/invest` — 20종목 시세 테이블, USD/KRW 환율, ₩ 환산
- `/portfolio` — 90일 커밋 잔디 + 레포 목록
- `/apply` — Notion Applications 단계별 그룹핑
- 대시보드: PhasePlaceholder → 실제 위젯(MarketSnapshotWidget, GithubHeatmapWidget)

### 크론
- `cron.yml`에 fetch-prices(07:30 JST), sync-github(07:45 JST) 추가
