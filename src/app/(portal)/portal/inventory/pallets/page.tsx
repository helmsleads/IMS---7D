"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Package,
  RefreshCw,
  CalendarDays,
  Warehouse,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import { getUnitLabel } from "@/lib/labels";
import {
  BrandPalletDetailRow,
  BrandPalletSummary,
  LiveBrandPalletEstimate,
  getBrandPalletDetails,
  getLivePalletsByBrand,
  getPalletsByBrand,
} from "@/lib/api/storage-snapshots";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(n);
}

function formatDateLabel(date: string | null) {
  if (!date) return "—";
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function qtyLabel(row: BrandPalletDetailRow) {
  const unit = getUnitLabel(row.containerType);
  const qty = formatNumber(row.qtyOnHand);
  if (row.caseCount != null) {
    return `${qty} ${unit} (${formatNumber(row.caseCount)} cs)`;
  }
  return `${qty} ${unit}`;
}

export default function PortalPalletsPage() {
  const { client } = useClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snapshotDate, setSnapshotDate] = useState("");
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [brand, setBrand] = useState<BrandPalletSummary | null>(null);
  const [live, setLive] = useState<LiveBrandPalletEstimate | null>(null);
  const [details, setDetails] = useState<BrandPalletDetailRow[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const load = useCallback(
    async (date?: string) => {
      if (!client?.id) return;
      setLoading(true);
      setError("");
      try {
        const [snapshotResult, liveRows] = await Promise.all([
          getPalletsByBrand({ snapshotDate: date || undefined, clientId: client.id }),
          getLivePalletsByBrand({ clientId: client.id }),
        ]);
        setAvailableDates(snapshotResult.overview.availableDates);
        setSnapshotDate(snapshotResult.snapshotDate || "");
        setBrand(snapshotResult.brands[0] || null);
        setLive(liveRows[0] || null);

        if (snapshotResult.snapshotDate && snapshotResult.brands[0]) {
          setDetailsLoading(true);
          try {
            const rows = await getBrandPalletDetails({
              snapshotDate: snapshotResult.snapshotDate,
              clientId: client.id,
            });
            setDetails(rows);
          } finally {
            setDetailsLoading(false);
          }
        } else {
          setDetails([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load pallet usage");
      } finally {
        setLoading(false);
      }
    },
    [client?.id]
  );

  useEffect(() => {
    void load();
  }, [load]);

  if (!client) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Pallets</h1>
          <p className="text-sm text-slate-500 mt-1">
            Estimated pallet storage for <span className="font-medium text-slate-700">{client.company_name}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-600 flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            Date
          </label>
          <select
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
          <Button variant="secondary" onClick={() => void load(snapshotDate || undefined)} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card padding="sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Pallets</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNumber(brand?.palletCount ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {snapshotDate ? `Snapshot ${formatDateLabel(snapshotDate)}` : "No snapshot yet"}
              </p>
            </Card>
            <Card padding="sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Barrels / kegs</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNumber(brand?.barrelCount ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Counted separately from pallets</p>
            </Card>
            <Card padding="sm">
              <p className="text-xs uppercase tracking-wide text-slate-500">Units on hand</p>
              <p className="mt-1 text-3xl font-semibold text-slate-900">
                {formatNumber(brand?.qtyOnHand ?? 0)}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Across {brand?.productCount ?? 0} SKUs
              </p>
            </Card>
          </div>

          {!brand && (
            <Card>
              <div className="py-8 text-center space-y-2">
                <Warehouse className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-medium text-slate-800">No snapshot data for your brand yet</p>
                <p className="text-sm text-slate-500 max-w-md mx-auto">
                  Warehouse staff capture a daily storage snapshot for billing. Until then, your
                  live inventory estimate is shown below.
                </p>
              </div>
            </Card>
          )}

          {brand && (
            <Card
              title="Storage detail"
              subtitle="Products and locations included in this snapshot"
              actions={
                <button
                  type="button"
                  className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                  onClick={() => setDetailsOpen((v) => !v)}
                >
                  {detailsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {detailsOpen ? "Hide" : "Show"}
                </button>
              }
            >
              {detailsOpen &&
                (detailsLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner />
                  </div>
                ) : details.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">No rows for this date.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                          <th className="px-2 py-2 font-medium">SKU</th>
                          <th className="px-2 py-2 font-medium">Product</th>
                          <th className="px-2 py-2 font-medium">Type</th>
                          <th className="px-2 py-2 font-medium">Location</th>
                          <th className="px-2 py-2 font-medium text-right">On hand</th>
                          <th className="px-2 py-2 font-medium text-right">Pallets</th>
                          <th className="px-2 py-2 font-medium text-right">Barrels</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.map((row) => (
                          <tr key={row.id} className="border-b border-slate-100">
                            <td className="px-2 py-2.5 font-mono text-slate-700">{row.productSku}</td>
                            <td className="px-2 py-2.5 text-slate-900">{row.productName}</td>
                            <td className="px-2 py-2.5 text-slate-500 capitalize">
                              {row.containerType || "—"}
                            </td>
                            <td className="px-2 py-2.5 text-slate-600">{row.locationName || "—"}</td>
                            <td className="px-2 py-2.5 text-right whitespace-nowrap">{qtyLabel(row)}</td>
                            <td className="px-2 py-2.5 text-right font-medium">
                              {formatNumber(row.palletCount)}
                            </td>
                            <td className="px-2 py-2.5 text-right">{formatNumber(row.barrelCount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </Card>
          )}

          {live && (
            <Card title="Live inventory estimate" subtitle="Based on current stock — may differ from the saved snapshot.">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600">Est. pallets</span>
                  <span className="font-semibold text-slate-900">{formatNumber(live.palletCount)}</span>
                </div>
                <div>
                  <span className="text-slate-600">Barrels</span>{" "}
                  <span className="font-semibold text-slate-900">{formatNumber(live.barrelCount)}</span>
                </div>
                <div>
                  <span className="text-slate-600">SKUs</span>{" "}
                  <span className="font-semibold text-slate-900">{live.productCount}</span>
                </div>
                <div>
                  <span className="text-slate-600">Units</span>{" "}
                  <span className="font-semibold text-slate-900">{formatNumber(live.qtyOnHand)}</span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
