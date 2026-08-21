import { redirect } from "next/navigation";
import { Sidebar } from "@/components/shell/sidebar";
import { BottomTabBar } from "@/components/shell/bottom-tab-bar";
import { BudgetBanner } from "@/components/shell/budget-banner";
import { CommandPalette } from "@/components/shell/command-palette";
import { OfflineBanner } from "@/components/shell/offline-banner";
import { QuickCapture } from "@/components/shell/quick-capture";
import { SyncBanner } from "@/components/shell/sync-banner";
import { ToastProvider } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/server";
import { getSidebarOrder } from "@/lib/repos/user-prefs";
import { saveSidebarOrder, signOut } from "./actions";

/**
 * 인증된 영역의 셸. 위젯 데이터는 여기서 가져오지 않는다 — 각 페이지가 lib/repos로 읽는다.
 * 사이드바 순서만 예외인데, 셸 자체의 상태라 여기서 읽는다.
 *
 * 모바일은 하단 탭 바(iOS 스타일), 데스크톱은 사이드바를 쓴다.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 미들웨어가 먼저 막지만, 레이아웃에서도 확인한다. 인증 검사는 한 겹으로 두지 않는다.
  if (!user) redirect("/login");

  const savedOrder = await getSidebarOrder();

  return (
    <ToastProvider>
      <div className="flex min-h-dvh bg-bg">
        <Sidebar savedOrder={savedOrder} onReorder={saveSidebarOrder} onSignOut={signOut} />
        <div className="flex min-w-0 flex-1 flex-col">
          <OfflineBanner />
          <SyncBanner />
          <BudgetBanner />
          {/* 모바일: 하단 탭 바 높이(50px) + safe area 만큼 main에 여백을 준다. */}
          <main className="min-w-0 flex-1 p-4 pb-[calc(50px+env(safe-area-inset-bottom)+1rem)] lg:p-6 lg:pb-6">
            {children}
          </main>
          <BottomTabBar />
        </div>
      </div>
      {/* 전역 오버레이 — 모든 페이지에서 ⌘K·N·FAB로 접근한다 (1-B, 1-C, 2-D). */}
      <CommandPalette />
      <QuickCapture />
    </ToastProvider>
  );
}
