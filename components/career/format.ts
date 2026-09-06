import type { Eligibility, FactKey, Lifecycle } from "@/lib/career/types";
import type { CareerOpportunity } from "@/lib/career/view";

export const factLabels: Record<FactKey, string> = {
  graduation_date: "졸업 예정일", academic_year: "현재 학년", degree: "학위 과정", major: "전공", university: "대학교",
  residence: "현재 거주지", work_authorization: "국가별 취업 자격", languages: "언어 능력",
  available_from: "활동 가능 시작일", available_until: "활동 가능 종료일", weekly_days: "주당 활동 가능 일수", skills: "확인한 기술",
};
export const eligibilityLabels: Record<Eligibility, string> = { confirmed_eligible: "지원 조건 충족", possibly_eligible: "조건 확인 필요", not_eligible: "지원 조건 미충족", next_cycle: "다음 모집 대기" };
export const lifecycleLabels: Record<Lifecycle, string> = { open: "모집 중", upcoming: "모집 예정", closed: "모집 종료", unknown: "모집 상태 미확인" };
export const opportunityTypeLabels: Record<CareerOpportunity["opportunityType"], string> = { job: "채용", internship: "인턴십", program: "프로그램", event: "행사", other: "기타" };
export const sourceClassLabels: Record<CareerOpportunity["sourceClass"], string> = { official_posting: "공식 모집 공고", official_program: "공식 프로그램 안내", official_faq: "공식 FAQ" };
export const stageLabels: Record<string, string> = { preparing: "준비 중", submitted: "제출 완료", interview: "면접", offer: "오퍼", rejected: "불합격", withdrawn: "지원 취소" };
export function dateLabel(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "미확인";
  return new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Tokyo", dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
export function jstInput(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(Date.parse(value) + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
