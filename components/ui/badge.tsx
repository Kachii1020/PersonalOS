import { cn } from "@/lib/design/cn";

type Tone = "neutral" | "positive" | "negative" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-[rgba(0,0,0,0.05)] text-text-muted dark:bg-[rgba(255,255,255,0.08)]",
  positive: "bg-positive/10 text-positive",
  negative: "bg-negative/10 text-negative",
  accent: "bg-accent-soft text-accent",
};

type BadgeProps = React.ComponentPropsWithoutRef<"span"> & { tone?: Tone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
