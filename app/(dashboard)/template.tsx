/**
 * layout.tsx와 달리 template.tsx는 이동할 때마다 새로 마운트된다.
 * 그 성질을 이용해 페이지 전환마다 fade-slide-in을 다시 튼다 (UX 개선 F2).
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-in">{children}</div>;
}
