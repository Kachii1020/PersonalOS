import { strToU8, zipSync } from "fflate";

export function xmlEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function cellNumber(addr: string, value: number, style?: number): string {
  const s = style === undefined ? "" : ` s="${style}"`;
  return `<c r="${addr}"${s}><v>${value}</v></c>`;
}

export function cellInline(addr: string, text: string): string {
  const space = /^\s|\s$|\s{2,}/.test(text) ? ' xml:space="preserve"' : "";
  return `<c r="${addr}" t="inlineStr"><is><t${space}>${xmlEscape(text)}</t></is></c>`;
}

export function worksheetXml(rows: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.join("\n    ")}
  </sheetData>
</worksheet>`;
}

function extraContentType(path: string): string | undefined {
  if (path.includes("pivotTables")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml";
  }
  if (path.includes("/charts/")) {
    return "application/vnd.openxmlformats-officedocument.drawingml.chart+xml";
  }
  if (path.endsWith("connections.xml")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.connections+xml";
  }
  if (path.includes("queryTables")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.queryTable+xml";
  }
  return undefined;
}

export function buildSheetXlsx(opts: {
  sheets: { name: string; xml: string }[];
  extra?: Record<string, string>;
  styles?: string;
}): Uint8Array {
  const extra = opts.extra ?? {};
  const overrides: string[] = [
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`,
  ];
  opts.sheets.forEach((_, i) => {
    overrides.push(
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    );
  });
  if (opts.styles) {
    overrides.push(
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`,
    );
  }
  for (const path of Object.keys(extra)) {
    const ct = extraContentType(path);
    if (ct) {
      const partName = path.startsWith("/") ? path : `/${path}`;
      overrides.push(`<Override PartName="${partName}" ContentType="${ct}"/>`);
    }
  }

  const rels: string[] = opts.sheets.map(
    (_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  );
  if (opts.styles) {
    rels.push(
      `<Relationship Id="rId${opts.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
    );
  }

  const sheetTags = opts.sheets.map(
    (sheet, i) =>
      `<sheet name="${xmlEscape(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  );

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${overrides.join("\n  ")}
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels.join("\n  ")}
</Relationships>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetTags.join("\n    ")}
  </sheets>
</workbook>`),
  };

  opts.sheets.forEach((sheet, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheet.xml);
  });
  if (opts.styles) files["xl/styles.xml"] = strToU8(opts.styles);
  for (const [path, xml] of Object.entries(extra)) {
    files[path] = strToU8(xml);
  }
  return zipSync(files);
}

export const DATE_STYLE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="yyyy-mm-dd"/>
  </numFmts>
  <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border/></borders>
  <cellStyleXfs count="1"><xf/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

export const PIVOT_PART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<pivotTableDefinition xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" name="PivotTable1"/>`;

export const CHART_PART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"/>`;

export const QUERY_PART_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<connections xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <connection id="1" name="Query1" type="5"/>
</connections>`;
