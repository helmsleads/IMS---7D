"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Package, ScanLine, AlertTriangle, CheckCircle, X, Plus, Volume2, MapPin, PartyPopper } from "lucide-react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { lookupBarcode } from "@/lib/api/barcode";
import { createClient } from "@/lib/supabase";

interface PickItem {
  id: string;
  product_id: string;
  qty_requested: number;
  qty_shipped: number;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    image_url: string | null;
  };
  inventory: {
    location_id: string;
    location_name: string;
    qty_available: number;
  }[];
}

interface PickingScannerProps {
  outboundOrderId: string;
  onComplete: () => void;
}

type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "not_in_order" | "no_stock";

// Audio context for beep sound
let audioContext: AudioContext | null = null;

function playBeep(success: boolean = true) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = success ? 880 : 220;
    oscillator.type = success ? "sine" : "square";

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + (success ? 0.15 : 0.3));

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + (success ? 0.15 : 0.3));
  } catch (err) {
    console.warn("Audio playback failed:", err);
  }
}

export default function PickingScanner({
  outboundOrderId,
  onComplete,
}: PickingScannerProps) {
  const [items, setItems] = useState<PickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scannedItem, setScannedItem] = useState<PickItem | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [pendingQty, setPendingQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [completing, setCompleting] = useState(false);

  const fetchItems = useCallback(async () => {
    const supabase = createClient();

    // Fetch order items with product info
    const { data: orderItems, error: itemsError } = await supabase
      .from("outbound_items")
      .select(`
        id,
        product_id,
        qty_requested,
        qty_shipped,
        product:products (
          id,
          name,
          sku,
          barcode,
          image_url
        )
      `)
      .eq("order_id", outboundOrderId)
      .order("created_at");

    if (itemsError) {
      console.error("Failed to fetch items:", itemsError);
      setLoading(false);
      return;
    }

    // Fetch inventory for each product
    const productIds = [...new Set((orderItems || []).map((item) => item.product_id))];

    const { data: inventoryData, error: inventoryError } = await supabase
      .from("inventory")
      .select(`
        product_id,
        location_id,
        qty_on_hand,
        qty_reserved,
        location:locations (
          id,
          name
        )
      `)
      .in("product_id", productIds)
      .gt("qty_on_hand", 0);

    if (inventoryError) {
      console.error("Failed to fetch inventory:", inventoryError);
    }

    // Map inventory to items
    const itemsWithInventory: PickItem[] = (orderItems || []).map((item) => {
      const itemInventory = (inventoryData || [])
        .filter((inv) => inv.product_id === item.product_id)
        .map((inv) => {
          // Handle Supabase returning location as array or object
          const location = Array.isArray(inv.location) ? inv.location[0] : inv.location;
          return {
            location_id: inv.location_id,
            location_name: (location as { name: string })?.name || "Unknown",
            qty_available: inv.qty_on_hand - inv.qty_reserved,
          };
        })
        .filter((inv) => inv.qty_available > 0);

      // Handle Supabase returning product as array or object
      const product = Array.isArray(item.product) ? item.product[0] : item.product;

      return {
        ...item,
        product: product as PickItem["product"],
        inventory: itemInventory,
      };
    });

    setItems(itemsWithInventory);
    setLoading(false);
  }, [outboundOrderId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleScan = useCallback(async (code: string) => {
    setScannedCode(code);
    setScannerActive(false);
    setPendingQty(0);
    setSelectedLocationId("");

    // Look up the product
    const product = await lookupBarcode(code);

    if (!product) {
      if (audioEnabled) playBeep(false);
      setScanStatus("not_found");
      setScannedItem(null);
      return;
    }

    // Check if product is in order items
    const matchedItem = items.find((item) => item.product_id === product.id);

    if (!matchedItem) {
      if (audioEnabled) playBeep(false);
      setScanStatus("not_in_order");
      setScannedItem(null);
      return;
    }

    // Check if item has available inventory
    if (matchedItem.inventory.length === 0) {
      if (audioEnabled) playBeep(false);
      setScanStatus("no_stock");
      setScannedItem(matchedItem);
      return;
    }

    // Success beep
    if (audioEnabled) playBeep(true);

    setScanStatus("found");
    setScannedItem(matchedItem);

    // Auto-select first location with stock
    if (matchedItem.inventory.length === 1) {
      setSelectedLocationId(matchedItem.inventory[0].location_id);
    }
  }, [items, audioEnabled]);

  const handleAddQty = (qty: number) => {
    if (!scannedItem || !selectedLocationId) return;

    const selectedInventory = scannedItem.inventory.find((inv) => inv.location_id === selectedLocationId);
    if (!selectedInventory) return;

    const remaining = scannedItem.qty_requested - scannedItem.qty_shipped - pendingQty;
    const availableInLocation = selectedInventory.qty_available;
    const toAdd = Math.min(qty, remaining, availableInLocation - pendingQty);

    if (toAdd > 0) {
      setPendingQty((prev) => prev + toAdd);
    }
  };

  const handleAddAll = () => {
    if (!scannedItem || !selectedLocationId) return;

    const selectedInventory = scannedItem.inventory.find((inv) => inv.location_id === selectedLocationId);
    if (!selectedInventory) return;

    const remaining = scannedItem.qty_requested - scannedItem.qty_shipped;
    const availableInLocation = selectedInventory.qty_available;
    setPendingQty(Math.min(remaining, availableInLocation));
  };

  const handleConfirmPick = async () => {
    if (!scannedItem || !selectedLocationId || pendingQty <= 0) return;

    setSaving(true);
    setMessage(null);

    const supabase = createClient();

    const newQtyShipped = scannedItem.qty_shipped + pendingQty;

    // Update the item's shipped quantity
    const { error: updateError } = await supabase
      .from("outbound_items")
      .update({ qty_shipped: newQtyShipped })
      .eq("id", scannedItem.id);

    if (updateError) {
      setMessage({ type: "error", text: "Failed to update picked quantity" });
      setSaving(false);
      return;
    }

    // Update inventory (reduce stock)
    const { error: inventoryError } = await supabase.rpc("update_inventory", {
      p_product_id: scannedItem.product_id,
      p_location_id: selectedLocationId,
      p_qty_change: -pendingQty,
    });

    if (inventoryError) {
      // Rollback the item update
      await supabase
        .from("outbound_items")
        .update({ qty_shipped: scannedItem.qty_shipped })
        .eq("id", scannedItem.id);
      setMessage({ type: "error", text: "Failed to update inventory" });
      setSaving(false);
      return;
    }

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "outbound_item",
      entity_id: scannedItem.id,
      action: "picked",
      details: {
        product_id: scannedItem.product_id,
        qty_picked: pendingQty,
        location_id: selectedLocationId,
      },
    });

    // Update local state
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === scannedItem.id) {
          return {
            ...item,
            qty_shipped: newQtyShipped,
            inventory: item.inventory.map((inv) =>
              inv.location_id === selectedLocationId
                ? { ...inv, qty_available: inv.qty_available - pendingQty }
                : inv
            ).filter((inv) => inv.qty_available > 0),
          };
        }
        return item;
      })
    );

    setMessage({
      type: "success",
      text: `Picked ${pendingQty} x ${scannedItem.product.name}`,
    });

    // Reset scan state
    setScanStatus("idle");
    setScannedItem(null);
    setScannedCode(null);
    setPendingQty(0);
    setSelectedLocationId("");
    setSaving(false);

    // Auto-start scanner for next item
    setTimeout(() => setScannerActive(true), 500);
  };

  const handleScanAgain = () => {
    setScanStatus("idle");
    setScannedItem(null);
    setScannedCode(null);
    setPendingQty(0);
    setSelectedLocationId("");
    setMessage(null);
    setScannerActive(true);
  };

  const handleManualSelect = (item: PickItem) => {
    if (item.inventory.length === 0) {
      if (audioEnabled) playBeep(false);
      setScanStatus("no_stock");
      setScannedItem(item);
      return;
    }

    if (audioEnabled) playBeep(true);
    setScanStatus("found");
    setScannedItem(item);
    setScannedCode(item.product.sku);
    setScannerActive(false);
    setPendingQty(0);

    if (item.inventory.length === 1) {
      setSelectedLocationId(item.inventory[0].location_id);
    } else {
      setSelectedLocationId("");
    }
  };

  const handleCompletePicking = async () => {
    setCompleting(true);

    const supabase = createClient();

    try {
      // Update order status to "packed"
      const { error } = await supabase
        .from("outbound_orders")
        .update({ status: "packed" })
        .eq("id", outboundOrderId);

      if (error) {
        setMessage({ type: "error", text: "Failed to update order status" });
        setCompleting(false);
        return;
      }

      // Log activity
      await supabase.from("activity_log").insert({
        entity_type: "outbound_order",
        entity_id: outboundOrderId,
        action: "status_changed",
        details: {
          new_status: "packed",
          picked_items: items.length,
          total_picked: items.reduce((sum, item) => sum + item.qty_shipped, 0),
        },
      });

      // Success - call onComplete to close and refresh
      onComplete();
    } catch (err) {
      console.error("Failed to complete picking:", err);
      setMessage({ type: "error", text: "Failed to complete picking" });
      setCompleting(false);
    }
  };

  const totalRequested = items.reduce((sum, item) => sum + item.qty_requested, 0);
  const totalPicked = items.reduce((sum, item) => sum + item.qty_shipped, 0);
  const allPicked = items.every((item) => item.qty_shipped >= item.qty_requested);
  const runningTotal = totalPicked + pendingQty;

  const locationOptions = scannedItem?.inventory.map((inv) => ({
    value: inv.location_id,
    label: `${inv.location_name} (${inv.qty_available} available)`,
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Picking Progress</h3>
            <p className="text-sm text-gray-500">
              {runningTotal} of {totalRequested} units
              {pendingQty > 0 && (
                <span className="text-blue-600 ml-1">(+{pendingQty} pending)</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                audioEnabled ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
              }`}
              title={audioEnabled ? "Sound on" : "Sound off"}
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${Math.min(100, (runningTotal / totalRequested) * 100)}%` }}
              />
            </div>
            {allPicked && (
              <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Complete
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* Scanner Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Scan Item</h3>
          {!scannerActive && scanStatus === "idle" && (
            <Button onClick={() => setScannerActive(true)}>
              <ScanLine className="w-4 h-4 mr-1" />
              Start Scanner
            </Button>
          )}
        </div>

        {/* Active Scanner */}
        {scannerActive && (
          <div className="space-y-4">
            <BarcodeScanner
              isActive={scannerActive}
              onScan={handleScan}
              onError={(err) => console.error("Scanner error:", err)}
            />
            <Button variant="secondary" onClick={() => setScannerActive(false)} className="w-full">
              Cancel
            </Button>
          </div>
        )}

        {/* Scan Result - Not Found */}
        {scanStatus === "not_found" && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <X className="w-6 h-6 text-red-600" />
            </div>
            <p className="font-medium text-gray-900">Product Not Found</p>
            <p className="text-sm text-gray-500 mt-1">
              No product matches code: <span className="font-mono">{scannedCode}</span>
            </p>
            <Button variant="secondary" onClick={handleScanAgain} className="mt-4">
              Scan Again
            </Button>
          </div>
        )}

        {/* Scan Result - Not In Order */}
        {scanStatus === "not_in_order" && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <p className="font-medium text-gray-900">Not in This Order</p>
            <p className="text-sm text-gray-500 mt-1">
              This product is not part of this outbound order
            </p>
            <Button variant="secondary" onClick={handleScanAgain} className="mt-4">
              Scan Again
            </Button>
          </div>
        )}

        {/* Scan Result - No Stock */}
        {scanStatus === "no_stock" && scannedItem && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-red-600" />
            </div>
            <p className="font-medium text-gray-900">No Stock Available</p>
            <p className="text-sm text-gray-500 mt-1">
              {scannedItem.product.name} has no available inventory
            </p>
            <Button variant="secondary" onClick={handleScanAgain} className="mt-4">
              Scan Again
            </Button>
          </div>
        )}

        {/* Scan Result - Found */}
        {scanStatus === "found" && scannedItem && (
          <div className="space-y-4">
            {/* Product Card with Image */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Product Image */}
                <div className="w-20 h-20 bg-white rounded-lg border border-green-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {scannedItem.product.image_url ? (
                    <Image
                      src={scannedItem.product.image_url}
                      alt={scannedItem.product.name}
                      width={80}
                      height={80}
                      className="object-contain"
                    />
                  ) : (
                    <Package className="w-8 h-8 text-green-400" />
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-lg">{scannedItem.product.name}</p>
                  <p className="text-sm text-gray-500 font-mono">{scannedItem.product.sku}</p>

                  {/* Quantity Stats */}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white rounded px-2 py-1">
                      <span className="text-gray-500">Requested:</span>
                      <span className="font-bold text-gray-900 ml-1">{scannedItem.qty_requested}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1">
                      <span className="text-gray-500">Picked:</span>
                      <span className="font-bold text-blue-600 ml-1">{scannedItem.qty_shipped}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pick Location Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Pick from location:</p>
              {scannedItem.inventory.length > 1 ? (
                <Select
                  name="pick-location"
                  options={locationOptions}
                  value={selectedLocationId}
                  onChange={(e) => {
                    setSelectedLocationId(e.target.value);
                    setPendingQty(0);
                  }}
                  placeholder="Select location"
                />
              ) : (
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-gray-900">{scannedItem.inventory[0]?.location_name}</span>
                  <span className="text-sm text-gray-500">
                    ({scannedItem.inventory[0]?.qty_available} available)
                  </span>
                </div>
              )}
            </div>

            {/* Quick Add Buttons */}
            {selectedLocationId && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Add to pick quantity:</p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => handleAddQty(1)}
                    disabled={scannedItem.qty_shipped + pendingQty >= scannedItem.qty_requested}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add 1
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleAddQty(5)}
                    disabled={scannedItem.qty_shipped + pendingQty >= scannedItem.qty_requested}
                    className="flex-1"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add 5
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleAddAll}
                    disabled={scannedItem.qty_shipped + pendingQty >= scannedItem.qty_requested}
                    className="flex-1"
                  >
                    Add All
                  </Button>
                </div>
              </div>
            )}

            {/* Running Total Display */}
            {selectedLocationId && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-medium">Pending to Pick</p>
                    <p className="text-3xl font-bold text-blue-700">{pendingQty}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">New Total</p>
                    <p className="text-xl font-semibold text-gray-900">
                      {scannedItem.qty_shipped + pendingQty} / {scannedItem.qty_requested}
                    </p>
                    {scannedItem.qty_shipped + pendingQty >= scannedItem.qty_requested && (
                      <span className="text-xs text-green-600 font-medium">Complete</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleScanAgain}
                className="flex-1"
              >
                <ScanLine className="w-4 h-4 mr-1" />
                Scan Next
              </Button>
              <Button
                onClick={handleConfirmPick}
                disabled={saving || pendingQty <= 0 || !selectedLocationId}
                className="flex-1"
              >
                {saving ? "Saving..." : `Confirm Pick +${pendingQty}`}
              </Button>
            </div>
          </div>
        )}

        {/* Idle State */}
        {scanStatus === "idle" && !scannerActive && (
          <div className="text-center py-6 text-gray-500">
            <ScanLine className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">Click &quot;Start Scanner&quot; or select an item below</p>
          </div>
        )}
      </Card>

      {/* Message */}
      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Pick List */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Pick List</h3>
        <div className="divide-y">
          {items.map((item) => {
            const isComplete = item.qty_shipped >= item.qty_requested;
            const isPartial = item.qty_shipped > 0 && item.qty_shipped < item.qty_requested;
            const isSelected = scannedItem?.id === item.id;
            const hasStock = item.inventory.length > 0;

            return (
              <div
                key={item.id}
                className={`py-3 ${
                  isSelected ? "bg-blue-50 -mx-4 px-4 rounded" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Thumbnail */}
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden ${
                        isComplete
                          ? "bg-green-100"
                          : isPartial
                          ? "bg-amber-100"
                          : "bg-gray-100"
                      }`}
                    >
                      {item.product.image_url ? (
                        <Image
                          src={item.product.image_url}
                          alt={item.product.name}
                          width={40}
                          height={40}
                          className="object-contain"
                        />
                      ) : isComplete ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{item.product.sku}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className={`font-medium ${isComplete ? "text-green-600" : "text-gray-900"}`}>
                        {item.qty_shipped} / {item.qty_requested}
                      </p>
                      <p className="text-xs text-gray-500">picked</p>
                    </div>
                    {!isComplete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleManualSelect(item)}
                        disabled={!hasStock}
                        title={!hasStock ? "No stock available" : undefined}
                      >
                        {hasStock ? "Pick" : "No Stock"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Location hints */}
                {!isComplete && item.inventory.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 ml-13">
                    {item.inventory.slice(0, 3).map((inv) => (
                      <span
                        key={inv.location_id}
                        className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded"
                      >
                        <MapPin className="w-3 h-3" />
                        {inv.location_name}: {inv.qty_available}
                      </span>
                    ))}
                    {item.inventory.length > 3 && (
                      <span className="text-xs text-gray-400">
                        +{item.inventory.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* All Picked Success & Complete Button */}
      {allPicked && (
        <Card>
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">All Items Picked!</h3>
            <p className="text-gray-500 mb-6">
              Successfully picked {totalPicked} units across {items.length} items.
              Ready to mark as packed.
            </p>
            <Button
              onClick={handleCompletePicking}
              loading={completing}
              disabled={completing}
              className="px-8"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {completing ? "Updating..." : "Complete Picking & Mark Packed"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
