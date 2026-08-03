import { cn } from "@/lib/design/cn";

const CONTROL =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text " +
  "transition-colors placeholder:text-text-muted disabled:cursor-not-allowed disabled:opacity-50";

export function Input({ className, ...props }: React.ComponentPropsWithoutRef<"input">) {
  return <input className={cn(CONTROL, className)} {...props} />;
}

export function Select({ className, ...props }: React.ComponentPropsWithoutRef<"select">) {
  return <select className={cn(CONTROL, "cursor-pointer", className)} {...props} />;
}

/** 라벨과 컨트롤을 묶는다. 라벨 없는 입력은 스크린리더에서 정체를 알 수 없다. */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-text">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </div>
  );
}
