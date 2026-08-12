"use client";

import { useActionState, useEffect } from "react";
import { FileText, Presentation } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { uploadMaterial, summarizeMaterial, type FormState } from "@/app/(dashboard)/courses/actions";
import type { MaterialRow } from "@/lib/repos/materials";
import { monthDayWeekday } from "@/lib/time";

export function MaterialPanel({
  courseId,
  materials,
  className,
}: {
  courseId: string;
  materials: MaterialRow[];
  className?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadMaterial, null);
  const toast = useToast();

  useEffect(() => {
    if (state) toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>강의자료</CardTitle>
        <CardHint>{materials.length > 0 ? `${materials.length}개` : "PDF · PPTX"}</CardHint>
      </CardHeader>

      <form action={action} className="mb-4 space-y-3 border-b border-line pb-4">
        <input type="hidden" name="courseId" value={courseId} />
        <Field label="파일 추가" htmlFor="file" hint="올리는 즉시 텍스트를 뽑습니다. 요약은 버튼을 눌러야 합니다.">
          <Input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.pptx"
            required
            className="file:mr-3 file:rounded file:border-0 file:bg-accent-soft file:px-2 file:py-1 file:text-xs file:text-text"
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "읽는 중" : "업로드"}
        </Button>
      </form>

      {materials.length === 0 ? (
        <EmptyState icon={FileText} message="아직 올린 자료가 없습니다." />
      ) : (
        <ul className="space-y-3">
          {materials.map((material) => (
            <MaterialItem key={material.id} courseId={courseId} material={material} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MaterialItem({ courseId, material }: { courseId: string; material: MaterialRow }) {
  const [state, action, pending] = useActionState<FormState, FormData>(summarizeMaterial, null);
  const toast = useToast();
  // MIME 상수는 server-only 모듈에 있다. 아이콘은 장식이라 확장자로 고른다.
  const Icon = material.filename.toLowerCase().endsWith(".pptx") ? Presentation : FileText;

  useEffect(() => {
    if (state?.ok) toast(state.message, "success");
  }, [state, toast]);

  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm text-text">
            <Icon aria-hidden className="size-4 shrink-0 text-text-muted" />
            <span className="truncate">{material.filename}</span>
          </p>
          <p className="num mt-0.5 text-xs text-text-muted">
            {monthDayWeekday(material.uploadedAt)} · {material.textLength.toLocaleString()}자
          </p>
        </div>

        <form action={action} className="shrink-0">
          <input type="hidden" name="id" value={material.id} />
          <input type="hidden" name="courseId" value={courseId} />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "요약 중" : material.summary ? "다시 요약" : "요약하기"}
          </Button>
        </form>
      </div>

      {state && !state.ok && (
        <p role="status" className="mt-2 text-xs text-negative">
          {state.message}
        </p>
      )}

      {material.summary && (
        <div className="mt-3 border-t border-line pt-3">
          {material.keywords && material.keywords.length > 0 && (
            <p className="mb-2 flex flex-wrap gap-1">
              {material.keywords.map((keyword) => (
                <Badge key={keyword} tone="accent">
                  {keyword}
                </Badge>
              ))}
            </p>
          )}
          <div className="space-y-2 text-sm leading-relaxed text-text-muted">
            {material.summary.split(/\n{2,}/).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}
