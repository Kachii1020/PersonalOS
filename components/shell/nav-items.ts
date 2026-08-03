import { CalendarDays, LayoutDashboard, ListTodo, Newspaper, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * SPEC.md 6.2의 Phase 1 경로만 넣는다.
 * /quiz, /wiki, /courses (Phase 2), /invest, /portfolio, /apply (Phase 3)는
 * 해당 Phase에서 추가한다.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/tasks", label: "마감·할 일", icon: ListTodo },
  { href: "/briefing", label: "브리핑", icon: Newspaper },
  { href: "/settings", label: "설정", icon: Settings },
];
