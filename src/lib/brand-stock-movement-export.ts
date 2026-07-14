import * as XLSX from "xlsx";
import type {
  BrandStockMovementReport,
  BrandStockMovementRow,
} from "@/lib/api/storage-snapshots";

function formatRangeLabel(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const monthLong = start.toLocaleDateString("en-US", { month: "long" });
  const endMonth = end.toLocaleDateString("en-US", { month: "long" });
  const year = end.getFullYear();

  if (
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth()
  ) {
    if (start.getDate() === end.getDate()) {
      return `${monthLong} ${start.getDate()}, ${year}`;
    }
    return `${monthLong} ${start.getDate()}-${end.getDate()}, ${year}`;
  }

  const startLabel = start.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  // Prefer compact form when years match
  if (start.getFullYear() === end.getFullYear()) {
    const startShort = `${monthLong} ${start.getDate()}`;
    const endShort = `${endMonth} ${end.getDate()}, ${year}`;
    return `${startShort}-${endShort}`;
  }
  return `${startLabel} - ${endLabel}`;
}

function blankIfZero(n: number): number | string {
  return n === 0 ? "" : Math.round(n * 10) / 10;
}

function begNote(startDate: string): string {
  const label = new Date(`${startDate}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });
  return `Beg = Inventory as of ${label}`;
}

/**
 * Build workbook rows matching the inventory date-range Excel template,
 * plus Beginning / Ending pallets by brand.
 */
export function buildBrandStockMovementSheetRows(
  report: BrandStockMovementReport,
  brands?: BrandStockMovementRow[]
): (string | number)[][] {
  const rows = brands ?? report.brands;
  const rangeLabel = formatRangeLabel(report.startDate, report.endDate);

  const sheet: (string | number)[][] = [
    ["Date Range:", rangeLabel, "", "", "", "", "", ""],
    [
      "",
      "Beginning Inventory",
      "In",
      "Out",
      "Adjustments",
      "Ending Inventory",
      "Beginning Pallets",
      "Ending Pallets",
    ],
  ];

  for (const b of rows) {
    sheet.push([
      b.brandName,
      blankIfZero(b.startQty),
      blankIfZero(b.inQty),
      blankIfZero(b.outQty),
      blankIfZero(b.adjQty),
      blankIfZero(b.endQty),
      blankIfZero(b.startPallets),
      blankIfZero(b.endPallets),
    ]);
  }

  sheet.push([
    "NOTES ONLY:",
    begNote(report.startDate),
    "Inbound",
    "Outbound",
    "Positive or (Negative) Adjustments",
    "End = BEG + IN - OUT +/- ADJUSTMENTS",
    "Pallets at start snapshot",
    "Pallets at end snapshot",
  ]);

  return sheet;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Download Excel (.xls) matching the date-range inventory template style,
 * including the cyan NOTES row.
 */
export function downloadBrandStockMovementExcel(
  report: BrandStockMovementReport,
  options?: { brands?: BrandStockMovementRow[]; filename?: string }
): void {
  const dataRows = buildBrandStockMovementSheetRows(report, options?.brands);
  const notesRowIndex = dataRows.length - 1;

  const htmlRows = dataRows
    .map((row, rowIndex) => {
      const isHeader = rowIndex === 1;
      const isNotes = rowIndex === notesRowIndex;
      const bg = isNotes ? "#00FFFF" : isHeader ? "#F3F4F6" : "#FFFFFF";
      const weight = isHeader || rowIndex === 0 || isNotes ? "bold" : "normal";
      const cells = row
        .map((cell, colIndex) => {
          const align =
            colIndex === 0 || rowIndex === 0 ? "left" : "right";
          const display =
            cell === "" || cell === null || cell === undefined
              ? "&nbsp;"
              : escapeHtml(cell);
          return `<td style="border:1px solid #9CA3AF;padding:6px 10px;background:${bg};font-weight:${weight};text-align:${align};white-space:nowrap">${display}</td>`;
        })
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
 <x:Name>Stock Movement</x:Name>
 <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
 </x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook>
</xml><![endif]-->
<style>
  table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
</style>
</head>
<body>
<table>
${htmlRows}
</table>
</body>
</html>`;

  const start = report.startDate.replace(/-/g, "");
  const end = report.endDate.replace(/-/g, "");
  const filename =
    options?.filename || `stock-movement-by-brand_${start}_${end}.xls`;

  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Also available as true .xlsx (structure only; NOTES row not colorized).
 */
export function downloadBrandStockMovementXlsx(
  report: BrandStockMovementReport,
  options?: { brands?: BrandStockMovementRow[]; filename?: string }
): void {
  const sheetData = buildBrandStockMovementSheetRows(report, options?.brands);
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  worksheet["!cols"] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 12 },
    { wch: 12 },
    { wch: 28 },
    { wch: 36 },
    { wch: 18 },
    { wch: 16 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Stock Movement");
  const start = report.startDate.replace(/-/g, "");
  const end = report.endDate.replace(/-/g, "");
  const filename =
    options?.filename || `stock-movement-by-brand_${start}_${end}.xlsx`;
  XLSX.writeFile(workbook, filename);
}
