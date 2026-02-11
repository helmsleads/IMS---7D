"use client";

import { useState } from "react";
import {
  Search,
  Package,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import PalletContentsCard, {
  PalletContentDisplay,
} from "@/components/internal/PalletContentsCard";
import PalletBreakdownScanner from "@/components/internal/PalletBreakdownScanner";
import {
  getPalletForBreakdown,
  pullFromPallet,
  getPalletBreakdownHistory,
  formatCaseAwareQty,
  PalletForBreakdown,
} from "@/lib/api/pallet-breakdown";
import { getLocations, Location } from "@/lib/api/locations";
import { getSublocations, SublocationWithLocation } from "@/lib/api/sublocations";

export default function PalletBreakdownPage() {
  // Search state
  const [searchCode, setSearchCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Pallet state
  const [pallet, setPallet] = useState<PalletForBreakdown | null>(null);

  // Pull modal state
  const [pullingContent, setPullingContent] = useState<PalletContentDisplay | null>(null);
  const [pullQty, setPullQty] = useState(0);
  const [pullLocationId, setPullLocationId] = useState("");
  const [pullSublocationId, setPullSublocationId] = useState("");
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState("");
  const [pullSuccess, setPullSuccess] = useState("");

  // Location data
  const [locations, setLocations] = useState<Location[]>([]);
  const [sublocations, setSublocations] = useState<SublocationWithLocation[]>([]);
  const [locationsLoaded, setLocationsLoaded] = useState(false);

  // History state
  const [history, setHistory] = useState<Array<{
    id: string;
    product_id: string;
    location_id: string;
    transaction_type: string;
    qty_change: number;
    reason: string | null;
    notes: string | null;
    created_at: string;
    product: { id: string; sku: string; name: string };
    location: { id: string; name: string };
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Scanner mode
  const [showScanner, setShowScanner] = useState(false);

  const loadLocations = async () => {
    if (locationsLoaded) return;
    try {
      const locs = await getLocations();
      setLocations(locs.filter((l) => l.active));
      setLocationsLoaded(true);
    } catch {
      console.error("Failed to load locations");
    }
  };

  const handleSearch = async () => {
    const code = searchCode.trim();
    if (!code) return;

    setSearching(true);
    setSearchError("");
    setPallet(null);
    setHistory([]);
    setPullSuccess("");

    try {
      const result = await getPalletForBreakdown(code);
      if (!result) {
        setSearchError(`No pallet found with code "${code}"`);
        return;
      }
      if (result.container_type !== "pallet") {
        setSearchError(`LPN "${code}" is not a pallet (type: ${result.container_type})`);
        return;
      }
      setPallet(result);
      await loadLocations();

      // Load history
      setHistoryLoading(true);
      try {
        const hist = await getPalletBreakdownHistory(result.id);
        setHistory(hist);
      } catch {
        // Non-critical
      } finally {
        setHistoryLoading(false);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const openPullModal = (content: PalletContentDisplay) => {
    const upc = content.product.units_per_case || 1;
    setPullingContent(content);
    setPullQty(upc); // Default to 1 case
    setPullLocationId("");
    setPullSublocationId("");
    setPullError("");
    setPullSuccess("");
  };

  const closePullModal = () => {
    setPullingContent(null);
    setPullQty(0);
    setPullLocationId("");
    setPullSublocationId("");
    setPullError("");
  };

  const handleLocationChange = async (locationId: string) => {
    setPullLocationId(locationId);
    setPullSublocationId("");
    if (locationId) {
      try {
        const subs = await getSublocations(locationId);
        setSublocations(subs);
      } catch {
        setSublocations([]);
      }
    } else {
      setSublocations([]);
    }
  };

  const handlePull = async () => {
    if (!pallet || !pullingContent || pullQty <= 0 || !pullLocationId) return;

    setPulling(true);
    setPullError("");

    try {
      const updated = await pullFromPallet({
        palletId: pallet.id,
        productId: pullingContent.product_id,
        quantity: pullQty,
        destinationLocationId: pullLocationId,
        destinationSublocationId: pullSublocationId || undefined,
        lotId: pullingContent.lot_id || undefined,
        notes: `Breakdown pull: ${pullQty} units to ${
          locations.find((l) => l.id === pullLocationId)?.name || "location"
        }`,
      });

      setPallet(updated);
      const containerType = pullingContent.product.container_type || "other";
      const upc = pullingContent.product.units_per_case ?? null;
      setPullSuccess(
        `Pulled ${formatCaseAwareQty(pullQty, containerType, upc)} of ${
          pullingContent.product.name
        }`
      );
      closePullModal();

      // Refresh history
      try {
        const hist = await getPalletBreakdownHistory(updated.id);
        setHistory(hist);
      } catch {
        // Non-critical
      }
    } catch (err) {
      setPullError(err instanceof Error ? err.message : "Pull failed");
    } finally {
      setPulling(false);
    }
  };

  const adjustQtyByCase = (amount: number) => {
    const newQty = Math.max(0, pullQty + amount);
    if (pullingContent && newQty <= pullingContent.qty) {
      setPullQty(newQty);
    }
  };

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const sublocationOptions = sublocations.map((s) => ({
    value: s.id,
    label: `${s.code}${s.name ? ` - ${s.name}` : ""}`,
  }));

  const totalItems = pallet?.contents?.reduce((sum, c) => sum + c.qty, 0) || 0;

  return (
    <AppShell title="Pallet Breakdown" subtitle="Pull items from pallets to storage locations">
      <div className="space-y-6">
        {/* Search Bar */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter or scan pallet LPN code (e.g., PLT-...)"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            <Button onClick={handleSearch} loading={searching} disabled={searching || !searchCode.trim()} size="lg">
              Search
            </Button>
            <Button variant="secondary" onClick={() => setShowScanner(true)} size="lg">
              Scanner Mode
            </Button>
          </div>
          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{searchError}</p>
            </div>
          )}
        </Card>

        {/* Success Banner */}
        {pullSuccess && (
          <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <p className="font-medium">{pullSuccess}</p>
            <button
              onClick={() => setPullSuccess("")}
              className="ml-auto text-green-500 hover:text-green-700"
            >
              &times;
            </button>
          </div>
        )}

        {/* Pallet Info */}
        {pallet && (
          <>
            {/* Pallet Header */}
            <Card>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {pallet.lpn_number}
                    </h2>
                    <div className="flex items-center gap-3 mt-1">
                      <Badge
                        variant={
                          pallet.status === "active"
                            ? "success"
                            : pallet.status === "empty"
                            ? "default"
                            : "warning"
                        }
                      >
                        {pallet.status}
                      </Badge>
                      {pallet.is_mixed && (
                        <Badge variant="info">Mixed</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 text-sm">
                  {pallet.location && (
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>
                        {pallet.location.name}
                        {pallet.sublocation && (
                          <span className="font-medium ml-1">
                            / {pallet.sublocation.code}
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Package className="w-4 h-4" />
                    <span>
                      {pallet.contents?.length || 0} product
                      {(pallet.contents?.length || 0) !== 1 ? "s" : ""}
                      {" | "}
                      {totalItems.toLocaleString()} total units
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Contents Table */}
            <Card>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Pallet Contents
              </h3>
              {pallet.status === "empty" ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-lg font-medium text-gray-900">
                    Pallet is empty
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    All items have been pulled from this pallet
                  </p>
                </div>
              ) : (
                <PalletContentsCard
                  contents={pallet.contents || []}
                  showPullButton={pallet.status === "active"}
                  onPull={openPullModal}
                />
              )}
            </Card>

            {/* Breakdown History */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Breakdown History
                </h3>
              </div>

              {historyLoading ? (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No breakdown history yet
                </p>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Destination
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Qty Pulled
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {history.map((tx) => (
                        <tr key={tx.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900 text-sm">
                              {tx.product.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {tx.product.sku}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 text-sm text-gray-600">
                              <ArrowRight className="w-3 h-3" />
                              {tx.location.name}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium text-gray-900">
                              {tx.qty_change}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(tx.created_at).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </>
        )}

        {/* Empty state when no pallet loaded */}
        {!pallet && !searching && !searchError && (
          <Card>
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Search for a Pallet
              </h3>
              <p className="text-gray-500 max-w-md mx-auto">
                Enter or scan a pallet LPN code above to view its contents and begin
                breaking it down into storage locations.
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Pull Modal */}
      <Modal
        isOpen={!!pullingContent}
        onClose={closePullModal}
        title="Pull from Pallet"
        size="sm"
      >
        {pullingContent && (
          <div className="space-y-4">
            {/* Product Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">
                {pullingContent.product.name}
              </p>
              <p className="text-sm text-gray-500">{pullingContent.product.sku}</p>
              <p className="text-sm text-gray-600 mt-2">
                Available:{" "}
                <strong>
                  {formatCaseAwareQty(
                    pullingContent.qty,
                    pullingContent.product.container_type || "other",
                    pullingContent.product.units_per_case ?? null
                  )}
                </strong>
              </p>
            </div>

            {/* Quantity Input with Case Buttons */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity to Pull
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={pullingContent.qty}
                  value={pullQty}
                  onChange={(e) =>
                    setPullQty(
                      Math.min(parseInt(e.target.value) || 0, pullingContent.qty)
                    )
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Case increment buttons */}
              <div className="flex gap-2 mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => adjustQtyByCase(1)}
                  disabled={pullQty >= pullingContent.qty}
                >
                  +1 unit
                </Button>
                {(pullingContent.product.units_per_case || 1) > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        adjustQtyByCase(pullingContent.product.units_per_case || 1)
                      }
                      disabled={pullQty >= pullingContent.qty}
                    >
                      +1 case ({pullingContent.product.units_per_case})
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        adjustQtyByCase(-(pullingContent.product.units_per_case || 1))
                      }
                      disabled={pullQty <= 0}
                    >
                      -1 case
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPullQty(pullingContent.qty)}
                >
                  All
                </Button>
              </div>

              {/* Case-aware display */}
              <p className="text-xs text-gray-500 mt-1">
                {formatCaseAwareQty(
                  pullQty,
                  pullingContent.product.container_type || "other",
                  pullingContent.product.units_per_case ?? null
                )}
              </p>
            </div>

            {/* Destination Location */}
            <Select
              label="Destination Location"
              name="pull-location"
              options={locationOptions}
              value={pullLocationId}
              onChange={(e) => handleLocationChange(e.target.value)}
              placeholder="Select location"
              required
            />

            {/* Destination Sublocation */}
            {pullLocationId && sublocationOptions.length > 0 && (
              <Select
                label="Sublocation"
                name="pull-sublocation"
                options={sublocationOptions}
                value={pullSublocationId}
                onChange={(e) => setPullSublocationId(e.target.value)}
                placeholder="Select sublocation (optional)"
              />
            )}

            {/* Error */}
            {pullError && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                {pullError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button variant="secondary" onClick={closePullModal} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handlePull}
                loading={pulling}
                disabled={pulling || pullQty <= 0 || !pullLocationId}
                className="flex-1"
              >
                Pull {pullQty} Units
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Scanner Mode Modal */}
      <Modal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        title="Scanner Mode"
        size="lg"
      >
        <PalletBreakdownScanner
          onComplete={(updatedPallet) => {
            setShowScanner(false);
            if (updatedPallet) {
              setPallet(updatedPallet);
              setSearchCode(updatedPallet.lpn_number);
              // Refresh history
              getPalletBreakdownHistory(updatedPallet.id)
                .then(setHistory)
                .catch(() => {});
            }
          }}
        />
      </Modal>
    </AppShell>
  );
}
