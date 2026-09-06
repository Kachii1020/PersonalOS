"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/design/cn";
import { domainTitle } from "@/lib/ai/prompts/quiz";

type Props = {
  lesson: {
    domain: string;
    title: string;
    content: string;
    keyTerms: string[];
  };
  /** 처음부터 펼쳐 놓을지. */
  defaultOpen?: boolean;
};

export function DomainLessonCard({ lesson, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <CardHeader className="flex-1">
          <CardTitle>{domainTitle(lesson.domain)}</CardTitle>
        </CardHeader>
        <ChevronDown
          className={cn(
            "mr-3 size-4 shrink-0 text-text-muted transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-4 pt-0">
          <h3 className="text-sm font-medium text-text">{lesson.title}</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-text-muted">{lesson.content}</p>
          <div className="flex flex-wrap gap-1.5">
            {lesson.keyTerms.map((term) => (
              <Badge key={term} tone="accent">{term}</Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
