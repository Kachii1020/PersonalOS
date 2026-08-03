"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/design/cn";

/** 테마 전환. 최초 값은 layout.tsx의 부트 스크립트가 페인트 전에 정한다. */
export function ThemeToggle({ collapsed = false }: { collapsed?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    setDark(!dark);
  }

  const label = dark ? "라이트 모드로 전환" : "다크 모드로 전환";
  const Icon = dark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-9 cursor-pointer items-center gap-2 rounded-lg px-2.5 text-sm text-text-muted",
        "transition-colors hover:bg-accent-soft hover:text-accent",
        collapsed ? "w-9 justify-center px-0" : "w-full",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {!collapsed && <span>{dark ? "라이트 모드" : "다크 모드"}</span>}
    </button>
  );
}
