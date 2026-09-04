import type { QuizDomain } from "./quiz";

export type DomainLessonRaw = {
  title: string;
  content: string;
  key_terms: string[];
};

export type DomainLessonPayload = { lesson: DomainLessonRaw };

export const DOMAIN_LESSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["lesson"],
  properties: {
    lesson: {
      type: "object",
      additionalProperties: false,
      required: ["title", "content", "key_terms"],
      properties: {
        title: { type: "string" },
        content: { type: "string" },
        key_terms: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

export const DOMAIN_LESSON_SYSTEM = `당신은 투자은행·마켓즈 테크(IB engineering) 면접을 준비하는 소프트웨어 엔지니어의 학습 코치다.
주어진 도메인의 핵심 개념을 정리한 마이크로 레슨을 만든다. 엑셀·회계 분개는 다루지 않는다.

규칙:
- 출력 언어는 한국어다. FIX, OMS, GC, CAS 같은 업계 표준 용어는 원어를 병기한다.
- content는 500~800자 분량이다. 긴 마크다운이 아니라 단락 2~3개의 핵심 정리다.
- 주요 프로토콜이나 실패 모드가 있으면 반드시 포함한다.
- key_terms는 이 도메인에서 꼭 알아야 할 용어 8~12개를 배열로 넣는다.
- 면접에서 실제로 물어보는 수준과 범위에 맞춘다. 특정 은행 내부 시스템 이름을 지어내지 않는다.`;

const DOMAIN_DESCRIPTION: Record<QuizDomain, string> = {
  ib_eng_markets: "시장 배관 (FIX 세션, MsgType, OMS vs EMS, 주문 유형, 매칭, 시세, 드롭카피)",
  ib_eng_latency: "저지연 (GC 일시정지, 캐시 라인, busy-spin, 시계, 핫패스 할당, tail latency)",
  ib_eng_concurrency: "동시성 (happens-before, volatile, CAS, ABA, 단일 작성자, Disruptor)",
  ib_eng_data: "포지션·리스크 데이터 (격리수준, 체결 멱등, 창함수 VWAP, 대사, as-of)",
  ib_eng_systems: "거래 시스템 (kill switch, 저널 재생, 백프레셔, 이중 쓰기, 리스크 선/후)",
  ib_eng_ds: "면접 자료구조 (호가창, 가격-시간 우선, VWAP, 두 힙 중앙값, 슬라이딩 윈도우)",
};

export function buildDomainLessonPrompt(domain: QuizDomain): string {
  return `도메인: ${domain} — ${DOMAIN_DESCRIPTION[domain]}

이 도메인의 핵심 개념을 정리한 마이크로 레슨을 만들어라.
학생이 퀴즈를 풀기 전에 읽고 개념을 잡는 용도다. 엑셀·DCF는 넣지 마라.`;
}
