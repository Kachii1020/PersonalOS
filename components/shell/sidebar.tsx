"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GripVertical, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/design/cn";
import { NAV_ITEMS, type NavItem } from "./nav-items";
import { ThemeToggle } from "./theme-toggle";

const COLLAPSE_KEY = "sidebar-collapsed";

type ShellProps = {
  /** Supabase user_prefs에 저장된 순서. 없으면 NAV_ITEMS 기본 순서를 쓴다. */
  savedOrder: string[] | null;
  onReorder: (order: string[]) => Promise<{ ok: boolean; error?: string }>;
  onSignOut: () => Promise<void>;
};

function applyOrder(savedOrder: string[] | null): NavItem[] {
  if (!savedOrder) return NAV_ITEMS;
  const byHref = new Map(NAV_ITEMS.map((i) => [i.href, i]));
  const ordered = savedOrder.map((h) => byHref.get(h)).filter((i): i is NavItem => Boolean(i));
  // 저장 이후에 항목이 추가됐으면 뒤에 붙인다.
  const seen = new Set(ordered.map((i) => i.href));
  return [...ordered, ...NAV_ITEMS.filter((i) => !seen.has(i.href))];
}

export function Sidebar({ savedOrder, onReorder, onSignOut }: ShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [items, setItems] = useState<NavItem[]>(() => applyOrder(savedOrder));
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapse() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    setItems(next);
    void onReorder(next.map((i) => i.href));
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
        {items.map((item, index) => (
          <NavRow
            key={item.href}
            item={item}
            index={index}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
            dragging={dragIndex === index}
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDropAt={() => {
              if (dragIndex !== null) move(dragIndex, index);
              setDragIndex(null);
            }}
            onMove={(delta) => move(index, index + delta)}
          />
        ))}
      </nav>

      <div className="space-y-1 border-t border-line p-2">
        <ThemeToggle collapsed={collapsed} />
        <ShellButton
          collapsed={collapsed}
          label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          icon={collapsed ? PanelLeftOpen : PanelLeftClose}
          text="접기"
          onClick={toggleCollapse}
          aria-expanded={!collapsed}
        />
        <form action={onSignOut}>
          <ShellButton collapsed={collapsed} label="로그아웃" icon={LogOut} text="로그아웃" type="submit" />
        </form>
      </div>
    </aside>
  );
}

/** 모바일(<1024px)은 사이드바 대신 상단 가로 네비게이션을 쓴다. 재정렬은 데스크톱 전용이다. */
export function MobileNav({ savedOrder }: { savedOrder: string[] | null }) {
  const pathname = usePathname();
  const items = useMemo(() => applyOrder(savedOrder), [savedOrder]);

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-surface lg:hidden">
      <div className="flex h-12 items-center justify-between px-4">
        <span className="text-sm font-semibold text-text">Personal OS</span>
        <ThemeToggle collapsed />
      </div>
      <nav aria-label="주요 메뉴" className="flex gap-1 overflow-x-auto px-2 pb-2">
        {items.map((item) => {
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

function NavRow({
  item,
  index,
  active,
  collapsed,
  dragging,
  onDragStart,
  onDragEnd,
  onDropAt,
  onMove,
}: {
  item: NavItem;
  index: number;
  active: boolean;
  collapsed: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropAt: () => void;
  onMove: (delta: number) => void;
}) {
  const Icon = item.icon;

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDropAt}
      className={cn("group flex items-center gap-1", dragging && "opacity-50")}
    >
      {!collapsed && (
        <button
          type="button"
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          // 드래그는 마우스 전용이라 키보드 대안을 같이 준다.
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && e.altKey) {
              e.preventDefault();
              onMove(-1);
            }
            if (e.key === "ArrowDown" && e.altKey) {
              e.preventDefault();
              onMove(1);
            }
          }}
          aria-label={`${item.label} 순서 바꾸기. Alt와 위아래 화살표로 이동합니다. 현재 ${index + 1}번째`}
          className="cursor-grab rounded p-1 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
      )}
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-9 flex-1 cursor-pointer items-center gap-2 rounded-lg text-sm transition-colors",
          collapsed ? "justify-center px-0" : "px-2.5",
          active ? "bg-accent-soft font-medium text-accent" : "text-text-muted hover:bg-accent-soft hover:text-accent",
        )}
      >
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    </div>
  );
}

function ShellButton({
  collapsed,
  label,
  icon: Icon,
  text,
  ...props
}: React.ComponentPropsWithoutRef<"button"> & {
  collapsed: boolean;
  label: string;
  icon: NavItem["icon"];
  text: string;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-text-muted",
        "transition-colors hover:bg-accent-soft hover:text-accent",
        collapsed ? "w-9 justify-center px-0" : "w-full",
      )}
      {...props}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span>{text}</span>}
    </button>
  );
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
