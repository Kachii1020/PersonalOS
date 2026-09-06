"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { FACT_KEYS } from "@/lib/career/profile";
import { ymd } from "@/lib/time";
import type { CareerFacts, CareerFact, FactKey } from "@/lib/career/types";
import type { CareerCase, CareerCompany, CareerOpportunity } from "@/lib/career/view";
import { submitCareerApplication, submitCareerCapture, submitCareerCase, submitCareerCompany, submitCareerDecision, submitCareerProfile, submitCareerRefresh, type CareerFormState } from "@/app/(dashboard)/career/actions";
import { factLabels, jstInput, opportunityTypeLabels, sourceClassLabels, stageLabels } from "./format";

export const textareaClass = "w-full min-w-0 rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text placeholder:text-text-muted";

export function CareerForm({ action, label, children }: {
  action: (previous: CareerFormState, data: FormData) => Promise<CareerFormState>;
  label: string; children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);
  useEffect(() => {
    // A returned validation error must not discard an uncontrolled form's input.
    if (!state.error || !submitted.current || !formRef.current) return;
    for (const control of Array.from(formRef.current.elements)) {
      if (control instanceof HTMLInputElement && control.type === "checkbox") control.checked = submitted.current.getAll(control.name).includes(control.value);
      else if (control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement) {
        const value = submitted.current.get(control.name);
        if (typeof value === "string" && control.type !== "file") control.value = value;
      }
    }
  }, [state]);
  return <form ref={formRef} action={formAction} onSubmit={(event) => { submitted.current = new FormData(event.currentTarget); }} className="space-y-4">
    <fieldset disabled={pending} className="min-w-0 space-y-4">{children}<Button type="submit" variant="primary" disabled={pending}>{pending ? "저장 중…" : label}</Button></fieldset>
    {state.error && <p role="alert" className="text-sm text-negative">{state.error}</p>}
    {state.message && <div role="status" className="space-y-2 text-sm text-text-muted"><p>{state.message}</p>{state.href && <Link href={state.href} className="font-medium text-accent underline underline-offset-4">{state.href === "/approvals" ? "승인함 열기" : "저장한 공고 열기"}</Link>}</div>}
  </form>;
}

export function Check({ name, children, checked = false, required = false }: { name: string; children: React.ReactNode; checked?: boolean; required?: boolean }) {
  return <label className="flex cursor-pointer items-start gap-2 text-sm text-text"><input type="checkbox" name={name} defaultChecked={checked} required={required} className="mt-1 size-4 shrink-0 accent-accent" /><span>{children}</span></label>;
}

function valueText(fact: CareerFact | undefined): string {
  if (!fact) return "";
  const value = fact.value;
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => `${key}:${item}`).join(", ");
  return value === null ? "" : String(value);
}
const factHints: Partial<Record<FactKey, string>> = {
  degree: "공고와 비교할 학위 과정 이름. 예: bachelor",
  languages: "언어 코드와 CEFR 등급. 예: ja:C1, en:B2 (A1~C2)",
  work_authorization: "국가 코드:자격. 예: JP:restricted · unrestricted 제한 없음 / restricted 조건 있음 / none 없음 / unknown 미확인. 비자 유형만으로 자격을 추정하지 마세요.",
  skills: "직접 확인한 기술을 쉼표로 구분하세요.",
};

export function CareerProfileForm({ facts }: { facts: CareerFacts }) {
  return <CareerForm action={submitCareerProfile} label="확인한 프로필 저장">
    <p className="text-sm text-text-muted">아는 항목만 입력하세요. 빈 항목은 미확인으로 저장되며, 기존 값을 비우면 해당 사실도 지워집니다. 입력한 항목마다 근거와 날짜가 필요합니다.</p>
    {FACT_KEYS.map((field) => {
      const fact = facts[field];
      const type = ["graduation_date", "available_from", "available_until"].includes(field) ? "date" : ["academic_year", "weekly_days"].includes(field) ? "number" : "text";
      return <fieldset key={field} className="min-w-0 space-y-3 border-b border-line pb-5">
        <legend className="mb-2 text-sm font-medium text-text">{factLabels[field]}</legend>
        <Field label="사실 값" htmlFor={`${field}-value`} hint={factHints[field]}><Input id={`${field}-value`} name={`${field}.value`} type={type} min={field === "weekly_days" ? 0 : 1} max={field === "weekly_days" ? 7 : field === "academic_year" ? 12 : undefined} defaultValue={valueText(fact)} placeholder="모르면 비워 두세요" /></Field>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          <Field label="직접 확인한 날짜 (JST)" htmlFor={`${field}-verified`}><Input id={`${field}-verified`} name={`${field}.verified`} type="date" defaultValue={fact ? ymd(new Date(fact.verifiedAt)) : ""} /></Field>
          <Field label="다시 확인할 날짜 (JST)" htmlFor={`${field}-review`}><Input id={`${field}-review`} name={`${field}.review`} type="date" defaultValue={fact ? ymd(new Date(fact.reviewAt)) : ""} /></Field>
        </div>
        <Field label="확인 근거" htmlFor={`${field}-source`}><Input id={`${field}-source`} name={`${field}.source`} defaultValue={fact?.source ?? ""} maxLength={500} placeholder="본인 확인, 성적표, 자격 증빙 등" /></Field>
      </fieldset>;
    })}
    <Check name="confirmed" required>입력한 값은 추정이 아닌 직접 확인한 사실입니다.</Check>
  </CareerForm>;
}

export function CareerCompanyForm() {
  return <CareerForm action={submitCareerCompany} label="관심 기관 추가">
    <Field label="기관·회사 이름" htmlFor="company-name"><Input id="company-name" name="name" required maxLength={160} /></Field>
    <Field label="관심 이유" htmlFor="company-reason" hint="이 기관을 지켜보는 이유와 내 목표와의 관련성을 적어 주세요."><textarea id="company-reason" name="reason" rows={2} required maxLength={1000} className={textareaClass} /></Field>
    <Field label="공식 채용 주소" htmlFor="company-prefixes" hint="기관이 직접 운영하는 HTTPS 주소를 한 줄에 하나씩 입력하세요. 이 주소 아래의 공고만 공식 근거로 사용합니다."><textarea id="company-prefixes" name="prefixes" rows={3} required className={textareaClass} /></Field>
    <Check name="officialConfirmed" required>입력한 주소가 이 기관의 공식 채용·프로그램 페이지임을 직접 확인했습니다.</Check>
    <Field label="확인 주기" htmlFor="company-tier"><Select id="company-tier" name="tier" defaultValue="1"><option value="1">우선 관심 · 매주</option><option value="2">일반 관심 · 매월</option><option value="3">모집 기간 중에만</option></Select></Field>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Field label="확인 기간 시작 (JST, 기간 중 확인 시)" htmlFor="company-start"><Input id="company-start" name="windowStart" type="datetime-local" /></Field>
      <Field label="확인 기간 종료 (JST, 기간 중 확인 시)" htmlFor="company-end"><Input id="company-end" name="windowEnd" type="datetime-local" /></Field>
    </div>
  </CareerForm>;
}

export function CareerCaptureForm({ companies }: { companies: CareerCompany[] }) {
  if (!companies.length) return <p className="text-sm text-text-muted"><Link href="/career" className="text-accent underline">관심 기관과 공식 주소를 먼저 추가하세요.</Link></p>;
  return <CareerForm action={submitCareerCapture} label="공고 저장">
    <Field label="기관" htmlFor="capture-company"><Select id="capture-company" name="companyId" required>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</Select></Field>
    <Field label="공식 공고 링크" htmlFor="capture-url"><Input id="capture-url" name="url" type="url" required maxLength={2048} placeholder="https://" /></Field>
    <Field label="공고 이름" htmlFor="capture-title"><Input id="capture-title" name="title" required maxLength={240} /></Field>
    <div className="grid min-w-0 gap-3 sm:grid-cols-2">
      <Field label="기회 종류" htmlFor="capture-type"><Select id="capture-type" name="opportunityType" defaultValue="job">{Object.entries(opportunityTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="출처 종류" htmlFor="capture-source-class"><Select id="capture-source-class" name="sourceClass" defaultValue="official_posting">{Object.entries(sourceClassLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
    </div>
    <p className="text-xs text-text-muted">저장 후 원문과 조건을 자동으로 확인합니다. 조건 검토가 끝나기 전에는 지원 가능으로 확정하지 않습니다.</p>
  </CareerForm>;
}

export function CareerRefreshForm({ id }: { id: string }) {
  return <CareerForm action={submitCareerRefresh} label="원문 다시 확인 요청"><input type="hidden" name="id" value={id} /></CareerForm>;
}

export function CareerDecisionForm({ opportunity }: { opportunity: CareerOpportunity }) {
  const prefix = `decision-${opportunity.id}`;
  return <CareerForm action={submitCareerDecision} label="내 선택 저장">
    <input type="hidden" name="id" value={opportunity.id} />
    <Field label="이 공고에 대한 선택" htmlFor={prefix}><Select id={prefix} name="decision" defaultValue={opportunity.decision}><option value="none">추천에 포함</option><option value="defer">나중에 검토</option><option value="reject">추천에서 제외</option></Select></Field>
    <Field label="선택한 이유" htmlFor={`${prefix}-reason`}><textarea id={`${prefix}-reason`} name="reason" defaultValue={opportunity.decisionReason ?? ""} rows={2} className={textareaClass} /></Field>
    <Field label="다시 볼 날짜·시각 (JST, 미룰 때)" htmlFor={`${prefix}-until`}><Input id={`${prefix}-until`} name="deferUntil" type="datetime-local" defaultValue={jstInput(opportunity.deferUntil)} /></Field>
  </CareerForm>;
}

export function CareerApplicationForm({ id }: { id: string }) {
  return <CareerForm action={submitCareerApplication} label="지원 준비 시작">
    <input type="hidden" name="id" value={id} />
    <Field label="첫 번째 준비 행동" htmlFor="application-next"><Input id="application-next" name="nextAction" required maxLength={300} placeholder="예: 공고에 맞춰 이력서 초안 검토" /></Field>
    <Field label="준비 마감 (JST, 선택)" htmlFor="application-due"><Input id="application-due" name="dueAt" type="datetime-local" /></Field>
    <p className="text-xs text-text-muted">지원 기록과 준비 할 일의 승인 요청을 만듭니다. 지원서 제출이나 메시지 전송은 실행하지 않습니다.</p>
  </CareerForm>;
}

export function CareerCaseForm({ record }: { record: CareerCase }) {
  const prefix = `case-${record.id}`;
  return <CareerForm action={submitCareerCase} label="진행 기록 저장">
    <input type="hidden" name="id" value={record.id} />
    <Field label="현재 단계" htmlFor={`${prefix}-stage`}><Select id={`${prefix}-stage`} name="stage" defaultValue={record.stage}>{Object.entries(stageLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
    <Field label="다음 행동" htmlFor={`${prefix}-next`}><Input id={`${prefix}-next`} name="nextAction" defaultValue={record.nextAction} required maxLength={300} /></Field>
    <Field label="다음 행동 마감 (JST)" htmlFor={`${prefix}-due`}><Input id={`${prefix}-due`} name="dueAt" type="datetime-local" defaultValue={jstInput(record.dueAt)} /></Field>
    {([['documents', '서류와 버전'], ['interviews', '면접 기록'], ['contact', '최근 연락 기록'], ['result', '결과'], ['decisionReason', '결정 이유']] as const).map(([name, label]) => <Field key={name} label={label} htmlFor={`${prefix}-${name}`}><textarea id={`${prefix}-${name}`} name={name} rows={2} defaultValue={record[name]} className={textareaClass} /></Field>)}
    <p className="text-xs text-text-muted">진행 기록만 변경하며 실제 전송·제출은 수행하지 않습니다. 새 할 일이나 일정도 만들지 않습니다.</p>
  </CareerForm>;
}
