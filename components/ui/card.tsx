import { cn } from "@/lib/design/cn";

type CardProps = React.ComponentPropsWithoutRef<"section"> & {
  /**
   * 글래스는 달력 카드와 브리핑 카드에만 켠다 (SPEC.md 6.4 규칙 1).
   * 다른 위젯에서 true를 주면 리뷰에서 반려된다.
   */
  glass?: boolean;
};

export function Card({ glass = false, className, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-xl p-4 shadow-sm", // 그림자는 최대 1단계 (규칙 6)
        glass ? "glass" : "border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.ComponentPropsWithoutRef<"header">) {
  return <header className={cn("mb-3 flex items-baseline justify-between gap-2", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.ComponentPropsWithoutRef<"h2">) {
  return <h2 className={cn("text-base font-semibold text-text", className)} {...props} />;
}

export function CardHint({ className, ...props }: React.ComponentPropsWithoutRef<"p">) {
  return <p className={cn("text-xs text-text-muted", className)} {...props} />;
}
