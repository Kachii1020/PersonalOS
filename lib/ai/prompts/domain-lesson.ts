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

export const DOMAIN_LESSON_SYSTEM = `당신은 투자은행·퀀트 취업과 일본 취업을 준비하는 학생의 학습 코치다.
주어진 도메인의 핵심 개념을 정리한 마이크로 레슨을 만든다.

규칙:
- 출력 언어는 한국어다. 업계 표준 용어(EBITDA, WACC, P/E ratio 등)는 원어를 병기한다.
- content는 500~800자 분량이다. 긴 마크다운이 아니라 단락 2~3개의 핵심 정리다.
- 주요 공식이나 프레임워크가 있으면 반드시 포함한다.
- key_terms는 이 도메인에서 꼭 알아야 할 용어 8~12개를 배열로 넣는다.
- 면접에서 실제로 물어보는 수준과 범위에 맞춘다.`;

const DOMAIN_DESCRIPTION: Record<QuizDomain, string> = {
  ib: "투자은행 (밸류에이션, M&A, 자본구조, LBO, DCF, Comparable Analysis)",
  accounting: "회계 (3대 재무제표, 감가상각, 회계처리, 연결재무제표, 현금흐름표)",
  macro: "거시경제 (금리, 환율, 통화정책, 재정정책, GDP, 인플레이션, 중앙은행)",
  ai_ml: "머신러닝 (지도학습, 비지도학습, 딥러닝, 평가지표, 오버피팅, 모델 선택)",
  system_design: "시스템 설계 (확장성, 분산시스템, 데이터베이스, 캐싱, 로드밸런싱, 장애 대응)",
  japanese: "일본어 (비즈니스 일본어: 敬語·メール·会議表現, JLPT N1+: 文法·語彙·漢字·読解)",
};

export function buildDomainLessonPrompt(domain: QuizDomain): string {
  return `도메인: ${domain} — ${DOMAIN_DESCRIPTION[domain]}

이 도메인의 핵심 개념을 정리한 마이크로 레슨을 만들어라.
학생이 퀴즈를 풀기 전에 읽고 개념을 잡는 용도다.`;
}
