import Link from "next/link";
import { Newspaper } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { latestBriefing, type Briefing } from "@/lib/repos/briefings";
import type { Sector } from "@/config/news-sources";

const SECTOR_LABEL: Record<Sector, string> = {
  finance: "금융·거시",
  ai: "인공지능",
  semiconductor: "반도체",
  it: "IT 산업",
  rotating: "오늘의 주제",
};

/** 오늘의 브리핑. 달력과 함께 글래스를 쓰는 두 위젯 중 하나다 (SPEC.md 6.4 규칙 1). */
export async function DailyBriefing({ className }: { className?: string }) {
  let briefing: Briefing | null;
  try {
    briefing = await latestBriefing();
  } catch {
    return (
      <Card glass className={className}>
        <CardHeader>
          <CardTitle>오늘의 브리핑</CardTitle>
        </CardHeader>
        <ErrorState what="브리핑을 불러오지 못했습니다" fix="잠시 후 새로고침하세요." />
      </Card>
    );
  }

  if (!briefing) {
    return (
      <Card glass className={className}>
        <CardHeader>
          <CardTitle>오늘의 브리핑</CardTitle>
        </CardHeader>
        <EmptyState
          icon={Newspaper}
          message="아직 생성된 브리핑이 없습니다. 뉴스를 수집한 뒤 브리핑 잡이 돌면 여기에 표시됩니다."
          action={
            <Link href="/briefing" className={buttonClass({ size: "sm" })}>
              브리핑 아카이브
            </Link>
          }
        />
      </Card>
    );
  }

  if (briefing.status !== "ready") {
    return (
      <Card glass className={className}>
        <CardHeader>
          <CardTitle>오늘의 브리핑</CardTitle>
          <CardHint>{briefing.briefingDate}</CardHint>
        </CardHeader>
        <ErrorState
          what={briefing.status === "failed" ? "브리핑 생성이 실패했습니다" : "브리핑을 생성하는 중입니다"}
          fix={
            briefing.status === "failed"
              ? "설정에서 잡 로그를 확인하고 브리핑 잡을 다시 실행하세요."
              : "잠시 후 새로고침하세요."
          }
          action={
            <Link href="/settings" className={buttonClass({ size: "sm" })}>
              잡 로그 보기
            </Link>
          }
        />
      </Card>
    );
  }

  return (
    <Card glass className={className}>
      <CardHeader>
        <CardTitle>오늘의 브리핑</CardTitle>
        <CardHint>
          {briefing.briefingDate} · 섹션 {briefing.sections.length}개
        </CardHint>
      </CardHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {briefing.sections.map((section, index) => (
          <section key={`${section.sector}-${index}`} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge tone="accent">{SECTOR_LABEL[section.sector] ?? section.sector}</Badge>
            </div>
            <h3 className="text-sm font-semibold text-text">{section.headline}</h3>
            <ul className="space-y-1">
              {section.bullets.map((bullet, i) => (
                <li key={i} className="flex gap-1.5 text-sm text-text-muted">
                  <span aria-hidden="true" className="select-none">
                    ·
                  </span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
            <p className="border-l-2 border-accent pl-2 text-sm text-text">{section.why_it_matters}</p>
            {section.source_urls.length > 0 && (
              <p className="text-xs text-text-muted">
                출처{" "}
                {section.source_urls.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="num cursor-pointer text-accent underline-offset-2 transition-colors hover:underline"
                  >
                    [{i + 1}]{" "}
                  </a>
                ))}
              </p>
            )}
          </section>
        ))}
      </div>
    </Card>
  );
}
