# Notion 값 6개 얻는 법

`.env.local`에 넣어야 하는 값이다. 전부 Notion 웹에서 5~10분이면 얻는다.

```
NOTION_TOKEN=ntn_...
NOTION_DB_RESEARCH=...
NOTION_DB_WIKI=...
NOTION_DB_COURSE_NOTES=...
NOTION_DB_ALGO=...
NOTION_DB_APPLICATIONS=...
```

---

## 1. NOTION_TOKEN — 토큰 만들기

두 가지 방식이 있고 **아무거나 하나면 된다.** 이 앱은 읽기 전용이라 차이가 크지 않다.

### 방법 A. Internal connection (권장)

워크스페이스 소유자여야 한다. 개인 워크스페이스면 당연히 소유자다.

1. https://app.notion.com/developers/connections 접속
2. **New connection** (또는 **새 연결**)
3. 이름은 아무거나 — `Personal OS` 정도
4. 연결할 워크스페이스를 고른다
5. 만들고 나면 **Configuration** 탭에 토큰이 있다. `ntn_`으로 시작한다

권한(capabilities)은 **Read content만** 켜두면 된다. 이 앱은 Notion에 쓰지 않는다
(`CLAUDE.md`: Notion은 사람이 쓰는 것, 앱은 읽기 전용).

### 방법 B. Personal access token

1. https://www.notion.so/developers/tokens 접속
2. **New token**, 이름 입력, capability는 **Notion API** 선택
3. 역시 `ntn_`으로 시작하는 값이 나온다

> 방법 B의 토큰은 **당신 계정 권한 그대로** 동작한다. 즉 당신이 볼 수 있는 페이지는
> 전부 읽을 수 있다. 방법 A는 "명시적으로 연결한 페이지만" 읽는다. 사고 범위가 좁은
> 쪽이 A라서 권장한다.

---

## 2. 데이터베이스 5개 준비

SPEC.md 3절이 요구하는 DB다. **없으면 먼저 Notion에서 만들어야 한다.**
빈 DB여도 상관없다 — 앱은 있는 것만 읽는다.

| 환경변수 | DB 용도 | 최소 속성 |
|---|---|---|
| `NOTION_DB_RESEARCH` | 리서치 노트 | 제목, 종목/주제, 날짜 |
| `NOTION_DB_WIKI` | 실무 지식 위키 | 제목, 태그 |
| `NOTION_DB_COURSE_NOTES` | 과목별 노트 | 제목, 과목, 주차 |
| `NOTION_DB_ALGO` | 알고리즘 패턴 | 제목, 패턴, 난이도 |
| `NOTION_DB_APPLICATIONS` | 지원 파이프라인 | 회사, 단계, 마감일 |

만들 때는 Notion 페이지에서 `/database` → **Table view** → **Full page**로 만든다.
인라인(페이지 안에 박힌) DB도 되지만, 전체 페이지가 ID 복사하기 쉽다.

---

## 3. 각 DB의 ID 복사

DB를 **전체 페이지로 연 다음** 주소창을 본다.

```
https://www.notion.so/myworkspace/1a2b3c4d5e6f7890abcdef1234567890?v=98765432...
                                 └──────────── 이 32자가 DB ID ────────────┘
```

- 워크스페이스 이름 뒤, `?v=` 앞의 **32자리 16진수**다
- DB 제목이 URL에 섞여 있으면 (`.../과목노트-1a2b3c...`) 마지막 `-` 뒤부터가 ID다
- 하이픈이 있든(`1a2b3c4d-5e6f-...`) 없든 둘 다 된다

주소창을 못 쓰겠으면 DB 우상단 **•••** → **Copy link**로 링크를 복사해도 같은 값이 들어있다.

---

## 4. 각 DB를 커넥션에 연결 (이걸 빼먹으면 전부 실패한다)

**가장 자주 놓치는 단계다.** 토큰이 있어도 공유하지 않은 DB는 존재하지 않는 것처럼 보인다
(API가 `object_not_found`를 준다 — 권한 오류가 아니라 "없다"고 나와서 헷갈린다).

DB 5개 **각각**에 대해:

1. DB를 전체 페이지로 연다
2. 우상단 **•••** 클릭
3. 아래로 내려 **Add connections** (한국어 UI면 **연결 추가**)
4. 검색창에 아까 만든 커넥션 이름(`Personal OS`)을 치고 선택

부모 페이지에 연결하면 하위 페이지가 상속받는다. DB 5개를 한 페이지 밑에 모아뒀다면
그 부모 페이지 한 번만 연결해도 된다.

---

## 5. `.env.local`에 넣기

```bash
NOTION_TOKEN=ntn_실제값
NOTION_DB_RESEARCH=1a2b3c4d5e6f7890abcdef1234567890
NOTION_DB_WIKI=...
NOTION_DB_COURSE_NOTES=...
NOTION_DB_ALGO=...
NOTION_DB_APPLICATIONS=...
```

넣은 뒤 dev 서버를 **재시작**해야 읽힌다. Next.js는 환경변수를 부팅 시점에만 읽는다.

---

## 알아둘 것 — database ID와 data source ID

Notion API가 2025-09-03 버전부터 **하나의 DB가 여러 data source를 가질 수 있는 구조**로
바뀌었다. 그래서 실제 조회 엔드포인트는 database ID가 아니라 **data source ID**를 받는다.

```
GET  /v1/databases/{database_id}          → { data_sources: [{ id, name }, ...] }
POST /v1/data_sources/{data_source_id}/query   ← 실제 조회는 여기
```

**당신이 할 일은 없다.** 위 3번에서 복사한 database ID만 넣으면, 앱이 첫 조회 때
data source ID로 변환해서 쓴다. 환경변수 이름을 `NOTION_DB_*`로 유지하는 이유이기도 하다 —
URL에서 바로 얻을 수 있는 값이 database ID다.

DB 하나에 data source가 여러 개면 앱은 **첫 번째**를 쓴다. 이 앱의 5개 DB는 전부 단일
소스라 문제되지 않지만, 나중에 갈라지면 `docs/DECISIONS.md`를 보고 바꾼다.

data source ID를 직접 넣고 싶으면 DB의 **•••** → **Manage data sources** →
**Copy data source ID**로 얻을 수 있다. 앱은 둘 다 받는다.

---

## 확인

값을 다 넣고 dev 서버를 재시작한 뒤:

```bash
npm run notion:check
```

DB 5개에 각각 접근되는지, 몇 건이 보이는지 한 줄씩 찍는다.
`object_not_found`가 뜨면 4번(연결 추가)을 안 한 DB다.
