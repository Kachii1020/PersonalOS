import { cn } from "@/lib/design/cn";

type Tone = "neutral" | "positive" | "negative" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "border-line text-text-muted",
  positive: "border-positive/40 text-positive",
  negative: "border-negative/40 text-negative",
  accent: "border-accent/40 text-accent",
};

type BadgeProps = React.ComponentPropsWithoutRef<"span"> & { tone?: Tone };

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-1.5 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
