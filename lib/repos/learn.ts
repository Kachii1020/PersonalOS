// lib/repos/learn.ts
// Data access layer for the learn module.
// All Supabase calls go through here. Components never import supabase directly.

import { createClient } from "@/lib/supabase/server";

// ─── Types ───
export interface LearnTrack {
  id: string;
  slug: string;
  title: string;
  description: string | null;
}

export interface LearnPhase {
  id: string;
  track_id: string;
  phase_number: number;
  title: string;
  description: string | null;
  weeks_label: string | null;
}

export interface LearnModule {
  id: string;
  phase_id: string;
  slug: string;
  title: string;
  concepts: string[];
}

export interface LearnProgress {
  id: string;
  module_id: string;
  status: "not_started" | "in_progress" | "complete";
  completed_at: string | null;
}

// ─── Queries ───

export type LearnTrackTree = LearnTrack & {
  phases: (LearnPhase & { modules: LearnModule[] })[];
};

export type LearnQuizRow = {
  id: string;
  moduleSlug: string;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

/** 별칭. 기존 getTrack과 같다. */
export async function getTrackBySlug(slug: string): Promise<LearnTrack | null> {
  return getTrack(slug);
}

export async function getTrack(slug: string): Promise<LearnTrack | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learn_tracks")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) return null;
  return data;
}

export async function getPhases(trackId: string): Promise<LearnPhase[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learn_phases")
    .select("*")
    .eq("track_id", trackId)
    .order("position");
  if (error) return [];
  return data;
}

export async function getModules(phaseId: string): Promise<LearnModule[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learn_modules")
    .select("*")
    .eq("phase_id", phaseId)
    .order("position");
  if (error) return [];
  return data;
}

export async function getAllProgress(): Promise<LearnProgress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("learn_progress").select("*");
  if (error) return [];
  return data as unknown as LearnProgress[];
}

export async function updateProgress(
  moduleId: string,
  status: LearnProgress["status"],
): Promise<void> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  await supabase.from("learn_progress").upsert(
    {
      module_id: moduleId,
      status,
      completed_at: status === "complete" ? now : null,
      updated_at: now,
    },
    { onConflict: "module_id" },
  );
}

export interface LabCompletion {
  exercise_id: string;
  module_slug: string;
  completed_at: string;
}

export async function getLabCompletions(): Promise<LabCompletion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lab_completions")
    .select("exercise_id, module_slug, completed_at");
  if (error) return [];
  return data;
}

export async function recordLabCompletion(
  exerciseId: string,
  moduleSlug: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("lab_completions").upsert(
    { exercise_id: exerciseId, module_slug: moduleSlug },
    { onConflict: "exercise_id" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Quiz integration ───
// Quiz questions with domain='excel_finance' are fetched through
// the existing lib/repos/quiz.ts — no duplication here.
// The module_slug column links them back to learn_modules.

export async function getQuizzesByModule(moduleSlug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("*")
    .eq("domain", "excel_finance")
    .eq("module_slug", moduleSlug);
  if (error) return [];
  return data;
}

export async function getQuizByModuleSlug(moduleSlug: string): Promise<LearnQuizRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, module_slug, question, choices, answer_index, explanation, concept_hint")
    .eq("module_slug", moduleSlug)
    .order("concept_hint");
  if (error) throw new Error(`모듈 퀴즈 조회 실패: ${error.message}`);
  return (data ?? []).map(toQuizRow);
}

export async function getModulesByTrackSlug(trackSlug: string): Promise<LearnModule[]> {
  const track = await getTrack(trackSlug);
  if (!track) return [];
  const phases = await getPhases(track.id);
  const modules: LearnModule[] = [];
  for (const phase of phases) {
    modules.push(...(await getModules(phase.id)));
  }
  return modules;
}

export async function listLearnCurricula(): Promise<LearnTrackTree[]> {
  const supabase = await createClient();
  const { data: tracks, error } = await supabase
    .from("learn_tracks")
    .select("*")
    .order("position");
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(`트랙 조회 실패: ${error.message}`);
  }

  const trees: LearnTrackTree[] = [];
  for (const track of tracks ?? []) {
    const phases = await getPhases(track.id);
    const withModules = [];
    for (const phase of phases) {
      withModules.push({ ...phase, modules: await getModules(phase.id) });
    }
    trees.push({ ...track, phases: withModules });
  }
  return trees;
}

export async function listLearnQuestionIdMap(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, module_slug, concept_hint")
    .not("module_slug", "is", null)
    .order("module_slug")
    .order("concept_hint");
  if (error) throw new Error(`학습 퀴즈 목록 조회 실패: ${error.message}`);

  const map: Record<string, string[]> = {};
  for (const row of data ?? []) {
    if (!row.module_slug) continue;
    if (!map[row.module_slug]) map[row.module_slug] = [];
    map[row.module_slug].push(row.id);
  }
  return map;
}

export async function listLearnQuizzes(): Promise<LearnQuizRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_questions")
    .select("id, module_slug, question, choices, answer_index, explanation, concept_hint")
    .not("module_slug", "is", null)
    .order("module_slug")
    .order("concept_hint");
  if (error) throw new Error(`학습 퀴즈 조회 실패: ${error.message}`);
  return (data ?? []).filter((row) => row.module_slug).map(toQuizRow);
}

export async function listLearnAttempts(
  questionIds: string[],
): Promise<Record<string, { chosenIndex: number; isCorrect: boolean }>> {
  if (questionIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("question_id, chosen_index, is_correct")
    .in("question_id", questionIds)
    .order("attempted_at", { ascending: false });
  if (error) throw new Error(`응시 조회 실패: ${error.message}`);

  const map: Record<string, { chosenIndex: number; isCorrect: boolean }> = {};
  for (const row of data ?? []) {
    if (!map[row.question_id]) {
      map[row.question_id] = { chosenIndex: row.chosen_index, isCorrect: row.is_correct };
    }
  }
  return map;
}

function toQuizRow(row: {
  id: string;
  module_slug: string | null;
  question: string;
  choices: string[];
  answer_index: number;
  explanation: string | null;
}): LearnQuizRow {
  return {
    id: row.id,
    moduleSlug: row.module_slug ?? "",
    question: row.question,
    choices: row.choices,
    answerIndex: row.answer_index,
    explanation: row.explanation ?? "",
  };
}
