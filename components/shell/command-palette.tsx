"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarPlus,
  ExternalLink,
  FileQuestion,
  Library,
  ListPlus,
  ListTodo,
  Moon,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/design/cn";
import { searchEverything } from "@/app/(dashboard)/actions";
import type { SearchResult } from "@/lib/repos/search";
import { NAV_ITEMS } from "./nav-items";
import { openQuickCapture } from "./quick-capture";

export const COMMAND_PALETTE_EVENT = "personalos:command-palette";

type Item = {
  key: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  run: () => void;
};

const TYPE_META: Record<SearchResult["type"], { group: string; icon: LucideIcon }> = {
  event: { group: "일정", icon: CalendarDays },
  task: { group: "할 일", icon: ListTodo },
  course: { group: "과목", icon: FileQuestion },
  wiki: { group: "위키", icon: Library },
};

/**
 * ⌘K 커맨드 팔레트 (1-C) + G-then-X 키보드 내비 (2-D).
 * 정적 항목(페이지·퀵 액션)은 로컬 필터, DB·위키는 서버 액션(300ms debounce).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState<SearchResult[]>([]);
  const [cursor, setCursor] = useState(0);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingG = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setRemote([]);
    setCursor(0);
  }, []);

  // 전역 키보드: ⌘K/Ctrl+K 팔레트, N 퀵 캡처, G→{H,C,T,Q,B} 이동 (2-D).
  useEffect(() => {
    const NAV_BY_KEY: Record<string, string> = { h: "/", c: "/calendar", t: "/tasks", q: "/quiz", b: "/briefing" };

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // 입력 중에는 단축키를 먹지 않는다.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;

      const key = e.key.toLowerCase();
      if (pendingG.current) {
        pendingG.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const href = NAV_BY_KEY[key];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      if (key === "g") {
        pendingG.current = true;
        gTimer.current = setTimeout(() => {
          pendingG.current = false;
        }, 500);
        return;
      }
      if (key === "n") {
        e.preventDefault();
        openQuickCapture();
      }
    }

    const show = () => setOpen(true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_EVENT, show);
    };
  }, [router]);

  // 서버 검색 — 300ms debounce.
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setRemote([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          setRemote(await searchEverything(query));
        } catch {
          // 검색 실패는 결과 없음으로 보인다. 콘솔에만 남긴다.
          setRemote([]);
        }
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const items = useMemo<Item[]>(() => {
    const q = query.trim().toLowerCase();

    const go = (href: string) => () => {
      close();
      router.push(href);
    };

    const staticItems: Item[] = [
      ...NAV_ITEMS.map((nav) => ({
        key: `page:${nav.href}`,
        group: "이동",
        title: nav.label,
        icon: nav.icon,
        run: go(nav.href),
      })),
      {
        key: "action:add-task",
        group: "퀵 액션",
        title: "할 일 추가",
        icon: ListPlus,
        run: () => {
          close();
          openQuickCapture();
        },
      },
      {
        key: "action:add-event",
        group: "퀵 액션",
        title: "일정 추가",
        icon: CalendarPlus,
        run: () => {
          close();
          openQuickCapture();
        },
      },
      {
        key: "action:theme",
        group: "퀵 액션",
        title: "테마 전환",
        icon: Moon,
        run: () => {
          const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
          document.documentElement.dataset.theme = next;
          localStorage.setItem("theme", next);
          close();
        },
      },
    ].filter((item) => q.length === 0 || item.title.toLowerCase().includes(q));

    const remoteItems: Item[] = remote.map((r, i) => {
      const meta = TYPE_META[r.type];
      const external = r.href.startsWith("http");
      return {
        key: `remote:${r.type}:${i}`,
        group: meta.group,
        title: r.title,
        ...(r.subtitle ? { subtitle: r.subtitle } : {}),
        icon: external ? ExternalLink : meta.icon,
        run: external
          ? () => {
              window.open(r.href, "_blank", "noopener");
              close();
            }
          : go(r.href),
      };
    });

    return [...staticItems, ...remoteItems].slice(0, 15);
  }, [query, remote, router, close]);

  // 결과가 바뀌면 커서를 처음으로.
  useEffect(() => setCursor(0), [items.length, query]);

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || (e.ctrlKey && e.key.toLowerCase() === "j")) {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, items.length - 1));
    } else if (e.key === "ArrowUp" || (e.ctrlKey && e.key.toLowerCase() === "k")) {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[cursor]?.run();
    }
  }

  let lastGroup = "";

  return (
    <Dialog open={open} onClose={close} label="검색·이동" className="lg:mt-24 lg:mb-auto">
      <div className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Search className="size-4 shrink-0 text-text-muted" aria-hidden />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          autoFocus
          placeholder="페이지, 일정, 할 일, 과목, 위키 검색"
          aria-label="검색"
          className="w-full bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
        />
        <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-[10px] text-text-muted lg:block">esc</kbd>
      </div>

      <ul role="listbox" aria-label="검색 결과" className="max-h-[50vh] overflow-y-auto p-2">
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-text-muted">
            결과가 없습니다. 다른 검색어를 시도해 보세요.
          </li>
        )}
        {items.map((item, i) => {
          const showGroup = item.group !== lastGroup;
          lastGroup = item.group;
          const Icon = item.icon;
          return (
            <li key={item.key}>
              {showGroup && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-text-muted uppercase">
                  {item.group}
                </p>
              )}
              <button
                type="button"
                role="option"
                aria-selected={i === cursor}
                onClick={item.run}
                onMouseEnter={() => setCursor(i)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  i === cursor ? "bg-accent-soft text-text" : "text-text",
                )}
              >
                <Icon className="size-4 shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {item.subtitle && <span className="num shrink-0 text-xs text-text-muted">{item.subtitle}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
