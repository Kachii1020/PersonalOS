import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { CareerProfileForm } from "@/components/career/forms";
import { getCareerDashboard } from "@/lib/repos/career";

export const metadata = { title: "내 커리어 프로필 · Personal OS" };

export default async function CareerProfilePage() {
  let dashboard;
  try { dashboard = await getCareerDashboard(); }
  catch (error) {
    console.error("[career] profile failed", error);
    return <Card><ErrorState what="커리어 프로필을 불러오지 못했습니다." fix="잠시 후 새로고침해 주세요. 기존 사실은 그대로 보관됩니다." /></Card>;
  }
  return <div className="mx-auto max-w-3xl space-y-4"><Link href="/career" className="text-sm text-accent underline underline-offset-4">커리어 비서로 돌아가기</Link><header><h1 className="text-xl font-semibold text-text">내 커리어 프로필</h1><p className="mt-2 text-sm text-text-muted">지원 조건을 비교할 때 사용할 사실입니다. 대화에서 추정한 개인정보는 넣지 않습니다.</p></header><Card><CareerProfileForm key={dashboard.profileRevision} facts={dashboard.facts} /></Card></div>;
}
