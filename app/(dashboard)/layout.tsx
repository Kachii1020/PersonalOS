import { MobileNav, Sidebar } from "@/components/shell/sidebar";

/**
 * 인증된 영역의 셸. 데이터는 여기서 가져오지 않는다 — 각 페이지가 lib/repos로 읽는다.
 *
 * 아직 세션 검사가 없다. AGENTS.md에 인증을 담당하는 에이전트가 없어서
 * docs/DEFERRED.md에 올려뒀다.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
