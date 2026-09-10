import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/design/cn";
import { domainTitle } from "@/lib/ai/prompts/quiz";

type Props = {
  entry: {
    domain: string;
    question: string;
    choices: string[];
    answerIndex: number;
    chosenIndex: number;
    explanation: string;
    conceptHint: string | null;
    difficulty: number;
    attemptedAt: string;
  };
};

/** 오답노트 카드. 선택한 답(빨강), 정답(초록), 해설을 보여준다. */
export function WrongAnswerCard({ entry }: Props) {
  const dateStr = new Date(entry.attemptedAt).toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{domainTitle(entry.domain)}</CardTitle>
        <span className="flex items-center gap-2">
          <Badge>난이도 {entry.difficulty}</Badge>
          <CardHint>{dateStr}</CardHint>
        </span>
      </CardHeader>

      <p className="mb-3 text-sm text-text">{entry.question}</p>

      <ul className="space-y-1.5">
        {entry.choices.map((choice, i) => {
          const isCorrect = i === entry.answerIndex;
          const isWrongPick = i === entry.chosenIndex;
          return (
            <li
              key={i}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                isCorrect && "border-positive bg-positive/5 text-positive",
                isWrongPick && !isCorrect && "border-negative bg-negative/5 text-negative",
                !isCorrect && !isWrongPick && "border-line text-text-muted",
              )}
            >
              <span className="num shrink-0">{i + 1}</span>
              <span>{choice}</span>
              {isCorrect && <span className="ml-auto shrink-0 text-xs">정답</span>}
              {isWrongPick && !isCorrect && <span className="ml-auto shrink-0 text-xs">선택</span>}
            </li>
          );
        })}
      </ul>

      {entry.conceptHint && (
        <div className="mt-3 rounded-lg bg-accent-soft/50 px-3 py-2">
          <p className="text-xs font-medium text-accent">개념 힌트</p>
          <p className="text-sm text-text-muted">{entry.conceptHint}</p>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-medium text-text-muted">해설</p>
        <p className="text-sm text-text-muted">{entry.explanation}</p>
      </div>
    </Card>
  );
}
