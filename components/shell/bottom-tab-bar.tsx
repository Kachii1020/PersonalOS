"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/design/cn";
import { TAB_BAR_ITEMS, MORE_TAB, MORE_ITEMS, type NavItem } from "./nav-items";

/** "더보기" 하위 페이지에 있을 때도 더보기 탭을 활성으로 표시하기 위한 경로 집합. */
const MORE_HREFS = new Set([MORE_TAB.href, ...MORE_ITEMS.map((i) => i.href)]);

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * iOS-style 하단 탭 바. lg 이상에서는 숨긴다 (데스크톱은 사이드바를 쓴다).
 */
export function BottomTabBar() {
  const pathname = usePathname();
  const moreActive = MORE_HREFS.has(pathname) || MORE_ITEMS.some((i) => isActive(pathname, i.href));

  return (
    <nav
      aria-label="탭 메뉴"
      className={cn(
        "fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-md lg:hidden",
        /* safe area 하단 패딩 — 홈 인디케이터 겹침 방지 */
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <div className="flex h-[50px] items-end justify-around px-2">
        {TAB_BAR_ITEMS.map((item) => (
          <TabItem key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <TabItem item={MORE_TAB} active={moreActive} />
      </div>
    </nav>
  );
}

function TabItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1",
        "cursor-pointer select-none transition-[color,transform] duration-150",
        "active:scale-[0.88]",
        active ? "text-accent" : "text-text-muted",
      )}
    >
      <Icon className="size-[22px]" aria-hidden="true" />
      <span className="text-[10px] leading-tight font-medium">{item.label}</span>
    </Link>
  );
}
