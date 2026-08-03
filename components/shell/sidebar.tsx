"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/design/cn";
import { NAV_ITEMS } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

const COLLAPSE_KEY = "sidebar-collapsed";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  }

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r border-line bg-surface transition-[width] lg:flex lg:flex-col",
        collapsed ? "w-14" : "w-56",
      )}
    >
      <div className={cn("flex h-14 items-center border-b border-line", collapsed ? "justify-center px-2" : "px-4")}>
        {!collapsed && <span className="text-sm font-semibold text-text">Personal OS</span>}
      </div>

      <nav aria-label="주요 메뉴" className="flex-1 space-y-1 p-2">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      <div className="space-y-1 border-t border-line p-2">
        <ThemeToggle collapsed={collapsed} />
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          aria-expanded={!collapsed}
          className={cn(
            "flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-text-muted",
            "transition-colors hover:bg-accent-soft hover:text-accent",
            collapsed ? "w-9 justify-center px-0" : "w-full",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" aria-hidden="true" />
          )}
          {!collapsed && <span>접기</span>}
        </button>
      </div>
    </aside>
  );
}

/** 모바일(<1024px)은 사이드바 대신 상단 가로 네비게이션을 쓴다. */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface lg:hidden">
      <div className="flex h-12 items-center justify-between px-4">
        <span className="text-sm font-semibold text-text">Personal OS</span>
        <ThemeToggle collapsed />
      </div>
      <nav aria-label="주요 메뉴" className="flex gap-1 overflow-x-auto px-2 pb-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 cursor-pointer rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                active ? "bg-accent-soft font-medium text-accent" : "text-text-muted hover:bg-accent-soft",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: (typeof NAV_ITEMS)[number];
  pathname: string;
  collapsed: boolean;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 rounded-lg text-sm transition-colors",
        collapsed ? "justify-center px-0" : "px-2.5",
        active ? "bg-accent-soft font-medium text-accent" : "text-text-muted hover:bg-accent-soft hover:text-accent",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
