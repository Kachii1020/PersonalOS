import { pivotSales, pivotSeoulCogs, pivotSeoulQ1 } from "@/lib/learn/xlsx-pivot";
import {
  CHART_PART_XML,
  DATE_STYLE_XML,
  PIVOT_PART_XML,
  buildSheetXlsx,
  cellInline,
  cellNumber,
  worksheetXml,
} from "./ooxml";

export type PivotKind = "starter" | "pass" | "fail-part";

function salesSheet(): string {
  const rows = [
    `<row r="1">${cellInline("A1", "날짜")}${cellInline("B1", "지역")}${cellInline("C1", "제품")}${cellInline("D1", "금액")}</row>`,
  ];
  pivotSales().forEach((sale, i) => {
    const row = i + 2;
    rows.push(
      `<row r="${row}">${cellNumber(`A${row}`, sale.dateSerial, 1)}${cellInline(`B${row}`, sale.region)}${cellInline(`C${row}`, sale.product)}${cellNumber(`D${row}`, sale.amount)}</row>`,
    );
  });
  return worksheetXml(rows);
}

function outputSheet(kind: PivotKind): string {
  const rows =
    kind === "starter"
      ? [
          `<row r="2">${cellInline("A2", "서울 2023Q1")}</row>`,
          `<row r="4">${cellInline("A4", "서울 2023 원가")}</row>`,
        ]
      : [
          `<row r="2">${cellInline("A2", "서울 2023Q1")}${cellNumber("B2", pivotSeoulQ1())}</row>`,
          `<row r="4">${cellInline("A4", "서울 2023 원가")}${cellNumber("B4", pivotSeoulCogs())}</row>`,
        ];
  return worksheetXml(rows);
}

function pivotSheet(): string {
  return worksheetXml([`<row r="1">${cellInline("A1", "피벗")}</row>`]);
}

export function buildPivotXlsx(kind: PivotKind): Uint8Array {
  const sheets = [
    { name: "Sales", xml: salesSheet() },
    { name: "Output", xml: outputSheet(kind) },
  ];
  if (kind !== "starter") sheets.push({ name: "Pivot", xml: pivotSheet() });

  const extra: Record<string, string> = {};
  if (kind === "pass") {
    extra["xl/pivotTables/pivotTable1.xml"] = PIVOT_PART_XML;
    extra["xl/charts/chart1.xml"] = CHART_PART_XML;
  }
  if (kind === "fail-part") {
    extra["xl/charts/chart1.xml"] = CHART_PART_XML;
  }

  return buildSheetXlsx({ sheets, extra, styles: DATE_STYLE_XML });
}
