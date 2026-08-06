# Notion 연결하기

**지금 필요한 건 값 2개다.** 나머지는 Phase 3에서 한다.

```
NOTION_TOKEN=ntn_...        ← 열쇠
NOTION_DB_WIKI=...          ← 어느 표를 읽을지
```

---

## 왜 두 개가 필요한가

Notion API는 **기본적으로 아무것도 못 본다.** 토큰이 있어도 그렇다.
"이 표를 이 앱에게 보여주겠다"고 사람이 직접 지정해야 한다. 그래서 순서가 이렇다.

```
1. 열쇠를 만든다          → NOTION_TOKEN
2. 읽을 표를 만든다        → 이 표의 주소에서 NOTION_DB_WIKI를 얻는다
3. 그 표에 열쇠를 꽂는다    → 이걸 빼먹으면 1·2가 맞아도 "그런 표 없음"이 나온다
```

3번이 제일 많이 빠진다. **표마다 따로 해야 한다.**

---

## 1단계 — 표 만들기 (2분)

Notion에서 아무 페이지나 열고:

1. 본문에 `/table` 입력 → **Table view** 선택
2. **Full page**(전체 페이지)로 만든다 — 페이지 안에 박힌 인라인 표보다 주소 복사가 쉽다
3. 제목을 `실무 지식 위키` 정도로 붙인다

**내용은 비어 있어도 된다.** 앱은 있는 것만 읽는다. 나중에 채우면 그때부터 보인다.

이미 위키로 쓰는 표가 있으면 그걸 쓰면 된다. 새로 만들 필요 없다.

---

## 2단계 — 열쇠(토큰) 만들기 (2분)

1. https://www.notion.so/profile/integrations 접속
   (안 열리면 https://app.notion.com/developers/connections)
2. **New integration** 또는 **New connection** 버튼
3. 이름: `Personal OS`
4. 워크스페이스: 본인 것 선택
5. 만들면 나오는 **Internal Integration Secret** / **Configuration** 탭의 토큰을 복사

`ntn_`으로 시작하는 긴 문자열이다. 이게 `NOTION_TOKEN`이다.

권한은 **Read content만** 켜두면 된다. 이 앱은 Notion에 쓰지 않는다.

---

## 3단계 — 표에 열쇠 꽂기 (30초) ← 여기가 핵심

1단계에서 만든 표를 **전체 페이지로 열고**:

1. 우측 상단 **•••** 클릭
2. 메뉴를 **아래로 끝까지** 스크롤
3. **Connections** 또는 **Add connections** 클릭
4. `Personal OS` 검색해서 선택
5. 확인 창이 뜨면 **Confirm**

이걸 안 하면 API가 `object_not_found`를 준다. "권한 없음"이 아니라 **"그런 표가 없다"**고
나오기 때문에, ID를 잘못 복사한 줄 알고 엉뚱한 데를 고치게 된다.

---

## 4단계 — 표 주소에서 ID 꺼내기 (1분)

표를 전체 페이지로 연 상태에서 브라우저 주소창을 본다.

```
https://www.notion.so/내워크스페이스/26f1b2c3d4e5806f9a0b1c2d3e4f5061?v=26f1b2c3...
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    이 32자리가 NOTION_DB_WIKI
```

- **`?v=` 앞**의 32자다. `?v=` 뒤에 있는 건 뷰 ID라서 쓰면 안 된다
- 표 제목이 주소에 섞여 있으면 (`.../실무-지식-위키-26f1b2c3...`) **마지막 `-` 뒤부터**가 ID다
- 하이픈이 있어도(`26f1b2c3-d4e5-...`) 없어도 둘 다 된다

주소창을 쓰기 어려우면 표 우상단 **•••** → **Copy link**로 붙여넣어도 같은 값이 들어있다.

---

## 5단계 — 파일에 넣고 확인

`~/personalOS/.env.local` 맨 아래에 두 줄 추가:

```
NOTION_TOKEN=ntn_여기에붙여넣기
NOTION_DB_WIKI=26f1b2c3d4e5806f9a0b1c2d3e4f5061
```

그리고:

```bash
npm run notion:check
```

성공하면 이렇게 나온다:

```
✔ 위키 — '실무 지식 위키' 0건
· 과목 노트 — 아직 없음 (Phase 3에서 필요합니다. 지금은 넘어가도 됩니다)
...
연결됐습니다. 이제 /wiki를 만들 수 있습니다.
```

---

## 안 될 때

| 메시지 | 원인 | 할 일 |
|---|---|---|
| `NOTION_TOKEN이 없습니다` | 파일에 안 들어갔거나 dev 서버가 옛 값을 물고 있다 | `.env.local` 확인 |
| `404 ... object_not_found` | **3단계를 안 했다** (가장 흔함) | 표 ••• → Connections에서 연결 |
| `401 Unauthorized` | 토큰이 잘렸거나 오타 | 토큰 다시 복사 |
| `400 ... path failed validation` | ID가 32자가 아니다 | `?v=` 뒤를 복사한 게 아닌지 확인 |

---

## 나중에 (Phase 3)

`/invest`와 `/apply` 화면을 만들 때 아래를 같은 방식으로 추가한다.
**표를 만들고 → 연결하고 → ID를 넣는다.** 절차는 위와 똑같다.

```
NOTION_DB_COURSE_NOTES=      과목별 노트
NOTION_DB_RESEARCH=          리서치 노트
NOTION_DB_ALGO=              알고리즘 패턴
NOTION_DB_APPLICATIONS=      지원 파이프라인
```

---

## 참고 — database ID와 data source ID

Notion API가 2025-09-03 버전부터 "표 하나가 여러 데이터 소스를 가질 수 있는" 구조로
바뀌어서, 실제 조회는 database ID가 아니라 **data source ID**로 한다.

**당신이 할 일은 없다.** 4단계에서 복사한 값만 넣으면 앱이 알아서 변환한다.
환경변수 이름을 `NOTION_DB_*`로 둔 이유가 이거다 — 주소창에서 바로 얻을 수 있는 값이니까.
