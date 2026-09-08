import { strFromU8, unzipSync } from "fflate";

export type ParsedCell = {
  value: string | number | null;
  formula?: string;
};

export type ParsedWorkbook = {
  sheets: string[];
  names: string[];
  cells: Map<string, ParsedCell>;
  parts: { pivot: boolean; query: boolean; chart: boolean; iteration: boolean };
};

function unescapeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`(?:\\s|:)${name}="([^"]*)"`)) ?? tag.match(new RegExp(`${name}="([^"]*)"`));
  return match?.[1];
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let block = siRe.exec(xml);
  while (block) {
    const texts = [...block[1].matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((m) => unescapeXml(m[1]));
    out.push(texts.join(""));
    block = siRe.exec(xml);
  }
  return out;
}

function parseCells(xml: string, shared: string[]): Map<string, ParsedCell> {
  const cells = new Map<string, ParsedCell>();
  const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
  let hit = cellRe.exec(xml);
  while (hit) {
    const addr = attr(hit[1], "r");
    if (!addr) {
      hit = cellRe.exec(xml);
      continue;
    }
    const type = attr(hit[1], "t") ?? "";
    const body = hit[2];
    const formula = body.match(/<f\b[^>]*>([\s\S]*?)<\/f>/)?.[1];
    const raw = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
    const inline = [...body.matchAll(/<t\b[^>]*>([^<]*)<\/t>/g)].map((m) => unescapeXml(m[1])).join("");

    let value: string | number | null = null;
    if (type === "inlineStr" || (inline && raw === undefined && !formula)) {
      value = inline || null;
    } else if (type === "s" && raw !== undefined) {
      value = shared[Number(raw)] ?? raw;
    } else if (raw !== undefined && raw !== "") {
      const num = Number(raw);
      value = Number.isFinite(num) && type !== "str" ? num : unescapeXml(raw);
    } else if (inline) {
      value = inline;
    }

    cells.set(addr, {
      value,
      formula: formula ? unescapeXml(formula) : undefined,
    });
    hit = cellRe.exec(xml);
  }
  return cells;
}

export function parseXlsx(bytes: Uint8Array): ParsedWorkbook {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("xlsx zip을 열 수 없습니다. 엑셀에서 저장한 파일인지 확인하세요.");
  }

  const workbookXml = files["xl/workbook.xml"];
  if (!workbookXml) throw new Error("workbook.xml이 없습니다. xlsx가 맞는지 확인하세요.");
  const workbook = strFromU8(workbookXml);

  const relsXml = files["xl/_rels/workbook.xml.rels"];
  const rels = new Map<string, string>();
  if (relsXml) {
    const relRe = /<Relationship\b([^>]*)\/>/g;
    let rel = relRe.exec(strFromU8(relsXml));
    while (rel) {
      const id = attr(rel[1], "Id");
      const target = attr(rel[1], "Target");
      if (id && target) rels.set(id, target.replace(/^\//, "").replace(/^\.\.\//, "xl/"));
      rel = relRe.exec(strFromU8(relsXml));
    }
  }

  const sheets: string[] = [];
  const sheetTargets: string[] = [];
  const sheetRe = /<sheet\b([^>]*)\/>/g;
  let sheet = sheetRe.exec(workbook);
  while (sheet) {
    const name = attr(sheet[1], "name");
    const rid = attr(sheet[1], "id");
    if (name) {
      sheets.push(name);
      const target = rid ? rels.get(rid) : undefined;
      const path = target
        ? target.startsWith("xl/")
          ? target
          : `xl/${target.replace(/^\/+/, "")}`
        : `xl/worksheets/sheet${sheets.length}.xml`;
      sheetTargets.push(path);
    }
    sheet = sheetRe.exec(workbook);
  }

  const names: string[] = [];
  const nameRe = /<definedName\b([^>]*)>/g;
  let named = nameRe.exec(workbook);
  while (named) {
    const name = attr(named[1], "name");
    if (name) names.push(name);
    named = nameRe.exec(workbook);
  }

  const shared = files["xl/sharedStrings.xml"]
    ? parseSharedStrings(strFromU8(files["xl/sharedStrings.xml"]))
    : [];

  const cells = new Map<string, ParsedCell>();
  sheets.forEach((name, i) => {
    const path = sheetTargets[i];
    const xml = files[path];
    if (!xml) return;
    for (const [addr, cell] of parseCells(strFromU8(xml), shared)) {
      cells.set(`${name}!${addr}`, cell);
    }
  });

  const keys = Object.keys(files);
  const calc = files["xl/workbook.xml"] ? workbook : "";
  return {
    sheets,
    names,
    cells,
    parts: {
      pivot: keys.some((k) => k.startsWith("xl/pivotTables/")),
      query: keys.some((k) => k === "xl/connections.xml" || k.startsWith("xl/queryTables/")),
      chart: keys.some((k) => k.startsWith("xl/charts/")),
      iteration: /iterate="1"/.test(calc),
    },
  };
}

export function cellKey(sheet: string, addr: string): string {
  return `${sheet}!${addr.toUpperCase()}`;
}
