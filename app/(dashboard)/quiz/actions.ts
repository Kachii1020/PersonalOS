"use server";

import { revalidatePath } from "next/cache";
import { ensureIbEngBank, recordAttempt } from "@/lib/repos/quiz";

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
 * 코드 은행(레슨 6 + 빠진 문항)을 DB에 넣는다. AI를 부르지 않는다.
 */
export async function generateMissingLessons(): Promise<
  { ok: true; questions: number; lessons: number } | { ok: false; error: string }
> {
  try {
    const inserted = await ensureIbEngBank();
    revalidatePath("/quiz");
    revalidatePath("/");
    return { ok: true, ...inserted };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "IB eng 은행 동기화 실패",
    };
  }
}
