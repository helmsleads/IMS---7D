import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { InventoryWithDetails } from "@/lib/api/inventory";
import type { Client } from "@/lib/api/clients";
import { getContainerBadge, getUnitLabel } from "@/lib/labels";
import { InventoryStatus } from "@/types/database";

/** Human-readable filter summary for PDF (and similar) exports. */
export type InventoryExportFilterLine = { name: string; value: string };

export const INVENTORY_EXPORT_HEADERS = [
  "Product Name",
  "SKU",
  "Client",
  "Location",
  "Sublocation",
  "Type",
  "On Hand",
  "On Hand Unit",
  "Reserved",
  "Available",
  "Cases",
  "Unit Cost",
  "Inventory Status",
  "Stock Level",
] as const;

function escapeCsvField(value: string | number): string {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function getStockLevelLabel(item: InventoryWithDetails): string {
  if (item.qty_on_hand === 0) return "Out";
  if (item.qty_on_hand <= item.product.reorder_point) return "Low";
  return "OK";
}

const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  available: "Available",
  damaged: "Damaged",
  quarantine: "Quarantine",
  reserved: "Reserved",
  returned: "Returned",
};

function getRowInventoryStatusLabel(item: InventoryWithDetails): string {
  const isOutOfStockRow =
    item.qty_on_hand === 0 && (item.status === "available" || !item.status);
  if (isOutOfStockRow) return "Out of Stock";
  const status = item.status || "available";
  return INVENTORY_STATUS_LABELS[status] ?? INVENTORY_STATUS_LABELS.available;
}

/** One table row per inventory line (matches CSV / PDF exports). */
export function buildInventoryExportRows(
  items: InventoryWithDetails[],
  clients: Client[],
): (string | number)[][] {
  return items.map((item) => {
    const client = item.product.client_id
      ? clients.find((c) => c.id === item.product.client_id)
      : null;
    const typeInfo = getContainerBadge(item.product.container_type);
    const stock = getStockLevelLabel(item);
    const invStatus = getRowInventoryStatusLabel(item);
    const upc = item.product.units_per_case || 1;
    const cases =
      upc <= 1
        ? ""
        : item.qty_on_hand % upc === 0
          ? String(item.qty_on_hand / upc)
          : (item.qty_on_hand / upc).toFixed(1);
    const available = item.qty_on_hand - item.qty_reserved;
    const sub = item.sublocation
      ? [
          item.sublocation.code,
          item.sublocation.zone ? `Zone ${item.sublocation.zone}` : "",
        ]
          .filter(Boolean)
          .join(" ")
      : "Unassigned";
    const locLine = [item.location.city, item.location.state].filter(Boolean).join(", ");

    return [
      item.product.name,
      item.product.sku,
      client?.company_name ?? (item.product.client_id ? "" : "No Client"),
      locLine ? `${item.location.name} (${locLine})` : item.location.name,
      sub,
      typeInfo.label,
      item.qty_on_hand,
      getUnitLabel(item.product.container_type),
      item.qty_reserved,
      available,
      cases,
      item.product.unit_cost,
      invStatus,
      stock,
    ];
  });
}

export function downloadInventoryCsv(
  items: InventoryWithDetails[],
  clients: Client[],
): void {
  if (items.length === 0) return;
  const rows = buildInventoryExportRows(items, clients);
  const headers = [...INVENTORY_EXPORT_HEADERS];
  const csvBody = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((r) => r.map((c) => escapeCsvField(c)).join(",")),
  ].join("\r\n");

  const blob = new Blob(["\uFEFF" + csvBody], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadInventoryPdf(
  items: InventoryWithDetails[],
  clients: Client[],
  filterLines: InventoryExportFilterLine[],
): void {
  if (items.length === 0) return;
  const rows = buildInventoryExportRows(items, clients);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const dateStr = new Date().toISOString().slice(0, 10);
  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const textMaxWidth = pageWidth - marginX * 2;

  let y = 12;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Inventory export", marginX, y);
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated ${dateStr} · ${items.length} row(s)`, marginX, y);
  y += 6;

  if (filterLines.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Filters:", marginX, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const { name, value } of filterLines) {
      const line = `${name}: ${value}`;
      const wrapped = doc.splitTextToSize(line, textMaxWidth);
      for (const segment of wrapped) {
        doc.text(segment, marginX, y);
        y += 4;
      }
    }
    y += 2;
  }

  autoTable(doc, {
    startY: y,
    head: [[...INVENTORY_EXPORT_HEADERS]],
    body: rows.map((r) => r.map((c) => String(c))),
    styles: {
      fontSize: 7,
      cellPadding: 2,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [51, 65, 85],
      fontStyle: "bold",
      textColor: 255,
      overflow: "linebreak",
      valign: "middle",
    },
    bodyStyles: {
      overflow: "linebreak",
      valign: "top",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { minCellWidth: 28 },
      1: { minCellWidth: 16 },
      2: { minCellWidth: 22 },
      3: { minCellWidth: 24 },
      4: { minCellWidth: 18 },
    },
    margin: { left: 14, right: 14 },
    tableWidth: "auto",
    horizontalPageBreak: false,
    showHead: "everyPage",
    rowPageBreak: "avoid",
  });

  doc.save(`inventory-export-${dateStr}.pdf`);
}
