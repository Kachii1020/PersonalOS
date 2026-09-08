import { strToU8, zipSync } from "fflate";
import {
  HANDS_DATA_ROWS,
  HANDS_FILL_ROW,
  HANDS_LAST_ROW,
  HANDS_TAX_AFTER,
  HANDS_TAX_RATE,
  handsAmount,
  handsFillValue,
  handsSum,
} from "@/lib/learn/xlsx-hands";

export type HandsKind = "starter" | "pass" | "fail-sum";

function xmlEscape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cellNumber(addr: string, value: number): string {
  return `<c r="${addr}"><v>${value}</v></c>`;
}

function cellInline(addr: string, text: string): string {
  return `<c r="${addr}" t="inlineStr"><is><t>${xmlEscape(text)}</t></is></c>`;
}

function cellFormula(addr: string, formula: string, value: number): string {
  return `<c r="${addr}"><f>${xmlEscape(formula)}</f><v>${value}</v></c>`;
}

function dataSheet(kind: HandsKind): string {
  const rows: string[] = [];
  rows.push(
    `<row r="1">${cellInline("A1", "이름")}${cellInline("B1", "금액")}${cellInline("D1", "세율")}${cellNumber("E1", HANDS_TAX_RATE)}</row>`,
  );
  for (let i = 0; i < HANDS_DATA_ROWS; i++) {
    const row = i + 2;
    const cells = [cellInline(`A${row}`, `이름${String(i + 1).padStart(3, "0")}`), cellNumber(`B${row}`, handsAmount(i))];
    if (kind !== "starter" && row >= 2 && row <= HANDS_FILL_ROW) {
      cells.push(cellFormula(`C${row}`, `B${row}*$E$1`, handsAmount(i) * HANDS_TAX_RATE));
    }
    rows.push(`<row r="${row}">${cells.join("")}</row>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.join("\n    ")}
  </sheetData>
</worksheet>`;
}

function outputSheet(kind: HandsKind): string {
  const rows =
    kind === "starter"
      ? [
          `<row r="2">${cellInline("A2", "마지막 행")}</row>`,
          `<row r="3">${cellInline("A3", "금액 합")}</row>`,
          `<row r="4">${cellInline("A4", "세후(TaxRate)")}</row>`,
          `<row r="5">${cellInline("A5", "채우기 C6")}</row>`,
        ]
      : [
          `<row r="2">${cellInline("A2", "마지막 행")}${cellNumber("B2", HANDS_LAST_ROW)}</row>`,
          `<row r="3">${cellInline("A3", "금액 합")}${cellFormula("B3", "SUM(Data!B2:B501)", kind === "fail-sum" ? 0 : handsSum())}</row>`,
          `<row r="4">${cellInline("A4", "세후(TaxRate)")}${cellFormula("B4", "100*(1-TaxRate)", HANDS_TAX_AFTER)}</row>`,
          `<row r="5">${cellInline("A5", "채우기 C6")}${cellFormula("B5", "Data!C6", handsFillValue())}</row>`,
        ];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${rows.join("\n    ")}
  </sheetData>
</worksheet>`;
}

function workbookXml(kind: HandsKind): string {
  const names =
    kind === "starter"
      ? ""
      : `<definedNames><definedName name="TaxRate">Data!$E$1</definedName></definedNames>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Data" sheetId="1" r:id="rId1"/>
    <sheet name="Output" sheetId="2" r:id="rId2"/>
  </sheets>
  ${names}
</workbook>`;
}

export function buildHandsXlsx(kind: HandsKind): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`),
    "_rels/.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`),
    "xl/workbook.xml": strToU8(workbookXml(kind)),
    "xl/worksheets/sheet1.xml": strToU8(dataSheet(kind)),
    "xl/worksheets/sheet2.xml": strToU8(outputSheet(kind)),
  };
  return zipSync(files);
}
