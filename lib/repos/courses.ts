import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { gradePoint, isGrade } from "@/lib/grades";

/** 과목·학기 데이터 접근 레이어 (SPEC.md 4절, 5.1b). */

export type CourseRow = {
  id: string;
  name: string;
  code: string | null;
  credits: number;
  grade: string | null;
  semesterLabel: string;
};

export type SemesterRow = { id: string; label: string; isCurrent: boolean };

export async function listSemesters(): Promise<SemesterRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("semesters")
    .select("id, label, is_current")
    .order("starts_on", { ascending: false });

  if (error) throw new Error(`학기 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({ id: r.id, label: r.label, isCurrent: r.is_current }));
}

/**
 * 학기 추가. is_current를 켜면 나머지를 끈다 — '이번 학기'가 둘이면 과목 추가 폼의
 * 기본 선택이 무엇을 고를지 알 수 없다.
 */
export async function createSemester(input: {
  label: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}): Promise<void> {
  const supabase = await createClient();

  if (input.isCurrent) {
    const { error } = await supabase.from("semesters").update({ is_current: false }).eq("is_current", true);
    if (error) throw new Error(`이전 학기 해제 실패: ${error.message}`);
  }

  const { error } = await supabase.from("semesters").insert({
    label: input.label,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    is_current: input.isCurrent,
  });

  if (error) {
    // label에 unique 제약이 있다. 메시지를 그대로 흘리면 사용자가 뭘 고칠지 모른다.
    if (error.code === "23505") throw new Error(`'${input.label}' 학기가 이미 있습니다.`);
    throw new Error(`학기 추가 실패: ${error.message}`);
  }
}

export async function listCourses(): Promise<CourseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, code, credits, grade, semesters(label, starts_on)")
    .order("name", { ascending: true });

  if (error) throw new Error(`과목 조회 실패: ${error.message}`);
  return (data ?? [])
    .map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code,
      credits: Number(r.credits),
      grade: r.grade,
      semesterLabel: r.semesters?.label ?? "",
      startsOn: r.semesters?.starts_on ?? "",
    }))
    // 최근 학기가 위로. PostgREST는 조인한 테이블 컬럼으로 정렬하지 못해 여기서 정렬한다.
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn) || a.name.localeCompare(b.name))
    .map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      credits: c.credits,
      grade: c.grade,
      semesterLabel: c.semesterLabel,
    }));
}

export async function getCourse(id: string): Promise<CourseRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("courses")
    .select("id, name, code, credits, grade, semesters(label)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`과목 조회 실패: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    code: data.code,
    credits: Number(data.credits),
    grade: data.grade,
    semesterLabel: data.semesters?.label ?? "",
  };
}

export async function createCourse(input: {
  semesterId: string;
  name: string;
  code: string | null;
  credits: number;
}): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("courses").insert({
    semester_id: input.semesterId,
    name: input.name,
    code: input.code,
    credits: input.credits,
  });
  if (error) throw new Error(`과목 추가 실패: ${error.message}`);
}

/** grade_point는 grade에서 파생된다. 둘을 따로 입력받으면 어긋난다. */
export async function setGrade(id: string, grade: string | null): Promise<void> {
  if (grade !== null && !isGrade(grade)) throw new Error(`알 수 없는 등급입니다: ${grade}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("courses")
    .update({ grade, grade_point: grade === null ? null : gradePoint(grade) })
    .eq("id", id);

  if (error) throw new Error(`성적 저장 실패: ${error.message}`);
}

/** 과목 상세의 '다음 수업'. ICS로 들어온 이벤트 중 아직 안 지난 첫 건 (G2 조건). */
export async function nextClass(courseId: string): Promise<{ summary: string; startsAt: string; location: string | null } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("summary, starts_at, location")
    .eq("course_id", courseId)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`다음 수업 조회 실패: ${error.message}`);
  if (!data) return null;
  return { summary: data.summary, startsAt: data.starts_at, location: data.location };
}

/** 잡 전용: code가 있는 과목의 code → id 맵. 코드는 대문자로 정규화한다. */
export async function courseCodeMapForJob(): Promise<Map<string, string>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("courses").select("id, code").not("code", "is", null);

  if (error) throw new Error(`과목 코드 조회 실패: ${error.message}`);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (row.code) map.set(row.code.toUpperCase(), row.id);
  }
  return map;
}
