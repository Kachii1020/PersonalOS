import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type GitHubRepo = {
  id: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string | null;
  htmlUrl: string;
};

export type DailyCommits = {
  asOf: string;
  commitCount: number;
};

type RepoRow = {
  id: string;
  full_name: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushed_at: string | null;
  html_url: string;
};

function toRepo(r: RepoRow): GitHubRepo {
  return {
    id: r.id,
    fullName: r.full_name,
    description: r.description,
    language: r.language,
    stars: r.stars,
    pushedAt: r.pushed_at,
    htmlUrl: r.html_url,
  };
}

/** 잡 전용. upsert by full_name. */
export async function upsertRepos(
  repos: Array<{
    fullName: string;
    description: string | null;
    language: string | null;
    stars: number;
    pushedAt: string | null;
    htmlUrl: string;
  }>,
): Promise<number> {
  if (repos.length === 0) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("github_repos")
    .upsert(
      repos.map((r) => ({
        full_name: r.fullName,
        description: r.description,
        language: r.language,
        stars: r.stars,
        pushed_at: r.pushedAt,
        html_url: r.htmlUrl,
      })),
      { onConflict: "full_name" },
    )
    .select("id");

  if (error) throw new Error(`GitHub 레포 저장 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** 잡 전용. upsert by as_of. 같은 날 재실행하면 덮어쓴다. */
export async function upsertDailyCommits(
  rows: Array<{ asOf: string; commitCount: number }>,
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("github_daily_commits")
    .upsert(
      rows.map((r) => ({ as_of: r.asOf, commit_count: r.commitCount })),
      { onConflict: "as_of" },
    )
    .select("id");

  if (error) throw new Error(`커밋 저장 실패: ${error.message}`);
  return data?.length ?? 0;
}

/** UI용. 레포 목록. */
export async function listRepos(): Promise<GitHubRepo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("github_repos")
    .select("id, full_name, description, language, stars, pushed_at, html_url")
    .order("pushed_at", { ascending: false });

  if (error) throw new Error(`GitHub 레포 조회 실패: ${error.message}`);
  return (data ?? []).map(toRepo);
}

/** UI용. 최근 90일 커밋 잔디. */
export async function listDailyCommits(days = 90): Promise<DailyCommits[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("github_daily_commits")
    .select("as_of, commit_count")
    .gte("as_of", cutoff)
    .order("as_of");

  if (error) throw new Error(`커밋 잔디 조회 실패: ${error.message}`);
  return (data ?? []).map((r) => ({ asOf: r.as_of, commitCount: r.commit_count }));
}
