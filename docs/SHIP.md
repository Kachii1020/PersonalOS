# 배포 체크리스트 — VAPID · db push · iPhone G4

에이전트가 이 환경에서 못 하는 세 가지. 자격증명과 실기기가 있는 쪽에서 이 순서대로 한다.

이 클라우드 VM에서 확인한 것: `npm run vapid:generate`가 키를 만들고 `.env.local`(mode 0600)에 쓴다. `.env.local`은 gitignore. 그 키는 에이전트 로그에 찍혔으므로 **버린다.** 프로덕션 키는 노트북에서 다시 만든다.

이 VM에서 못 한 것: 호스티드 `db push`(CLI 미로그인, `SUPABASE_ACCESS_TOKEN` 없음), iPhone G4 1·4·5.

## 1. VAPID 키

프로젝트 루트에서 (로컬, 로그가 안 남는 터미널):

```bash
npm run vapid:generate
```

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

이번 push에 포함돼야 하는 미적용 마이그레이션:

| 파일 | 내용 |
|---|---|
| `0001`–`0007` | Phase 1–3 + 퀴즈 학습 (아직 한 번도 안 올렸으면 전부) |
| `0008_event_exdates.sql` | Trust PR — `events.exdates` (그 PR을 먼저 머지했을 때) |
| `0009_phase4_push_review.sql` | `push_subscriptions`, `weekly_reviews` |

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

판정은 `docs/G4-REPORT.md` 조건 1·4·5를 수동 통과로 고친다.
