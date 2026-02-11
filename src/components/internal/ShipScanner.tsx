"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, ScanLine, AlertTriangle, CheckCircle, Truck, Volume2, Box } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { createClient } from "@/lib/supabase";
import { logScanEvent, resolveBarcode } from "@/lib/api/scan-events";
import { getLPNByNumber, updateLPNStatus, LPN } from "@/lib/api/lpns";
import { updateOutboundOrderStatus } from "@/lib/api/outbound";

interface ShipScannerProps {
  outboundOrderId: string;
  onComplete?: () => void;
}

type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "wrong_order";

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

interface ShipmentCarton extends LPN {
  scanned: boolean;
}

export default function ShipScanner({
  outboundOrderId,
  onComplete,
}: ShipScannerProps) {
  const [loading, setLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Order info
  const [orderNumber, setOrderNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  // Cartons to ship
  const [cartons, setCartons] = useState<ShipmentCarton[]>([]);

  const fetchData = useCallback(async () => {
    const supabase = createClient();

    // Get order info
    const { data: order, error: orderError } = await supabase
      .from("outbound_orders")
      .select("order_number, carrier, tracking_number")
      .eq("id", outboundOrderId)
      .single();

    if (orderError) {
      console.error("Failed to fetch order:", orderError);
      setLoading(false);
      return;
    }

    setOrderNumber(order.order_number);
    setCarrier(order.carrier || "");
    setTrackingNumber(order.tracking_number || "");

    // Get cartons for this order
    const { data: lpns, error: lpnsError } = await supabase
      .from("lpns")
      .select("*")
      .eq("reference_type", "outbound_order")
      .eq("reference_id", outboundOrderId)
      .in("stage", ["staged", "packing"]);

    if (lpnsError) {
      console.error("Failed to fetch cartons:", lpnsError);
    } else {
      setCartons((lpns || []).map(lpn => ({
        ...lpn,
        scanned: false,
      })) as ShipmentCarton[]);
    }

    setLoading(false);
  }, [outboundOrderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allCartonsScanned = cartons.length > 0 && cartons.every(c => c.scanned);

  const handleScan = useCallback(async (code: string) => {
    setScannerActive(false);
    setMessage(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Try to resolve as LPN
    const resolved = await resolveBarcode(code);

    await logScanEvent({
      scanType: resolved?.type || "lpn",
      barcode: code,
      workflowStage: "shipping",
      lpnId: resolved?.type === "lpn" ? resolved.id : undefined,
      referenceType: "outbound_order",
      referenceId: outboundOrderId,
      scannedBy: user?.id,
      scanResult: resolved ? "success" : "error",
      errorMessage: resolved ? undefined : "Barcode not found",
    });

    if (!resolved) {
      if (audioEnabled) playBeep(false);
      setScanStatus("not_found");
      setMessage({ type: "error", text: `Carton not found: ${code}` });
      return;
    }

    if (resolved.type === "lpn") {
      // Check if this carton belongs to this order
      const carton = cartons.find(c => c.id === resolved.id);
      if (!carton) {
        if (audioEnabled) playBeep(false);
        setScanStatus("wrong_order");
        setMessage({ type: "error", text: "This carton does not belong to this order" });
        return;
      }

      if (carton.scanned) {
        if (audioEnabled) playBeep(true);
        setMessage({ type: "warning", text: `Carton ${carton.lpn_number} already scanned` });
        return;
      }

      // Mark carton as scanned
      if (audioEnabled) playBeep(true);
      setCartons(prev => prev.map(c =>
        c.id === carton.id ? { ...c, scanned: true } : c
      ));
      setScanStatus("found");
      setMessage({ type: "success", text: `Carton ${carton.lpn_number} verified` });
    } else {
      if (audioEnabled) playBeep(false);
      setMessage({ type: "error", text: "Please scan a carton/LPN barcode" });
    }
  }, [cartons, audioEnabled, outboundOrderId]);

  const handleConfirmShipment = async () => {
    if (!allCartonsScanned) {
      setMessage({ type: "error", text: "Please scan all cartons before shipping" });
      return;
    }

    if (!carrier || !trackingNumber) {
      setMessage({ type: "warning", text: "Please enter carrier and tracking information" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Update all cartons to shipped status
      for (const carton of cartons) {
        await updateLPNStatus(carton.id, "shipped", "shipped");
      }

      // Update order status to shipped
      await updateOutboundOrderStatus(outboundOrderId, "shipped", {
        carrier,
        tracking_number: trackingNumber,
      });

      if (audioEnabled) playBeep(true);
      setMessage({ type: "success", text: "Shipment confirmed!" });

      if (onComplete) {
        setTimeout(onComplete, 1500);
      }
    } catch (error) {
      if (audioEnabled) playBeep(false);
      setMessage({ type: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Ship Scanner
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Order: {orderNumber}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAudioEnabled(!audioEnabled)}
            >
              <Volume2 className={`w-4 h-4 ${audioEnabled ? "text-blue-600" : "text-gray-400"}`} />
            </Button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : message.type === "warning"
              ? "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}>
            {message.type === "success" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            {message.text}
          </div>
        )}

        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
            <span>Cartons verified</span>
            <span>{cartons.filter(c => c.scanned).length} / {cartons.length}</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{
                width: cartons.length > 0
                  ? `${(cartons.filter(c => c.scanned).length / cartons.length) * 100}%`
                  : "0%",
              }}
            />
          </div>
        </div>

        {/* Scanner */}
        {!allCartonsScanned && (
          <>
            {scannerActive ? (
              <div className="mb-4">
                <BarcodeScanner
                  onScan={handleScan}
                  onClose={() => setScannerActive(false)}
                />
              </div>
            ) : (
              <Button
                onClick={() => setScannerActive(true)}
                className="w-full mb-4"
              >
                <ScanLine className="w-4 h-4 mr-2" />
                Scan Carton to Verify
              </Button>
            )}
          </>
        )}

        {/* Carton List */}
        {cartons.length > 0 ? (
          <div className="space-y-2 mb-4">
            {cartons.map(carton => (
              <div
                key={carton.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  carton.scanned
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "bg-gray-50 dark:bg-gray-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  {carton.scanned ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <Box className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white">
                    {carton.lpn_number}
                  </span>
                </div>
                <span className={`text-sm ${
                  carton.scanned ? "text-green-600" : "text-gray-500"
                }`}>
                  {carton.scanned ? "Verified" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No cartons found for this order</p>
            <p className="text-sm">Items may not have been packed yet</p>
          </div>
        )}
      </Card>

      {/* Shipping Details */}
      <Card>
        <h4 className="font-medium text-gray-900 dark:text-white mb-4">Shipping Details</h4>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Carrier
            </label>
            <Input
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder="e.g., FedEx, UPS, USPS"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
              Tracking Number
            </label>
            <Input
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
            />
          </div>
        </div>
      </Card>

      {/* Confirm Button */}
      <Card>
        <Button
          onClick={handleConfirmShipment}
          disabled={saving || !allCartonsScanned || !carrier || !trackingNumber}
          className="w-full"
          size="lg"
        >
          {saving ? (
            "Processing..."
          ) : (
            <>
              <Truck className="w-5 h-5 mr-2" />
              Confirm Shipment
            </>
          )}
        </Button>
        {!allCartonsScanned && cartons.length > 0 && (
          <p className="text-sm text-center text-gray-500 mt-2">
            Scan all cartons to enable shipping
          </p>
        )}
      </Card>
    </div>
  );
}
