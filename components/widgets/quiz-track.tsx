import Link from "next/link";
import { IB_ENG_DOMAINS } from "@/lib/quiz/ib-eng";
import type { DomainProgress } from "@/lib/repos/quiz";
import type { QuizDomain } from "@/lib/ai/prompts/quiz";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

type Props = {
  progress: DomainProgress[];
  activeDomain?: QuizDomain;
};

export function QuizTrack({ progress, activeDomain }: Props) {
  const byDomain = new Map(progress.map((row) => [row.domain, row]));
  const attempted = progress.reduce((sum, row) => sum + row.attempted, 0);
  const total = progress.reduce((sum, row) => sum + row.total, 0);

  return (
    <section className="mb-6 space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">IB Engineering</h1>
          <p className="mt-1 text-sm text-text-muted">
            은행 테크 면접·직무. 엑셀 모델링이 아니다.
          </p>
        </div>
        <p className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
          {attempted}/{total}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {IB_ENG_DOMAINS.map((meta) => {
          const row = byDomain.get(meta.id);
          const done = row?.attempted ?? 0;
          const max = row?.total ?? 0;
          const active = activeDomain === meta.id;
          return (
            <Link
              key={meta.id}
              href={active ? "/quiz" : `/quiz?topic=${meta.id}`}
              className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${FOCUS} ${
                active ? "border-accent bg-accent-soft" : "border-line bg-surface"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-semibold text-text">{meta.title}</h2>
                <span className="font-mono text-[10px] tabular-nums text-text-muted">
                  {done}/{max}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">{meta.blurb}</p>
            </Link>
          );
        })}
      </div>
      {activeDomain && (
        <Link href="/quiz" className={`cursor-pointer text-xs font-semibold text-accent ${FOCUS}`}>
          오늘 세트(섞기)로
        </Link>
      )}
    </section>
  );
}
