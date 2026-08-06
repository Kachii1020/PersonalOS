import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Phase 3 위젯의 자리표시자.
 *
 * SPEC.md 6.1의 대시보드 배치는 하단 세 칸을 전제로 하므로, 자리를 비워두면
 * 레이아웃이 Phase마다 바뀐다. 기능이 아니라 자리를 잡아두는 카드다.
 */
export function PhasePlaceholder({
  title,
  phase,
  message,
  className,
}: {
  title: string;
  phase: 3;
  message: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardHint>Phase {phase}</CardHint>
      </CardHeader>
      <EmptyState message={message} />
    </Card>
  );
}

export function MarketSnapshot({ className }: { className?: string }) {
  return (
    <PhasePlaceholder
      title="지수·환율"
      phase={3}
      message="티커를 등록하면 종가와 등락률이 여기에 표시됩니다. 시세 갱신이 실패해도 마지막 스냅샷을 보여줍니다."
      className={className}
    />
  );
}

export function GithubHeatmap({ className }: { className?: string }) {
  return (
    <PhasePlaceholder
      title="GitHub 잔디"
      phase={3}
      message="GitHub 토큰을 등록하면 최근 90일 커밋 활동이 여기에 표시됩니다."
      className={className}
    />
  );
}
