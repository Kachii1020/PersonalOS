import "server-only";

const API = "https://api.github.com";
const TIMEOUT_MS = 20_000;

type GHRepo = {
  full_name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  pushed_at: string | null;
  html_url: string;
  fork: boolean;
};

type GHEvent = {
  type: string;
  created_at: string;
  payload: { commits?: Array<{ sha: string }> };
};

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "personal-os/1.0",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export type RepoData = {
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  pushedAt: string | null;
  htmlUrl: string;
};

export type CommitDay = {
  asOf: string;
  commitCount: number;
};

/**
 * 공개 레포 목록. fork는 제외한다 (SPEC 5.4: owner 타입만).
 */
export async function fetchRepos(username: string): Promise<RepoData[]> {
  const url = `${API}/users/${username}/repos?per_page=100&type=owner&sort=pushed`;
  const res = await fetch(url, {
    headers: headers(),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`GitHub repos: HTTP ${res.status}`);
  const data = (await res.json()) as GHRepo[];

  return data
    .filter((r) => !r.fork)
    .map((r) => ({
      fullName: r.full_name,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      pushedAt: r.pushed_at,
      htmlUrl: r.html_url,
    }));
}

/**
 * 이벤트 API에서 PushEvent를 집계해 일별 커밋 수를 구한다.
 * SPEC 5.4: "이벤트 기반으로 누적. 완벽히 일치하지 않는다".
 * 이벤트 API는 최대 300건 / 10페이지. 90일 보존 한계.
 */
export async function fetchDailyCommits(username: string): Promise<CommitDay[]> {
  const counts = new Map<string, number>();
  let page = 1;

  while (page <= 10) {
    const url = `${API}/users/${username}/events?per_page=100&page=${page}`;
    const res = await fetch(url, {
      headers: headers(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });

    if (!res.ok) {
      // 404 = 이벤트 없음 (정상), 다른 에러는 던진다
      if (res.status === 404) break;
      throw new Error(`GitHub events: HTTP ${res.status}`);
    }

    const events = (await res.json()) as GHEvent[];
    if (events.length === 0) break;

    for (const ev of events) {
      if (ev.type !== "PushEvent") continue;
      const day = ev.created_at.slice(0, 10);
      const commits = ev.payload.commits?.length ?? 1;
      counts.set(day, (counts.get(day) ?? 0) + commits);
    }

    page++;
  }

  return [...counts.entries()]
    .map(([asOf, commitCount]) => ({ asOf, commitCount }))
    .sort((a, b) => a.asOf.localeCompare(b.asOf));
}
