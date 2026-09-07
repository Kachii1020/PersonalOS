import Link from "next/link";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { CareerCaseForm, CareerCompanyForm } from "@/components/career/forms";
import { dateLabel, stageLabels } from "@/components/career/format";
import { getCareerDashboard } from "@/lib/repos/career";

export const metadata = { title: "커리어 비서 · Personal OS" };

export default async function CareerPage() {
  let dashboard;
  try { dashboard = await getCareerDashboard(); }
  catch (error) {
    console.error("[career] dashboard failed", error);
    return <><h1 className="mb-4 text-xl font-semibold text-text">커리어 비서</h1><Card><ErrorState what="커리어 정보를 불러오지 못했습니다." fix="잠시 후 새로고침하세요. 연결 오류가 계속되면 설정에서 상태를 확인하세요." /></Card></>;
  }
  return <div className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium text-accent">JARVIS</p><h1 className="mt-1 text-xl font-semibold text-text">커리어 비서</h1><p className="mt-2 text-sm text-text-muted">공식 공고의 조건을 확인하고 다음 준비 행동을 정합니다.</p></div><div className="flex flex-wrap gap-2"><Link href="/career/profile" className={buttonClass()}>내 프로필</Link><Link href="/opportunities" className={buttonClass({ variant: "primary" })}>지원 기회</Link></div></header>
    <Card><CardHeader><CardTitle>관심 기관</CardTitle><Badge>{dashboard.companies.length}개</Badge></CardHeader>
      {!dashboard.companies.length ? <p className="text-sm text-text-muted">관심 기관이 없습니다. 아래에서 기관 이름과 직접 확인한 공식 주소를 추가하세요.</p> : <ul className="divide-y divide-line">{dashboard.companies.map((company) => <li key={company.id} className="space-y-2 py-3 first:pt-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-text">{company.name}</h3><Badge>{company.tier === 1 ? "매주 확인" : company.tier === 2 ? "매월 확인" : "모집 기간 중 확인"}</Badge>{!company.enabled && <Badge>확인 중지</Badge>}</div>{company.reason && <p className="break-words text-sm text-text-muted">관심 이유: {company.reason}</p>}<ul className="space-y-1">{company.officialPrefixes.map((url) => <li key={url}><a href={url} target="_blank" rel="noopener noreferrer" className="break-all text-sm text-accent underline underline-offset-4">{url}</a></li>)}</ul>{company.tier === 3 && <p className="text-xs text-text-muted">확인 기간: {company.windowStart ?? "미정"} ~ {company.windowEnd ?? "미정"}</p>}</li>)}</ul>}
      <details className="mt-4 border-t border-line pt-4" open={!dashboard.companies.length}><summary className="mb-4 cursor-pointer text-sm font-medium text-text">관심 기관 추가</summary><CareerCompanyForm /></details>
    </Card>
    <Card><CardHeader><CardTitle>진행 중인 지원</CardTitle><Badge>{dashboard.cases.length}개</Badge></CardHeader>
      {!dashboard.cases.length ? <p className="text-sm text-text-muted">아직 시작한 지원이 없습니다. 공고에서 ‘지원 준비 시작’을 누르면 다음 행동과 함께 이곳에 표시됩니다.</p> : <div className="divide-y divide-line">{dashboard.cases.map((record) => <article key={record.id} className="space-y-3 py-4 first:pt-0"><div className="flex flex-wrap items-start justify-between gap-2"><Link href={`/opportunities/${record.opportunityId}`} className="break-words font-medium text-text hover:text-accent">{record.title}</Link><Badge>{stageLabels[record.stage] ?? record.stage}</Badge></div><p className="text-sm text-text">다음 행동: {record.nextAction}</p><p className="text-xs text-text-muted">마감: {record.dueAt ? dateLabel(record.dueAt) : "없음"}</p>{record.approvalId && <Link href="/approvals" className="inline-block text-sm text-accent underline">준비 할 일 승인 상태 보기</Link>}<details className="rounded-lg border border-line p-3"><summary className="cursor-pointer text-sm font-medium text-text">진행 기록 수정</summary><div className="mt-4"><CareerCaseForm record={record} /></div></details></article>)}</div>}
    </Card>
  </div>;
}
