-- Seed: Excel for Finance curriculum + quiz questions
-- Run after 0012_learn_module.sql migration is applied.
-- concept_hint stores exercise position ('0','1','2') for deterministic ordering.

-- ============ Track ============
insert into learn_tracks (slug, title, description, position) values
  ('excel-finance', 'Excel for Finance', '기초 → 재무 분석 → 모델링. FP&A/IB 공통 기반.', 1);

-- ============ Phases ============
insert into learn_phases (track_id, phase_number, title, description, weeks_label, position) values
  ((select id from learn_tracks where slug = 'excel-finance'), 1,
   'Excel 기초 체력', '마우스 없이 엑셀을 다루는 속도감 + 핵심 함수 12개', '1–2주차', 1),
  ((select id from learn_tracks where slug = 'excel-finance'), 2,
   '재무 분석 실무', '피벗 테이블, 데이터 정리, 재무 함수', '3–4주차', 2),
  ((select id from learn_tracks where slug = 'excel-finance'), 3,
   '재무 모델링 기초', '3-Statement Model + DCF', '5–8주차', 3);

-- ============ Modules ============
-- Phase 1
insert into learn_modules (phase_id, slug, title, concepts, position) values
  ((select id from learn_phases where phase_number = 1 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'nav', '네비게이션 & 단축키',
   array['Ctrl+방향키로 데이터 끝까지 이동','Ctrl+Shift+방향키로 범위 선택','Ctrl+Space / Shift+Space (열/행 선택)','Alt → 리본 단축키 체계','F2 (셀 편집 모드 진입)','Ctrl+1 (셀 서식), Ctrl+; (오늘 날짜)','Ctrl+D / Ctrl+R (아래/오른쪽 채우기)'],
   1),
  ((select id from learn_phases where phase_number = 1 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'basic-fn', '기본 함수',
   array['SUM, AVERAGE, COUNT, COUNTA, COUNTBLANK','MIN, MAX, LARGE, SMALL','절대참조($A$1) vs 상대참조(A1) vs 혼합참조','이름 정의(Name Manager)로 범위에 이름 붙이기'],
   2),
  ((select id from learn_phases where phase_number = 1 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'logic', '논리 & 조건부 집계',
   array['IF / IFS / 중첩 IF','AND, OR, NOT','IFERROR, IFNA','SUMIF, SUMIFS','COUNTIF, COUNTIFS','AVERAGEIF, AVERAGEIFS'],
   3),
  ((select id from learn_phases where phase_number = 1 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'lookup', 'INDEX-MATCH',
   array['VLOOKUP 구조와 한계','XLOOKUP','INDEX(범위, 행, [열])','MATCH(값, 범위, [유형])','INDEX-MATCH 조합','2차원: INDEX-MATCH-MATCH'],
   4);

-- Phase 2
insert into learn_modules (phase_id, slug, title, concepts, position) values
  ((select id from learn_phases where phase_number = 2 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'pivot', '피벗 테이블',
   array['피벗 테이블 생성 (Alt+N+V)','행/열/값/필터 영역','값 필드 설정','날짜 그룹화','슬라이서','피벗 차트','Calculated Field'],
   1),
  ((select id from learn_phases where phase_number = 2 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'data-clean', '데이터 정리 & PQ',
   array['Text to Columns','중복 제거, 빈 셀 처리','TRIM, CLEAN, SUBSTITUTE','LEFT, RIGHT, MID, FIND, LEN','Power Query 기초','열 병합/분할, 피벗 해제','Merge & Append'],
   2),
  ((select id from learn_phases where phase_number = 2 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'fin-fn', '재무 함수',
   array['NPV, XNPV','IRR, XIRR','PMT, IPMT, PPMT','PV, FV','RATE, NPER','부호 규칙 (유입=+, 유출=-)'],
   3);

-- Phase 3
insert into learn_modules (phase_id, slug, title, concepts, position) values
  ((select id from learn_phases where phase_number = 3 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'model-structure', '모델 설계 원칙',
   array['컬러 컨벤션: 입력=파랑, 수식=검정, 링크=초록','하드코딩 금지','시트 구조: Assumptions → IS → BS → CF → Valuation','BS 밸런스 체크 행','시나리오 스위치','순환참조 해결'],
   1),
  ((select id from learn_phases where phase_number = 3 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'three-stmt', '3-Statement 연결',
   array['IS 구축','BS 구축','CF 간접법','IS→BS: 순이익→이익잉여금','BS→CF: 운전자본 변동, 감가상각','CF→BS: 기말 현금','순환참조: 이자비용↔차입금'],
   2),
  ((select id from learn_phases where phase_number = 3 and track_id = (select id from learn_tracks where slug = 'excel-finance')),
   'dcf-intro', 'DCF 기초',
   array['FCF = 영업CF - Capex','WACC','Terminal Value','EV → Equity Value','감도분석 Data Table','Football Field Chart'],
   3);

-- ============ Quiz Questions (domain = 'excel_finance') ============
-- concept_hint = exercise index ('0','1','2') for deterministic ordering within module.

-- Phase 1 / nav
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'nav', '0', '1000행 데이터에서 A1에서 마지막 데이터 행까지 이동하려면?',
   array['Ctrl+End','Ctrl+↓','Ctrl+Shift+End','Page Down'], 1,
   'Ctrl+↓는 현재 열에서 데이터가 있는 마지막 셀까지 점프한다. Ctrl+End는 사용된 범위의 우하단 끝으로 간다.', 1),
  ('excel_finance', 'nav', '1', 'A1:A500을 한 번에 선택하는 가장 빠른 방법은?',
   array['드래그','Ctrl+Shift+↓','Shift+Ctrl+End','이름 상자에 A1:A500 입력'], 1,
   'A1에서 Ctrl+Shift+↓. 데이터가 연속이면 마지막 행까지 선택된다.', 1),
  ('excel_finance', 'nav', '2', '셀 서식 대화상자를 여는 단축키는?',
   array['Ctrl+F','Ctrl+1','Ctrl+Shift+1','Alt+H'], 1,
   'Ctrl+1이 셀 서식(Format Cells) 대화상자. Ctrl+Shift+1은 숫자 서식을 바로 적용한다.', 1);

-- Phase 1 / basic-fn
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'basic-fn', '0', 'B2에 =A2*C$1 수식이 있다. B3로 복사하면?',
   array['=A3*C$1','=A2*C$1','=A3*C$2','=A2*C$2'], 0,
   'A2→A3 (상대참조), C$1→C$1 (혼합참조, $가 행 고정). 세율 같은 고정 값 참조에 쓰는 패턴.', 1),
  ('excel_finance', 'basic-fn', '1', '빈 셀 제외하고 데이터가 있는 셀 수를 세려면?',
   array['COUNT','COUNTA','COUNTBLANK','LEN'], 1,
   'COUNT는 숫자만, COUNTA는 비어있지 않은 셀 전부, COUNTBLANK는 빈 셀.', 1),
  ('excel_finance', 'basic-fn', '2', '두 번째로 큰 값을 구하려면?',
   array['MAX-1','LARGE(범위, 2)','RANK(2)','INDEX(MAX)'], 1,
   'LARGE(범위, k)는 k번째로 큰 값. SMALL은 반대.', 1),
  ('excel_finance', 'basic-fn', '3', '빈 셀 개수만 세려면?',
   array['COUNTA','COUNTBLANK','COUNT','LEN'], 1,
   'COUNTBLANK는 빈 셀. COUNT는 숫자, COUNTA는 비어 있지 않은 셀.', 1),
  ('excel_finance', 'basic-fn', '4', '세 번째로 작은 값을 구하려면?',
   array['MIN-2','SMALL(범위, 3)','LARGE(범위, 3)','RANK(3)'], 1,
   'SMALL(범위, k)는 k번째로 작은 값. LARGE는 큰 쪽.', 1),
  ('excel_finance', 'basic-fn', '5', '숫자 3개와 빈 칸 1개가 있는 범위에서 COUNT와 COUNTBLANK는?',
   array['3과 1','4와 1','3과 0','4와 0'], 0,
   'COUNT는 숫자만 3, COUNTBLANK는 빈 칸 1.', 1),
  ('excel_finance', 'basic-fn', '6', 'LARGE(범위,1)과 같은 결과는?',
   array['SMALL(범위,1)','MAX(범위)','MIN(범위)','AVERAGE(범위)'], 1,
   'LARGE(...,1)은 최댓값이라 MAX와 같다.', 1),
  ('excel_finance', 'basic-fn', '7', '한 열에서 최댓값만 필요하면?',
   array['LARGE(범위, 1)','MAX(범위)가 더 짧다','RANK','둘 다 불가'], 1,
   '최댓값만이면 MAX. LARGE는 k번째가 필요할 때.', 1);

-- Phase 1 / logic
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'logic', '0', '매출 1억 이상 + 지역 "서울"인 행의 합계를 구하려면?',
   array['SUMIF(지역,"서울",매출)','SUMIFS(매출,지역,"서울",매출,">="&1억)','SUM(IF(...))','SUMPRODUCT'], 1,
   'SUMIFS는 복수 조건. 첫 인수가 합산 범위, 이후 (조건범위, 조건) 쌍을 나열.', 2),
  ('excel_finance', 'logic', '1', 'VLOOKUP에서 #N/A 대신 0을 표시하려면?',
   array['IF(VLOOKUP=NA,0)','IFERROR(VLOOKUP(...), 0)','VLOOKUP(..., FALSE, 0)','ISNA(VLOOKUP(...))'], 1,
   'IFERROR는 에러 시 지정한 값으로 대체. 재무 모델에서 필수.', 1),
  ('excel_finance', 'logic', '2', '=IF(AND(A1>100, B1="Y"), "승인", "보류") — A1=150, B1="N"일 때?',
   array['승인','보류','#VALUE!','TRUE'], 1,
   'AND는 모든 조건이 TRUE여야 함. B1="N"이므로 FALSE → "보류".', 1),
  ('excel_finance', 'logic', '3', 'OR는 언제 TRUE인가?',
   array['모든 조건이 TRUE','하나라도 TRUE','모두 FALSE','숫자만'], 1,
   'OR는 조건 중 하나만 참이면 참.', 1),
  ('excel_finance', 'logic', '4', '이 그리드에서 IFS의 마지막 분기에 TRUE를 쓰면?',
   array['그 외 전부','#NAME?','0','FALSE'], 1,
   'HyperFormula는 TRUE를 이름로 본다. B2>=0처럼 비교를 쓴다.', 1),
  ('excel_finance', 'logic', '5', 'IFNA가 IFERROR와 다른 점은?',
   array['더 빠르다','#N/A만 대체하고 #DIV/0!는 남긴다','배열만 받는다','차이 없음'], 1,
   '조회 실패만 가릴 때 IFNA. IFERROR는 모든 에러를 삼킨다.', 1),
  ('excel_finance', 'logic', '6', '이 실습 그리드에서 AVERAGEIFS를 치면?',
   array['조건 평균','#NAME?','AVERAGEIF와 동일','0'], 1,
   'AVERAGEIFS는 엔진에 없다. AVERAGEIF만 계산한다.', 1),
  ('excel_finance', 'logic', '7', '이 엔진에서 SUMPRODUCT((A1:A4="서울")*(C1:C4))는?',
   array['서울 합계','#VALUE! (배열 조건 불가)','0','TRUE'], 1,
   '수량×단가처럼 숫자 배열만 곱해 더한다. 조건 배열은 엑셀 365에서.', 1),
  ('excel_finance', 'logic', '8', 'SUMIFS의 첫 인수는?',
   array['조건 범위','합산 범위','조건','평균 범위'], 1,
   'SUMIFS는 합산 범위가 먼저다. SUMIF와 순서가 반대.', 2),
  ('excel_finance', 'logic', '9', 'NOT(A1>10)이 TRUE인 경우는?',
   array['A1=20','A1=5','A1=10.1','A1이 텍스트'], 1,
   'NOT은 조건을 뒤집는다. 5>10은 FALSE → NOT은 TRUE.', 1),
  ('excel_finance', 'logic', '10', '한 조건으로 행 수를 세는 함수는?',
   array['COUNTIFS만','COUNTIF','COUNTA','COUNTBLANK'], 1,
   '조건 하나면 COUNTIF. 둘 이상이면 COUNTIFS.', 1),
  ('excel_finance', 'logic', '11', 'IFS에서 어떤 조건도 참이 아니면?',
   array['0','#N/A','마지막 값','FALSE'], 1,
   '짝이 맞는 참이 없으면 #N/A. 그래서 마지막에 항상 참인 비교를 둔다.', 1);

-- Phase 1 / lookup
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'lookup', '0', 'INDEX-MATCH가 VLOOKUP보다 선호되는 핵심 이유는?',
   array['더 빠르다','조회 열이 왼쪽에 있어도 작동한다','자동 에러 처리','피벗 호환'], 1,
   'VLOOKUP은 왼→오 고정. INDEX-MATCH는 방향 제한 없고 열 삽입에 안전.', 2),
  ('excel_finance', 'lookup', '1', 'MATCH의 세 번째 인수 0의 의미는?',
   array['오름차순 근사','정확 일치','내림차순 근사','와일드카드'], 1,
   '0은 exact match. 재무 데이터에서는 거의 항상 0.', 1),
  ('excel_finance', 'lookup', '2', '특정 회사의 특정 연도 매출을 동적으로 찾을 때 쓰는 패턴은?',
   array['VLOOKUP 중첩','INDEX-MATCH-MATCH','INDIRECT','OFFSET'], 1,
   'INDEX(데이터, MATCH(행값,행헤더,0), MATCH(열값,열헤더,0)). 모델링 핵심 패턴.', 2),
  ('excel_finance', 'lookup', '3', 'XLOOKUP이 VLOOKUP보다 나은 핵심은?',
   array['더 짧은 이름','조회열 위치 제한이 없다','피벗이 필요','근사만 된다'], 1,
   '반환열을 따로 지정하므로 왼쪽 조회가 된다.', 2),
  ('excel_finance', 'lookup', '4', 'XLOOKUP에서 키가 없을 때 0을 주려면?',
   array['IFERROR만','네 번째 인수 if_not_found','FALSE','MATCH -1'], 1,
   'XLOOKUP(값, 조회, 반환, 0)처럼 if_not_found를 넣는다.', 2),
  ('excel_finance', 'lookup', '5', '이름에서 코드를 찾으려면 XLOOKUP의 조회 배열은?',
   array['코드 열','이름 열','단가 열','시트 전체'], 1,
   '찾는 값이 있는 열이 조회 배열, 주고 싶은 열이 반환 배열.', 1),
  ('excel_finance', 'lookup', '6', '재무 조회에서 XLOOKUP 기본 일치 방식은?',
   array['근사','정확 일치','와일드카드','정규식'], 1,
   '기본이 정확 일치다. 근사를 켜지 않는다.', 1),
  ('excel_finance', 'lookup', '7', '이 그리드의 VLOOKUP·XLOOKUP에서 FALSE를 쓰면?',
   array['정확 일치','#NAME?','0과 같음','TRUE'], 1,
   'FALSE는 이름이 아니다. 정확 일치는 0.', 1);

-- Phase 2 / pivot
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'pivot', '0', '일별 매출 데이터를 분기별로 묶으려면?',
   array['날짜 우클릭 → 그룹화 → 분기','QUARTER 함수로 새 열','필터에서 분기 선택','정렬 후 소계'], 0,
   '피벗 날짜 필드 우클릭 → 그룹화. 원본 데이터를 건드리지 않는다.', 1),
  ('excel_finance', 'pivot', '1', '피벗에서 매출 대비 원가 비율을 보려면?',
   array['옆 셀에 수식','Calculated Field로 =원가/매출','값 형식을 %로 변경','조건부 서식'], 1,
   'Calculated Field는 피벗 내부에서 필드 간 연산. 원본에 열을 추가하지 않아도 됨.', 2);

-- Phase 2 / data-clean
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'data-clean', '0', '같은 형식의 월별 시트 여러 개를 합치는 가장 효율적 방법?',
   array['수동 복사','INDIRECT','Power Query Append','VBA 매크로'], 2,
   'Append는 같은 구조의 테이블을 합친다. 새 시트가 추가돼도 새로고침 한 번.', 2),
  ('excel_finance', 'data-clean', '1', '" Samsung Electronics Co. " (앞뒤 공백)을 정리하려면?',
   array['CLEAN','TRIM','SUBSTITUTE(," ","")','LEFT'], 1,
   'TRIM은 앞뒤 공백 + 중간 연속 공백을 하나로. SUBSTITUTE는 단어 사이도 지운다.', 1);

-- Phase 2 / fin-fn
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'fin-fn', '0', 'NPV와 XNPV의 차이는?',
   array['할인율 정확도','NPV는 등간격, XNPV는 날짜 기반','XNPV는 음수 처리','차이 없음'], 1,
   'NPV는 1기간 간격 가정. XNPV는 날짜 기반으로 불규칙 간격도 정확히 할인.', 2),
  ('excel_finance', 'fin-fn', '1', '=PMT(0.05/12, 360, -500000000)의 의미는?',
   array['5억, 연 5%, 30년 월 상환액','5억의 5% 이자','30년 후 미래가치','월 5%로 적금'], 0,
   'PMT(월이율, 기간수, 현재가치). 대출 스케줄링에서 핵심.', 2),
  ('excel_finance', 'fin-fn', '2', '이 그리드에서 XNPV 날짜를 DATE()로 두고 참조하면?',
   array['정상 계산','#VALUE!가 날 수 있다. 일련번호를 쓴다','XIRR과 같음','0'], 1,
   'HyperFormula XNPV는 날짜 일련번호(숫자)를 기대한다. XIRR은 DATE()를 받는다.', 2),
  ('excel_finance', 'fin-fn', '3', 'IPMT가 계산하는 것은?',
   array['월 상환액 전체','해당 회차의 이자분','원금분','잔액'], 1,
   'IPMT는 이자, PPMT는 원금. 둘을 더하면 PMT에 가깝다.', 2),
  ('excel_finance', 'fin-fn', '4', '목표 금액에 도달하는 기간을 구하려면?',
   array['RATE','NPER','PV','NPV'], 1,
   'NPER(이율, 납입, pv, fv)가 기간을 역산한다.', 2),
  ('excel_finance', 'fin-fn', '5', 'PPMT의 결과는?',
   array['이자만','해당 회차 원금 상환분','남은 원금','총이자'], 1,
   'PPMT는 그 회차에 깎이는 원금.', 2),
  ('excel_finance', 'fin-fn', '6', '대출 IPMT에서 원금을 양수로 넣고 결과도 양수로 읽으면?',
   array['항상 맞다','부호 규칙이 뒤집힐 수 있다','이자가 0','NPER이 필요'], 1,
   'PMT 계열은 유출을 음수로 두는 편이 안전하다.', 2),
  ('excel_finance', 'fin-fn', '7', '월 적립 NPER의 이율은?',
   array['연 이율 그대로','연 이율/12','연 이율*12','WACC'], 1,
   '납입이 월이면 이율도 월로 맞춘다.', 2),
  ('excel_finance', 'fin-fn', '8', '날짜 간격이 다른 현금흐름의 수익률은?',
   array['IRR','XIRR','RATE','NPER'], 1,
   'IRR은 등간격. 날짜가 있으면 XIRR.', 2);

-- Phase 3 / model-structure
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'model-structure', '0', '성장률 15%를 =B5*1.15로 직접 쓰면 안 되는 이유는?',
   array['계산이 느림','가정 변경 시 모든 셀을 수정해야 함','에러 발생','서식 깨짐'], 1,
   '하드코딩은 감사 불가능 + 시나리오 변경 시 누락. Assumptions에서 참조해야.', 2),
  ('excel_finance', 'model-structure', '1', 'BS 밸런스 체크 행(자산-부채-자본=0)을 넣는 이유는?',
   array['보기 좋아서','에러를 즉시 감지하기 위해','엑셀 기능상 필수','인쇄용'], 1,
   '밸런스 안 맞으면 IS→BS→CF 연결 오류 신호. 역추적해서 버그 찾는다.', 2);

-- Phase 3 / three-stmt
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'three-stmt', '0', '간접법 CF에서 감가상각비를 순이익에 더하는 이유는?',
   array['비용이 아님','IS에서 차감됐지만 현금유출이 아니라서','BS 밸런스 맞추기','세금 절감'], 1,
   '감가상각은 IS에서 빠졌지만 현금은 Capex 시점에 나감. CF에서 복원한다.', 2),
  ('excel_finance', 'three-stmt', '1', '매출채권 증가가 영업CF에 미치는 영향은?',
   array['CF 증가','CF 감소','영향 없음','투자활동에 반영'], 1,
   '매출채권↑ = 매출 인식됐지만 현금 미수취. CF에서 차감.', 2);

-- Phase 3 / dcf-intro
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('excel_finance', 'dcf-intro', '0', 'TV가 기업가치의 60–80%를 차지한다. 이것이 의미하는 바는?',
   array['예측 기간 CF는 중요하지 않다','TV 가정에 대한 감도분석이 필수다','DCF는 신뢰할 수 없다','예측 기간을 늘려야 한다'], 1,
   'TV 비중이 크면 성장률/할인율의 작은 변화가 밸류에이션을 크게 흔든다.', 3),
  ('excel_finance', 'dcf-intro', '1', 'EV에서 Equity Value를 구하려면?',
   array['EV + 순차입금','EV - 순차입금','EV × 주식수','EV / WACC'], 1,
   'Equity = EV - Net Debt. EV는 채권자+주주 전체, 빚을 빼면 주주 몫.', 2);
