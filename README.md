# Personal OS

커리어 학습, 스케줄, 시사·금융 정보, 투자 리서치, SWE 실무 지식을 한 곳에서 관리하는 단일 사용자용 대시보드.

> 개인용 프로젝트입니다. 멀티테넌시를 가정하지 않습니다.

---

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router), TypeScript strict |
| Styling | Tailwind CSS v4 |
| DB | Supabase (Postgres) |
| Docs | Notion API (읽기 전용) |
| Calendar | iCloud CalDAV (`tsdav`) |
| Finance | `yahoo-finance2`, frankfurter, FRED, ECOS |
| AI | Anthropic API |
| Deploy | Vercel |
| Scheduler | GitHub Actions cron |

---

## 데이터 소유권

한 레코드는 한쪽에만 삽니다. 양방향 동기화는 만들지 않습니다.

- **Notion** — 사람이 쓰는 것 (리서치 노트, 실무 위키, 과목 노트, 알고리즘 패턴)
- **Supabase** — 기계가 쓰는 것 (캘린더 미러, 태스크, 뉴스, 브리핑, 퀴즈, 시세, 로그)

---

## 시작하기

```bash
npm install
cp .env.example .env.local     # 값 채우기
npx supabase db reset
npm run dev
```

### 캘린더 연동 전 스파이크

CalDAV 쓰기 가능 여부를 먼저 판정합니다. 이 결과에 따라 캘린더 설계가 갈립니다.

```bash
npx tsx scripts/spike-caldav.ts
```

사전 준비: Apple ID 앱 전용 암호 발급 + 아이폰 캘린더 앱에서 iCloud 계정 아래 `Personal OS` 캘린더 생성.

---

## 구현 단계

| Phase | 범위 | 게이트 |
|---|---|---|
| 1 | 인증, 레이아웃, 캘린더, 태스크, 뉴스, AI 브리핑 | G1 |
| 2 | 퀴즈, 실무 위키, 과목·성적, 시간표 ICS | G2 |
| 3 | 투자 리서치, 시세, GitHub 수집, 지원 파이프라인 | G3 |

게이트를 통과하지 못하면 다음 Phase로 넘어가지 않습니다. 조건은 [SPEC.md](./SPEC.md) 7절.

---

## 문서

| 파일 | 내용 |
|---|---|
| [SPEC.md](./SPEC.md) | 제품·기술 스펙, DB 스키마, 연동 상세, 게이트 조건 |
| [CLAUDE.md](./CLAUDE.md) | 에이전트 행동 규칙과 작업 프로토콜 |
| [AGENTS.md](./AGENTS.md) | 서브에이전트 정의와 실행 순서 |
| `docs/DECISIONS.md` | 아키텍처 결정 로그 |
| `docs/DEFERRED.md` | 의도적으로 미룬 것들 |

---

## 스크립트

```bash
npm run dev
npm run typecheck
npm run lint
npm run test

# 잡 수동 실행
curl -X POST localhost:3000/api/jobs/sync-calendar -H "x-cron-secret: $CRON_SECRET"
```

---

## 설계 원칙

1. **UI는 외부 API를 직접 조회하지 않는다.** 항상 Supabase 미러를 읽습니다. 외부 서비스가 죽어도 앱은 뜹니다.
2. **실패는 조용하지 않다.** 모든 외부 호출 실패는 `sync_state` 또는 `job_runs`에 기록되고 UI에 표시됩니다.
3. **AI 호출 지점은 3곳뿐이다.** 브리핑 생성, 퀴즈 생성, 강의자료 요약. 월 예산 하드캡을 넘으면 호출 전에 차단됩니다.
4. **현재 Phase 밖의 것은 만들지 않는다.**

---

## License

MIT
