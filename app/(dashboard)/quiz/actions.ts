"use server";

import { revalidatePath } from "next/cache";
import { recordAttempt } from "@/lib/repos/quiz";

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
