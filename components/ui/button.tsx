import { cn } from "@/lib/design/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-bg hover:opacity-90",
  secondary: "bg-accent-soft text-accent hover:brightness-95",
  ghost: "text-text-muted hover:bg-accent-soft hover:text-accent",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-9 px-3 text-sm",
};

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        // 클릭 가능 요소에는 cursor-pointer, 전환은 200ms (SPEC.md 6.4 규칙 7·8)
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
