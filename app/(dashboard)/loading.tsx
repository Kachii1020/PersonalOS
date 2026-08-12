import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";

/**
 * (dashboard) 세그먼트 전체의 공용 로딩 상태.
 * 사이드바에서 다른 페이지로 이동할 때, 다음 page.tsx가 렌더되는 동안 이게 뜬다.
 * 어떤 페이지로 갈지 미리 알 수 없어서 범용 스켈레톤 3장으로 구성했다.
 */
export default function DashboardLoading() {
  return (
    <div className="animate-in">
      <Skeleton className="mb-4 h-6 w-32" />
      <div className="grid gap-4 lg:grid-cols-3">
        {[6, 4, 5].map((lines, i) => (
          <Card key={i} className={i === 0 ? "lg:col-span-3" : undefined}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <SkeletonLines lines={lines} />
          </Card>
        ))}
      </div>
    </div>
  );
}
