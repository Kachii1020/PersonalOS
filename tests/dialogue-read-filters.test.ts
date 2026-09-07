import test from "node:test";
import assert from "node:assert/strict";
import { deriveDialogueReadFilters } from "../lib/jarvis/dialogue-read-filters";

test("plain list politeness and whitespace do not invent default filters", () => {
  for (const text of ["현재 등록된 태스크를 확인하고 싶어", "내 할일 목록을 조회해 주세요", "전체 할 일 목록 보여 줘"]) assert.deepEqual(deriveDialogueReadFilters("read_tasks", text), {});
  for (const text of ["저장된 지원 기회 목록부터 알려 줘", "커리어 목록에 뭐가 있어?", "채용 공고를 확인해 주세요"]) assert.deepEqual(deriveDialogueReadFilters("read_career", text), {});
});

test("composed task conditions remain explicit and literal", () => {
  assert.deepEqual(deriveDialogueReadFilters("read_tasks", '끝낸 할일 중 제목에 "자격증"이 포함된 것만 우선 순위 높은 순으로 보여 주세요'), { taskStatus: "done", keyword: "자격증", order: "priority" });
  assert.deepEqual(deriveDialogueReadFilters("read_tasks", "상태 무관 태스크 마감 순으로 알려줘"), { taskStatus: "all", order: "due" });
  assert.deepEqual(deriveDialogueReadFilters("read_tasks", "2030-04-30에 기한인 미 완료 태스크 조회해줘", "2030-04-30"), { taskStatus: "open" });
  assert.deepEqual(deriveDialogueReadFilters("read_tasks", '제목에 "일정 생성 여부"가 들어간 할 일 보여줘'), { keyword: "일정 생성 여부" });
  assert.deepEqual(deriveDialogueReadFilters("read_tasks", '제목에 "100%_quota"가 들어간 태스크 보여줘'), { keyword: "100%_quota" });
});

test("stored career eligibility and title keywords never infer new eligibility", () => {
  for (const [label, eligibility] of [["자격이 확정된", "confirmed_eligible"], ["자격이 미확정인", "possibly_eligible"], ["자격을 충족하지 못한", "not_eligible"], ["다음 모집 주기인", "next_cycle"]]) {
    assert.deepEqual(deriveDialogueReadFilters("read_career", `${label} 제목에 "연구"가 들어간 기회 목록 보여줘`), { eligibility, keyword: "연구" });
  }
});

test("contradictory and unsupported constraints cannot vanish into a broader query", () => {
  for (const text of ["미완료 완료된 할 일 보여줘", "모든 상태 미완료 할 일 보여줘", "할 일 우선순위 높은 순으로 마감 순으로 보여줘", '제목에 "Alpha"가 들어간 제목에 "Beta"가 들어간 할 일 보여줘', "우선순위 80 이상 할 일 보여줘", "마감 없는 할 일 보여줘", "할 일 중 장학금 제외하고 보여줘", "할 일 2개만 보여줘"]) assert.equal(deriveDialogueReadFilters("read_tasks", text), null, text);
  assert.equal(deriveDialogueReadFilters("read_career", "자격이 확인된 자격이 불확실한 기회 보여줘"), null);
  assert.equal(deriveDialogueReadFilters("read_career", "2030-04-30 마감인 기회 보여줘", "2030-04-30"), null);
  assert.equal(deriveDialogueReadFilters("read_tasks", "2030-04-30 생성한 할 일 보여줘", "2030-04-30"), null);
});

test("calendar parser permits only a plain list with its already-validated date", () => {
  assert.deepEqual(deriveDialogueReadFilters("read_calendar", "2033-06-12 캘린더에 있는 일정만 조회해 주세요", "2033-06-12"), {});
  assert.deepEqual(deriveDialogueReadFilters("read_calendar", "현재 일정 목록 보여줘"), {});
  for (const text of ['2033-06-12 제목에 "실험"이 들어간 일정 보여줘', "2033-06-12 미완료 일정 보여줘", "2033-06-12 장소가 서울인 일정 보여줘", "2033-06-12 빈 시간 알려줘"]) assert.equal(deriveDialogueReadFilters("read_calendar", text, "2033-06-12"), null);
});
