"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { getLocations, Location } from "@/lib/api/locations";
import { getInventoryByLocation, InventoryWithDetails } from "@/lib/api/inventory";
import { createTransfer } from "@/lib/api/transfers";

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface TransferQty {
  [productId: string]: number;
}

export default function StockTransferModal({
  isOpen,
  onClose,
  onComplete,
}: StockTransferModalProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationInventory, setLocationInventory] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [transferQtys, setTransferQtys] = useState<TransferQty>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchLocations = async () => {
        try {
          const locationsData = await getLocations();
          setLocations(locationsData);
        } catch (error) {
          console.error("Failed to fetch locations:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchLocations();
    }
  }, [isOpen]);

  useEffect(() => {
    if (fromLocationId) {
      const fetchInventory = async () => {
        setLoadingInventory(true);
        try {
          const inventoryData = await getInventoryByLocation(fromLocationId);
          setLocationInventory(inventoryData);
          setTransferQtys({});
        } catch (error) {
          console.error("Failed to fetch inventory:", error);
        } finally {
          setLoadingInventory(false);
        }
      };
      fetchInventory();
    } else {
      setLocationInventory([]);
      setTransferQtys({});
    }
  }, [fromLocationId]);

  const locationOptions = useMemo(() => {
    return locations.map((loc) => ({ value: loc.id, label: loc.name }));
  }, [locations]);

  const toLocationOptions = useMemo(() => {
    return locations
      .filter((loc) => loc.id !== fromLocationId)
      .map((loc) => ({ value: loc.id, label: loc.name }));
  }, [locations, fromLocationId]);

  const getAvailableQty = (item: InventoryWithDetails): number => {
    return item.qty_on_hand - item.qty_reserved;
  };

  const handleQtyChange = (productId: string, qty: string) => {
    const numQty = parseInt(qty) || 0;
    setTransferQtys((prev) => ({
      ...prev,
      [productId]: numQty,
    }));
  };

  const handleClose = () => {
    setFromLocationId("");
    setToLocationId("");
    setTransferQtys({});
    setLocationInventory([]);
    setNotes("");
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");

    try {
      const items = itemsToTransfer.map((item) => ({
        productId: item.product_id,
        qtyRequested: transferQtys[item.product_id],
      }));

      await createTransfer(fromLocationId, toLocationId, items, notes || undefined);
      onComplete();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create transfer");
    } finally {
      setSubmitting(false);
    }
  };

  const locationsAreSame = fromLocationId && toLocationId && fromLocationId === toLocationId;

  const itemsToTransfer = useMemo(() => {
    return locationInventory.filter((item) => {
      const qty = transferQtys[item.product_id] || 0;
      return qty > 0;
    });
  }, [locationInventory, transferQtys]);

  const hasInvalidQty = useMemo(() => {
    return locationInventory.some((item) => {
      const qty = transferQtys[item.product_id] || 0;
      const available = getAvailableQty(item);
      return qty < 0 || qty > available;
    });
  }, [locationInventory, transferQtys]);

  const canSubmit =
    fromLocationId &&
    toLocationId &&
    !locationsAreSame &&
    itemsToTransfer.length > 0 &&
    !hasInvalidQty;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Stock Transfer" size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="From Location"
            name="fromLocation"
            options={locationOptions}
            value={fromLocationId}
            onChange={(e) => setFromLocationId(e.target.value)}
            placeholder="Select source location"
            disabled={loading}
          />

          <Select
            label="To Location"
            name="toLocation"
            options={toLocationOptions}
            value={toLocationId}
            onChange={(e) => setToLocationId(e.target.value)}
            placeholder="Select destination location"
            disabled={loading || !fromLocationId}
          />
        </div>

        {locationsAreSame && (
          <Alert
            type="error"
            message="Source and destination locations must be different"
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Products to Transfer
          </label>

          {!fromLocationId ? (
            <p className="text-sm text-gray-500 py-4">
              Select a source location to view available products
            </p>
          ) : loadingInventory ? (
            <div className="py-8 text-center text-gray-500">
              Loading inventory...
            </div>
          ) : locationInventory.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              No products available at this location
            </p>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Product
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">
                      On Hand
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase w-24">
                      Available
                    </th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase w-32">
                      Transfer Qty
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {locationInventory.map((item) => {
                    const available = getAvailableQty(item);
                    const transferQty = transferQtys[item.product_id] || 0;
                    const isInvalid = transferQty < 0 || transferQty > available;

                    return (
                      <tr key={item.id} className={transferQty > 0 ? "bg-blue-50" : ""}>
                        <td className="px-4 py-2">
                          <div className="text-sm font-medium text-gray-900">
                            {item.product.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.product.sku}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-900">
                          {item.qty_on_hand}
                        </td>
                        <td className="px-4 py-2 text-right text-sm">
                          <span className={available <= 0 ? "text-red-600" : "text-green-600"}>
                            {available}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="number"
                            value={transferQty || ""}
                            onChange={(e) => handleQtyChange(item.product_id, e.target.value)}
                            min={0}
                            max={available}
                            placeholder="0"
                            disabled={available <= 0}
                            className={`w-full px-2 py-1 text-center border rounded-md text-sm
                              ${isInvalid
                                ? "border-red-500 bg-red-50 focus:ring-red-500"
                                : "border-gray-300 focus:ring-blue-500"
                              }
                              focus:outline-none focus:ring-2 focus:border-transparent
                              disabled:bg-gray-100 disabled:text-gray-400`}
                          />
                          {isInvalid && (
                            <p className="text-xs text-red-500 mt-1 text-center">
                              Max: {available}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {itemsToTransfer.length > 0 && (
            <div className="mt-2 text-sm text-gray-600">
              {itemsToTransfer.length} product{itemsToTransfer.length !== 1 ? "s" : ""} selected for transfer
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Add any additional notes..."
          />
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError("")} />}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting}>
            Create Transfer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
