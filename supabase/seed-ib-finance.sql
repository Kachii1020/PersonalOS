-- Seed: IB & Finance Fundamentals
-- 0012_learn_module.sql 이후. 기존 Learn 퀴즈 행은 건드리지 않는다.
-- concept_hint = 모듈 안 문항 순번 ('0'..).

-- ============ Track ============
insert into learn_tracks (slug, title, description, position) values
  ('ib-finance', 'IB & Finance Fundamentals',
   'iAgora JD 16개 기반 IB/Finance 인턴 준비 커리큘럼. 30卒 지원 시점(2028 봄)까지 ~18개월 로드맵.',
   2);

-- ============ Phases ============
insert into learn_phases (track_id, phase_number, title, description, weeks_label, position) values
  ((select id from learn_tracks where slug = 'ib-finance'), 1,
   '기초 체력', '회계와 엑셀 모델링', '1-8주차', 1),
  ((select id from learn_tracks where slug = 'ib-finance'), 2,
   '밸류에이션 & 시장', 'DCF/Comps와 시장 지식', '9-16주차', 2),
  ((select id from learn_tracks where slug = 'ib-finance'), 3,
   '기술 스택 확장', 'Python 금융 데이터와 VBA', '17-24주차', 3);

-- ============ Modules ============
insert into learn_modules (phase_id, slug, title, concepts, position) values
  ((select id from learn_phases where phase_number = 1 and track_id = (select id from learn_tracks where slug = 'ib-finance')),
   'accounting', 'Accounting 기초 → 3-Statement Model',
   array[
     '[concept] 복식부기 원리 — 차변/대변 구조 | 簿記3級 교재 (TAC)',
     '[concept] Income Statement — Revenue → COGS → Gross Profit → EBIT → Net Income | Damodaran Session 2',
     '[concept] Balance Sheet — Assets = Liabilities + Equity | Damodaran Session 3',
     '[concept] Cash Flow Statement — Operating / Investing / Financing 구분 | Damodaran Session 4',
     '[concept] Revenue recognition, accrual vs. cash basis | Coursera UVA Financial Accounting',
     '[concept] Working capital — AR, AP, Inventory, cash conversion cycle | Damodaran Session 5',
     '[practice] 3-statement 연결 — Net Income → CF, CapEx → BS, D&A → CF/IS | CFI 3-Statement Model Course',
     '[practice] 일본 기업 재무제표 읽기 — EDINET 유가증권보고서 (売上高/営業利益/減価償却費) | EDINET 실습',
     '[project] 실제 기업 3-statement model 처음부터 만들기 (Excel) | WSP 3-Statement Tutorial'
   ],
   0),
  ((select id from learn_phases where phase_number = 1 and track_id = (select id from learn_tracks where slug = 'ib-finance')),
   'excel-modeling', 'Excel Modeling',
   array[
     '[concept] VLOOKUP/XLOOKUP, INDEX-MATCH 완전 숙달 | CFI Excel Crash Course',
     '[concept] SUMIFS, COUNTIFS, AVERAGEIFS 조건부 함수 | CFI Excel Crash Course',
     '[concept] OFFSET, INDIRECT — 동적 범위 참조 | WSP Excel Best Practices',
     '[concept] 모델 구조 컨벤션 — input 파란색, 수식 검정, 하드코딩 분리, 탭 구조 | Macquarie Financial Modeling Guide',
     '[practice] Data Table (1-way, 2-way) — sensitivity analysis | WSP Sensitivity Analysis',
     '[practice] 키보드 단축키 50개 — Ctrl+Shift+End, Alt+=, F2, F4 등 | WSP Shortcuts Cheat Sheet',
     '[practice] 차트, 대시보드, conditional formatting | 실습',
     '[project] 완성된 3-statement model에 sensitivity + scenario 추가 | 직접 제작'
   ],
   1);

insert into learn_modules (phase_id, slug, title, concepts, position) values
  ((select id from learn_phases where phase_number = 2 and track_id = (select id from learn_tracks where slug = 'ib-finance')),
   'valuation', 'DCF / Comps Valuation',
   array[
     '[concept] DCF 프레임워크 — FCFF/FCFE, projection period, terminal value | Damodaran Valuation (Session 12-15)',
     '[concept] WACC 계산 — Cost of Equity (CAPM), Cost of Debt, capital structure weights | Damodaran Session 7-8',
     '[concept] Terminal Value — perpetuity growth method vs. exit multiple method | Rosenbaum & Pearl Ch. 3',
     '[concept] Comparable Company Analysis — EV/EBITDA, P/E, EV/Revenue | Rosenbaum & Pearl Ch. 1',
     '[concept] Precedent Transactions — deal premium, synergy 반영 | Rosenbaum & Pearl Ch. 2',
     '[concept] Enterprise Value vs. Equity Value bridge | Damodaran Session 9',
     '[concept] LBO 기초 — leverage, debt paydown, IRR/MOIC 계산 | WSP LBO Modeling',
     '[practice] Football field chart — 밸류에이션 결과 시각적 요약 | 실습',
     '[project] 일본 상장기업 1개 full DCF + Comps 모델 | 직접 제작'
   ],
   0),
  ((select id from learn_phases where phase_number = 2 and track_id = (select id from learn_tracks where slug = 'ib-finance')),
   'markets', '시장 지식 (Market Literacy)',
   array[
     '[concept] 매크로 지표 — GDP, CPI, PMI, 실업률, BOJ/Fed 금리 정책 | FT / Nikkei',
     '[concept] 자산 클래스 — Equities, Fixed Income, FX, Commodities 가격 결정 요인 | CFA Level 1 교재 요약',
     '[concept] 일본 시장 — 東証 구분(プライム/スタンダード/グロース), 決算 시즌, 거버넌스 개혁 | 日経 + JPX',
     '[concept] 채권 기초 — yield, duration, credit spread, yield curve | Damodaran Bond Valuation',
     '[concept] Derivatives 기초 — Forward, Future, Option, Swap 구조와 용도 | Hull Options Ch.1-5',
     '[concept] Structured Products — ELN, CLN, Auto-callable 기본 구조 | SocGen JD 기반',
     '[practice] 일일 루틴: 아침 시장 브리프 읽기 + 주 1회 시장 코멘트 작성 | 습관 형성'
   ],
   1);

insert into learn_modules (phase_id, slug, title, concepts, position) values
  ((select id from learn_phases where phase_number = 3 and track_id = (select id from learn_tracks where slug = 'ib-finance')),
   'python-fin', 'Python 금융 데이터 분석',
   array[
     '[concept] pandas — DataFrame 조작, groupby, merge, pivot_table | pandas 공식 튜토리얼',
     '[concept] numpy — 배열 연산, 선형대수 기초 함수 | numpy quickstart',
     '[concept] SQL 기초 — SELECT, JOIN, GROUP BY, subquery | Mode Analytics SQL Tutorial',
     '[practice] yfinance — 주가 데이터 수집, OHLCV, 재무제표 API | yfinance docs',
     '[practice] matplotlib/plotly — 주가 차트, 수익률 분포, 상관관계 히트맵 | 실습',
     '[practice] 포트폴리오 분석 — 수익률 계산, Sharpe ratio, 효율적 프론티어 | 실습',
     '[practice] openpyxl/xlsxwriter — Excel 리포트 자동 생성 | 실습',
     '[project] 일본 섹터별 주가 분석 대시보드 구축 | 직접 제작'
   ],
   0),
  ((select id from learn_phases where phase_number = 3 and track_id = (select id from learn_tracks where slug = 'ib-finance')),
   'vba', 'VBA 기초',
   array[
     '[concept] VBA 에디터 사용법, Sub/Function, 변수 선언 | Walkenbach Excel VBA Programming',
     '[concept] Range, Cells, Worksheet 객체 조작 | 같은 교재 Ch. 5-7',
     '[concept] Loop (For, Do While), 조건문 (If/Select Case) | 같은 교재 Ch. 8-9',
     '[practice] UserForm — 간단한 입력 폼 만들기 | 실습',
     '[project] 매크로로 데이터 정리 + 리포트 자동 생성 | 직접 제작'
   ],
   1);

-- ============ Quiz (domain = ib_finance) ============
insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('ib_finance', 'accounting', '0',
   $q$감가상각비(D&A)가 증가하면 세 개 재무제표에 미치는 영향은?$q$,
   array[
     $c$IS: 비용 증가 → 순이익 감소 / BS: 고정자산 감소, 이익잉여금 감소 / CF: 영업현금흐름 증가 (비현금 비용 가산)$c$,
     $c$IS: 비용 증가 / BS: 변동 없음 / CF: 변동 없음$c$,
     $c$IS: 변동 없음 / BS: 고정자산 감소 / CF: 투자현금흐름 감소$c$,
     $c$IS: 비용 증가 / BS: 고정자산 감소 / CF: 영업현금흐름 감소$c$
   ], 0,
   $e$D&A는 비현금 비용이라 IS에서 순이익을 줄이고 BS에서 자산 장부가를 감소시키지만, CF에서는 영업활동 현금흐름에 다시 가산된다. 이것이 3-statement 연결의 핵심 메커니즘.$e$,
   2),
  ('ib_finance', 'accounting', '1',
   $q$매출채권(AR)이 전년 대비 크게 증가했을 때 가장 직접적인 영향은?$q$,
   array[
     $c$영업현금흐름 감소 (현금 미회수 매출 증가)$c$,
     $c$순이익 감소$c$,
     $c$총자산 감소$c$,
     $c$영업이익 증가$c$
   ], 0,
   $e$AR 증가는 매출은 인식했지만 현금을 아직 받지 못했다는 뜻. IS의 순이익에는 이미 반영되어 있으나, CF에서 운전자본 변동(AR 증가분)만큼 영업현금흐름이 줄어든다.$e$,
   2),
  ('ib_finance', 'accounting', '2',
   $q$Accrual basis 회계에서, 12월에 선수금(advance payment)을 받고 서비스는 1월에 제공할 예정일 때 12월 재무제표 처리는?$q$,
   array[
     $c$BS: 현금 증가 + 선수수익(부채) 증가 / IS: 매출 인식 안 함$c$,
     $c$IS: 12월에 매출 인식 / BS: 현금 증가 + 이익잉여금 증가$c$,
     $c$BS: 현금 증가 + 매출채권 증가$c$,
     $c$IS: 12월에 비용 인식 / BS: 변동 없음$c$
   ], 0,
   $e$발생주의(accrual basis)에서는 서비스 제공 시점에 매출을 인식한다. 현금을 먼저 받았으므로 BS에 현금(자산)과 선수수익(부채)이 동시에 증가하고, 매출은 1월에 인식한다.$e$,
   2),
  ('ib_finance', 'accounting', '3',
   $q$다음 중 Cash Flow Statement의 투자활동(Investing Activities)에 해당하는 항목은?$q$,
   array[
     $c$설비 구매 대금 지출 (CapEx)$c$,
     $c$은행 차입금 상환$c$,
     $c$배당금 지급$c$,
     $c$매입채무 증가$c$
   ], 0,
   $e$CapEx는 투자활동. 차입금 상환과 배당금 지급은 재무활동(Financing). 매입채무 변동은 영업활동(Operating)의 운전자본 항목.$e$,
   1),
  ('ib_finance', 'accounting', '4',
   $q$일본 기업의 유가증권보고서에서 '営業利益'에 해당하는 영문 재무제표 항목은?$q$,
   array[
     $c$Operating Income (EBIT)$c$,
     $c$Gross Profit$c$,
     $c$Net Income$c$,
     $c$EBITDA$c$
   ], 0,
   $e$営業利益는 매출총이익에서 판관비(販売費及び一般管理費)를 차감한 영업이익으로, 영문으로는 Operating Income에 해당한다. 단, 일본 기준에서는 영업외수익/비용이 별도로 표시되므로 US GAAP의 EBIT과 완전히 동일하지는 않다.$e$,
   1);

insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('ib_finance', 'excel-modeling', '0',
   $q$Excel financial model에서 input cell과 formula cell을 구분하는 표준 컨벤션은?$q$,
   array[
     $c$Input: 파란색 폰트, Formula: 검정색 폰트$c$,
     $c$Input: 굵게(bold), Formula: 일반$c$,
     $c$Input: 빨간색 배경, Formula: 흰색 배경$c$,
     $c$구분하지 않고 모두 같은 서식 사용$c$
   ], 0,
   $e$금융업계 표준 모델링 컨벤션에서 하드코딩된 input은 파란색 폰트, 다른 셀을 참조하는 formula는 검정색 폰트로 표시한다. 이를 통해 모델 감사(audit) 시 어떤 셀이 가정치이고 어떤 셀이 계산값인지 즉시 파악할 수 있다.$e$,
   1),
  ('ib_finance', 'excel-modeling', '1',
   $q$2-way Data Table (sensitivity analysis)에서 행 입력 셀과 열 입력 셀을 올바르게 설정하는 방법은?$q$,
   array[
     $c$테이블 좌상단 셀에 결과 수식을 넣고, 행 변수를 열 방향(상단), 열 변수를 행 방향(좌측)에 배치$c$,
     $c$행 변수와 열 변수 모두 상단에 배치$c$,
     $c$결과 수식은 테이블 외부에 두고 INDIRECT로 참조$c$,
     $c$Data Table 대신 반복 IF 함수로 구현$c$
   ], 0,
   $e$Excel Data Table은 좌상단 코너 셀에 결과 수식(예: NPV)이 위치하고, 첫 행(상단)에 한 변수의 값 범위, 첫 열(좌측)에 다른 변수의 값 범위를 나열한다. What-If Analysis > Data Table에서 행/열 입력 셀을 각각 지정하면 자동으로 모든 조합이 계산된다.$e$,
   2),
  ('ib_finance', 'excel-modeling', '2',
   $q$INDEX-MATCH가 VLOOKUP보다 financial modeling에서 선호되는 가장 큰 이유는?$q$,
   array[
     $c$조회 열이 참조 범위의 첫 열일 필요가 없고, 열 삽입/삭제에도 깨지지 않는다$c$,
     $c$계산 속도가 항상 더 빠르다$c$,
     $c$에러 처리가 자동으로 된다$c$,
     $c$대소문자를 구분해서 검색한다$c$
   ], 0,
   $e$VLOOKUP은 검색 키가 반드시 범위의 첫 열에 있어야 하고, col_index_num이 하드코딩이라 열을 삽입/삭제하면 잘못된 열을 반환한다. INDEX-MATCH는 이 두 제약이 없어서 모델 구조 변경에 강하다.$e$,
   1),
  ('ib_finance', 'excel-modeling', '3',
   $q$Financial model에서 circular reference가 발생하는 대표적 상황과 해결 방법은?$q$,
   array[
     $c$이자비용이 부채 잔액에 의존하고, 부채 잔액이 현금흐름(이자비용 포함)에 의존할 때 / iterative calculation 활성화 또는 circuit breaker 셀 사용$c$,
     $c$SUM 함수가 자기 자신을 포함할 때 / 범위를 수정$c$,
     $c$IF 함수가 무한 루프에 빠질 때 / VBA 매크로로 대체$c$,
     $c$외부 파일 참조가 끊어졌을 때 / 링크 업데이트$c$
   ], 0,
   $e$3-statement model에서 이자비용 → 순이익 → 현금흐름 → 부채 상환/차입 → 부채 잔액 → 이자비용 순환이 대표적 circular reference. Excel의 Iterative Calculation을 켜거나, 순환을 끊는 toggle 셀(circuit breaker)을 두어 디버깅 시 순환을 끌 수 있게 한다.$e$,
   3),
  ('ib_finance', 'excel-modeling', '4',
   $q$Excel에서 F4 키의 기능은?$q$,
   array[
     $c$셀 참조의 절대/상대 전환 ($A$1 ↔ A$1 ↔ $A1 ↔ A1)$c$,
     $c$선택한 셀 삭제$c$,
     $c$수식 감사(audit) 모드 전환$c$,
     $c$마지막 동작 반복$c$
   ], 0,
   $e$수식 입력 중 F4를 누르면 참조 타입이 순환한다 ($A$1 → A$1 → $A1 → A1). 수식 입력 모드가 아닌 상태에서 F4는 마지막 동작을 반복하는데, 이 문제는 수식 편집 중(F2 후) 상황을 묻고 있다.$e$,
   1);

insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('ib_finance', 'valuation', '0',
   $q$DCF에서 WACC를 할인율로 사용할 때, 할인 대상 현금흐름은?$q$,
   array[
     $c$FCFF (Free Cash Flow to Firm) — 부채와 자기자본 투자자 모두에게 귀속되는 현금흐름$c$,
     $c$FCFE (Free Cash Flow to Equity) — 자기자본 투자자에게만 귀속되는 현금흐름$c$,
     $c$EBITDA$c$,
     $c$Net Income$c$
   ], 0,
   $e$WACC는 부채와 자기자본의 가중평균 비용이므로, 양쪽 투자자 모두에게 귀속되는 FCFF를 할인한다. FCFE를 할인할 때는 Cost of Equity만 사용한다. EBITDA와 Net Income은 현금흐름이 아니라 회계 이익 지표.$e$,
   2),
  ('ib_finance', 'valuation', '1',
   $q$Terminal Value를 perpetuity growth method로 계산할 때 공식은?$q$,
   array[
     $c$FCF × (1 + g) / (WACC - g)$c$,
     $c$FCF × g / WACC$c$,
     $c$FCF / (1 + WACC)$c$,
     $c$FCF × WACC / (1 - g)$c$
   ], 0,
   $e$Gordon Growth Model 적용. 마지막 projection year의 FCF에 (1+g)를 곱해 다음 해 FCF를 구하고, (WACC - g)로 나눈다. g는 장기 성장률로 보통 GDP 성장률 수준(2-3%)을 사용한다.$e$,
   2),
  ('ib_finance', 'valuation', '2',
   $q$Enterprise Value (EV)에서 Equity Value로 전환하는 bridge에서 빼야 하는 항목은?$q$,
   array[
     $c$순부채 (총 유이자부채 - 현금 및 현금성 자산)$c$,
     $c$매출원가$c$,
     $c$영업이익$c$,
     $c$감가상각비$c$
   ], 0,
   $e$EV = Equity Value + Net Debt. 따라서 Equity Value = EV - Net Debt. Net Debt = 총 유이자부채(단기+장기) + 우선주 + 소수지분 - 현금 및 현금성자산. 비유이자 부채(매입채무 등)는 Net Debt에 포함하지 않는다.$e$,
   2),
  ('ib_finance', 'valuation', '3',
   $q$Comparable Company Analysis에서 EV/EBITDA 멀티플을 사용하는 이유로 적절하지 않은 것은?$q$,
   array[
     $c$자본구조(부채 비율)의 차이를 반영하기 위해$c$,
     $c$감가상각 정책 차이의 영향을 제거하기 위해$c$,
     $c$세율 차이의 영향을 줄이기 위해$c$,
     $c$P/E 대비 적자 기업에도 적용 가능하기 때문에$c$
   ], 0,
   $e$EV/EBITDA는 자본구조의 차이를 '제거'하기 위해 사용하는 멀티플이지, '반영'하기 위한 것이 아니다. EV는 부채와 자기자본을 합한 기업 전체 가치이고, EBITDA는 이자/세금/감가상각 전 이익이므로 자본구조, 세율, 감가상각 정책 차이를 중립화한다.$e$,
   3),
  ('ib_finance', 'valuation', '4',
   $q$LBO 모델에서 투자자의 수익률을 측정하는 핵심 지표 2개는?$q$,
   array[
     $c$IRR (Internal Rate of Return)과 MOIC (Multiple on Invested Capital)$c$,
     $c$ROE와 ROA$c$,
     $c$EPS와 BPS$c$,
     $c$WACC와 Cost of Equity$c$
   ], 0,
   $e$IRR은 투자 기간 동안의 연환산 수익률, MOIC는 투자원금 대비 회수 배수. PE 펀드는 보통 5년 내 IRR 20%+, MOIC 2.0x+ 를 목표로 한다. ROE/ROA는 기업의 수익성 지표이고, WACC/CoE는 할인율이지 수익률 측정 도구가 아니다.$e$,
   2);

insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('ib_finance', 'markets', '0',
   $q$BOJ가 기준금리를 인상했을 때, 일반적으로 예상되는 엔화(JPY)와 일본 국채 가격의 반응은?$q$,
   array[
     $c$엔화 강세, 국채 가격 하락$c$,
     $c$엔화 약세, 국채 가격 상승$c$,
     $c$엔화 강세, 국채 가격 상승$c$,
     $c$엔화 약세, 국채 가격 하락$c$
   ], 0,
   $e$금리 인상 → 일본 자산의 상대적 수익률 상승 → 엔화 수요 증가 → 엔화 강세. 동시에 금리 상승 → 기존 채권의 상대적 매력 감소 → 국채 가격 하락 (채권 가격과 금리는 역의 관계).$e$,
   2),
  ('ib_finance', 'markets', '1',
   $q$Yield curve가 역전(inverted)되었다는 것은 무엇을 의미하는가?$q$,
   array[
     $c$단기 국채 금리가 장기 국채 금리보다 높은 상태로, 경기 침체 신호로 해석되는 경우가 많다$c$,
     $c$장기 국채 금리가 단기보다 훨씬 높아 가파른 상태$c$,
     $c$모든 만기의 금리가 동일한 수준$c$,
     $c$국채 금리가 회사채 금리보다 높은 상태$c$
   ], 0,
   $e$정상적인 yield curve는 장기 > 단기(기간 프리미엄). 역전은 시장이 향후 금리 인하(=경기 둔화)를 예상한다는 신호로, 역사적으로 미국 경기 침체에 선행하는 지표로 주목받아 왔다.$e$,
   2),
  ('ib_finance', 'markets', '2',
   $q$Auto-callable (Autocall) structured product의 기본 구조는?$q$,
   array[
     $c$기초자산 가격이 정기 관찰일에 특정 수준(barrier) 이상이면 자동 조기 상환되고, 쿠폰을 지급하는 구조$c$,
     $c$만기까지 무조건 보유해야 하는 채권$c$,
     $c$기초자산을 직접 매수하는 펀드$c$,
     $c$금리 변동에 따라 수익이 결정되는 스왑$c$
   ], 0,
   $e$Autocall은 정기적(보통 분기/반기) 관찰일마다 기초자산(주가지수, 개별주 등) 가격이 행사 수준 이상이면 원금+쿠폰을 조기 상환한다. 관찰일에 조건 미충족 시 다음 관찰일로 넘어가고, 만기까지 knock-in barrier를 하회하면 원금 손실이 발생할 수 있다. SocGen Tokyo JD에서 명시적으로 다루는 상품.$e$,
   3),
  ('ib_finance', 'markets', '3',
   $q$東京証券取引所의 프라임(Prime) 시장 상장 유지 기준 중 유통주식 시가총액의 최소 요건은?$q$,
   array[
     $c$100억 엔$c$,
     $c$10억 엔$c$,
     $c$1000억 엔$c$,
     $c$50억 엔$c$
   ], 0,
   $e$2022년 시장 재편 이후 프라임 시장은 유통주식 시가총액 100억 엔 이상을 상장 유지 기준으로 요구한다. 이 기준 미달 기업에는 개선 계획 제출 의무가 부여되며, 일본 기업 거버넌스 개혁의 핵심 동인 중 하나.$e$,
   2),
  ('ib_finance', 'markets', '4',
   $q$Credit spread가 확대(widening)된다는 것은 어떤 시장 상황을 나타내는가?$q$,
   array[
     $c$회사채와 국채 간 금리 차이가 커지고 있으며, 신용 위험에 대한 시장의 우려가 높아지고 있다$c$,
     $c$금리가 전반적으로 하락하고 있다$c$,
     $c$주식 시장이 상승하고 있다$c$,
     $c$환율이 안정되고 있다$c$
   ], 0,
   $e$Credit spread = 회사채 금리 - 무위험금리(국채). 스프레드 확대는 기업 디폴트 위험에 대한 보상을 더 요구한다는 뜻으로, 경기 둔화, 금융 스트레스 시기에 나타난다. 2008년 금융위기, 2020년 코로나 초기에 급격히 확대된 사례가 있다.$e$,
   2);

insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('ib_finance', 'python-fin', '0',
   $q$pandas에서 두 DataFrame을 공통 열 기준으로 결합할 때, SQL의 LEFT JOIN과 동일한 동작을 하는 파라미터는?$q$,
   array[
     $c$pd.merge(df1, df2, on='key', how='left')$c$,
     $c$pd.merge(df1, df2, on='key', how='inner')$c$,
     $c$pd.concat([df1, df2], axis=1)$c$,
     $c$df1.join(df2)  # 인덱스 기준$c$
   ], 0,
   $e$pd.merge의 how='left'는 왼쪽 DataFrame의 모든 행을 유지하고 오른쪽에서 매칭되는 행을 결합한다. how='inner'는 양쪽 모두에 존재하는 키만 반환. concat은 단순 연결이고, join은 기본적으로 인덱스 기준이라 별도 설정이 필요하다.$e$,
   1),
  ('ib_finance', 'python-fin', '1',
   $q$yfinance로 가져온 일별 종가 데이터에서 일간 수익률을 계산하는 가장 적절한 pandas 메서드는?$q$,
   array[
     $c$df['Close'].pct_change()$c$,
     $c$df['Close'].diff()$c$,
     $c$df['Close'].rolling(2).mean()$c$,
     $c$df['Close'].shift(1)$c$
   ], 0,
   $e$pct_change()는 (현재값 - 이전값) / 이전값 을 계산해 백분율 변화율을 반환한다. diff()는 절대 차이, rolling().mean()은 이동 평균, shift()는 단순 시차. 금융에서 일간 수익률은 로그 수익률(np.log)을 쓰는 경우도 있지만, 산술 수익률로는 pct_change()가 표준.$e$,
   1),
  ('ib_finance', 'python-fin', '2',
   $q$Sharpe Ratio의 계산식과 해석으로 올바른 것은?$q$,
   array[
     $c$(포트폴리오 수익률 - 무위험 수익률) / 포트폴리오 수익률의 표준편차. 위험 단위당 초과 수익을 측정$c$,
     $c$포트폴리오 수익률 / 포트폴리오 변동성. 절대 수익을 측정$c$,
     $c$(포트폴리오 수익률 - 벤치마크 수익률) / 추적오차. 상대 성과를 측정$c$,
     $c$포트폴리오 베타 × 시장 수익률. 체계적 위험을 측정$c$
   ], 0,
   $e$Sharpe Ratio = (Rp - Rf) / σp. 무위험 수익률 대비 초과 수익을 변동성(표준편차)으로 나눈 것으로, 위험 조정 수익률의 표준 지표. 보기 c는 Information Ratio, d는 CAPM 관련 계산.$e$,
   2),
  ('ib_finance', 'python-fin', '3',
   $q$pandas에서 대용량 CSV를 메모리 효율적으로 읽는 방법은?$q$,
   array[
     $c$pd.read_csv('file.csv', chunksize=10000)으로 청크 단위 반복 처리$c$,
     $c$pd.read_csv('file.csv', nrows=10000)으로 앞부분만 읽기$c$,
     $c$csv 모듈로 한 줄씩 읽기$c$,
     $c$파일을 Excel로 변환 후 pd.read_excel 사용$c$
   ], 0,
   $e$chunksize 파라미터를 지정하면 TextFileReader 객체가 반환되고, for 루프로 청크별 처리가 가능하다. nrows는 처음 N행만 읽어서 전체 처리가 안 되고, csv 모듈은 DataFrame 기능이 없다. Excel 변환은 오히려 메모리를 더 쓴다.$e$,
   2),
  ('ib_finance', 'python-fin', '4',
   $q$SQL에서 GROUP BY와 함께 사용할 수 없는 것은?$q$,
   array[
     $c$SELECT 절에 GROUP BY에 포함되지 않은 비집계 열을 넣는 것$c$,
     $c$HAVING 절로 집계 결과 필터링$c$,
     $c$COUNT, SUM, AVG 등 집계 함수 사용$c$,
     $c$ORDER BY로 결과 정렬$c$
   ], 0,
   $e$GROUP BY 사용 시 SELECT에 올 수 있는 열은 GROUP BY에 포함된 열이거나 집계 함수로 감싼 열뿐이다. 비집계 열을 그냥 넣으면 어떤 행의 값을 반환할지 모호해지므로 대부분의 RDBMS에서 에러가 발생한다 (MySQL의 일부 모드 제외).$e$,
   1);

insert into quiz_questions (domain, module_slug, concept_hint, question, choices, answer_index, explanation, difficulty) values
  ('ib_finance', 'vba', '0',
   $q$VBA에서 Range("A1:A10")의 각 셀에 순서대로 1~10을 넣는 올바른 코드는?$q$,
   array[
     $c$For i = 1 To 10: Cells(i, 1).Value = i: Next i$c$,
     $c$Range("A1:A10").Value = 10$c$,
     $c$For i = 1 To 10: Range(i).Value = i: Next i$c$,
     $c$Cells(1, 1).Value = "1:10"$c$
   ], 0,
   $e$Cells(row, col) 형식으로 개별 셀에 접근하고 For 루프로 반복한다. Range(i)는 유효한 참조가 아니고, Range 전체에 스칼라를 대입하면 모든 셀에 같은 값이 들어간다.$e$,
   1),
  ('ib_finance', 'vba', '1',
   $q$VBA Sub 프로시저와 Function 프로시저의 차이는?$q$,
   array[
     $c$Function은 값을 반환할 수 있고 워크시트 수식에서 호출 가능, Sub는 값을 반환하지 않고 매크로로 실행$c$,
     $c$Sub가 Function보다 실행 속도가 빠르다$c$,
     $c$Function은 셀을 수정할 수 없다$c$,
     $c$차이 없이 호환 사용 가능$c$
   ], 0,
   $e$Function은 반환값이 있어 = MyFunction(A1) 형태로 셀 수식에서 사용 가능하다. Sub는 반환값 없이 동작을 수행하며 매크로 버튼, 단축키, 이벤트로 실행한다. Function에서도 셀 수정은 기술적으로 가능하지만 워크시트 수식 호출 시에는 제한된다.$e$,
   1),
  ('ib_finance', 'vba', '2',
   $q$VBA에서 현재 워크시트의 마지막 데이터가 있는 행 번호를 구하는 관용적 방법은?$q$,
   array[
     $c$Cells(Rows.Count, 1).End(xlUp).Row$c$,
     $c$Range("A1").End(xlDown).Row$c$,
     $c$ActiveSheet.UsedRange.Rows.Count$c$,
     $c$Range("A65536").Row$c$
   ], 0,
   $e$Cells(Rows.Count, 1).End(xlUp).Row는 시트 맨 아래에서 위로 올라가며 첫 데이터 셀을 찾으므로 중간에 빈 행이 있어도 정확하다. End(xlDown)은 첫 빈 행에서 멈추고, UsedRange는 서식만 있는 셀도 포함하므로 부정확할 수 있다.$e$,
   2),
  ('ib_finance', 'vba', '3',
   $q$VBA에서 에러가 발생해도 코드 실행을 계속하게 하는 구문은?$q$,
   array[
     $c$On Error Resume Next$c$,
     $c$On Error GoTo 0$c$,
     $c$Try...Catch$c$,
     $c$If Err.Number Then$c$
   ], 0,
   $e$On Error Resume Next는 에러 발생 시 다음 줄로 넘어간다 (에러를 삼킨다). On Error GoTo 0은 기본 에러 처리로 복원. VBA에는 Try...Catch가 없다 (Python/Java 문법). 실무에서는 Resume Next 후 Err.Number를 체크해 특정 에러만 처리하는 패턴을 쓴다.$e$,
   1),
  ('ib_finance', 'vba', '4',
   $q$Excel VBA 매크로가 포함된 파일의 확장자는?$q$,
   array[
     $c$.xlsm$c$,
     $c$.xlsx$c$,
     $c$.xls$c$,
     $c$.xlsb$c$
   ], 0,
   $e$.xlsx는 매크로를 포함할 수 없는 포맷. 매크로를 저장하려면 .xlsm (Macro-Enabled Workbook)으로 저장해야 한다. .xls는 레거시(97-2003) 포맷으로 매크로 포함 가능하지만 현재 표준은 아니다. .xlsb는 바이너리 포맷으로 매크로 포함 가능하지만 일반적이지 않다.$e$,
   1);
