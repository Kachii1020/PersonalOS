# /quiz — IB Engineering

게이트 밖. **SPEC.md는 고치지 않는다.** 이 파일이 `/quiz` 경로의 소스다.
Learn 엑셀 트랙(`excel_finance`, `/learn`)과 겹치지 않는다.

상태: **구현됨** (문항 90 + 레슨 6 + 오늘 5칸). 호스티드 SQL 시드는 운영자가 적용한다. 로그인 뒤 `/quiz`의 「90문항 넣기」도 같은 행을 만든다.

---

## 한 줄

`/quiz`는 은행 테크(IB engineering) 면접·직무 경로다. 엑셀 모델링이 아니다.

하루 5문제·오답 1/3/7일·복습 우선(G2)은 유지한다. 섞는 도메인만 바꿨다.

---

## 도메인 6

| id | 제목 |
|---|---|
| `ib_eng_markets` | 시장 배관 (FIX, OMS/EMS) |
| `ib_eng_latency` | 저지연 |
| `ib_eng_concurrency` | 동시성 |
| `ib_eng_data` | 포지션·리스크 데이터 |
| `ib_eng_systems` | 거래 시스템 |
| `ib_eng_ds` | 면접 자료구조 |

문항은 `lib/quiz/ib-eng/*`에 둔다. 시드는 `supabase/seed-ib-engineering.sql`.
`module_slug`는 `ib_eng/{id}`, `concept_hint`는 힌트 문장이다.

---

## 오늘 세트

1. 복습 큐(해당 도메인)
2. 아직 안 푼 시드 문항 (도메인 회전)
3. 나머지

`?topic=`이면 그 도메인만. 엑셀·옛 커리어 도메인은 넣지 않는다.

---

## 하지 않음

- SPEC.md 도메인 목록 개정
- Learn 엑셀 퀴즈 50 재배열
- 호스티드 시드를 적용했다고 주장 (런타임 「90문항 넣기」는 로컬/세션 경로)
- 일반 leetcode 볼륨, 특정 은행 내부 시스템 이름
