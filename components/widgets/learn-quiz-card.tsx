import type { Quiz } from "@/lib/learn/curriculum";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function QuizCard({
  ex,
  answered,
  selected,
  onSelect,
}: {
  ex: Quiz;
  answered: boolean;
  selected: number | undefined;
  onSelect: (i: number) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-4 text-sm font-semibold leading-relaxed text-text">
        {ex.q}
      </p>
      <div className="flex flex-col gap-2">
        {ex.options.map((opt, i) => {
          let cls =
            "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ";
          if (!answered) {
            cls +=
              `border-line bg-transparent text-text hover:border-accent cursor-pointer ${FOCUS}`;
          } else if (i === ex.answer) {
            cls +=
              "border-positive bg-positive/10 text-positive";
          } else if (i === selected) {
            cls +=
              "border-negative bg-negative/10 text-negative";
          } else {
            cls += "border-line text-text-muted opacity-50";
          }
          return (
            <button
              key={i}
              onClick={() => !answered && onSelect(i)}
              disabled={answered}
              className={cls}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-3 rounded-lg bg-accent-soft p-3 text-xs leading-relaxed text-text-muted">
          {ex.explain}
        </div>
      )}
    </div>
  );
}
