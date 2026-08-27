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
