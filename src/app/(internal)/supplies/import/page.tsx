"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  Package,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import Alert from "@/components/ui/Alert";
import Spinner from "@/components/ui/Spinner";
import Pagination from "@/components/ui/Pagination";
import FileDropZone from "@/components/internal/FileDropZone";
import { getLocations, Location } from "@/lib/api/locations";

type ImportStep = 1 | 2 | 3 | 4;

interface ParsedSupplyRow {
  rowIndex: number;
  sku: string;
  name: string;
  quantity: number;
  raw: Record<string, string>;
  warnings: string[];
  existingSupplyId: string | null;
  existingSupplyName: string | null;
  isNew: boolean;
}

interface ParseResponse {
  success: boolean;
  filename: string;
  fileType: "csv" | "xlsx";
  rows: ParsedSupplyRow[];
  warnings: string[];
  existingInventory: Record<string, number>;
  stats: {
    totalRows: number;
    validRows: number;
    emptyRows: number;
    matchedSupplies: number;
    newSupplies: number;
    duplicateSkus: string[];
  };
}

interface ApplyResponse {
  success: boolean;
  stats: {
    suppliesCreated: number;
    inventoryUpdated: number;
    rowsSkipped: number;
    errorsCount: number;
  };
  errors: Array<{ row: number; sku: string; error: string }>;
}

const ROWS_PER_PAGE = 25;

export default function SupplyImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>(1);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [rowInclusion, setRowInclusion] = useState<Record<number, boolean>>({});
  const [rowQtyOverrides, setRowQtyOverrides] = useState<Record<number, number>>({});
  const [previewPage, setPreviewPage] = useState(1);
  const [showWarnings, setShowWarnings] = useState(false);

  // Step 3/4
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [results, setResults] = useState<ApplyResponse | null>(null);

  useEffect(() => {
    getLocations().then((locs) => {
      setLocations(locs);
      const active = locs.filter((l: Location) => l.active);
      if (active.length > 0) {
        setSelectedLocation(active[0].id);
      }
    });
  }, []);

  const locationOptions = useMemo(
    () => locations.filter((l) => l.active).map((l) => ({ value: l.id, label: l.name })),
    [locations]
  );

  // ---- Step 1: Parse ----
  const handleParse = async () => {
    if (!file || !selectedLocation) return;

    setParseLoading(true);
    setParseError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("locationId", selectedLocation);

      const res = await fetch("/api/supplies/import/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setParseError(data.error || "Failed to parse file");
        return;
      }

      setParseData(data);

      // Initialize inclusion — all included by default
      const initialInclusion: Record<number, boolean> = {};
      for (const row of data.rows) {
        initialInclusion[row.rowIndex] = true;
      }
      setRowInclusion(initialInclusion);

      setStep(2);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParseLoading(false);
    }
  };

  // ---- Step 2 helpers ----
  const filteredRows = useMemo(() => {
    if (!parseData) return [];
    return parseData.rows;
  }, [parseData]);

  const paginatedRows = useMemo(() => {
    const start = (previewPage - 1) * ROWS_PER_PAGE;
    return filteredRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredRows, previewPage]);

  const includedCount = useMemo(() => {
    return Object.values(rowInclusion).filter(Boolean).length;
  }, [rowInclusion]);

  const toggleAllRows = (included: boolean) => {
    const updated: Record<number, boolean> = {};
    for (const row of filteredRows) {
      updated[row.rowIndex] = included;
    }
    setRowInclusion(updated);
  };

  // ---- Step 3: Apply ----
  const handleApply = async () => {
    if (!parseData || !selectedLocation) return;

    setStep(3);
    setApplyLoading(true);
    setApplyError(null);

    try {
      const rows = parseData.rows.map((row) => ({
        rowIndex: row.rowIndex,
        sku: row.sku,
        name: row.name,
        quantity: rowQtyOverrides[row.rowIndex] ?? row.quantity,
        existingSupplyId: row.existingSupplyId,
        included: rowInclusion[row.rowIndex] ?? true,
        isNew: row.isNew,
      }));

      const res = await fetch("/api/supplies/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: parseData.filename,
          fileType: parseData.fileType,
          locationId: selectedLocation,
          rows,
        }),
      });

      const data: ApplyResponse = await res.json();

      if (!res.ok) {
        setApplyError((data as unknown as { error: string }).error || "Failed to apply import");
        setStep(2);
        return;
      }

      setResults(data);
      setStep(4);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : "Failed to apply import");
      setStep(2);
    } finally {
      setApplyLoading(false);
    }
  };

  // ---- Render ----
  const stepLabels = [
    { num: 1, label: "Upload" },
    { num: 2, label: "Preview" },
    { num: 3, label: "Applying" },
    { num: 4, label: "Results" },
  ];

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {stepLabels.map(({ num, label }, i) => (
        <div key={num} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              step === num
                ? "bg-blue-100 text-blue-700"
                : step > num
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            {step > num ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <span className="w-5 h-5 flex items-center justify-center rounded-full bg-current/20 text-xs">
                {num}
              </span>
            )}
            {label}
          </div>
          {i < stepLabels.length - 1 && (
            <div
              className={`w-8 h-0.5 mx-1 ${
                step > num ? "bg-green-300" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  // ---- Step 1: Upload ----
  const renderStep1 = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Upload Supply Spreadsheet
        </h2>

        <FileDropZone
          onFileSelect={setFile}
          selectedFile={file}
          onClear={() => setFile(null)}
        />

        <div className="mt-6 space-y-4">
          <Select
            label="Location"
            name="location"
            options={locationOptions}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            required
          />

          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              Upload a CSV or XLSX file with supply SKUs and quantities. The system will
              match SKUs against existing supplies and update inventory counts. New SKUs
              will be created as new supply items.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Expected columns: <span className="font-medium">SKU/Code</span>,{" "}
              <span className="font-medium">Name/Description</span>,{" "}
              <span className="font-medium">Quantity/Count</span>
            </p>
          </div>
        </div>

        {parseError && (
          <div className="mt-4">
            <Alert type="error" message={parseError} onClose={() => setParseError(null)} />
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleParse}
            disabled={!file || !selectedLocation || parseLoading}
            loading={parseLoading}
          >
            <Eye className="w-4 h-4 mr-2" />
            Parse & Preview
          </Button>
        </div>
      </Card>
    </div>
  );

  // ---- Step 2: Preview ----
  const renderStep2 = () => {
    if (!parseData) return null;

    return (
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">
                {parseData.stats.validRows}
              </p>
              <p className="text-sm text-gray-500">Total Rows</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {parseData.stats.matchedSupplies}
              </p>
              <p className="text-sm text-gray-500">Matched</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {parseData.stats.newSupplies}
              </p>
              <p className="text-sm text-gray-500">New Supplies</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">{includedCount}</p>
              <p className="text-sm text-gray-500">Selected</p>
            </div>
          </Card>
        </div>

        {/* Warnings */}
        {parseData.warnings.length > 0 && (
          <Card>
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-yellow-500" />
                <span className="font-medium text-gray-900">
                  {parseData.warnings.length} Warning{parseData.warnings.length > 1 ? "s" : ""}
                </span>
              </div>
              {showWarnings ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {showWarnings && (
              <ul className="mt-3 space-y-1">
                {parseData.warnings.map((w, i) => (
                  <li key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                    <span className="text-yellow-400 mt-0.5">&#x2022;</span>
                    {w}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {applyError && (
          <Alert type="error" message={applyError} onClose={() => setApplyError(null)} />
        )}

        {/* Preview Table */}
        <Card padding="none">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Supply Rows ({filteredRows.length})
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleAllRows(true)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <button
                onClick={() => toggleAllRows(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left w-10">
                    <input
                      type="checkbox"
                      checked={includedCount === filteredRows.length}
                      onChange={(e) => toggleAllRows(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Status</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">SKU</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Name</th>
                  <th className="px-3 py-2 text-right text-gray-600 font-medium">Sheet Qty</th>
                  <th className="px-3 py-2 text-right text-gray-600 font-medium">Current Qty</th>
                  <th className="px-3 py-2 text-right text-gray-600 font-medium">Diff</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Warnings</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => {
                  const isIncluded = rowInclusion[row.rowIndex] ?? true;
                  const currentQty = row.existingSupplyId
                    ? parseData.existingInventory[row.existingSupplyId] ?? null
                    : null;
                  const sheetQty = rowQtyOverrides[row.rowIndex] ?? row.quantity;
                  const diff = currentQty !== null ? sheetQty - currentQty : null;

                  return (
                    <tr
                      key={row.rowIndex}
                      className={`border-b hover:bg-gray-100/50 transition-colors ${
                        !isIncluded
                          ? "bg-gray-50 opacity-60"
                          : row.isNew
                          ? "bg-yellow-50"
                          : diff !== null && diff !== 0
                          ? "bg-red-50"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          onChange={(e) =>
                            setRowInclusion((prev) => ({
                              ...prev,
                              [row.rowIndex]: e.target.checked,
                            }))
                          }
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="px-3 py-2">
                        {row.isNew ? (
                          <Badge variant="warning" size="sm">New</Badge>
                        ) : (
                          <Badge variant="success" size="sm">Exists</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-900">{row.sku || "—"}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                        {row.existingSupplyName || row.name || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={rowQtyOverrides[row.rowIndex] ?? row.quantity}
                          onChange={(e) =>
                            setRowQtyOverrides((prev) => ({
                              ...prev,
                              [row.rowIndex]: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-20 px-2 py-1 text-right border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-gray-500">
                        {currentQty !== null ? currentQty : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {diff !== null ? (
                          <span
                            className={`font-medium ${
                              diff > 0
                                ? "text-green-600"
                                : diff < 0
                                ? "text-red-600"
                                : "text-gray-400"
                            }`}
                          >
                            {diff > 0 ? "+" : ""}
                            {diff}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.warnings.length > 0 ? (
                          <span
                            className="text-yellow-600 cursor-help"
                            title={row.warnings.join("\n")}
                          >
                            <AlertTriangle className="w-4 h-4 inline" />
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={previewPage}
            totalItems={filteredRows.length}
            itemsPerPage={ROWS_PER_PAGE}
            onPageChange={setPreviewPage}
          />
        </Card>

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={() => {
              setStep(1);
              setParseData(null);
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">
              {includedCount} of {filteredRows.length} rows selected
            </span>
            <Button onClick={handleApply} disabled={includedCount === 0}>
              <Upload className="w-4 h-4 mr-2" />
              Apply Import ({includedCount} rows)
            </Button>
          </div>
        </div>
      </div>
    );
  };

  // ---- Step 3: Applying ----
  const renderStep3 = () => (
    <div className="max-w-md mx-auto text-center py-16">
      <Spinner size="lg" />
      <p className="mt-4 text-lg font-medium text-gray-900">Processing Supply Import...</p>
      <p className="text-sm text-gray-500 mt-1">
        Updating supply inventory counts
      </p>
    </div>
  );

  // ---- Step 4: Results ----
  const renderStep4 = () => {
    if (!results) return null;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Alert
          type={results.stats.errorsCount === 0 ? "success" : "warning"}
          message={
            results.stats.errorsCount === 0
              ? "Supply import completed successfully!"
              : `Import completed with ${results.stats.errorsCount} error(s).`
          }
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-green-100 rounded-full">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {results.stats.suppliesCreated}
              </p>
              <p className="text-sm text-gray-500">Supplies Created</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-blue-100 rounded-full">
                  <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {results.stats.inventoryUpdated}
              </p>
              <p className="text-sm text-gray-500">Inventory Updated</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-gray-100 rounded-full">
                  <XCircle className="w-5 h-5 text-gray-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-gray-500">
                {results.stats.rowsSkipped}
              </p>
              <p className="text-sm text-gray-500">Skipped</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
              </div>
              <p className="text-2xl font-bold text-red-500">
                {results.stats.errorsCount}
              </p>
              <p className="text-sm text-gray-500">Errors</p>
            </div>
          </Card>
        </div>

        {results.errors.length > 0 && (
          <Card>
            <h3 className="font-semibold text-red-700 mb-3">
              Errors ({results.errors.length})
            </h3>
            <ul className="space-y-2">
              {results.errors.map((err, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <span className="text-red-700">
                    Row {err.row} ({err.sku || "no SKU"}): {err.error}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => router.push("/supplies")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Supplies
          </Button>
          <Button
            onClick={() => {
              setStep(1);
              setFile(null);
              setParseData(null);
              setResults(null);
              setRowInclusion({});
              setRowQtyOverrides({});
            }}
          >
            <Upload className="w-4 h-4 mr-2" />
            Import Another
          </Button>
        </div>
      </div>
    );
  };

  return (
    <AppShell
      title="Import Supplies"
      subtitle="Upload a spreadsheet to update supply inventory"
      actions={
        step === 1 ? (
          <Button variant="secondary" onClick={() => router.push("/supplies")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Supplies
          </Button>
        ) : undefined
      }
    >
      {renderStepIndicator()}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
    </AppShell>
  );
}
