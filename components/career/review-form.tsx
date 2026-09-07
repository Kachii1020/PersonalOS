"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { submitCareerReview } from "@/app/(dashboard)/career/actions";
import { FACT_KEYS } from "@/lib/career/profile";
import type { CareerRequirement, FactKey, RequirementOperator } from "@/lib/career/types";
import type { CareerOpportunity } from "@/lib/career/view";
import { CareerForm, Check, textareaClass } from "./forms";
import { factLabels, jstInput, lifecycleLabels } from "./format";

const operatorLabels: Record<RequirementOperator, string> = { eq: "같음", one_of: "하나 이상 해당", all_of: "모두 해당", gte: "이상", lte: "이하", between: "범위 안", not_required: "요구하지 않음 (원문 확인)", unknown: "아직 해석하지 못함" };
function expectedText(requirement: CareerRequirement): string {
  const value = requirement.expected;
  if (value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    if (typeof value.language === "string") return `${value.language}:${value.minimum}`;
    if (typeof value.country === "string") return `${value.country}:${value.level}`;
    return "";
  }
  return String(value);
}
function expectedHint(field: FactKey, operator: RequirementOperator): string {
  if (operator === "unknown") return "모호한 조건은 값을 비워 두고 미확인으로 남기세요.";
  if (operator === "not_required") return "값은 비워 두세요. 요구하지 않는다는 공식 원문 인용이 필요합니다.";
  if (field === "languages") return "언어 코드:최소 CEFR 등급. 예: ja:C1 · 비교는 같음 또는 이상을 선택하세요.";
  if (field === "work_authorization") return "국가 코드:자격. 예: JP:unrestricted (제한 없는 자격), JP:any (조건부 포함). 비교는 같음.";
  if (operator === "between") return "시작과 끝을 쉼표로 구분하세요. 예: 2027-04-01, 2028-03-31 또는 2, 4";
  if (operator === "one_of" || operator === "all_of" || field === "skills") return "각 값을 쉼표로 구분하세요. 예: Python, SQL";
  if (["graduation_date", "available_from", "available_until"].includes(field)) return "날짜는 YYYY-MM-DD 형식으로 입력하세요.";
  return "공식 조건과 비교할 값. 학년·일수는 숫자로 입력하세요.";
}
type RuleRow = CareerRequirement & { rawExpected: string };

export function CareerReviewForm({ opportunity }: { opportunity: CareerOpportunity }) {
  const [rows, setRows] = useState<RuleRow[]>(() => opportunity.requirements.map((rule) => ({ ...rule, rawExpected: expectedText(rule) })));
  function change(id: string, patch: Partial<RuleRow>) {
    setRows((current) => current.map((row) => row.id === id ? { ...row, reviewed: false, ...patch } : row));
  }
  if (!opportunity.source?.available || !opportunity.source.official) return <p className="text-sm text-text-muted">사용할 수 있는 공식 원문을 확인한 뒤 조건을 검토할 수 있습니다. 원문 오류와 공식 주소를 먼저 확인해 주세요.</p>;
  return <CareerForm action={submitCareerReview} label="원문·조건 검토 저장">
    <input type="hidden" name="id" value={opportunity.id} />
    <input type="hidden" name="revision" value={opportunity.revision} />
    <input type="hidden" name="requirementCount" value={rows.length} />
    <p className="text-sm text-text-muted">자동 정리된 조건은 후보입니다. 아래 원문과 비교해 빠진 조건을 추가하고, 해석이 모호하면 미확인으로 남기세요.</p>
    <Field label="공고 이름" htmlFor="review-title"><Input id="review-title" name="title" required maxLength={240} defaultValue={opportunity.title} /></Field>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Field label="원문에서 확인한 모집 상태" htmlFor="review-lifecycle"><Select id="review-lifecycle" name="lifecycle" defaultValue={opportunity.lifecycle}>{Object.entries(lifecycleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="마감 날짜·시각 (JST, 명시된 경우)" htmlFor="review-deadline"><Input id="review-deadline" name="deadline" type="datetime-local" defaultValue={jstInput(opportunity.deadline)} /></Field>
      <Field label="근무 장소" htmlFor="review-location"><Input id="review-location" name="location" defaultValue={opportunity.location ?? ""} /></Field>
      <Field label="근무 방식" htmlFor="review-mode"><Input id="review-mode" name="workMode" defaultValue={opportunity.workMode ?? ""} placeholder="원격, 현장, 혼합 등" /></Field>
    </div>
    <div className="space-y-4">
      <h3 className="font-medium text-text">지원 조건 {rows.length}개</h3>
      {rows.length === 0 && <p className="text-sm text-text-muted">아직 조건이 없습니다. 공식 원문을 읽고 조건을 추가하세요. 조건이 없으면 지원 가능으로 확정하지 않습니다.</p>}
      {rows.map((row, index) => {
        const prefix = `rule.${index}`;
        return <fieldset key={row.id} className="min-w-0 space-y-3 border-b border-line pb-4">
          <legend className="mb-2 text-sm font-medium text-text">조건 {index + 1}</legend>
          <input type="hidden" name={`${prefix}.id`} value={row.id} />
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Field label="확인할 프로필 항목" htmlFor={`${row.id}-field`}><Select id={`${row.id}-field`} name={`${prefix}.field`} value={row.field} onChange={(event) => change(row.id, { field: event.target.value as FactKey })}>{FACT_KEYS.map((field) => <option key={field} value={field}>{factLabels[field]}</option>)}</Select></Field>
            <Field label="비교 방법" htmlFor={`${row.id}-operator`}><Select id={`${row.id}-operator`} name={`${prefix}.operator`} value={row.operator} onChange={(event) => change(row.id, { operator: event.target.value as RequirementOperator })}>{Object.entries(operatorLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
          </div>
          <Field label="조건 값" htmlFor={`${row.id}-expected`} hint={expectedHint(row.field, row.operator)}><Input id={`${row.id}-expected`} name={`${prefix}.expected`} value={row.rawExpected} onChange={(event) => change(row.id, { rawExpected: event.target.value })} disabled={row.operator === "unknown" || row.operator === "not_required"} /></Field>
          <Field label="근거가 되는 원문 그대로" htmlFor={`${row.id}-quote`} hint="아래 저장된 원문에서 조건을 설명하는 문장을 그대로 붙여 넣으세요."><textarea id={`${row.id}-quote`} name={`${prefix}.quote`} rows={3} value={row.quote} onChange={(event) => change(row.id, { quote: event.target.value })} className={textareaClass} /></Field>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text"><input name={`${prefix}.hard`} type="checkbox" checked={row.hard} onChange={(event) => change(row.id, { hard: event.target.checked })} className="size-4 accent-accent" />필수 자격 조건</label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text"><input name={`${prefix}.reviewed`} type="checkbox" checked={row.reviewed} onChange={(event) => change(row.id, { reviewed: event.target.checked })} className="size-4 accent-accent" />이 조건의 값과 인용을 직접 확인함</label>
          <Button type="button" variant="ghost" onClick={() => setRows((current) => current.filter((item) => item.id !== row.id))} aria-label={`조건 ${index + 1} 삭제`}><Trash2 className="size-4" aria-hidden="true" />조건 삭제</Button>
        </fieldset>;
      })}
      <Button type="button" disabled={rows.length >= 50} onClick={() => setRows((current) => [...current, { id: crypto.randomUUID(), field: "degree", operator: "unknown", expected: null, rawExpected: "", hard: true, quote: "", sourceId: opportunity.source!.id, reviewed: false }])}><Plus className="size-4" aria-hidden="true" />조건 추가</Button>
    </div>
    <details className="space-y-3 rounded-lg border border-line p-3">
      <summary className="cursor-pointer text-sm font-medium text-text">추천 우선순위와 중복 준비물</summary>
      <p className="text-xs text-text-muted">각 점수는 0~100입니다. 지원 자격이 확인된 공고 사이의 순서만 정합니다.</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-3">{([['fit', '내 목표와 적합도'], ['value', '기대 가치'], ['effort', '준비 부담']] as const).map(([name, label]) => <Field key={name} label={label} htmlFor={`review-${name}`}><Input id={`review-${name}`} name={name} type="number" min={0} max={100} required defaultValue={opportunity[name]} /></Field>)}</div>
      <Field label="함께 준비할 결과물 이름 (선택)" htmlFor="review-deliverable" hint="같은 결과물 이름을 가진 공고는 추천 상위 3개에서 중복 노출하지 않습니다."><Input id="review-deliverable" name="deliverableKey" defaultValue={opportunity.deliverableKey ?? ""} /></Field>
    </details>
    <Check name="sourceReviewed" required>저장된 원문이 해당 기관의 공식 공고임을 직접 확인했습니다.</Check>
    <Check name="complete">원문의 필수 조건을 빠짐없이 옮겼습니다. 누락·모호함이 있으면 체크하지 않습니다.</Check>
  </CareerForm>;
}
