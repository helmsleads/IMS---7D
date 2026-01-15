"use client";

import { useEffect, useMemo, useState } from "react";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import { getProducts, Product } from "@/lib/api/products";
import { getLocations, Location } from "@/lib/api/locations";
import { getInventory, adjustStock, InventoryWithDetails } from "@/lib/api/inventory";

interface StockAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  preselectedProduct?: string;
  preselectedLocation?: string;
}

const adjustmentTypeOptions = [
  { value: "add", label: "Add" },
  { value: "remove", label: "Remove" },
  { value: "set", label: "Set" },
];

const reasonOptions = [
  { value: "received", label: "Received" },
  { value: "damaged", label: "Damaged" },
  { value: "sample", label: "Sample" },
  { value: "theft", label: "Theft" },
  { value: "count_correction", label: "Count Correction" },
  { value: "other", label: "Other" },
];

export default function StockAdjustmentModal({
  isOpen,
  onClose,
  onComplete,
  preselectedProduct,
  preselectedLocation,
}: StockAdjustmentModalProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const [productId, setProductId] = useState(preselectedProduct || "");
  const [locationId, setLocationId] = useState(preselectedLocation || "");
  const [adjustmentType, setAdjustmentType] = useState("");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        try {
          const [productsData, locationsData, inventoryData] = await Promise.all([
            getProducts(),
            getLocations(),
            getInventory(),
          ]);
          setProducts(productsData);
          setLocations(locationsData);
          setInventory(inventoryData);
        } catch (error) {
          console.error("Failed to fetch data:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (preselectedProduct) setProductId(preselectedProduct);
    if (preselectedLocation) setLocationId(preselectedLocation);
  }, [preselectedProduct, preselectedLocation]);

  const currentQty = useMemo(() => {
    if (!productId || !locationId) return null;
    const inventoryItem = inventory.find(
      (item) => item.product_id === productId && item.location_id === locationId
    );
    return inventoryItem?.qty_on_hand ?? 0;
  }, [productId, locationId, inventory]);

  const newQty = useMemo(() => {
    if (currentQty === null || !adjustmentType || quantity === "") return null;
    const adjustmentQty = parseInt(quantity, 10);
    if (isNaN(adjustmentQty)) return null;

    switch (adjustmentType) {
      case "add":
        return currentQty + adjustmentQty;
      case "remove":
        return currentQty - adjustmentQty;
      case "set":
        return adjustmentQty;
      default:
        return null;
    }
  }, [currentQty, adjustmentType, quantity]);

  const isNegative = newQty !== null && newQty < 0;

  const handleClose = () => {
    setProductId(preselectedProduct || "");
    setLocationId(preselectedLocation || "");
    setAdjustmentType("");
    setQuantity("");
    setReason("");
    setNotes("");
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit || currentQty === null) return;

    setSubmitting(true);
    setError("");

    try {
      const adjustmentQty = parseInt(quantity, 10);
      let qtyChange: number;

      switch (adjustmentType) {
        case "add":
          qtyChange = adjustmentQty;
          break;
        case "remove":
          qtyChange = -adjustmentQty;
          break;
        case "set":
          qtyChange = adjustmentQty - currentQty;
          break;
        default:
          throw new Error("Invalid adjustment type");
      }

      await adjustStock({
        productId,
        locationId,
        qtyChange,
        reason,
        notes: notes || undefined,
      });

      onComplete();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setSubmitting(false);
    }
  };

  const productOptions = products.map((p) => ({
    value: p.id,
    label: `${p.sku} - ${p.name}`,
  }));

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const canSubmit =
    productId &&
    locationId &&
    adjustmentType &&
    quantity !== "" &&
    reason &&
    !isNegative;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Adjust Stock" size="md">
      <div className="space-y-4">
        <Select
          label="Product"
          name="product"
          options={productOptions}
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          placeholder="Select a product"
          disabled={loading || !!preselectedProduct}
        />

        <Select
          label="Location"
          name="location"
          options={locationOptions}
          value={locationId}
          onChange={(e) => setLocationId(e.target.value)}
          placeholder="Select a location"
          disabled={loading || !!preselectedLocation}
        />

        <Select
          label="Adjustment Type"
          name="adjustmentType"
          options={adjustmentTypeOptions}
          value={adjustmentType}
          onChange={(e) => setAdjustmentType(e.target.value)}
          placeholder="Select type"
        />

        <Input
          label="Quantity"
          name="quantity"
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min={0}
        />

        {currentQty !== null && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Preview</div>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-xs text-gray-500">Current</div>
                <div className="text-lg font-semibold text-gray-900">{currentQty}</div>
              </div>
              <div className="text-gray-400 text-xl">&rarr;</div>
              <div className="text-center">
                <div className="text-xs text-gray-500">New</div>
                <div
                  className={`text-lg font-semibold ${
                    newQty === null
                      ? "text-gray-400"
                      : isNegative
                      ? "text-red-600"
                      : "text-green-600"
                  }`}
                >
                  {newQty !== null ? newQty : "—"}
                </div>
              </div>
            </div>
            {isNegative && (
              <div className="mt-2">
                <Alert
                  type="error"
                  message="Quantity cannot go negative"
                />
              </div>
            )}
          </div>
        )}

        <Select
          label="Reason"
          name="reason"
          options={reasonOptions}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Select a reason"
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes (optional)
          </label>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            placeholder="Add any additional notes..."
          />
        </div>

        {error && (
          <Alert type="error" message={error} onClose={() => setError("")} />
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting} loading={submitting}>
            Apply Adjustment
          </Button>
        </div>
      </div>
    </Modal>
  );
}
