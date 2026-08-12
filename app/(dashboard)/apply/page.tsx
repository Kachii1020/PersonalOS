import { Briefcase, ExternalLink } from "lucide-react";
import { Card, CardHeader, CardHint, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listApplications, groupByStage } from "@/lib/repos/applications";

export const metadata = { title: "지원 파이프라인 · Personal OS" };

/**
 * SPEC.md 6.2: /apply — 지원 파이프라인.
 * Notion의 Applications DB를 읽기 전용으로 보여준다.
 * G3 조건 5: 단계별 그룹핑.
 */
export default async function ApplyPage() {
  const apps = await listApplications();

  if (apps.length === 0) {
    const noEnv = !process.env.NOTION_DB_APPLICATIONS?.trim();
    return (
      <>
        <h1 className="mb-4 text-xl font-semibold text-text">지원 파이프라인</h1>
        <Card>
          <CardHeader>
            <CardTitle>지원 현황</CardTitle>
            <CardHint>Notion 읽기 전용</CardHint>
          </CardHeader>
          <EmptyState
            icon={Briefcase}
            message={
              noEnv
                ? "NOTION_DB_APPLICATIONS를 .env.local에 설정하면 Notion 파이프라인이 여기에 표시됩니다. npm run notion:check로 ID를 찾으세요."
                : "Notion의 Applications 테이블에 항목을 추가하면 여기에 단계별로 표시됩니다."
            }
          />
        </Card>
      </>
    );
  }

  const groups = groupByStage(apps);

  return (
    <>
      <header className="mb-4 flex items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold text-text">지원 파이프라인</h1>
        <p className="text-xs text-text-muted">Notion 읽기 전용 · {apps.length}건</p>
      </header>

      <div className="space-y-4">
        {[...groups.entries()].map(([stage, items]) => (
          <Card key={stage}>
            <CardHeader>
              <CardTitle>{stage}</CardTitle>
              <CardHint>{items.length}건</CardHint>
            </CardHeader>

            <ul className="divide-y divide-line" aria-label={`${stage} 단계 지원`}>
              {items.map((app) => (
                <li key={app.id} className="py-2 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={app.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                      >
                        {app.company}
                        <ExternalLink className="size-3" aria-hidden="true" />
                      </a>
                      {app.role && (
                        <p className="text-sm text-text-muted">{app.role}</p>
                      )}
                    </div>
                    {app.deadline && (
                      <span className="num shrink-0 text-xs text-text-muted">{app.deadline}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </>
  );
}
