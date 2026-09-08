import type { DialogueReadFilters } from "./dialogue-types";

/** Escaped regex for PostgREST imatch. Unlike ilike, it does not alias * to %. */
export function literalContainsPattern(keyword: string): string {
  return keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function dialogueTaskStatusLabel(status: string): string {
  return ({ open: "열린", done: "완료한", dropped: "중단한" } as Record<string, string>)[status] ?? "상태 미확인";
}

/** Filter before truncating. Eligibility remains the repository's derived fact. */
export function filterDialogueCareer<T extends { title: string; assessment: { eligibility: string } }>(rows: T[], filters: DialogueReadFilters): T[] {
  return rows.filter(row => (!filters.eligibility || row.assessment.eligibility === filters.eligibility)
    && (!filters.keyword || row.title.toLowerCase().includes(filters.keyword.toLowerCase())));
}
