import { TriangleAlert } from "lucide-react";
import { listSyncStates } from "@/lib/repos/sync-state";

/** 잡 이름 → 사람이 읽을 이름과 조치 (SPEC.md 6.4 규칙 11: 사과하지 않고 고치는 법을 쓴다). */
const FIXES: Record<string, { label: string; fix: string }> = {
  caldav: { label: "iCloud 동기화 실패", fix: "앱 전용 암호(APPLE_APP_PASSWORD)를 확인하세요." },
  rss: { label: "뉴스 수집 실패", fix: "설정에서 소스별 상태를 확인하세요." },
  prices: { label: "시세 갱신 실패", fix: "마지막 스냅샷을 표시 중입니다." },
  github: { label: "GitHub 수집 실패", fix: "GITHUB_TOKEN 만료 여부를 확인하세요." },
};

/**
 * 동기화 실패를 화면 상단에 노출한다 (SPEC.md 5.1 절대 규칙 5).
 * 외부 서비스가 죽어도 앱은 떠야 하므로, 이 컴포넌트가 렌더를 막지 않는다.
 */
export async function SyncBanner() {
  let states: Awaited<ReturnType<typeof listSyncStates>>;
  try {
    states = await listSyncStates();
  } catch (e) {
    // 배너가 레이아웃 전체를 무너뜨리면 안 된다. 못 읽었다는 사실만 알린다.
    return (
      <div role="alert" className="border-b border-line bg-surface px-4 py-2 text-sm lg:px-6">
        <span className="font-medium text-text">동기화 상태를 읽지 못했습니다</span>{" "}
        <span className="text-text-muted">{e instanceof Error ? e.message : "설정에서 로그를 확인하세요."}</span>
      </div>
    );
  }
  const failed = states.filter((s) => s.lastStatus === "failed");
  if (failed.length === 0) return null;

  return (
    <div role="alert" className="border-b border-line bg-surface px-4 py-2 lg:px-6">
      {failed.map((s) => {
        const meta = FIXES[s.key] ?? { label: `${s.key} 동기화 실패`, fix: "설정에서 로그를 확인하세요." };
        return (
          <div key={s.key} className="flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-negative" aria-hidden="true" />
            <p className="text-text">
              <span className="font-medium">{meta.label}</span>{" "}
              <span className="text-text-muted">{meta.fix}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
