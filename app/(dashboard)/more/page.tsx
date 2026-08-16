import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MORE_ITEMS } from "@/components/shell/nav-items";

export const metadata = { title: "더보기 · Personal OS" };

export default function MorePage() {
  return (
    <>
      <h1 className="mb-4 text-xl font-bold text-text">더보기</h1>

      <div className="space-y-1">
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex cursor-pointer items-center gap-3 rounded-xl bg-surface px-4 py-3.5 transition-[background-color,transform] duration-150 active:scale-[0.98] active:bg-accent-soft"
            >
              <div className="flex size-8 items-center justify-center rounded-lg bg-accent-soft">
                <Icon className="size-[18px] text-accent" aria-hidden="true" />
              </div>
              <span className="flex-1 text-sm font-medium text-text">{item.label}</span>
              <ChevronRight className="size-4 text-text-muted" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </>
  );
}
