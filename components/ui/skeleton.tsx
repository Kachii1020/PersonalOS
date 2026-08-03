import { cn } from "@/lib/design/cn";

/** 로딩 자리표시자. prefers-reduced-motion에서는 globals.css가 애니메이션을 끈다. */
export function Skeleton({ className, ...props }: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-accent-soft", className)}
      {...props}
    />
  );
}

/** 위젯 로딩 상태의 기본형. 위젯마다 다시 만들지 않는다. */
export function SkeletonLines({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="불러오는 중">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-4 w-2/3" : "h-4 w-full"} />
      ))}
    </div>
  );
}
