export interface ExportColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (item: T) => string | number;
}

/**
 * Exports data to a CSV file and triggers download
 * @param data - Array of data objects to export
 * @param columns - Column definitions with key, header, and optional render function
 * @param filename - Name for the downloaded file (without extension)
 */
export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: ExportColumn<T>[],
  filename: string
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Generate headers
  const headers = columns.map((col) => col.header);

  // Generate rows
  const rows = data.map((item) =>
    columns.map((col) => {
      // Use custom render function if provided
      if (col.render) {
        return col.render(item);
      }

      // Otherwise get value by key (supports nested keys like "client.name")
      const value = getNestedValue(item, col.key as string);
      return value ?? "";
    })
  );

  // Escape and format CSV content
  const csvContent = [
    headers.map(escapeCSVValue).join(","),
    ...rows.map((row) => row.map(escapeCSVValue).join(",")),
  ].join("\n");

  // Create blob and trigger download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  // Add date to filename if not already present
  const dateStr = new Date().toISOString().split("T")[0];
  const finalFilename = filename.includes(dateStr) ? filename : `${filename}-${dateStr}`;

  link.setAttribute("href", url);
  link.setAttribute("download", `${finalFilename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Escapes a value for CSV format
 */
function escapeCSVValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);

  // If value contains comma, newline, or quote, wrap in quotes and escape existing quotes
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

/**
 * Gets a nested value from an object using dot notation
 * e.g., getNestedValue({client: {name: "Test"}}, "client.name") returns "Test"
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((current: unknown, key: string) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Formats a date for CSV export
 */
export function formatDateForExport(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Formats a currency value for CSV export
 */
export function formatCurrencyForExport(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value.toFixed(2);
}

/**
 * Formats a number for CSV export (with optional decimal places)
 */
export function formatNumberForExport(
  value: number | null | undefined,
  decimals: number = 0
): string {
  if (value === null || value === undefined) return "";
  return value.toFixed(decimals);
}
