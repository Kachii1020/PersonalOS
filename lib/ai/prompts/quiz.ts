export const QUIZ_DOMAINS = [
  "ib_eng_markets",
  "ib_eng_latency",
  "ib_eng_concurrency",
  "ib_eng_data",
  "ib_eng_systems",
  "ib_eng_ds",
] as const;
export type QuizDomain = (typeof QUIZ_DOMAINS)[number];

export type QuizQuestionRaw = {
  domain: QuizDomain;
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
  concept_hint: string;
  difficulty: number;
};

export type QuizPayload = { questions: QuizQuestionRaw[] };

/** JSON Schema는 개수 제약(minItems)을 지원하지 않는다. 개수는 프롬프트와 서버 검증으로 잡는다. */
export const QUIZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["domain", "question", "choices", "answer_index", "explanation", "concept_hint", "difficulty"],
        properties: {
          domain: { type: "string", enum: QUIZ_DOMAINS },
          question: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          answer_index: { type: "integer" },
          explanation: { type: "string" },
          concept_hint: { type: "string" },
          difficulty: { type: "integer", enum: [1, 2, 3] },
        },
      },
    },
  },
} as const;

export const QUIZ_SYSTEM = `당신은 투자은행·마켓즈 테크(IB engineering) 면접을 준비하는 소프트웨어 엔지니어의 학습 코치다.
매일 푸는 4지선다 문제를 만든다. 엑셀 모델링·DCF·회계 분개는 내지 않는다.

규칙:
- 출력 언어는 한국어다. FIX, OMS, GC, CAS, VWAP 같은 업계 표준 용어는 원어를 그대로 쓴다.
- choices는 정확히 4개다. 정답은 하나뿐이고 answer_index는 0부터 센 위치다.
- 오답 3개도 그럴듯해야 한다. 명백히 틀린 보기를 채우지 않는다.
- explanation은 정답인 이유와 대표 오답이 왜 틀렸는지를 한 문단으로 쓴다.
- difficulty는 1(개념 확인) / 2(적용) / 3(응용·함정) 중 하나다.
- concept_hint는 이 문제가 다루는 핵심 개념을 2~3문장으로 설명한다. 문제의 정답을 직접 드러내지 않는다.
- 계산 문제는 암산으로 풀 수 있는 수준까지만 낸다. 필요한 수치는 문제 안에 전부 넣는다.
- 사실관계가 불확실한 최신 통계, 특정 은행 내부 시스템 이름, 검증되지 않은 벤더 벤치마크를 묻지 않는다.
- 시드 은행과 같은 주제를 반복해도 숫자·상황·함정은 다르게 낸다.`;

/**
 * 보기 순서를 섞는다.
 *
 * 모델은 정답을 첫 번째에 두는 경향이 강하다 — 실제로 첫 실행에서 5문제 전부
 * answer_index가 0이었다. 그대로 두면 "항상 1번"으로 100점이 나온다.
 * 프롬프트로 부탁하는 것보다 서버에서 섞는 쪽이 확실하다.
 */
export function shuffleChoices(question: QuizQuestionRaw, random: () => number = Math.random): QuizQuestionRaw {
  const answer = question.choices[question.answer_index];
  if (answer === undefined) return question;

  const shuffled = [...question.choices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const atI = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = atI;
  }

  return { ...question, choices: shuffled, answer_index: shuffled.indexOf(answer) };
}

export const DOMAIN_LABEL: Record<QuizDomain, string> = {
  ib_eng_markets: "시장 배관 (FIX, OMS/EMS, 주문·체결)",
  ib_eng_latency: "저지연 (GC, 캐시, 시계, 핫패스)",
  ib_eng_concurrency: "동시성 (JMM, CAS, 단일 작성자)",
  ib_eng_data: "포지션·리스크 데이터 (SQL, 대사, 창함수)",
  ib_eng_systems: "거래 시스템 (멱등, kill switch, 저널)",
  ib_eng_ds: "면접 자료구조 (호가창, VWAP, 힙)",
};

export function domainTitle(domain: string): string {
  if (domain in DOMAIN_LABEL) return DOMAIN_LABEL[domain as QuizDomain];
  return DOMAIN_SHORT[domain] ?? domain;
}

export const DOMAIN_SHORT: Record<string, string> = {
  ib_eng_markets: "배관",
  ib_eng_latency: "저지연",
  ib_eng_concurrency: "동시성",
  ib_eng_data: "데이터",
  ib_eng_systems: "시스템",
  ib_eng_ds: "자료구조",
  ib: "IB",
  accounting: "회계",
  macro: "거시",
  ai_ml: "ML",
  system_design: "설계",
  japanese: "日本語",
  devops: "DevOps",
  ai_engineering: "AI Eng",
  excel_finance: "엑셀",
};

/**
 * 요청 문항 수와 도메인 구성을 지정한다.
 * G2 조건이 "도메인 2개 이상"을 요구하므로 최소 2개 도메인을 명시적으로 요구한다.
 */
export function buildQuizPrompt(count: number, avoid: string[]): string {
  const domains = QUIZ_DOMAINS.map((d) => `- ${d}: ${DOMAIN_LABEL[d]}`).join("\n");
  const avoidBlock =
    avoid.length > 0
      ? `\n\n최근에 낸 문제다. 같은 것을 다시 내지 마라.\n${avoid.map((q) => `- ${q}`).join("\n")}`
      : "";

  return `문제를 정확히 ${count}개 만들어라. 서로 다른 도메인이 최소 2개는 섞여야 한다.
엑셀·회계 분개·DCF는 금지. IB engineering(마켓즈 테크)만.

도메인:
${domains}${avoidBlock}`;
}
