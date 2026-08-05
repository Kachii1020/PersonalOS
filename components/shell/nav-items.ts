import { BookOpen, BrainCircuit, CalendarDays, LayoutDashboard, ListTodo, Newspaper, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/**
 * SPEC.md 6.2의 경로 중 구현된 것만 넣는다.
 * /wiki (Phase 2 남은 것), /invest, /portfolio, /apply (Phase 3)는
 * 해당 화면이 생길 때 추가한다.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/tasks", label: "마감·할 일", icon: ListTodo },
  { href: "/quiz", label: "퀴즈", icon: BrainCircuit },
  { href: "/courses", label: "과목", icon: BookOpen },
  { href: "/briefing", label: "브리핑", icon: Newspaper },
  { href: "/settings", label: "설정", icon: Settings },
];
