import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  FolderKanban,
  GitGraph,
  LayoutDashboard,
  Library,
  ListTodo,
  Newspaper,
  Settings,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

/** SPEC.md 6.2의 전체 경로. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/tasks", label: "마감·할 일", icon: ListTodo },
  { href: "/quiz", label: "퀴즈", icon: BrainCircuit },
  { href: "/courses", label: "과목", icon: BookOpen },
  { href: "/wiki", label: "위키", icon: Library },
  { href: "/invest", label: "투자", icon: TrendingUp },
  { href: "/portfolio", label: "포트폴리오", icon: GitGraph },
  { href: "/apply", label: "지원", icon: FolderKanban },
  { href: "/briefing", label: "브리핑", icon: Newspaper },
  { href: "/settings", label: "설정", icon: Settings },
];
