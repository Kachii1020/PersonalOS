import {
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Ellipsis,
  FolderKanban,
  GraduationCap,
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
  { href: "/learn", label: "학습", icon: GraduationCap },
  { href: "/courses", label: "과목", icon: BookOpen },
  { href: "/wiki", label: "위키", icon: Library },
  { href: "/invest", label: "투자", icon: TrendingUp },
  { href: "/portfolio", label: "포트폴리오", icon: GitGraph },
  { href: "/apply", label: "지원", icon: FolderKanban },
  { href: "/briefing", label: "브리핑", icon: Newspaper },
  { href: "/settings", label: "설정", icon: Settings },
];

/** 하단 탭 바에 표시할 주요 항목 (5개). 나머지는 "더보기" 탭 뒤에 배치. */
export const TAB_BAR_ITEMS: NavItem[] = [
  { href: "/", label: "홈", icon: LayoutDashboard },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  { href: "/quiz", label: "퀴즈", icon: BrainCircuit },
  { href: "/briefing", label: "브리핑", icon: Newspaper },
];

/** "더보기" 탭 자체의 정의. */
export const MORE_TAB: NavItem = { href: "/more", label: "더보기", icon: Ellipsis };

/** 탭 바에 없는 항목 — "더보기" 화면에 리스트로 보여준다. */
export const MORE_ITEMS: NavItem[] = NAV_ITEMS.filter(
  (item) => !TAB_BAR_ITEMS.some((tab) => tab.href === item.href),
);
