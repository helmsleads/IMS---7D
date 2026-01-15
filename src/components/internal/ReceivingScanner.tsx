"use client";

import { useEffect, useState, useCallback } from "react";
import { Check, Package, ScanLine, AlertTriangle, CheckCircle, X, Plus, Volume2 } from "lucide-react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { lookupBarcode } from "@/lib/api/barcode";
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
  };
}

interface ReceivingScannerProps {
  inboundOrderId: string;
  onComplete: () => void;
}

type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "not_expected";

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
          image_url
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

    setScanStatus("found");
    setScannedItem(matchedItem);
    setPendingQty(0);
  }, [items, audioEnabled]);

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

    setSaving(true);
    setMessage(null);

    const supabase = createClient();

    const newQtyReceived = scannedItem.qty_received + pendingQty;

    const { error } = await supabase
      .from("inbound_items")
      .update({ qty_received: newQtyReceived })
      .eq("id", scannedItem.id);

    if (error) {
      setMessage({ type: "error", text: "Failed to update received quantity" });
      setSaving(false);
      return;
    }

    // Update local state
    setItems((prev) =>
      prev.map((item) =>
        item.id === scannedItem.id
          ? { ...item, qty_received: newQtyReceived }
          : item
      )
    );

    setMessage({
      type: "success",
      text: `Received ${pendingQty} x ${scannedItem.product.name}`,
    });

    // Reset scan state
    setScanStatus("idle");
    setScannedItem(null);
    setScannedCode(null);
    setPendingQty(0);
    setSaving(false);

    // Auto-start scanner for next item
    setTimeout(() => setScannerActive(true), 500);
  };

  const handleScanAgain = () => {
    setScanStatus("idle");
    setScannedItem(null);
    setScannedCode(null);
    setPendingQty(0);
    setMessage(null);
    setScannerActive(true);
  };

  const handleManualSelect = (item: InboundItem) => {
    if (audioEnabled) playBeep(true);
    setScanStatus("found");
    setScannedItem(item);
    setScannedCode(item.product.sku);
    setScannerActive(false);
    setPendingQty(0);
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
                    <p className="font-medium text-gray-900">{item.product.name}</p>
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
                      Receive
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
