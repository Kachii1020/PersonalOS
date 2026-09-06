import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { getCareerDashboard } from "@/lib/repos/career";
import type { CareerTopAction } from "@/lib/career/types";
import { dateLabel } from "./format";

export function CareerTopActions({ items }: { items: CareerTopAction[] }) {
  if (!items.length) return <p className="text-sm text-text-muted">지금 지원 조건을 충족한 공고가 없습니다. 프로필과 공고의 확인할 조건을 검토해 주세요.</p>;
  return <ol className="divide-y divide-line">{items.slice(0, 3).map((item) => <li key={item.id} className="space-y-2 py-3 first:pt-0">
    <Link href={`/opportunities/${item.id}`} className="block break-words font-medium text-text hover:text-accent">{item.title}</Link>
    <p className="text-xs text-text-muted">{item.organization} · 마감 {item.deadline ? dateLabel(item.deadline) : "명시 없음"}</p>
    <p className="text-xs leading-5 text-text-muted">{item.reason}</p>
  </li>)}</ol>;
}

export async function TodayCareerSummary() {
  let data;
  try { data = await getCareerDashboard(); }
  catch (error) {
    console.error("[career] Today career summary failed", error);
    return <Card><ErrorState what="지원 기회를 불러오지 못했습니다." fix="공고 화면에서 상태를 확인하거나 잠시 후 새로고침하세요." action={<Link className="text-sm text-accent underline" href="/opportunities">지원 기회 열기</Link>} /></Card>;
  }
  return <Card><CardHeader><CardTitle>지원 기회 확인</CardTitle><Badge>{data.topActions.length}개</Badge></CardHeader><p className="text-sm text-text-muted">{data.topActions.length ? `지원 조건을 충족해 우선 검토할 기회가 ${data.topActions.length}개 있습니다.` : "프로필과 공식 공고를 검토하면 지원 가능한 기회를 확인할 수 있습니다."}</p><Link href="/opportunities" className="mt-3 inline-block text-sm font-medium text-accent underline underline-offset-4">공고 검토 열기</Link></Card>;
}
