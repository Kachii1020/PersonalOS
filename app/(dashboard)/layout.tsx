import { redirect } from "next/navigation";
import { MobileNav, Sidebar } from "@/components/shell/sidebar";
import { SyncBanner } from "@/components/shell/sync-banner";
import { createClient } from "@/lib/supabase/server";
import { getSidebarOrder } from "@/lib/repos/user-prefs";
import { saveSidebarOrder, signOut } from "./actions";

/**
 * 인증된 영역의 셸. 위젯 데이터는 여기서 가져오지 않는다 — 각 페이지가 lib/repos로 읽는다.
 * 사이드바 순서만 예외인데, 셸 자체의 상태라 여기서 읽는다.
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
    <div className="flex min-h-dvh bg-bg">
      <Sidebar savedOrder={savedOrder} onReorder={saveSidebarOrder} onSignOut={signOut} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav savedOrder={savedOrder} />
        <SyncBanner />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
