"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Package, ScanLine, AlertTriangle, CheckCircle, X, Plus, Volume2, Layers, Calendar } from "lucide-react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { lookupBarcode } from "@/lib/api/barcode";
import { receiveWithLot } from "@/lib/api/inbound";
import { createClient } from "@/lib/supabase";

interface InboundItem {
  id: string;
  product_id: string;
  qty_expected: number;
  qty_received: number;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    image_url: string | null;
    lot_tracking_enabled: boolean;
    default_expiration_days: number | null;
  };
}

interface ReceivingScannerProps {
  inboundOrderId: string;
  defaultLocationId?: string;
  onComplete: () => void;
}

type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "not_expected" | "lot_entry";

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

    // Success beep: higher pitch, pleasant tone
    // Error beep: lower pitch, warning tone
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

export default function ReceivingScanner({
  inboundOrderId,
  defaultLocationId,
  onComplete,
}: ReceivingScannerProps) {
  const [items, setItems] = useState<InboundItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scannedItem, setScannedItem] = useState<InboundItem | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [pendingQty, setPendingQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Lot tracking state
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [lotScannerActive, setLotScannerActive] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(defaultLocationId || null);

  const fetchItems = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("inbound_items")
      .select(`
        id,
        product_id,
        qty_expected,
        qty_received,
        product:products (
          id,
          name,
          sku,
          barcode,
          image_url,
          lot_tracking_enabled,
          default_expiration_days
        )
      `)
      .eq("inbound_order_id", inboundOrderId)
      .order("created_at");

    if (error) {
      console.error("Failed to fetch items:", error);
    } else {
      setItems((data || []) as unknown as InboundItem[]);
    }

    setLoading(false);
  }, [inboundOrderId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Calculate default expiration date based on product's default_expiration_days
  const getDefaultExpirationDate = useCallback((item: InboundItem): string => {
    if (item.product.default_expiration_days) {
      const date = new Date();
      date.setDate(date.getDate() + item.product.default_expiration_days);
      return date.toISOString().split("T")[0];
    }
    return "";
  }, []);

  const handleScan = useCallback(async (code: string) => {
    setScannedCode(code);
    setScannerActive(false);
    setPendingQty(0);

    // Look up the product
    const product = await lookupBarcode(code);

    if (!product) {
      if (audioEnabled) playBeep(false);
      setScanStatus("not_found");
      setScannedItem(null);
      return;
    }

    // Check if product is in expected items
    const matchedItem = items.find((item) => item.product_id === product.id);

    if (!matchedItem) {
      if (audioEnabled) playBeep(false);
      setScanStatus("not_expected");
      setScannedItem(null);
      return;
    }

    // Success beep
    if (audioEnabled) playBeep(true);

    setScannedItem(matchedItem);

    // If lot tracking is enabled, go to lot entry step
    if (matchedItem.product.lot_tracking_enabled) {
      setLotNumber("");
      setExpirationDate(getDefaultExpirationDate(matchedItem));
      setScanStatus("lot_entry");
      setPendingQty(1); // Default to 1 for lot-tracked items
    } else {
      setScanStatus("found");
      setPendingQty(0);
    }
  }, [items, audioEnabled, getDefaultExpirationDate]);

  // Handle lot barcode scan
  const handleLotScan = useCallback((code: string) => {
    setLotNumber(code);
    setLotScannerActive(false);
    if (audioEnabled) playBeep(true);
  }, [audioEnabled]);

  const handleAddQty = (qty: number) => {
    if (!scannedItem) return;
    const remaining = scannedItem.qty_expected - scannedItem.qty_received - pendingQty;
    const toAdd = Math.min(qty, remaining);
    if (toAdd > 0) {
      setPendingQty((prev) => prev + toAdd);
    }
  };

  const handleAddAll = () => {
    if (!scannedItem) return;
    const remaining = scannedItem.qty_expected - scannedItem.qty_received;
    setPendingQty(remaining);
  };

  const handleConfirmReceive = async () => {
    if (!scannedItem || pendingQty <= 0) return;

    // For lot-tracked items, validate lot number
    if (scannedItem.product.lot_tracking_enabled) {
      if (!lotNumber.trim()) {
        setMessage({ type: "error", text: "Lot number is required" });
        return;
      }
      if (!locationId) {
        setMessage({ type: "error", text: "Location is required for lot-tracked items" });
        return;
      }
    }

    setSaving(true);
    setMessage(null);

    const newQtyReceived = scannedItem.qty_received + pendingQty;

    try {
      if (scannedItem.product.lot_tracking_enabled && locationId) {
        // Use receiveWithLot for lot-tracked products
        await receiveWithLot(
          scannedItem.id,
          newQtyReceived,
          locationId,
          lotNumber.trim(),
          expirationDate || null
        );
      } else {
        // Standard receive for non-lot-tracked products
        const supabase = createClient();
        const { error } = await supabase
          .from("inbound_items")
          .update({ qty_received: newQtyReceived })
          .eq("id", scannedItem.id);

        if (error) {
          throw new Error(error.message);
        }
      }

      // Update local state
      setItems((prev) =>
        prev.map((item) =>
          item.id === scannedItem.id
            ? { ...item, qty_received: newQtyReceived }
            : item
        )
      );

      const lotInfo = scannedItem.product.lot_tracking_enabled
        ? ` (Lot: ${lotNumber})`
        : "";
      setMessage({
        type: "success",
        text: `Received ${pendingQty} x ${scannedItem.product.name}${lotInfo}`,
      });

      // Reset scan state
      setScanStatus("idle");
      setScannedItem(null);
      setScannedCode(null);
      setPendingQty(0);
      setLotNumber("");
      setExpirationDate("");
      setSaving(false);

      // Auto-start scanner for next item
      setTimeout(() => setScannerActive(true), 500);
    } catch (err) {
      console.error("Failed to receive:", err);
      setMessage({ type: "error", text: "Failed to update received quantity" });
      setSaving(false);
    }
  };

  const handleScanAgain = () => {
    setScanStatus("idle");
    setScannedItem(null);
    setScannedCode(null);
    setPendingQty(0);
    setLotNumber("");
    setExpirationDate("");
    setLotScannerActive(false);
    setMessage(null);
    setScannerActive(true);
  };

  const handleManualSelect = (item: InboundItem) => {
    if (audioEnabled) playBeep(true);
    setScannedItem(item);
    setScannedCode(item.product.sku);
    setScannerActive(false);

    // If lot tracking is enabled, go to lot entry step
    if (item.product.lot_tracking_enabled) {
      setLotNumber("");
      setExpirationDate(getDefaultExpirationDate(item));
      setScanStatus("lot_entry");
      setPendingQty(1);
    } else {
      setScanStatus("found");
      setPendingQty(0);
    }
  };

  const totalExpected = items.reduce((sum, item) => sum + item.qty_expected, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.qty_received, 0);
  const allReceived = items.every((item) => item.qty_received >= item.qty_expected);

  // Calculate running total including pending
  const runningTotal = totalReceived + pendingQty;

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
            <h3 className="font-semibold text-gray-900">Receiving Progress</h3>
            <p className="text-sm text-gray-500">
              {runningTotal} of {totalExpected} units
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
                style={{ width: `${Math.min(100, (runningTotal / totalExpected) * 100)}%` }}
              />
            </div>
            {allReceived && (
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

        {/* Scan Result - Not Expected */}
        {scanStatus === "not_expected" && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <p className="font-medium text-gray-900">Not in This Order</p>
            <p className="text-sm text-gray-500 mt-1">
              This product is not expected in this inbound order
            </p>
            <Button variant="secondary" onClick={handleScanAgain} className="mt-4">
              Scan Again
            </Button>
          </div>
        )}

        {/* Lot Entry Step - For lot-tracked products */}
        {scanStatus === "lot_entry" && scannedItem && (
          <div className="space-y-4">
            {/* Product Info Card */}
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Product Image */}
                <div className="w-16 h-16 bg-white rounded-lg border border-purple-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {scannedItem.product.image_url ? (
                    <Image
                      src={scannedItem.product.image_url}
                      alt={scannedItem.product.name}
                      width={64}
                      height={64}
                      className="object-contain"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-purple-400" />
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{scannedItem.product.name}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                      <Layers className="w-3 h-3" />
                      Lot Tracked
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 font-mono">{scannedItem.product.sku}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Remaining: <strong>{scannedItem.qty_expected - scannedItem.qty_received}</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Lot Entry Form */}
            <div className="space-y-4 bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-600" />
                Enter Lot Information
              </h4>

              {/* Lot Number - with scan option */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lot Number <span className="text-red-500">*</span>
                </label>
                {lotScannerActive ? (
                  <div className="space-y-2">
                    <BarcodeScanner
                      isActive={lotScannerActive}
                      onScan={handleLotScan}
                      onError={(err) => console.error("Lot scanner error:", err)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setLotScannerActive(false)}
                      className="w-full"
                    >
                      Cancel Scan
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      name="lot-number"
                      value={lotNumber}
                      onChange={(e) => setLotNumber(e.target.value)}
                      placeholder="Enter or scan lot number"
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => setLotScannerActive(true)}
                      title="Scan lot barcode"
                    >
                      <ScanLine className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Expiration Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration Date
                  {scannedItem.product.default_expiration_days && (
                    <span className="text-gray-400 font-normal ml-1">
                      (auto-calculated from {scannedItem.product.default_expiration_days} days)
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    type="button"
                    onClick={() => setExpirationDate(getDefaultExpirationDate(scannedItem))}
                    className="px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-md"
                    title="Reset to default"
                  >
                    <Calendar className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    name="lot-qty"
                    type="number"
                    min={1}
                    max={scannedItem.qty_expected - scannedItem.qty_received}
                    value={pendingQty}
                    onChange={(e) => setPendingQty(parseInt(e.target.value) || 0)}
                    className="flex-1"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingQty(scannedItem.qty_expected - scannedItem.qty_received)}
                  >
                    Max
                  </Button>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm">
                <div className="space-y-1">
                  <p className="text-gray-600">
                    Lot: <span className="font-medium text-gray-900">{lotNumber || "—"}</span>
                  </p>
                  <p className="text-gray-600">
                    Expires: <span className="font-medium text-gray-900">{expirationDate || "—"}</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Qty to Receive</p>
                  <p className="text-2xl font-bold text-blue-700">{pendingQty}</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={handleScanAgain}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmReceive}
                disabled={saving || pendingQty <= 0 || !lotNumber.trim()}
                className="flex-1"
              >
                {saving ? "Saving..." : `Confirm Receive`}
              </Button>
            </div>
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
                      <span className="text-gray-500">Expected:</span>
                      <span className="font-bold text-gray-900 ml-1">{scannedItem.qty_expected}</span>
                    </div>
                    <div className="bg-white rounded px-2 py-1">
                      <span className="text-gray-500">Received:</span>
                      <span className="font-bold text-blue-600 ml-1">{scannedItem.qty_received}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Add Buttons */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Add to received quantity:</p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => handleAddQty(1)}
                  disabled={scannedItem.qty_received + pendingQty >= scannedItem.qty_expected}
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add 1
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => handleAddQty(5)}
                  disabled={scannedItem.qty_received + pendingQty >= scannedItem.qty_expected}
                  className="flex-1"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add 5
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleAddAll}
                  disabled={scannedItem.qty_received + pendingQty >= scannedItem.qty_expected}
                  className="flex-1"
                >
                  Add All
                </Button>
              </div>
            </div>

            {/* Running Total Display */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600 font-medium">Pending to Add</p>
                  <p className="text-3xl font-bold text-blue-700">{pendingQty}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">New Total</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {scannedItem.qty_received + pendingQty} / {scannedItem.qty_expected}
                  </p>
                  {scannedItem.qty_received + pendingQty >= scannedItem.qty_expected && (
                    <span className="text-xs text-green-600 font-medium">Complete</span>
                  )}
                </div>
              </div>
            </div>

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
                onClick={handleConfirmReceive}
                disabled={saving || pendingQty <= 0}
                className="flex-1"
              >
                {saving ? "Saving..." : `Confirm +${pendingQty}`}
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

      {/* Expected Items List */}
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Expected Items</h3>
        <div className="divide-y">
          {items.map((item) => {
            const isComplete = item.qty_received >= item.qty_expected;
            const isPartial = item.qty_received > 0 && item.qty_received < item.qty_expected;
            const isSelected = scannedItem?.id === item.id;

            return (
              <div
                key={item.id}
                className={`py-3 flex items-center justify-between ${
                  isSelected ? "bg-blue-50 -mx-4 px-4 rounded" : ""
                }`}
              >
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{item.product.name}</p>
                      {item.product.lot_tracking_enabled && (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded"
                          title="Lot tracking required"
                        >
                          <Layers className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 font-mono">{item.product.sku}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-medium ${isComplete ? "text-green-600" : "text-gray-900"}`}>
                      {item.qty_received} / {item.qty_expected}
                    </p>
                    <p className="text-xs text-gray-500">received</p>
                  </div>
                  {!isComplete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleManualSelect(item)}
                    >
                      {item.product.lot_tracking_enabled ? "Enter Lot" : "Receive"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Complete Button */}
      {allReceived && (
        <div className="flex justify-end">
          <Button onClick={onComplete}>
            <CheckCircle className="w-4 h-4 mr-1" />
            Complete Receiving
          </Button>
        </div>
      )}
    </div>
  );
}
