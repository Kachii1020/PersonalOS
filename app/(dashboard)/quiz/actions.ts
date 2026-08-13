"use server";

import { revalidatePath } from "next/cache";
import { recordAttempt, allDomainLessons, upsertDomainLesson } from "@/lib/repos/quiz";
import { callStructured } from "@/lib/ai/client";
import { QUIZ_DOMAINS, type QuizDomain } from "@/lib/ai/prompts/quiz";
import {
  DOMAIN_LESSON_SCHEMA,
  DOMAIN_LESSON_SYSTEM,
  buildDomainLessonPrompt,
  type DomainLessonPayload,
} from "@/lib/ai/prompts/domain-lesson";

export type AnswerResult = {
  questionId: string;
  isCorrect: boolean;
  chosenIndex: number;
} | null;

/** 채점은 서버에서 한다. 정답을 클라이언트로 내려보내면 답이 노출된다. */
export async function submitAnswer(_prev: AnswerResult, formData: FormData): Promise<AnswerResult> {
  const questionId = String(formData.get("questionId") ?? "");
  const chosenIndex = Number(formData.get("chosenIndex"));

  if (!questionId || !Number.isInteger(chosenIndex)) return null;

  const { isCorrect } = await recordAttempt(questionId, chosenIndex);
  revalidatePath("/quiz");
  return { questionId, isCorrect, chosenIndex };
}

/**
 * 아직 생성되지 않은 도메인의 마이크로 레슨을 만든다.
 * SPEC 5.5의 "quiz" 용도로 callStructured를 재사용한다 (4번째 호출 지점을 만들지 않는다).
 */
export async function generateMissingLessons(): Promise<{ generated: string[]; skipped: string[] }> {
  const existing = await allDomainLessons();
  const existingDomains = new Set(existing.map((l) => l.domain));
  const missing = QUIZ_DOMAINS.filter((d) => !existingDomains.has(d));

  if (missing.length === 0) return { generated: [], skipped: [...QUIZ_DOMAINS] };

  const generated: string[] = [];
  for (const domain of missing) {
    const result = await callStructured<DomainLessonPayload>({
      purpose: "quiz",
      system: DOMAIN_LESSON_SYSTEM,
      userMessage: buildDomainLessonPrompt(domain as QuizDomain),
      schema: DOMAIN_LESSON_SCHEMA,
      effort: "low",
      retries: 1,
    });

    await upsertDomainLesson(domain as QuizDomain, result.data.lesson);
    generated.push(domain);
  }

  revalidatePath("/quiz");
  return { generated, skipped: [...existingDomains] };
}
