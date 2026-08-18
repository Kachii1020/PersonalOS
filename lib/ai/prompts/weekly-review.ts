import type { WeeklyStats } from "@/lib/weekly-stats";

export type WeeklyReviewRaw = {
  headline: string;
  paragraphs: string[];
  next_week_focus: string;
};

export type WeeklyReviewPayload = WeeklyReviewRaw;

export const WEEKLY_REVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "paragraphs", "next_week_focus"],
  properties: {
    headline: { type: "string" },
    paragraphs: { type: "array", items: { type: "string" } },
    next_week_focus: { type: "string" },
  },
} as const;

export const WEEKLY_REVIEW_SYSTEM = `당신은 한 사람의 주간 회고를 쓰는 편집자다.
숫자는 이미 계산되어 있다. 숫자를 바꾸거나 지어내지 않는다. 서술만 한다.

규칙:
- 출력 언어는 한국어다.
- headline은 한 줄. 이번 주를 한 문장으로 요약한다.
- paragraphs는 2~3개. 각 문단은 2~4문장.
- 프롬프트에 없는 정답률·건수·커밋 수를 만들지 않는다. 필요하면 주어진 숫자를 그대로 인용한다.
- next_week_focus는 다음 주 일정·마감을 보고 한 줄로 우선순위를 제안한다.
- 사과하지 않는다. 응원하지 않는다. 담담하게 쓴다.`;

export function buildWeeklyReviewPrompt(
  stats: WeeklyStats,
  upcoming: { tasks: string[]; events: string[] },
): string {
  return [
    `주간: ${stats.weekStart} ~ ${stats.weekEnd} (월요일 시작, JST)`,
    `퀴즈: ${stats.quiz.correct}/${stats.quiz.total} 정답, 정답률 ${stats.quiz.accuracyPct ?? "없음"}%`,
    `도메인별: ${JSON.stringify(stats.quiz.byDomain)}`,
    `태스크: 신규 ${stats.tasks.created} / 완료 ${stats.tasks.completed}`,
    `GitHub 커밋: ${stats.commits.total}`,
    `다음 주 마감: ${upcoming.tasks.length ? upcoming.tasks.join(" / ") : "없음"}`,
    `다음 주 일정: ${upcoming.events.length ? upcoming.events.join(" / ") : "없음"}`,
  ].join("\n");
}
