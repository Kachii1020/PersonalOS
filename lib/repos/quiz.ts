import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { QuizDomain, QuizQuestionRaw } from "@/lib/ai/prompts/quiz";
import { addDays, todayStart, ymd } from "@/lib/time";

export type QuizQuestion = {
  id: string;
  domain: QuizDomain;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  difficulty: number;
  /** 복습 큐에서 올라온 문항인지. UI가 "복습" 배지를 붙인다. */
  isReview: boolean;
};

type QuestionSelect = {
  id: string;
  domain: string;
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string;
  difficulty: number;
};

function toQuestion(row: QuestionSelect, isReview: boolean): QuizQuestion {
  return {
    id: row.id,
    domain: row.domain as QuizDomain,
    question: row.question,
    choices: row.choices,
    answerIndex: row.answer_index,
    explanation: row.explanation,
    difficulty: row.difficulty,
    isReview,
  };
}

const FIELDS = "id, domain, question, choices, answer_index, explanation, difficulty";

/** 잡 전용. 오늘까지 복습 예정인 문항 id. 중복은 제거한다. */
export async function dueReviewQuestionIdsForJob(now: Date = new Date()): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quiz_review_queue")
    .select("question_id")
    .lte("due_on", ymd(now));

  if (error) throw new Error(`복습 큐 조회 실패: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.question_id))];
}

/** 잡 전용. 같은 문제를 다시 내지 않도록 최근 문항 텍스트를 넘긴다. */
export async function recentQuestionTextsForJob(limit = 30): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("question")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`최근 문항 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => r.question);
}

export async function insertQuizQuestions(questions: QuizQuestionRaw[]): Promise<number> {
  if (questions.length === 0) return 0;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .insert(
      questions.map((q) => ({
        domain: q.domain,
        question: q.question,
        choices: q.choices,
        answer_index: q.answer_index,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
    )
    .select("id");

  if (error) throw new Error(`퀴즈 저장 실패: ${error.message}`);
  return data?.length ?? 0;
}

/**
 * 오늘의 퀴즈 (UI용).
 *
 * 복습 예정 문항을 먼저 채우고 모자란 만큼 최신 문항으로 채운다
 * (G2 조건: 오늘 날짜의 복습 문항이 오늘의 퀴즈에 우선 편입).
 */
export async function todaysQuiz(size = 5, now: Date = new Date()): Promise<QuizQuestion[]> {
  const supabase = await createClient();

  const { data: dueRows, error: dueError } = await supabase
    .from("quiz_review_queue")
    .select("question_id")
    .lte("due_on", ymd(now));
  if (dueError) throw new Error(`복습 큐 조회 실패: ${dueError.message}`);

  const dueIds = [...new Set((dueRows ?? []).map((r) => r.question_id))].slice(0, size);

  const review: QuizQuestion[] = [];
  if (dueIds.length > 0) {
    const { data, error } = await supabase.from("quiz_questions").select(FIELDS).in("id", dueIds);
    if (error) throw new Error(`복습 문항 조회 실패: ${error.message}`);
    review.push(...(data ?? []).map((r) => toQuestion(r, true)));
  }

  if (review.length >= size) return review.slice(0, size);

  const { data: fresh, error } = await supabase
    .from("quiz_questions")
    .select(FIELDS)
    .order("created_at", { ascending: false })
    .limit(size * 3);
  if (error) throw new Error(`퀴즈 조회 실패: ${error.message}`);

  const seen = new Set(review.map((q) => q.id));
  for (const row of fresh ?? []) {
    if (review.length >= size) break;
    if (seen.has(row.id)) continue;
    review.push(toQuestion(row, false));
  }
  return review;
}

/**
 * 응시 기록. 틀리면 복습 큐에 stage 1/2/3을 +1/+3/+7일로 만든다 (SPEC.md 7절 G2).
 * 맞히면 그 문항의 복습 큐를 비운다 — 이미 아는 문제를 계속 돌릴 이유가 없다.
 */
export async function recordAttempt(
  questionId: string,
  chosenIndex: number,
  now: Date = new Date(),
): Promise<{ isCorrect: boolean }> {
  const supabase = await createClient();

  const { data: question, error: loadError } = await supabase
    .from("quiz_questions")
    .select("answer_index")
    .eq("id", questionId)
    .single();
  if (loadError) throw new Error(`문항 조회 실패: ${loadError.message}`);

  const isCorrect = question.answer_index === chosenIndex;

  const { error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({ question_id: questionId, chosen_index: chosenIndex, is_correct: isCorrect });
  if (attemptError) throw new Error(`응시 기록 실패: ${attemptError.message}`);

  if (isCorrect) {
    const { error } = await supabase.from("quiz_review_queue").delete().eq("question_id", questionId);
    if (error) throw new Error(`복습 큐 정리 실패: ${error.message}`);
    return { isCorrect };
  }

  const base = todayStart(now);
  const { error } = await supabase.from("quiz_review_queue").upsert(
    [1, 3, 7].map((days, i) => ({
      question_id: questionId,
      stage: i + 1,
      due_on: ymd(addDays(base, days)),
    })),
    { onConflict: "question_id,stage" },
  );
  if (error) throw new Error(`복습 큐 생성 실패: ${error.message}`);

  return { isCorrect };
}
