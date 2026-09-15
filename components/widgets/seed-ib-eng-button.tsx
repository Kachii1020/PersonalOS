"use client";

import { useState, useTransition } from "react";
import { generateMissingLessons } from "@/app/(dashboard)/quiz/actions";
import { buttonClass } from "@/components/ui/button";

export function SeedIbEngButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await generateMissingLessons();
            if (!result.ok) setError(result.error);
          });
        }}
        className={buttonClass({ variant: "primary" })}
      >
        {pending ? "넣는 중…" : "90문항 넣기"}
      </button>
      {error && <p className="text-sm text-negative">{error}</p>}
    </div>
  );
}
