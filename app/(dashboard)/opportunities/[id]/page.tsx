import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { CareerApplicationForm, CareerDecisionForm, CareerRefreshForm } from "@/components/career/forms";
import { CareerReviewForm } from "@/components/career/review-form";
import { dateLabel, eligibilityLabels, factLabels, lifecycleLabels, opportunityTypeLabels, sourceClassLabels } from "@/components/career/format";
import { getCareerDashboard } from "@/lib/repos/career";

export const metadata = { title: "공고 검토 · Personal OS" };

export default async function OpportunityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let dashboard;
  try { dashboard = await getCareerDashboard(); }
  catch (error) {
    console.error("[career] opportunity detail failed", error);
    return <Card><ErrorState what="공고를 불러오지 못했습니다." fix="잠시 후 새로고침해 주세요." /></Card>;
  }
  const opportunity = dashboard.opportunities.find((item) => item.id === id);
  if (!opportunity) notFound();
  const resultLabels = { pass: "충족", fail: "미충족", unknown: "미확인", not_applicable: "해당 없음" };
  return <div className="space-y-4">
    <Link href="/opportunities" className="text-sm text-accent underline underline-offset-4">지원 기회로 돌아가기</Link>
    <header className="space-y-2"><p className="text-sm text-text-muted">{opportunity.organization} · {opportunityTypeLabels[opportunity.opportunityType]}</p><h1 className="break-words text-xl font-semibold text-text">{opportunity.title}</h1><div className="flex flex-wrap gap-2"><Badge tone={opportunity.assessment.eligibility === "confirmed_eligible" ? "positive" : opportunity.assessment.eligibility === "not_eligible" ? "negative" : "neutral"}>{eligibilityLabels[opportunity.assessment.eligibility]}</Badge><Badge>{lifecycleLabels[opportunity.assessment.lifecycle]}</Badge></div><a href={opportunity.canonicalUrl} target="_blank" rel="noopener noreferrer" className="inline-block break-all text-sm font-medium text-accent underline underline-offset-4">공고 원문 열기 ↗</a></header>
    <Card><CardHeader><CardTitle>판정과 확인할 항목</CardTitle></CardHeader><ul className="space-y-2 text-sm text-text-muted">{opportunity.assessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
      {opportunity.assessment.results.length > 0 && <ul className="mt-4 divide-y divide-line">{opportunity.assessment.results.map((result) => {
        const requirement = opportunity.requirements.find((rule) => rule.id === result.requirementId);
        return <li key={result.requirementId} className="space-y-1 py-3"><div className="flex flex-wrap gap-2 text-sm"><span className="font-medium text-text">{requirement ? factLabels[requirement.field] : "지원 조건"}</span><Badge tone={result.result === "pass" ? "positive" : result.result === "fail" ? "negative" : "neutral"}>{resultLabels[result.result]}</Badge></div><p className="text-sm text-text-muted">{result.reason}</p>{requirement?.quote && <blockquote className="break-words border-l-2 border-line pl-3 text-xs leading-5 text-text-muted">{requirement.quote}</blockquote>}</li>;
      })}</ul>}<Link href="/career/profile" className="mt-3 inline-block text-sm text-accent underline">내 사실 확인·수정</Link>
    </Card>
    <Card><CardHeader><CardTitle>출처와 저장된 원문</CardTitle></CardHeader>
      <p className="mb-2 text-sm text-text-muted">출처 종류: {sourceClassLabels[opportunity.sourceClass]}</p>
      <p className="text-sm text-text-muted">마지막 확인: {dateLabel(opportunity.source?.checkedAt ?? null)} (JST)</p>
      <p className="mt-1 text-xs text-text-muted">다음 확인: {dateLabel(opportunity.nextCheckAt)}</p>
      {opportunity.source && <p className="mt-2 text-sm text-text-muted">{opportunity.source.available ? "원문 확인 가능" : "원문을 확인할 수 없음"} · {opportunity.source.official ? "등록한 공식 주소와 일치" : "공식 주소 확인 필요"} · {opportunity.source.reviewed ? "사용자 검토 완료" : "사용자 검토 필요"}</p>}
      {!opportunity.source && <p className="mt-3 text-sm text-text-muted">원문과 조건 정리를 기다리고 있습니다. 자동 처리 후 새로고침해 주세요.</p>}
      {opportunity.lastError && <ErrorState what={`원문 처리 실패: ${opportunity.lastError}`} fix="공고 링크가 공개되어 있는지 확인한 뒤 원문 재확인을 요청하세요. 실패한 출처로 지원 가능 여부를 확정하지 않습니다." />}
      {opportunity.source?.text && <details className="my-4 rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium text-text">저장된 원문 펼치기</summary><pre className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-text-muted">{opportunity.source.text}</pre></details>}
      <div className="mt-4"><CareerRefreshForm id={id} /></div>
    </Card>
    <Card><CardHeader><CardTitle>공식 원문·지원 조건 검토</CardTitle></CardHeader><CareerReviewForm key={`${id}:${opportunity.revision}`} opportunity={opportunity} /></Card>
    <div className="grid min-w-0 gap-4 lg:grid-cols-2"><Card><CardHeader><CardTitle>내 선택</CardTitle></CardHeader><CareerDecisionForm opportunity={opportunity} /></Card><Card><CardHeader><CardTitle>지원 준비</CardTitle></CardHeader>{dashboard.cases.some((record) => record.opportunityId === id) ? <p className="text-sm text-text-muted">이미 지원 준비를 시작했습니다. <Link href="/career" className="text-accent underline">진행 기록 보기</Link></p> : opportunity.assessment.status === "act_now" && opportunity.decision === "none" ? <CareerApplicationForm id={id} /> : <p className="text-sm text-text-muted">현재 모집 중인 공고의 지원 조건을 모두 확인하고, 내 선택을 ‘추천에 포함’으로 저장하면 준비를 시작할 수 있습니다.</p>}</Card></div>
  </div>;
}
