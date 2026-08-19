# 배포 체크리스트 — VAPID · db push · iPhone G4

에이전트가 이 환경에서 못 하는 세 가지. 자격증명과 실기기가 있는 쪽에서 이 순서대로 한다.

이 클라우드 VM에서 확인한 것: `npm run vapid:generate`가 키를 만들고 `.env.local`(mode 0600)에 쓴다. `.env.local`은 gitignore. 그 키는 에이전트 로그에 찍혔으므로 **버린다.** 프로덕션 키는 노트북에서 다시 만든다.

이 VM에서 못 한 것: 호스티드 `db push`는 운영자가 수행. iPhone G4 1·4·5는 2026-08-19 운영자가 수동 통과로 보고 (`docs/G4-REPORT.md`).

## 1. VAPID 키

`git pull origin …`만으로는 브랜치가 바뀌지 않는다. 체크아웃한 뒤, **npm install 없이**:

```bash
git fetch origin
git checkout cursor/phase4-implement-3145
node scripts/gen-vapid.cjs
```

또는 같은 파일: `npm run vapid:generate`. Node 내장 crypto만 쓴다.

`Missing script` / 파일이 없으면 브랜치가 아니다. 그때는 아무 디렉터리에서:

```bash
npx --yes web-push generate-vapid-keys
```

나온 두 값을 `.env.local`의 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`에 붙인다.

`.env.local`에 `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`가 생긴다.
**같은 두 값**을 Vercel(또는 동급) 환경변수에 넣고 **재배포**한다. 키를 바꾸면 기존 구독은 전부 죽는다.
발송 subject는 `ALLOWED_EMAIL`의 mailto (코드가 조합). 별도 `VAPID_SUBJECT`는 없다.

확인: `/settings` 푸시 카드에 "VAPID 설정됨"이 보인다. 키가 없으면 "VAPID 없음".

## 2. 호스티드 Supabase (`leitsqwmtxqsgnsvzdfc`)

액세스 토큰과 DB 비밀번호가 필요하다.

```bash
npx supabase login
npx supabase link --project-ref leitsqwmtxqsgnsvzdfc
npx supabase db push
```

운영자가 `0001`–`0007` + `0009`는 이미 push했다. 이 wrap 브랜치를 머지한 뒤 **남은 건 `0008`뿐**:

| 파일 | 내용 | 상태 |
|---|---|---|
| `0001`–`0007` | Phase 1–3 + 퀴즈 | 적용됨 |
| `0008_event_exdates.sql` | Trust — `events.exdates` | **이 머지 후 push** |
| `0009_phase4_push_review.sql` | `push_subscriptions`, `weekly_reviews` | 적용됨 |

시드는 별도. SQL Editor:

```sql
insert into app_config (key, value) values ('allowed_email', 'YOUR_EMAIL')
on conflict (key) do update set value = excluded.value;
```

확인: Studio에서 `push_subscriptions`, `weekly_reviews` 테이블이 보인다.

## 3. iPhone — G4 조건 1 · 4 · 5

프로덕션 URL을 **Safari**로 연다 (Chrome 아님).

### 조건 1 — 구독 왕복

1. Safari에서 한 번 열어 서비스 워커가 등록되게 한다
2. 공유 → 홈 화면에 추가
3. 홈 화면 아이콘으로 연다 (주소창이 없어야 한다)
4. `/settings` → 푸시 카드 진단:
   - 홈 화면 앱: 예
   - 서비스 워커: 예
   - VAPID: 예
5. **알림 구독** → 권한 허용
6. Studio `push_subscriptions`에 1행
7. **테스트 알림** → 잠금 화면에 Personal OS 알림

### 조건 4 — 오프라인 폴백

1. 온라인으로 대시보드를 한 번 연다
2. 비행기 모드
3. 홈 화면 아이콘으로 다시 연다
4. 흰 화면·500이 아니라 마지막 대시보드가 보인다
5. 상단에 "오프라인 — 마지막 동기화 데이터"

### 조건 5 — 온라인은 네트워크 우선

1. 비행기 모드를 끈다
2. 설정에서 아무 변경(테마 등) 후 새로고침
3. 변경이 즉시 보인다 (캐시가 가리지 않음)

2026-08-19 운영자 보고로 1·4·5 수동 통과. 판정은 `docs/G4-REPORT.md`.

## 4. 남은 사람 단계 (wrap 후)

1. 이 PR을 `main`에 머지하고 Vercel이 `main`을 배포하게 한다.
2. `npx supabase db push` — `0008_event_exdates`만 올라가야 정상.
3. GitHub repo Secrets: `APP_URL`, `CRON_SECRET` (Vercel과 같은 값).
4. Actions → `cron` → Run workflow:

| Job | 통과 기준 |
|---|---|
| `sync-calendar` | 200, `sync_state` `ok` |
| `generate-briefing` | 200, 오늘 `briefings` `ready`. 푸시 `sent`/`skipped`/`failed`여도 잡 `ok` (G4-2) |
| `generate-weekly-review` | 200, `weekly_reviews` `ready` + `ai_usage` 1행 `weekly_review` (G4-6) |
| `fetch-news` | 200, `job_runs.meta.pruned` 키 존재 |

5. G4-8: Vercel `AI_MONTHLY_BUDGET_USD=0` → `generate-weekly-review` → **402**, 새 `ready` 없음 → 예산을 `10`으로 되돌린다.
6. 출력(비밀값 제외)을 주면 `docs/G4-REPORT.md`를 갱신한다. 그 전에는 G4 통과라고 쓰지 않는다.

`NOTION_TOKEN`이 있으면 `npm run notion:check`. 없어도 wrap을 막지 않는다.
