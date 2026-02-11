"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ArrowLeft,
  ArrowRight,
  Package,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  Check,
  X,
  Trash2,
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
import { deleteBrandAlias } from "@/lib/api/brand-aliases";
import { deleteProduct } from "@/lib/api/products";
import type {
  ColumnMap,
  ParsedRow as BaseParsedRow,
  BrandSuggestion,
  DiscrepancyRow,
} from "@/lib/utils/spreadsheet-parser";

type ImportStep = 1 | 2 | 3 | 4;
type ImportType = "baseline" | "update";

/** Extended with isNewSku and isSupply from the parse API */
type ParsedRow = BaseParsedRow & { isNewSku?: boolean; isSupply?: boolean; supplyName?: string | null };

interface ParseResponse {
  success: boolean;
  filename: string;
  fileType: "csv" | "xlsx";
  columns: ColumnMap[];
  rows: ParsedRow[];
  brandSuggestions: BrandSuggestion[];
  /** Maps lowercase alias string → alias row ID for deletion */
  aliasIdMap: Record<string, string>;
  /** Maps lowercase SKU → product ID for deletion */
  skuProductIdMap: Record<string, string>;
  /** Maps lowercase supply SKU → supply name */
  supplySkuMap: Record<string, string>;
  discrepancies: DiscrepancyRow[];
  warnings: string[];
  stats: {
    totalRows: number;
    validRows: number;
    emptyRows: number;
    duplicateSkus: string[];
    uniqueBrands: number;
    matchedBrands: number;
    unmatchedBrands: number;
    newSkus: number;
    supplyRows: number;
  };
  discrepancyStats: {
    matches: number;
    discrepancies: number;
    newSkus: number;
    missingFromSheet: number;
  } | null;
  clients: Array<{ id: string; company_name: string; industries: string[] }>;
}

interface ApplyResponse {
  success: boolean;
  importId: string;
  status: string;
  stats: {
    productsCreated: number;
    productsUpdated: number;
    inventoryUpdated: number;
    rowsSkipped: number;
    errorsCount: number;
    discrepanciesCount: number;
  };
  discrepancies: Array<{
    sku: string;
    name: string;
    sheetQty: number;
    systemQty: number;
    difference: number;
  }>;
  errors: Array<{ row: number; sku: string; error: string }>;
}

const ROWS_PER_PAGE = 25;

const CONTAINER_TYPE_OPTIONS = [
  { value: "bottle", label: "Bottle" },
  { value: "can", label: "Can / RTD" },
  { value: "keg", label: "Keg" },
  { value: "bag_in_box", label: "Bag-in-Box" },
  { value: "gift_box", label: "Gift Box" },
  { value: "raw_materials", label: "Raw Materials" },
  { value: "empty_bottle", label: "Empty Bottle" },
  { value: "merchandise", label: "Merchandise" },
  { value: "sample", label: "Sample / ML" },
  { value: "other", label: "Other" },
];

/** Maps client industry to default container type */
const INDUSTRY_CONTAINER_DEFAULTS: Record<string, string> = {
  spirits: "bottle",
  wine: "bottle",
  beer: "can",
  rtd: "can",
  beverage_non_alc: "can",
  food: "other",
  cosmetics: "other",
  apparel: "merchandise",
  supplements: "other",
  general_merchandise: "merchandise",
};

/** Detect container type from SKU prefix and item name */
function detectContainerTypeFromSku(sku: string, item: string): string | null {
  const s = sku.toLowerCase();
  const n = item.toLowerCase();

  // Raw materials: corks, labels, neck labels, bottle covers, totes
  if (s.startsWith("raw-") || /\bcork\b/.test(n) || /\blabel\b/.test(n) || /\bbottle.?cover\b/.test(n) || /\bneck.?label\b/.test(n)) return "raw_materials";
  // Empty bottles
  if (s.includes("-empty") || /\bempty\b/.test(n)) return "empty_bottle";
  // Merchandise: hoodies, caps, shot glasses, cups, sweatshirts
  if (/\bhoodie\b|\bcap\b|\bshot.?glass\b|\bcup\b|\bsweatshirt\b|\bmerch\b|\bt-?shirt\b|\bhat\b|\bpromotional\b/.test(n)) return "merchandise";
  // Samples / ML
  if (/\bsample\b/.test(n) || /\bleftover\b/.test(n)) return "sample";
  // Gift boxes / custom boxes
  if (/\bcustom.?box\b|\bgift.?box\b|\bmerch.?box\b/.test(n) || s.includes("custombox") || s.includes("merchbox")) return "gift_box";

  return null;
}

/** Map unit string to container type — the most reliable signal */
const UNIT_CONTAINER_MAP: Record<string, string> = {
  Piece: "merchandise",
  Bottle: "bottle",
  Can: "can",
  Keg: "keg",
  "Bag-in-Box": "bag_in_box",
  ML: "sample",
  Box: "gift_box",
  Plastic: "other",
  Case: "bottle",
  Pack: "other",
  Pallet: "other",
};

function getDefaultContainerType(clientId: string | null, clients: Array<{ id: string; industries: string[] }>, sku?: string, item?: string, unit?: string): string {
  // First try SKU/item-based detection (most specific — raw materials, empty bottles, etc.)
  if (sku && item) {
    const skuDetected = detectContainerTypeFromSku(sku, item);
    if (skuDetected) return skuDetected;
  }

  // Then use the unit column — most reliable for general categorization
  if (unit && UNIT_CONTAINER_MAP[unit]) {
    return UNIT_CONTAINER_MAP[unit];
  }

  // Last resort: fall back to client industry
  if (!clientId) return "other";
  const client = clients.find((c) => c.id === clientId);
  if (!client || !client.industries?.length) return "other";
  return INDUSTRY_CONTAINER_DEFAULTS[client.industries[0]] || "other";
}

export default function ImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>(1);

  // Step 1 state
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<ImportType>("baseline");
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  // Step 2 state (from parse response)
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [brandMap, setBrandMap] = useState<Record<string, string | null>>({});
  const [rowInclusion, setRowInclusion] = useState<Record<number, boolean>>({});
  const [rowQtyOverrides, setRowQtyOverrides] = useState<Record<number, number>>({});
  const [previewPage, setPreviewPage] = useState(1);
  const [showWarnings, setShowWarnings] = useState(false);
  const [showBrandMapping, setShowBrandMapping] = useState(true);

  // Create Client state
  const [creatingBrand, setCreatingBrand] = useState<string | null>(null);
  const [createdBrands, setCreatedBrands] = useState<Set<string>>(new Set());

  // New Products section state
  const [showNewProducts, setShowNewProducts] = useState(true);

  // Alias removal state
  const [removingAlias, setRemovingAlias] = useState<string | null>(null);
  const [removedAliases, setRemovedAliases] = useState<Set<string>>(new Set());

  // SKU deletion state
  const [deletingSku, setDeletingSku] = useState<string | null>(null);
  const [deletedSkus, setDeletedSkus] = useState<Set<string>>(new Set());

  // Container type overrides for new SKUs (sku → container type)
  const [containerTypeOverrides, setContainerTypeOverrides] = useState<Record<string, string>>({});

  // Per-row client overrides (sku → clientId) — lets users reassign individual SKUs to a different client
  const [rowClientOverrides, setRowClientOverrides] = useState<Record<string, string | null>>({});

  // Step 3/4 state
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [results, setResults] = useState<ApplyResponse | null>(null);

  // Fetch locations on mount
  useEffect(() => {
    getLocations().then((locs) => {
      setLocations(locs);
      // Default to first active location
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
      formData.append("importType", importType);
      formData.append("locationId", selectedLocation);

      const res = await fetch("/api/inventory/import/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setParseError(data.error || "Failed to parse file");
        return;
      }

      setParseData(data);

      // Initialize brand map from suggestions
      const initialBrandMap: Record<string, string | null> = {};
      for (const suggestion of data.brandSuggestions) {
        initialBrandMap[suggestion.brand] = suggestion.clientId;
      }
      setBrandMap(initialBrandMap);

      // Initialize row inclusion (all included by default, supply rows excluded)
      const initialInclusion: Record<number, boolean> = {};
      for (const row of data.rows) {
        initialInclusion[row.rowIndex] = !row.isSupply;
      }
      setRowInclusion(initialInclusion);

      setStep(2);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setParseLoading(false);
    }
  };

  // ---- Create Client inline ----
  const handleCreateClient = async (brandName: string) => {
    setCreatingBrand(brandName);
    try {
      const res = await fetch("/api/inventory/import/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandName }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create client");
        return;
      }
      // Update clients list in parseData
      setParseData((prev) => {
        if (!prev) return prev;
        const alreadyInList = prev.clients.some((c) => c.id === data.id);
        return {
          ...prev,
          clients: alreadyInList
            ? prev.clients
            : [...prev.clients, { id: data.id, company_name: data.company_name, industries: data.industries || [] }]
                .sort((a, b) => a.company_name.localeCompare(b.company_name)),
        };
      });
      // Auto-select the new client for this brand
      setBrandMap((prev) => ({ ...prev, [brandName]: data.id }));
      // Mark as created
      setCreatedBrands((prev) => new Set(prev).add(brandName));
    } catch {
      alert("Failed to create client");
    } finally {
      setCreatingBrand(null);
    }
  };

  // ---- Remove saved alias ----
  const handleRemoveAlias = async (brand: string) => {
    if (!parseData) return;
    const aliasKey = brand.toLowerCase().trim();
    const aliasId = parseData.aliasIdMap?.[aliasKey];
    if (!aliasId) return;

    setRemovingAlias(brand);
    try {
      await deleteBrandAlias(aliasId);
      setRemovedAliases((prev) => new Set(prev).add(brand));
      // Clear the brand mapping so user can re-select
      setBrandMap((prev) => ({ ...prev, [brand]: null }));
      // Update the suggestion to show as unmatched
      setParseData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          brandSuggestions: prev.brandSuggestions.map((s) =>
            s.brand === brand
              ? { ...s, clientId: null, clientName: null, confidence: "none" as const, aliasMatch: false }
              : s
          ),
        };
      });
    } catch {
      alert("Failed to remove alias");
    } finally {
      setRemovingAlias(null);
    }
  };

  // ---- Delete SKU from system ----
  const handleDeleteSku = async (sku: string) => {
    if (!parseData) return;
    const productId = parseData.skuProductIdMap?.[sku.toLowerCase()];
    if (!productId) return;

    if (!confirm(`Delete product "${sku}" from the system? This cannot be undone.`)) return;

    setDeletingSku(sku);
    try {
      await deleteProduct(productId);
      setDeletedSkus((prev) => new Set(prev).add(sku.toLowerCase()));
      // Mark the row as new since the product no longer exists
      setParseData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.map((r) =>
            r.sku.toLowerCase() === sku.toLowerCase() ? { ...r, isNewSku: true } : r
          ),
        };
      });
    } catch {
      alert("Failed to delete product. It may have inventory or order references.");
    } finally {
      setDeletingSku(null);
    }
  };

  // ---- Step 2: Preview helpers ----
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

  // Group ALL SKUs by brand for the "SKUs by Brand" section
  const skusByBrand = useMemo(() => {
    if (!parseData) return new Map<string, ParsedRow[]>();
    const groups = new Map<string, ParsedRow[]>();
    for (const row of parseData.rows) {
      const key = row.brand || "(No Brand)";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }
    return groups;
  }, [parseData]);

  const totalNewSkus = useMemo(() => {
    if (!parseData) return 0;
    return parseData.rows.filter((r) => r.isNewSku).length;
  }, [parseData]);

  /** Get the effective client ID for a row — per-row override takes priority over brand mapping */
  const getClientForRow = (row: ParsedRow): string | null => {
    if (row.sku in rowClientOverrides) return rowClientOverrides[row.sku];
    return brandMap[row.brand] || null;
  };

  const getContainerTypeForRow = (row: ParsedRow): string => {
    if (containerTypeOverrides[row.sku]) return containerTypeOverrides[row.sku];
    const clientId = getClientForRow(row);
    return getDefaultContainerType(clientId, parseData?.clients || [], row.sku, row.item, row.unit);
  };

  const toggleBrandSkus = (brand: string, included: boolean) => {
    const rows = skusByBrand.get(brand);
    if (!rows) return;
    setRowInclusion((prev) => {
      const updated = { ...prev };
      for (const row of rows) {
        updated[row.rowIndex] = included;
      }
      return updated;
    });
  };

  const getBrandClient = (brand: string): string => {
    if (brand === "(No Brand)") return "None";
    const clientId = brandMap[brand];
    if (!clientId) return "No Client";
    const client = parseData?.clients.find((c) => c.id === clientId);
    return client?.company_name || "No Client";
  };

  /** Check if a row has been overridden to a different client than its brand mapping */
  const hasRowClientOverride = (row: ParsedRow): boolean => {
    return row.sku in rowClientOverrides && rowClientOverrides[row.sku] !== (brandMap[row.brand] || null);
  };

  const toggleAllRows = (included: boolean) => {
    const updated: Record<number, boolean> = {};
    for (const row of filteredRows) {
      updated[row.rowIndex] = included;
    }
    setRowInclusion(updated);
  };

  const getRowColor = (row: ParsedRow): string => {
    if (!rowInclusion[row.rowIndex]) return "bg-gray-50 opacity-60";
    if (row.isSupply) return "bg-purple-50";
    if (importType === "update" && parseData?.discrepancies) {
      const disc = parseData.discrepancies.find(
        (d) => d.sku.toLowerCase() === row.sku.toLowerCase()
      );
      if (disc) {
        if (disc.type === "discrepancy") return "bg-red-50";
        if (disc.type === "new") return "bg-yellow-50";
        if (disc.type === "match") return "bg-green-50";
      }
    }
    // Baseline: new products to create
    if (row.isNewSku) return "bg-yellow-50";
    if (row.warnings.length > 0) return "bg-yellow-50";
    return "";
  };

  const getDiscrepancyForRow = (row: ParsedRow): DiscrepancyRow | null => {
    if (!parseData?.discrepancies) return null;
    return (
      parseData.discrepancies.find(
        (d) => d.sku.toLowerCase() === row.sku.toLowerCase()
      ) || null
    );
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
        item: row.item,
        brand: row.brand,
        unit: row.unit,
        groundInventory: rowQtyOverrides[row.rowIndex] ?? row.groundInventory,
        clientId: getClientForRow(row),
        included: rowInclusion[row.rowIndex] ?? true,
        existingProductId: getDiscrepancyForRow(row)?.productId || null,
        containerType: row.isNewSku ? getContainerTypeForRow(row) : undefined,
      }));

      const res = await fetch("/api/inventory/import/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: parseData.filename,
          fileType: parseData.fileType,
          importType,
          locationId: selectedLocation,
          rows,
          brandClientMap: brandMap,
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

  // ---- Render helpers ----
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
          Upload Spreadsheet
        </h2>

        <FileDropZone
          onFileSelect={setFile}
          selectedFile={file}
          onClear={() => setFile(null)}
        />

        <div className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Import Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setImportType("baseline")}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  importType === "baseline"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">Baseline</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  First import — creates products & sets quantities
                </div>
              </button>
              <button
                onClick={() => setImportType("update")}
                className={`p-3 rounded-lg border-2 text-left transition-colors ${
                  importType === "update"
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-medium text-gray-900">Ground Count</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  Compare sheet vs system, flag discrepancies
                </div>
              </button>
            </div>
          </div>

          <Select
            label="Location"
            name="location"
            options={locationOptions}
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            required
          />
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
              <p className="text-2xl font-bold text-green-600">{includedCount}</p>
              <p className="text-sm text-gray-500">Selected</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {parseData.stats.uniqueBrands}
              </p>
              <p className="text-sm text-gray-500">Brands</p>
            </div>
          </Card>
          <Card>
            <div className="text-center">
              <p className="text-2xl font-bold text-yellow-600">
                {parseData.warnings.length}
              </p>
              <p className="text-sm text-gray-500">Warnings</p>
            </div>
          </Card>
        </div>

        {/* Supply rows notice */}
        {parseData.stats.supplyRows > 0 && (
          <Alert
            type="info"
            message={`${parseData.stats.supplyRows} row${parseData.stats.supplyRows !== 1 ? "s" : ""} matched existing supplies and will be skipped (not imported as products). You can include them manually if needed.`}
          />
        )}

        {/* Discrepancy stats for update imports */}
        {importType === "update" && parseData.discrepancyStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {parseData.discrepancyStats.matches}
                </p>
                <p className="text-sm text-gray-500">Matches</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {parseData.discrepancyStats.discrepancies}
                </p>
                <p className="text-sm text-gray-500">Discrepancies</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">
                  {parseData.discrepancyStats.newSkus}
                </p>
                <p className="text-sm text-gray-500">New SKUs</p>
              </div>
            </Card>
            <Card>
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-600">
                  {parseData.discrepancyStats.missingFromSheet}
                </p>
                <p className="text-sm text-gray-500">Missing from Sheet</p>
              </div>
            </Card>
          </div>
        )}

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

        {/* Brand Mapping */}
        <Card>
          <button
            onClick={() => setShowBrandMapping(!showBrandMapping)}
            className="flex items-center justify-between w-full"
          >
            <h3 className="font-semibold text-gray-900">Brand Mapping</h3>
            {showBrandMapping ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          {showBrandMapping && (
            <div className="mt-4 space-y-3">
              {parseData.brandSuggestions.map((suggestion) => (
                <div
                  key={suggestion.brand}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">
                        {suggestion.brand}
                      </span>
                      {createdBrands.has(suggestion.brand) ? (
                        <Badge variant="success" size="sm">
                          <Check className="w-3 h-3 inline mr-0.5" />
                          Created
                        </Badge>
                      ) : suggestion.aliasMatch && !removedAliases.has(suggestion.brand) ? (
                        <Badge variant="success" size="sm">Alias</Badge>
                      ) : suggestion.confidence === "exact" ? (
                        <Badge variant="success" size="sm">Exact</Badge>
                      ) : suggestion.confidence === "fuzzy" && brandMap[suggestion.brand] === suggestion.clientId ? (
                        <Badge variant="warning" size="sm">Fuzzy</Badge>
                      ) : brandMap[suggestion.brand] ? (
                        <Badge variant="info" size="sm">
                          <Check className="w-3 h-3 inline mr-0.5" />
                          Manual
                        </Badge>
                      ) : (
                        <Badge variant="error" size="sm">No Match</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={brandMap[suggestion.brand] ?? ""}
                      onChange={(e) => {
                        setBrandMap((prev) => ({
                          ...prev,
                          [suggestion.brand]: e.target.value || null,
                        }));
                      }}
                      className="w-64 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">No Client</option>
                      {parseData.clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.company_name}
                        </option>
                      ))}
                    </select>
                    {suggestion.confidence === "none" && !createdBrands.has(suggestion.brand) && (
                      <button
                        onClick={() => handleCreateClient(suggestion.brand)}
                        disabled={creatingBrand === suggestion.brand}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                      >
                        {creatingBrand === suggestion.brand ? (
                          <span className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          <Plus className="w-3.5 h-3.5" />
                        )}
                        Create
                      </button>
                    )}
                    {suggestion.aliasMatch && !removedAliases.has(suggestion.brand) && (
                      <button
                        onClick={() => handleRemoveAlias(suggestion.brand)}
                        disabled={removingAlias === suggestion.brand}
                        className="flex items-center gap-1 px-2 py-1.5 text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
                        title="Remove saved alias"
                      >
                        {removingAlias === suggestion.brand ? (
                          <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {parseData.brandSuggestions.length === 0 && (
                <p className="text-sm text-gray-500">No brands detected in spreadsheet.</p>
              )}
            </div>
          )}
        </Card>

        {/* SKUs by Brand */}
        {skusByBrand.size > 0 && (
          <Card>
            <button
              onClick={() => setShowNewProducts(!showNewProducts)}
              className="flex items-center justify-between w-full"
            >
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-gray-900">
                  SKUs by Brand
                </h3>
                {totalNewSkus > 0 && (
                  <Badge variant="warning" size="sm">{totalNewSkus} new</Badge>
                )}
              </div>
              {showNewProducts ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {showNewProducts && (
              <div className="mt-4 space-y-4">
                {[...skusByBrand.entries()].map(([brand, rows]) => {
                  const allIncluded = rows.every((r) => rowInclusion[r.rowIndex]);
                  const noneIncluded = rows.every((r) => !rowInclusion[r.rowIndex]);
                  const supplyCount = rows.filter((r) => r.isSupply).length;
                  const newCount = rows.filter((r) => r.isNewSku && !r.isSupply).length;
                  const existingCount = rows.length - newCount - supplyCount;
                  return (
                    <div key={brand} className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-gray-900">{brand}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-500">
                            Client: <span className="font-medium">{getBrandClient(brand)}</span>
                          </span>
                          <Badge variant="default" size="sm">{rows.length} SKU{rows.length !== 1 ? "s" : ""}</Badge>
                          {newCount > 0 && (
                            <Badge variant="warning" size="sm">{newCount} new</Badge>
                          )}
                          {existingCount > 0 && (
                            <Badge variant="success" size="sm">{existingCount} existing</Badge>
                          )}
                          {supplyCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">{supplyCount} supply</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleBrandSkus(brand, true)}
                            className={`text-xs px-2 py-1 rounded ${
                              allIncluded
                                ? "bg-green-100 text-green-700 font-medium"
                                : "text-gray-500 hover:text-green-600 hover:bg-green-50"
                            }`}
                          >
                            Include All
                          </button>
                          <button
                            onClick={() => toggleBrandSkus(brand, false)}
                            className={`text-xs px-2 py-1 rounded ${
                              noneIncluded
                                ? "bg-red-100 text-red-700 font-medium"
                                : "text-gray-500 hover:text-red-600 hover:bg-red-50"
                            }`}
                          >
                            Skip All
                          </button>
                        </div>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-white">
                            <th className="px-3 py-1.5 text-left w-10" />
                            <th className="px-3 py-1.5 text-left text-gray-500 font-medium text-xs">Status</th>
                            <th className="px-3 py-1.5 text-left text-gray-500 font-medium text-xs">SKU</th>
                            <th className="px-3 py-1.5 text-left text-gray-500 font-medium text-xs">Item Name</th>
                            <th className="px-3 py-1.5 text-left text-gray-500 font-medium text-xs">Unit</th>
                            <th className="px-3 py-1.5 text-left text-gray-500 font-medium text-xs">Type</th>
                            <th className="px-3 py-1.5 text-left text-gray-500 font-medium text-xs">Client</th>
                            <th className="px-3 py-1.5 text-right text-gray-500 font-medium text-xs">Qty</th>
                            <th className="px-3 py-1.5 w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => {
                            const included = rowInclusion[row.rowIndex] ?? true;
                            const isDeleted = deletedSkus.has(row.sku.toLowerCase());
                            return (
                              <tr
                                key={row.rowIndex}
                                className={`border-b last:border-b-0 ${
                                  !included ? "opacity-50 bg-gray-50" : row.isSupply ? "bg-purple-50/50" : row.isNewSku ? "bg-yellow-50/50" : ""
                                }`}
                              >
                                <td className="px-3 py-1.5">
                                  <input
                                    type="checkbox"
                                    checked={included}
                                    onChange={(e) =>
                                      setRowInclusion((prev) => ({
                                        ...prev,
                                        [row.rowIndex]: e.target.checked,
                                      }))
                                    }
                                    className="rounded border-gray-300"
                                  />
                                </td>
                                <td className="px-3 py-1.5">
                                  {isDeleted ? (
                                    <Badge variant="error" size="sm">Deleted</Badge>
                                  ) : row.isSupply ? (
                                    <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Supply</span>
                                  ) : row.isNewSku ? (
                                    <Badge variant="warning" size="sm">New</Badge>
                                  ) : (
                                    <Badge variant="success" size="sm">Exists</Badge>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 font-mono text-gray-900">{row.sku}</td>
                                <td className="px-3 py-1.5 text-gray-700 max-w-xs truncate">{row.item || "—"}</td>
                                <td className="px-3 py-1.5 text-gray-500">{row.unit}</td>
                                <td className="px-3 py-1.5">
                                  {row.isNewSku && !row.isSupply ? (
                                    <select
                                      value={getContainerTypeForRow(row)}
                                      onChange={(e) =>
                                        setContainerTypeOverrides((prev) => ({
                                          ...prev,
                                          [row.sku]: e.target.value,
                                        }))
                                      }
                                      className="w-28 px-1.5 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                      {CONTAINER_TYPE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-xs text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5">
                                  <select
                                    value={getClientForRow(row) || ""}
                                    onChange={(e) =>
                                      setRowClientOverrides((prev) => ({
                                        ...prev,
                                        [row.sku]: e.target.value || null,
                                      }))
                                    }
                                    className={`w-32 px-1.5 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                      hasRowClientOverride(row) ? "border-blue-400 bg-blue-50" : "border-gray-200"
                                    }`}
                                  >
                                    <option value="">No Client</option>
                                    {parseData?.clients.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.company_name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="px-3 py-1.5 text-right text-gray-700">{row.groundInventory}</td>
                                <td className="px-3 py-1.5">
                                  {!row.isNewSku && !isDeleted && (
                                    <button
                                      onClick={() => handleDeleteSku(row.sku)}
                                      disabled={deletingSku === row.sku}
                                      className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                      title="Delete product from system"
                                    >
                                      {deletingSku === row.sku ? (
                                        <span className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin inline-block" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* Preview Table */}
        <Card padding="none">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">
              Preview Rows ({filteredRows.length})
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

          {/* Color legend */}
          {importType === "update" && (
            <div className="px-4 py-2 bg-gray-50 border-b flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-green-200 inline-block" /> Match
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-200 inline-block" /> Discrepancy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-yellow-200 inline-block" /> New SKU
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-gray-200 inline-block" /> Excluded
              </span>
            </div>
          )}

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
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Row</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Brand</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">SKU</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Item</th>
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Unit</th>
                  <th className="px-3 py-2 text-right text-gray-600 font-medium">
                    Sheet Qty
                  </th>
                  {importType === "update" && (
                    <>
                      <th className="px-3 py-2 text-right text-gray-600 font-medium">
                        System Qty
                      </th>
                      <th className="px-3 py-2 text-right text-gray-600 font-medium">
                        Diff
                      </th>
                    </>
                  )}
                  <th className="px-3 py-2 text-left text-gray-600 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => {
                  const disc = getDiscrepancyForRow(row);
                  const isIncluded = rowInclusion[row.rowIndex] ?? true;

                  return (
                    <tr
                      key={row.rowIndex}
                      className={`border-b hover:bg-gray-100/50 transition-colors ${getRowColor(row)}`}
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
                      <td className="px-3 py-2 text-gray-400 text-xs">{row.rowIndex}</td>
                      <td className="px-3 py-2 text-gray-700">{row.brand || "—"}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{row.sku || "—"}</td>
                      <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                        {row.item || "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{row.unit}</td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          value={rowQtyOverrides[row.rowIndex] ?? row.groundInventory}
                          onChange={(e) =>
                            setRowQtyOverrides((prev) => ({
                              ...prev,
                              [row.rowIndex]: parseInt(e.target.value) || 0,
                            }))
                          }
                          className="w-20 px-2 py-1 text-right border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      {importType === "update" && (
                        <>
                          <td className="px-3 py-2 text-right text-gray-500">
                            {disc?.systemQty ?? "—"}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {disc?.difference != null ? (
                              <span
                                className={`font-medium ${
                                  disc.difference > 0
                                    ? "text-green-600"
                                    : disc.difference < 0
                                    ? "text-red-600"
                                    : "text-gray-400"
                                }`}
                              >
                                {disc.difference > 0 ? "+" : ""}
                                {disc.difference}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2">
                        {row.warnings.length > 0 ? (
                          <span
                            className="text-yellow-600 cursor-help"
                            title={row.warnings.join("\n")}
                          >
                            <AlertTriangle className="w-4 h-4 inline" />
                          </span>
                        ) : importType === "update" && disc ? (
                          disc.type === "match" ? (
                            <Badge variant="success" size="sm">Match</Badge>
                          ) : disc.type === "discrepancy" ? (
                            <Badge variant="error" size="sm">Diff</Badge>
                          ) : disc.type === "new" ? (
                            <Badge variant="warning" size="sm">New</Badge>
                          ) : null
                        ) : row.isSupply ? (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Supply</span>
                        ) : row.isNewSku ? (
                          <Badge variant="warning" size="sm">New</Badge>
                        ) : (
                          <Badge variant="success" size="sm">Ready</Badge>
                        )}
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
      <p className="mt-4 text-lg font-medium text-gray-900">Processing Import...</p>
      <p className="text-sm text-gray-500 mt-1">
        Creating products and updating inventory
      </p>
    </div>
  );

  // ---- Step 4: Results ----
  const renderStep4 = () => {
    if (!results) return null;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Success/failure banner */}
        <Alert
          type={results.stats.errorsCount === 0 ? "success" : "warning"}
          message={
            results.stats.errorsCount === 0
              ? "Import completed successfully!"
              : `Import completed with ${results.stats.errorsCount} error(s).`
          }
        />

        {/* Result stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <div className="text-center">
              <div className="flex justify-center mb-2">
                <div className="p-2 bg-green-100 rounded-full">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {results.stats.productsCreated}
              </p>
              <p className="text-sm text-gray-500">Products Created</p>
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

        {/* Discrepancies list */}
        {results.discrepancies.length > 0 && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-3">
              Quantity Discrepancies ({results.discrepancies.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left text-gray-600">SKU</th>
                    <th className="px-3 py-2 text-left text-gray-600">Name</th>
                    <th className="px-3 py-2 text-right text-gray-600">Sheet Qty</th>
                    <th className="px-3 py-2 text-right text-gray-600">Was</th>
                    <th className="px-3 py-2 text-right text-gray-600">Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {results.discrepancies.map((d, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-3 py-2 font-mono">{d.sku}</td>
                      <td className="px-3 py-2 text-gray-700 truncate max-w-xs">{d.name}</td>
                      <td className="px-3 py-2 text-right font-medium">{d.sheetQty}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{d.systemQty}</td>
                      <td className="px-3 py-2 text-right">
                        <span
                          className={`font-medium ${
                            d.difference > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {d.difference > 0 ? "+" : ""}
                          {d.difference}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Errors list */}
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

        {/* Action buttons */}
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={() => router.push("/inventory")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            View Inventory
          </Button>
          <Button
            onClick={() => {
              setStep(1);
              setFile(null);
              setParseData(null);
              setResults(null);
              setRowInclusion({});
              setRowQtyOverrides({});
              setBrandMap({});
              setCreatedBrands(new Set());
              setRemovedAliases(new Set());
              setDeletedSkus(new Set());
              setContainerTypeOverrides({});
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
      title="Import Spreadsheet"
      actions={
        step === 1 ? (
          <Button variant="secondary" onClick={() => router.push("/inventory")}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Inventory
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
