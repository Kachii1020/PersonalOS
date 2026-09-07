import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { CareerCaptureForm } from "@/components/career/forms";
import { CareerTopActions } from "@/components/career/summary";
import { dateLabel, eligibilityLabels, lifecycleLabels } from "@/components/career/format";
import { getCareerDashboard } from "@/lib/repos/career";

export const metadata = { title: "지원 기회 · Personal OS" };

export default async function OpportunitiesPage() {
  let dashboard;
  try { dashboard = await getCareerDashboard(); }
  catch (error) {
    console.error("[career] opportunities failed", error);
    return <><h1 className="mb-4 text-xl font-semibold text-text">지원 기회</h1><Card><ErrorState what="지원 기회를 불러오지 못했습니다." fix="잠시 후 새로고침하세요. 관심 기관과 연결 상태도 확인해 주세요." /></Card></>;
  }
  return <div className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-xl font-semibold text-text">지원 기회</h1><p className="mt-2 text-sm text-text-muted">지원 가능 여부를 공식 원문과 내 프로필로 확인합니다.</p></div><Link href="/career" className={buttonClass()}>기관·지원 기록</Link></header>
    <Card><CardHeader><CardTitle>지금 준비할 기회</CardTitle><Badge>최대 3개</Badge></CardHeader><CareerTopActions items={dashboard.topActions} /><Link href="/career/profile" className="mt-3 inline-block text-sm text-accent underline underline-offset-4">내 프로필 확인</Link></Card>
    <Card><CardHeader><CardTitle>공식 공고 저장</CardTitle></CardHeader><CareerCaptureForm companies={dashboard.companies.filter((company) => company.enabled)} /></Card>
    <Card><CardHeader><CardTitle>저장한 공고</CardTitle><Badge>{dashboard.opportunities.length}개</Badge></CardHeader>
      {!dashboard.opportunities.length ? <p className="text-sm text-text-muted">저장한 공고가 없습니다. 위에 공식 공고 링크를 넣어 시작하세요.</p> : <ul className="divide-y divide-line">{dashboard.opportunities.map((item) => <li key={item.id} className="space-y-2 py-4 first:pt-0"><Link href={`/opportunities/${item.id}`} className="block break-words font-medium text-text hover:text-accent">{item.title}</Link><p className="text-xs text-text-muted">{item.organization}</p><div className="flex flex-wrap gap-2"><Badge tone={item.assessment.eligibility === "confirmed_eligible" ? "positive" : item.assessment.eligibility === "not_eligible" ? "negative" : "neutral"}>{eligibilityLabels[item.assessment.eligibility]}</Badge><Badge>{lifecycleLabels[item.assessment.lifecycle]}</Badge>{item.decision !== "none" && <Badge>{item.decision === "reject" ? "추천 제외" : "검토 미룸"}</Badge>}</div><p className="text-xs text-text-muted">마지막 확인: {dateLabel(item.source?.checkedAt ?? null)} · 마감: {item.deadline ? dateLabel(item.deadline) : "미확인·명시 없음"}</p>{!item.source && <p className="text-xs text-text-muted">원문과 조건 정리 대기 중 · 자동 처리 후 새로고침해 주세요.</p>}{item.lastError && <p className="break-words text-sm text-negative">원문 처리 오류: {item.lastError}</p>}<p className="text-sm text-text-muted">{item.assessment.reasons[0]}</p></li>)}</ul>}
    </Card>
  </div>;
}
