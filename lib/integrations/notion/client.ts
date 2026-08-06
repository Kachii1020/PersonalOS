import "server-only";

/**
 * Notion 읽기 전용 클라이언트 (SPEC.md 3절, CLAUDE.md 데이터 소유권).
 *
 * **이 앱은 Notion에 절대 쓰지 않는다.** 여기에 POST/PATCH로 페이지를 만들거나
 * 고치는 함수를 추가하면 리뷰에서 반려된다. 유일한 예외는 조회용 query 엔드포인트로,
 * 이건 POST지만 읽기다.
 *
 * API 2025-09-03부터 조회 대상이 database가 아니라 data source다.
 * 환경변수에는 URL에서 바로 얻을 수 있는 database ID를 받고, 여기서 변환한다.
 */

const API = "https://api.notion.com/v1";
const VERSION = "2026-03-11";

export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "NotionError";
  }
}

function token(): string {
  const value = process.env.NOTION_TOKEN?.trim();
  if (!value) {
    throw new Error("NOTION_TOKEN이 없습니다. docs/NOTION-SETUP.md의 1번을 보세요.");
  }
  return value;
}

async function call<T>(path: string, init?: { method: "GET" | "POST"; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Notion-Version": VERSION,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { code?: string; message?: string } | null;
    const code = detail?.code ?? null;
    // object_not_found는 "권한 없음"이 아니라 "없음"으로 온다. 원인이 대부분 연결 누락이라 그걸 짚어준다.
    const hint =
      code === "object_not_found"
        ? " — DB를 커넥션에 연결했는지 확인하세요 (docs/NOTION-SETUP.md 4번)."
        : "";
    throw new NotionError(`${detail?.message ?? res.statusText}${hint}`, res.status, code);
  }

  return (await res.json()) as T;
}

type DatabaseResponse = { id: string; title?: Array<{ plain_text?: string }>; data_sources?: Array<{ id: string; name: string }> };

export type DatabaseInfo = { id: string; title: string; dataSourceId: string; dataSourceCount: number };

/**
 * database ID → data source ID.
 *
 * data source가 여러 개면 첫 번째를 쓴다. 이 앱의 DB 5개는 전부 단일 소스다.
 * 개수를 같이 돌려주므로 호출부가 여러 개인 상황을 알아챌 수 있다.
 */
export async function describeDatabase(databaseId: string): Promise<DatabaseInfo> {
  const db = await call<DatabaseResponse>(`/databases/${databaseId}`);
  const first = db.data_sources?.[0];
  if (!first) {
    throw new NotionError(`데이터 소스가 없는 DB입니다: ${databaseId}`, 200, "no_data_source");
  }

  return {
    id: db.id,
    title: db.title?.map((t) => t.plain_text ?? "").join("").trim() || "(제목 없음)",
    dataSourceId: first.id,
    dataSourceCount: db.data_sources?.length ?? 1,
  };
}

export type NotionPage = {
  id: string;
  url: string;
  properties: Record<string, unknown>;
  last_edited_time: string;
};

/** 한 페이지 분량 조회. 페이지네이션은 호출부가 next_cursor로 이어간다. */
export async function queryDataSource(
  dataSourceId: string,
  options: { pageSize?: number; startCursor?: string } = {},
): Promise<{ results: NotionPage[]; hasMore: boolean; nextCursor: string | null }> {
  const body: Record<string, unknown> = {
    page_size: options.pageSize ?? 50,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
  };
  if (options.startCursor) body.start_cursor = options.startCursor;

  const data = await call<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }>(
    `/data_sources/${dataSourceId}/query`,
    { method: "POST", body },
  );

  return { results: data.results, hasMore: data.has_more, nextCursor: data.next_cursor };
}
