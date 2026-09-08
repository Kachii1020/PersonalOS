export type TopicKind = "concept" | "practice" | "project";

export type ParsedTopic = {
  kind: TopicKind;
  title: string;
  resource: string | null;
};

const KIND_RE = /^\[(concept|practice|project)\]\s*/;

/** 시드 concepts 한 줄. `[type] 제목 | 리소스` */
export function parseTopic(raw: string): ParsedTopic {
  const match = raw.match(KIND_RE);
  const kind = (match?.[1] ?? "concept") as TopicKind;
  const rest = (match ? raw.slice(match[0].length) : raw).trim();
  const bar = rest.indexOf("|");
  if (bar === -1) return { kind, title: rest, resource: null };
  const title = rest.slice(0, bar).trim();
  const resource = rest.slice(bar + 1).trim();
  return { kind, title, resource: resource || null };
}

export function isLabTrack(moduleSlugs: string[], labModuleIds: string[]): boolean {
  const labs = new Set(labModuleIds);
  return moduleSlugs.some((slug) => labs.has(slug));
}
