"use client";

import { useCallback, useEffect, useMemo, useState, Fragment } from "react";
import {
  Package,
  Play,
  RefreshCw,
  Warehouse,
  Building2,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  AlertCircle,
  CheckCircle2,
  Database,
  ArrowLeftRight,
  Download,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import { getUnitLabel } from "@/lib/labels";
import { downloadBrandStockMovementExcel } from "@/lib/brand-stock-movement-export";
import {
  BrandPalletDetailRow,
  BrandPalletSummary,
  BrandStockMovementReport,
  LiveBrandPalletEstimate,
  StorageSnapshotOverview,
  getBrandPalletDetails,
  getBrandStockMovementReport,
  getLivePalletsByBrand,
  getPalletsByBrand,
  runStorageSnapshotNow,
} from "@/lib/api/storage-snapshots";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
}

function qtyLabel(row: BrandPalletDetailRow) {
  const unit = getUnitLabel(row.containerType);
  const qty = formatNumber(row.qtyOnHand);
  if (row.caseCount != null) {
    return `${qty} ${unit} (${formatNumber(row.caseCount)} cs)`;
  }
  return `${qty} ${unit}`;
}

function formatDateLabel(date: string | null) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type PageTab = "pallets" | "movement" | "live";

function defaultRangeDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  };
}

export default function PalletsByBrandPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("pallets");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [snapshotDate, setSnapshotDate] = useState<string>("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [brands, setBrands] = useState<BrandPalletSummary[]>([]);
  const [overview, setOverview] = useState<StorageSnapshotOverview | null>(null);
  const [liveEstimates, setLiveEstimates] = useState<LiveBrandPalletEstimate[]>([]);
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);
  const [details, setDetails] = useState<BrandPalletDetailRow[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const defaultRange = useMemo(() => defaultRangeDates(), []);
  const [rangeStart, setRangeStart] = useState(defaultRange.start);
  const [rangeEnd, setRangeEnd] = useState(defaultRange.end);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementError, setMovementError] = useState("");
  const [movementReport, setMovementReport] = useState<BrandStockMovementReport | null>(null);
  const [movementSearch, setMovementSearch] = useState("");

  const load = useCallback(async (date?: string) => {
    setLoading(true);
    setError("");
    try {
      const [snapshotResult, live] = await Promise.all([
        getPalletsByBrand({ snapshotDate: date || undefined }),
        getLivePalletsByBrand(),
      ]);
      setBrands(snapshotResult.brands);
      setOverview(snapshotResult.overview);
      setAvailableDates(snapshotResult.overview.availableDates);
      setSnapshotDate(snapshotResult.snapshotDate || "");
      setLiveEstimates(live);
      setExpandedClientId(null);
      setDetails([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pallet data");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMovement = useCallback(async (start: string, end: string) => {
    if (!start || !end) return;
    setMovementLoading(true);
    setMovementError("");
    try {
      const report = await getBrandStockMovementReport({
        startDate: start,
        endDate: end,
      });
      setMovementReport(report);
    } catch (err) {
      setMovementError(
        err instanceof Error ? err.message : "Failed to load stock movement report"
      );
      setMovementReport(null);
    } finally {
      setMovementLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadMovement(defaultRange.start, defaultRange.end);
  }, [loadMovement, defaultRange.start, defaultRange.end]);

  const filteredBrands = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.brandName.toLowerCase().includes(q));
  }, [brands, search]);

  const filteredLive = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return liveEstimates;
    return liveEstimates.filter((b) => b.brandName.toLowerCase().includes(q));
  }, [liveEstimates, search]);

  const filteredMovement = useMemo(() => {
    const q = movementSearch.trim().toLowerCase();
    if (!movementReport) return [];
    if (!q) return movementReport.brands;
    return movementReport.brands.filter((b) => b.brandName.toLowerCase().includes(q));
  }, [movementReport, movementSearch]);

  const tabs = useMemo(
    () => [
      {
        key: "pallets" as const,
        label: "Pallets by Brand",
        icon: <Warehouse className="w-4 h-4" />,
        count: brands.length,
      },
      {
        key: "movement" as const,
        label: "Stock Movement",
        icon: <ArrowLeftRight className="w-4 h-4" />,
        count: movementReport?.brands.length,
      },
      {
        key: "live" as const,
        label: "Live Estimate",
        icon: <Package className="w-4 h-4" />,
        count: liveEstimates.length,
      },
    ],
    [brands.length, movementReport?.brands.length, liveEstimates.length]
  );

  const handleExpand = async (clientId: string) => {
    if (expandedClientId === clientId) {
      setExpandedClientId(null);
      setDetails([]);
      return;
    }
    if (!snapshotDate) return;
    setExpandedClientId(clientId);
    setDetailsLoading(true);
    try {
      const rows = await getBrandPalletDetails({ snapshotDate, clientId });
      setDetails(rows);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to load brand details",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleRunSnapshot = async (force = false) => {
    if (force) {
      const ok = window.confirm(
        "Rebuild today's storage snapshot? This replaces existing rows for today using current inventory."
      );
      if (!ok) return;
    }
    setRunning(true);
    setMessage(null);
    try {
      const result = await runStorageSnapshotNow({ force });
      if (result.alreadyExists) {
        setMessage({
          type: "info",
          text: `Snapshot for ${formatDateLabel(result.snapshotDate)} already exists. Use “Rebuild today” to refresh it.`,
        });
      } else {
        setMessage({
          type: "success",
          text: `Storage snapshot ${result.forced ? "rebuilt" : "completed"} — ${result.rowsCreated} inventory record${result.rowsCreated === 1 ? "" : "s"} for ${formatDateLabel(result.snapshotDate)}. Qty comes from inventory.qty_on_hand; samples are excluded from pallet billing.`,
        });
      }
      await load(result.snapshotDate);
      await loadMovement(rangeStart, rangeEnd);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to run storage snapshot",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell
      title="Pallets by Brand"
      subtitle="Storage pallet estimates from daily inventory snapshots (used for billing)"
    >
      <div className="space-y-6">
        {message && (
          <div
            className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
              message.type === "success"
                ? "border-green-200 bg-green-50 text-green-800"
                : message.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : message.type === "error" ? (
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <Database className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Tabs + snapshot actions on one row */}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-gray-200">
          <nav className="-mb-px flex flex-wrap gap-6" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span className={activeTab === tab.key ? "text-indigo-500" : "text-gray-400"}>
                  {tab.icon}
                </span>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                      activeTab === tab.key
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2 pb-2">
            <Button
              variant="secondary"
              onClick={() => void handleRunSnapshot(true)}
              disabled={running || loading}
            >
              <Database className="w-4 h-4" />
              Rebuild today
            </Button>
            <Button onClick={() => void handleRunSnapshot(false)} disabled={running || loading} loading={running}>
              <Play className="w-4 h-4" />
              Run storage snapshot
            </Button>
          </div>
        </div>

        {/* Tab: Pallets by Brand */}
        {activeTab === "pallets" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-600 flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  Snapshot date
                </label>
                <select
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={snapshotDate}
                  disabled={!availableDates.length || loading}
                  onChange={(e) => {
                    setSnapshotDate(e.target.value);
                    void load(e.target.value);
                  }}
                >
                  {availableDates.length === 0 ? (
                    <option value="">No snapshots yet</option>
                  ) : (
                    availableDates.map((d) => (
                      <option key={d} value={d}>
                        {formatDateLabel(d)}
                      </option>
                    ))
                  )}
                </select>
                <Button
                  variant="secondary"
                  onClick={() => void load(snapshotDate || undefined)}
                  disabled={loading || running}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>
              <input
                type="search"
                placeholder="Search brand…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm w-44"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card padding="sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Total pallets</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(overview?.totals.pallets || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {snapshotDate ? `As of ${formatDateLabel(snapshotDate)}` : "No snapshot"}
                </p>
              </Card>
              <Card padding="sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Brands</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {overview?.totals.brands || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">With stock in snapshot</p>
              </Card>
              <Card padding="sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Barrels / kegs</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(overview?.totals.barrels || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Tracked separately from pallets</p>
              </Card>
              <Card padding="sm">
                <p className="text-xs uppercase tracking-wide text-gray-500">Units on hand</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">
                  {formatNumber(overview?.totals.qtyOnHand || 0)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Across {overview?.totals.products || 0} SKUs
                </p>
              </Card>
            </div>

            <Card
              title="Pallets by brand"
              subtitle="Pallets = sellable cases ÷ ~60. Qty is from inventory on hand (samples / merch show units but 0 pallets)."
            >
              {loading ? (
                <div className="flex justify-center py-16">
                  <Spinner />
                </div>
              ) : brands.length === 0 ? (
                <div className="py-10 text-center space-y-3">
                  <Warehouse className="w-10 h-10 text-gray-300 mx-auto" />
                  <p className="text-gray-700 font-medium">No storage snapshots yet</p>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Run a storage snapshot to capture today’s inventory into{" "}
                    <code className="text-xs bg-gray-100 px-1 rounded">storage_snapshots</code>, then
                    review pallets per brand below.
                  </p>
                  <Button onClick={() => void handleRunSnapshot(false)} loading={running}>
                    <Play className="w-4 h-4" />
                    Run storage snapshot now
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-2 font-medium w-8" />
                        <th className="px-3 py-2 font-medium">Brand</th>
                        <th className="px-3 py-2 font-medium text-right">Pallets</th>
                        <th className="px-3 py-2 font-medium text-right">Barrels</th>
                        <th className="px-3 py-2 font-medium text-right">SKUs</th>
                        <th className="px-3 py-2 font-medium text-right">Locations</th>
                        <th className="px-3 py-2 font-medium text-right">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredBrands.map((brand) => {
                        const open = expandedClientId === brand.clientId;
                        return (
                          <Fragment key={brand.clientId}>
                            <tr
                              className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                              onClick={() => void handleExpand(brand.clientId)}
                            >
                              <td className="px-3 py-3 text-gray-400">
                                {open ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-indigo-500" />
                                  <span className="font-medium text-gray-900">{brand.brandName}</span>
                                </div>
                              </td>
                              <td className="px-3 py-3 text-right font-semibold text-gray-900">
                                {formatNumber(brand.palletCount)}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700">
                                {formatNumber(brand.barrelCount)}
                              </td>
                              <td className="px-3 py-3 text-right text-gray-700">{brand.productCount}</td>
                              <td className="px-3 py-3 text-right text-gray-700">{brand.locationCount}</td>
                              <td className="px-3 py-3 text-right text-gray-700">
                                {formatNumber(brand.qtyOnHand)}
                              </td>
                            </tr>
                            {open && (
                              <tr className="bg-slate-50/80">
                                <td colSpan={7} className="px-3 py-3">
                                  {detailsLoading ? (
                                    <div className="flex justify-center py-6">
                                      <Spinner />
                                    </div>
                                  ) : details.length === 0 ? (
                                    <p className="text-sm text-gray-500 py-2">No detail rows.</p>
                                  ) : (
                                    <table className="min-w-full text-xs">
                                      <thead>
                                        <tr className="text-left text-gray-500 border-b border-gray-200">
                                          <th className="py-2 pr-3 font-medium">SKU</th>
                                          <th className="py-2 pr-3 font-medium">Product</th>
                                          <th className="py-2 pr-3 font-medium">Type</th>
                                          <th className="py-2 pr-3 font-medium">Location</th>
                                          <th className="py-2 pr-3 font-medium text-right">On hand</th>
                                          <th className="py-2 pr-3 font-medium text-right">Pallets</th>
                                          <th className="py-2 font-medium text-right">Barrels</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {details.map((row) => (
                                          <tr key={row.id} className="border-b border-gray-100 last:border-0">
                                            <td className="py-2 pr-3 font-mono text-gray-700">
                                              {row.productSku}
                                            </td>
                                            <td className="py-2 pr-3 text-gray-800">{row.productName}</td>
                                            <td className="py-2 pr-3 text-gray-500 capitalize">
                                              {row.containerType || "—"}
                                            </td>
                                            <td className="py-2 pr-3 text-gray-600">
                                              {row.locationName || "—"}
                                            </td>
                                            <td className="py-2 pr-3 text-right whitespace-nowrap">
                                              {qtyLabel(row)}
                                            </td>
                                            <td className="py-2 pr-3 text-right font-medium">
                                              {formatNumber(row.palletCount)}
                                            </td>
                                            <td className="py-2 text-right">
                                              {formatNumber(row.barrelCount)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredBrands.length === 0 && (
                    <p className="text-sm text-gray-500 py-6 text-center">No brands match your search.</p>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab: Stock Movement */}
        {activeTab === "movement" && (
          <Card
            title="Stock movement by brand"
            subtitle="Start/end units from daily snapshots. In = receive/returns, Out = ship/write-off/expire, Adj = adjust/cycle count."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                />
                <span className="text-gray-400 text-sm">to</span>
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm"
                />
                <Button
                  variant="secondary"
                  disabled={movementLoading || !rangeStart || !rangeEnd}
                  onClick={() => void loadMovement(rangeStart, rangeEnd)}
                >
                  <ArrowLeftRight className={`w-4 h-4 ${movementLoading ? "animate-spin" : ""}`} />
                  Apply
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    movementLoading || !movementReport || filteredMovement.length === 0
                  }
                  onClick={() => {
                    if (!movementReport) return;
                    downloadBrandStockMovementExcel(movementReport, {
                      brands: filteredMovement,
                    });
                  }}
                >
                  <Download className="w-4 h-4" />
                  Export Excel
                </Button>
                <input
                  type="search"
                  placeholder="Search brand…"
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm w-40"
                />
              </div>
            }
          >
            {movementError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {movementError}
              </div>
            )}

            {movementReport && (!movementReport.hasStartSnapshot || !movementReport.hasEndSnapshot) && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {!movementReport.hasStartSnapshot &&
                    `No snapshot for ${formatDateLabel(movementReport.startDate)}. Start stock shows 0. `}
                  {!movementReport.hasEndSnapshot &&
                    `No snapshot for ${formatDateLabel(movementReport.endDate)}. End stock shows 0. `}
                  Pick snapshot dates that exist for reliable beginning/ending figures.
                </span>
              </div>
            )}

            {movementLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : !movementReport || movementReport.brands.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No stock movement data for this range. Ensure snapshots exist for the start and end dates.
              </p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 font-medium">Brand</th>
                      <th className="px-3 py-2 font-medium text-right">Beginning Inventory</th>
                      <th className="px-3 py-2 font-medium text-right text-green-700">In</th>
                      <th className="px-3 py-2 font-medium text-right text-red-700">Out</th>
                      <th className="px-3 py-2 font-medium text-right">Adjustments</th>
                      <th className="px-3 py-2 font-medium text-right">Ending Inventory</th>
                      <th className="px-3 py-2 font-medium text-right">Beginning Pallets</th>
                      <th className="px-3 py-2 font-medium text-right">Ending Pallets</th>
                      <th className="px-3 py-2 font-medium text-right">Variance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovement.map((row) => {
                      const varianceWarn = Math.abs(row.varianceQty) >= 0.5;
                      return (
                        <tr key={row.clientId} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-indigo-500 shrink-0" />
                              <span className="font-medium text-gray-900">{row.brandName}</span>
                              {(!row.hasStartSnapshot || !row.hasEndSnapshot) && (
                                <Badge variant="warning">Incomplete</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-800">
                            {formatNumber(row.startQty)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-green-700">
                            {formatNumber(row.inQty)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-red-700">
                            {formatNumber(row.outQty)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700">
                            {formatNumber(row.adjQty)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                            {formatNumber(row.endQty)}
                          </td>
                          <td className="px-3 py-2.5 text-right text-gray-700">
                            {formatNumber(row.startPallets)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                            {formatNumber(row.endPallets)}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums ${
                              varianceWarn ? "text-amber-700 font-medium" : "text-gray-400"
                            }`}
                            title="start + in − out + adj − end"
                          >
                            {formatNumber(row.varianceQty)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {movementReport.brands.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-slate-50 text-sm font-semibold">
                        <td className="px-3 py-2.5">Totals</td>
                        <td className="px-3 py-2.5 text-right">
                          {formatNumber(movementReport.totals.startQty)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-green-700">
                          {formatNumber(movementReport.totals.inQty)}
                        </td>
                        <td className="px-3 py-2.5 text-right text-red-700">
                          {formatNumber(movementReport.totals.outQty)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {formatNumber(movementReport.totals.adjQty)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {formatNumber(movementReport.totals.endQty)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {formatNumber(movementReport.totals.startPallets)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {formatNumber(movementReport.totals.endPallets)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {formatNumber(movementReport.totals.varianceQty)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {filteredMovement.length === 0 && (
                  <p className="text-sm text-gray-500 py-6 text-center">No brands match your search.</p>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Tab: Live Estimate */}
        {activeTab === "live" && (
          <Card
            title="Live inventory estimate"
            subtitle="Calculated right now from current inventory (not yet saved as a snapshot)."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">Live</Badge>
                <Button
                  variant="secondary"
                  onClick={() => void load(snapshotDate || undefined)}
                  disabled={loading || running}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <input
                  type="search"
                  placeholder="Search brand…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm w-44"
                />
              </div>
            }
          >
            {loading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : liveEstimates.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No live inventory with quantity on hand.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-2 font-medium">Brand</th>
                      <th className="px-3 py-2 font-medium text-right">Est. pallets</th>
                      <th className="px-3 py-2 font-medium text-right">Barrels</th>
                      <th className="px-3 py-2 font-medium text-right">SKUs</th>
                      <th className="px-3 py-2 font-medium text-right">Units</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLive.map((row) => (
                      <tr key={row.clientId} className="border-b border-gray-100">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-900">{row.brandName}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium">
                          {formatNumber(row.palletCount)}
                        </td>
                        <td className="px-3 py-2.5 text-right">{formatNumber(row.barrelCount)}</td>
                        <td className="px-3 py-2.5 text-right">{row.productCount}</td>
                        <td className="px-3 py-2.5 text-right">{formatNumber(row.qtyOnHand)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLive.length === 0 && (
                  <p className="text-sm text-gray-500 py-6 text-center">No brands match your search.</p>
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
