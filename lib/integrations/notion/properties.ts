import "server-only";

/**
 * Notion 속성 읽기.
 *
 * **속성 이름을 가정하지 않는다.** 사람이 Notion에서 컬럼 이름을 바꾸거나 언어를 섞어 쓰면
 * 이름으로 찾는 코드는 조용히 빈 값을 낸다. 타입으로 먼저 찾고, 이름은 후보 목록으로만 쓴다.
 */

type PropertyValue = {
  type: string;
  title?: Array<{ plain_text?: string }>;
  rich_text?: Array<{ plain_text?: string }>;
  select?: { name?: string } | null;
  status?: { name?: string } | null;
  multi_select?: Array<{ name?: string }>;
  date?: { start?: string } | null;
  url?: string | null;
};

type Properties = Record<string, unknown>;

function entries(properties: Properties): Array<[string, PropertyValue]> {
  return Object.entries(properties).filter(
    (entry): entry is [string, PropertyValue] =>
      typeof entry[1] === "object" && entry[1] !== null && "type" in entry[1],
  );
}

/** 제목은 타입이 'title'인 속성 하나뿐이다. 이름이 '이름'이든 'Name'이든 상관없다. */
export function titleOf(properties: Properties): string {
  for (const [, value] of entries(properties)) {
    if (value.type === "title") {
      const text = (value.title ?? []).map((t) => t.plain_text ?? "").join("").trim();
      if (text) return text;
    }
  }
  return "";
}

/** select 또는 status 값 하나. 이름 후보에 맞는 게 없으면 타입이 맞는 첫 번째를 쓴다. */
export function labelOf(properties: Properties, names: string[]): string | null {
  const wanted = names.map((n) => n.toLowerCase());
  let fallback: string | null = null;

  for (const [key, value] of entries(properties)) {
    if (value.type !== "select" && value.type !== "status") continue;
    const name = (value.type === "select" ? value.select?.name : value.status?.name) ?? null;
    if (!name) continue;
    if (wanted.includes(key.toLowerCase())) return name;
    fallback ??= name;
  }
  return fallback;
}

/** multi_select 태그 전부. 여러 속성에 흩어져 있어도 모은다. */
export function tagsOf(properties: Properties): string[] {
  const tags: string[] = [];
  for (const [, value] of entries(properties)) {
    if (value.type !== "multi_select") continue;
    for (const option of value.multi_select ?? []) {
      if (option.name) tags.push(option.name);
    }
  }
  return tags;
}
