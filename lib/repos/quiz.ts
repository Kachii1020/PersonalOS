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
  conceptHint: string | null;
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
  concept_hint: string | null;
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
    conceptHint: row.concept_hint,
    difficulty: row.difficulty,
    isReview,
  };
}

const FIELDS = "id, domain, question, choices, answer_index, explanation, concept_hint, difficulty";

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
        concept_hint: q.concept_hint,
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

export type QuizProgress = { total: number; answered: number; correct: number; review: number };

/**
 * 대시보드 요약 (SPEC.md 6.1의 '오늘의 퀴즈' 칸).
 *
 * 문항 목록을 todaysQuiz로 그대로 받아 세므로 /quiz 화면과 숫자가 어긋나지 않는다.
 */
export async function todaysQuizProgress(size = 5, now: Date = new Date()): Promise<QuizProgress> {
  const questions = await todaysQuiz(size, now);
  if (questions.length === 0) return { total: 0, answered: 0, correct: 0, review: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("question_id, is_correct")
    .in(
      "question_id",
      questions.map((q) => q.id),
    )
    .gte("attempted_at", todayStart(now).toISOString());

  if (error) throw new Error(`응시 이력 조회 실패: ${error.message}`);

  // 같은 문항을 여러 번 눌렀을 수 있다. 문항 단위로 접어서 센다.
  const byQuestion = new Map<string, boolean>();
  for (const row of data ?? []) byQuestion.set(row.question_id, row.is_correct);

  return {
    total: questions.length,
    answered: byQuestion.size,
    correct: [...byQuestion.values()].filter(Boolean).length,
    review: questions.filter((q) => q.isReview).length,
  };
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

// ============ 오답노트 (SPEC.md 6.2) ============

export type WrongAnswer = {
  id: string;
  domain: QuizDomain;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  conceptHint: string | null;
  chosenIndex: number;
  attemptedAt: string;
  difficulty: number;
};

/** 틀린 문항을 도메인별로 그룹핑해서 반환한다. 같은 문항은 최신 시도만 남긴다. */
export async function wrongAnswersByDomain(): Promise<Partial<Record<QuizDomain, WrongAnswer[]>>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("quiz_attempts")
    .select(`
      id, chosen_index, attempted_at, is_correct,
      quiz_questions!inner(${FIELDS})
    `)
    .eq("is_correct", false)
    .order("attempted_at", { ascending: false })
    .limit(200);

  if (error) throw new Error(`오답 조회 실패: ${error.message}`);

  // 같은 문항은 가장 최근 시도만 남긴다
  const seen = new Set<string>();
  const result: Partial<Record<QuizDomain, WrongAnswer[]>> = {};

  for (const row of data ?? []) {
    const q = row.quiz_questions as unknown as QuestionSelect;
    if (seen.has(q.id)) continue;
    seen.add(q.id);

    const domain = q.domain as QuizDomain;
    const entry: WrongAnswer = {
      id: q.id,
      domain,
      question: q.question,
      choices: q.choices,
      answerIndex: q.answer_index,
      explanation: q.explanation,
      conceptHint: q.concept_hint,
      chosenIndex: row.chosen_index,
      attemptedAt: row.attempted_at,
      difficulty: q.difficulty,
    };

    if (!result[domain]) result[domain] = [];
    result[domain]!.push(entry);
  }

  return result;
}

/** 대시보드 요약용 오답 총 수. */
export async function wrongAnswerCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("quiz_attempts")
    .select("question_id", { count: "exact", head: true })
    .eq("is_correct", false);

  if (error) return 0;
  return count ?? 0;
}

// ============ 도메인 마이크로 레슨 ============

export type DomainLesson = {
  domain: QuizDomain;
  title: string;
  content: string;
  keyTerms: string[];
};

/** 생성된 도메인 레슨을 전부 반환한다. */
export async function allDomainLessons(): Promise<DomainLesson[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_domain_lessons")
    .select("domain, title, content, key_terms")
    .order("domain");

  if (error) throw new Error(`도메인 레슨 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({
    domain: r.domain as QuizDomain,
    title: r.title,
    content: r.content,
    keyTerms: r.key_terms,
  }));
}

/** 특정 도메인의 레슨을 반환한다. */
export async function getDomainLesson(domain: QuizDomain): Promise<DomainLesson | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_domain_lessons")
    .select("domain, title, content, key_terms")
    .eq("domain", domain)
    .maybeSingle();

  if (error) throw new Error(`도메인 레슨 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    domain: data.domain as QuizDomain,
    title: data.title,
    content: data.content,
    keyTerms: data.key_terms,
  };
}

/** 잡/서버 액션 전용. 도메인 레슨을 upsert한다. */
export async function upsertDomainLesson(
  domain: QuizDomain,
  lesson: { title: string; content: string; key_terms: string[] },
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("quiz_domain_lessons")
    .upsert({ domain, ...lesson }, { onConflict: "domain" });

  if (error) throw new Error(`도메인 레슨 저장 실패: ${error.message}`);
}
