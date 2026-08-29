import { PHASE1 } from "./phase1";
import { PHASE2 } from "./phase2";
import { PHASE3 } from "./phase3";
import type { LabExerciseDef } from "../types";

export const ALL_LAB_EXERCISES: LabExerciseDef[] = [
  ...PHASE1,
  ...PHASE2,
  ...PHASE3,
];

export function getExercisesForModule(slug: string): LabExerciseDef[] {
  return ALL_LAB_EXERCISES.filter((ex) => ex.moduleSlug === slug);
}

export function getExerciseById(id: string): LabExerciseDef | undefined {
  return ALL_LAB_EXERCISES.find((ex) => ex.id === id);
}
