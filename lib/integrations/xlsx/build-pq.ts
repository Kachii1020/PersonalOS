import {
  pqAppendSum,
  pqCleanRowCount,
  pqCleanRows,
  pqFebRows,
  pqFirst2023,
  pqJanRows,
  pqRawRows,
} from "@/lib/learn/xlsx-pq";
import {
  QUERY_PART_XML,
  buildSheetXlsx,
  cellInline,
  cellNumber,
  worksheetXml,
} from "./ooxml";

export type PqKind = "starter" | "pass" | "fail-query";

function rawSheet(): string {
  const rows = [
    `<row r="1">${cellInline("A1", "이름")}${cellInline("B1", "코드-연도")}${cellInline("C1", "2022")}${cellInline("D1", "2023")}${cellInline("E1", "2024")}</row>`,
  ];
  pqRawRows().forEach((row, i) => {
    const n = i + 2;
    rows.push(
      `<row r="${n}">${cellInline(`A${n}`, row.name)}${cellInline(`B${n}`, row.codeYear)}${cellNumber(`C${n}`, row.y2022)}${cellNumber(`D${n}`, row.y2023)}${cellNumber(`E${n}`, row.y2024)}</row>`,
    );
  });
  return worksheetXml(rows);
}

function monthSheet(kind: "Jan" | "Feb"): string {
  const data = kind === "Jan" ? pqJanRows() : pqFebRows();
  const rows = [`<row r="1">${cellInline("A1", "이름")}${cellInline("B1", "금액")}</row>`];
  data.forEach((row, i) => {
    const n = i + 2;
    rows.push(`<row r="${n}">${cellInline(`A${n}`, row.name)}${cellNumber(`B${n}`, row.amount)}</row>`);
  });
  return worksheetXml(rows);
}

function outputSheet(kind: PqKind): string {
  const rows =
    kind === "starter"
      ? [
          `<row r="2">${cellInline("A2", "Clean 행 수")}</row>`,
          `<row r="3">${cellInline("A3", "첫 키 2023")}</row>`,
          `<row r="4">${cellInline("A4", "Append 합계")}</row>`,
        ]
      : [
          `<row r="2">${cellInline("A2", "Clean 행 수")}${cellNumber("B2", pqCleanRowCount())}</row>`,
          `<row r="3">${cellInline("A3", "첫 키 2023")}${cellNumber("B3", pqFirst2023())}</row>`,
          `<row r="4">${cellInline("A4", "Append 합계")}${cellNumber("B4", pqAppendSum())}</row>`,
        ];
  return worksheetXml(rows);
}

function cleanSheet(): string {
  const rows = [
    `<row r="1">${cellInline("A1", "이름")}${cellInline("B1", "코드")}${cellInline("C1", "접미")}${cellInline("D1", "연도")}${cellInline("E1", "값")}</row>`,
  ];
  pqCleanRows().forEach((row, i) => {
    const n = i + 2;
    rows.push(
      `<row r="${n}">${cellInline(`A${n}`, row.name)}${cellInline(`B${n}`, row.code)}${cellInline(`C${n}`, row.suffix)}${cellNumber(`D${n}`, row.year)}${cellNumber(`E${n}`, row.value)}</row>`,
    );
  });
  return worksheetXml(rows);
}

export function buildPqXlsx(kind: PqKind): Uint8Array {
  const sheets = [
    { name: "Raw", xml: rawSheet() },
    { name: "Jan", xml: monthSheet("Jan") },
    { name: "Feb", xml: monthSheet("Feb") },
    { name: "Output", xml: outputSheet(kind) },
  ];
  if (kind !== "starter") sheets.push({ name: "Clean", xml: cleanSheet() });

  const extra: Record<string, string> = {};
  if (kind === "pass") extra["xl/connections.xml"] = QUERY_PART_XML;

  return buildSheetXlsx({ sheets, extra });
}
