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

/** 링크를 버튼처럼 보이게 할 때 쓴다. `<Link className={buttonClass()}>` */
export function buttonClass({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(
    // 클릭 가능 요소에는 cursor-pointer, 전환은 200ms (SPEC.md 6.4 규칙 7·8)
    "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium",
    // 눌렀을 때 살짝 줄어드는 press 피드백 (UX 개선 F4)
    "transition-[background-color,color,transform] duration-100 active:scale-[0.97]",
    "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

type ButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  variant?: Variant;
  size?: Size;
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClass({ variant, size, className })} {...props} />;
}
