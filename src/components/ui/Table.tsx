"use client";

import { ReactNode, useState } from "react";
import { Inbox, LayoutGrid, LayoutList } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  /** Hide this column on mobile table view */
  hideOnMobile?: boolean;
  /** Priority for mobile card view (1 = primary/title, 2 = secondary, 3+ = details) */
  mobilePriority?: number;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  loading?: boolean;
  emptyMessage?: ReactNode;
  emptyIcon?: ReactNode;
  /** Force a specific view mode */
  mobileView?: "table" | "cards";
}

export default function Table<T extends object>({
  columns,
  data,
  onRowClick,
  loading = false,
  emptyMessage = "No data available",
  emptyIcon,
  mobileView = "cards",
}: TableProps<T>) {
  const [viewMode, setViewMode] = useState<"table" | "cards">(mobileView);

  // Separate columns for mobile card view
  const primaryColumn = columns.find((c) => c.mobilePriority === 1) || columns[0];
  const secondaryColumns = columns.filter((c) => c.mobilePriority === 2);
  const detailColumns = columns.filter(
    (c) => c.mobilePriority && c.mobilePriority >= 3
  );
  const actionColumn = columns.find((c) => c.key === "actions");

  // Visible columns for mobile table view
  const mobileTableColumns = columns.filter((c) => !c.hideOnMobile);

  const renderCellValue = (item: T, column: Column<T>): ReactNode => {
    if (column.render) {
      return column.render(item);
    }
    return (item as Record<string, unknown>)[column.key] as ReactNode;
  };

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-sm font-semibold text-gray-900 ${
                    column.hideOnMobile ? "hidden md:table-cell" : ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="border-b border-gray-100">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-4 py-3 ${
                      column.hideOnMobile ? "hidden md:table-cell" : ""
                    }`}
                  >
                    <div className="h-4 bg-gray-200 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        {emptyIcon || <Inbox className="w-10 h-10 text-gray-300 mx-auto mb-3" />}
        <p className="text-gray-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile View Toggle */}
      <div className="md:hidden flex justify-end p-2 border-b border-gray-100">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5">
          <button
            onClick={() => setViewMode("cards")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "cards"
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
            aria-label="Card view"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-1.5 rounded-md transition-colors ${
              viewMode === "table"
                ? "bg-gray-900 text-white"
                : "text-gray-500 hover:text-gray-700"
            }`}
            aria-label="Table view"
          >
            <LayoutList className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Card View */}
      {viewMode === "cards" && (
        <div className="md:hidden divide-y divide-gray-100">
          {data.map((item, index) => (
            <div
              key={index}
              onClick={() => onRowClick?.(item)}
              className={`p-4 ${
                onRowClick ? "cursor-pointer hover:bg-gray-50 active:bg-gray-100" : ""
              }`}
            >
              {/* Primary row: title + actions */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Primary column (title) */}
                  <div className="font-medium text-gray-900">
                    {renderCellValue(item, primaryColumn)}
                  </div>
                  {/* Secondary columns */}
                  {secondaryColumns.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                      {secondaryColumns.map((col) => (
                        <div key={col.key} className="text-sm text-gray-600">
                          {renderCellValue(item, col)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Actions */}
                {actionColumn && (
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {renderCellValue(item, actionColumn)}
                  </div>
                )}
              </div>

              {/* Detail columns */}
              {detailColumns.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
                  {detailColumns.map((col) => (
                    <div key={col.key}>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">
                        {col.header}
                      </span>
                      <div className="text-sm text-gray-900 mt-0.5">
                        {renderCellValue(item, col)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mobile Table View (scrollable) */}
      {viewMode === "table" && (
        <div className="md:hidden overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-gray-200">
                {mobileTableColumns.map((column) => (
                  <th
                    key={column.key}
                    className="px-4 py-3 text-left text-sm font-semibold text-gray-900 whitespace-nowrap"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr
                  key={index}
                  onClick={() => onRowClick?.(item)}
                  className={`
                    border-b border-gray-100
                    ${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}
                  `}
                >
                  {mobileTableColumns.map((column) => (
                    <td
                      key={column.key}
                      className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap"
                    >
                      {renderCellValue(item, column)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-sm font-semibold text-gray-900"
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr
                key={index}
                onClick={() => onRowClick?.(item)}
                className={`
                  border-b border-gray-100
                  ${onRowClick ? "cursor-pointer hover:bg-gray-50" : ""}
                `}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-4 py-3 text-sm text-gray-700"
                  >
                    {renderCellValue(item, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
