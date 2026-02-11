"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, ScanLine, AlertTriangle, CheckCircle, Box, Volume2, Plus } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { createClient } from "@/lib/supabase";
import { logScanEvent, resolveBarcode } from "@/lib/api/scan-events";
import { createLPN, addLPNContent, updateLPNStatus, LPN } from "@/lib/api/lpns";

interface PackItem {
  id: string;
  product_id: string;
  qty_requested: number;
  qty_shipped: number;
  qty_packed: number;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
  };
}

interface PackScannerProps {
  outboundOrderId: string;
  onComplete?: () => void;
}

type ScanMode = "item" | "carton";
type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "wrong_item";

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

export default function PackScanner({
  outboundOrderId,
  onComplete,
}: PackScannerProps) {
  const [items, setItems] = useState<PackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("item");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Current carton being packed
  const [currentCarton, setCurrentCarton] = useState<LPN | null>(null);
  const [cartonContents, setCartonContents] = useState<Array<{
    productId: string;
    sku: string;
    name: string;
    qty: number;
  }>>([]);

  // All cartons for this order
  const [cartons, setCartons] = useState<LPN[]>([]);

  const fetchItems = useCallback(async () => {
    const supabase = createClient();

    const { data, error } = await supabase
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
          barcode
        )
      `)
      .eq("order_id", outboundOrderId)
      .order("created_at");

    if (error) {
      console.error("Failed to fetch items:", error);
      setLoading(false);
      return;
    }

    setItems((data || []).map(item => ({
      ...item,
      product: item.product as PackItem["product"],
      qty_packed: 0, // Will be calculated from carton contents
    })));

    // Fetch existing cartons for this order
    const { data: existingCartons } = await supabase
      .from("lpns")
      .select("*")
      .eq("reference_type", "outbound_order")
      .eq("reference_id", outboundOrderId);

    setCartons((existingCartons || []) as LPN[]);
    setLoading(false);
  }, [outboundOrderId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleCreateCarton = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const carton = await createLPN({
        containerType: "carton",
        referenceType: "outbound_order",
        referenceId: outboundOrderId,
        createdBy: user?.id,
      });

      await updateLPNStatus(carton.id, "active", "packing");

      setCurrentCarton(carton);
      setCartonContents([]);
      setCartons(prev => [...prev, carton]);

      if (audioEnabled) playBeep(true);
      setMessage({ type: "success", text: `Carton ${carton.lpn_number} created` });
    } catch (error) {
      if (audioEnabled) playBeep(false);
      setMessage({ type: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleScan = useCallback(async (code: string) => {
    setScannerActive(false);
    setMessage(null);

    const resolved = await resolveBarcode(code);

    // Log the scan
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await logScanEvent({
      scanType: resolved?.type || "product",
      barcode: code,
      workflowStage: "packing",
      productId: resolved?.type === "product" ? resolved.id : undefined,
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
      setMessage({ type: "error", text: `Barcode not found: ${code}` });
      return;
    }

    if (resolved.type === "product") {
      // Check if product is in the order
      const matchedItem = items.find(item => item.product_id === resolved.id);
      if (!matchedItem) {
        if (audioEnabled) playBeep(false);
        setScanStatus("wrong_item");
        setMessage({ type: "error", text: "This item is not in the order" });
        return;
      }

      // Add to current carton
      if (!currentCarton) {
        if (audioEnabled) playBeep(false);
        setMessage({ type: "error", text: "Please create a carton first" });
        return;
      }

      if (audioEnabled) playBeep(true);
      setScanStatus("found");

      // Add to carton contents
      setCartonContents(prev => {
        const existing = prev.find(c => c.productId === resolved.id);
        if (existing) {
          return prev.map(c =>
            c.productId === resolved.id
              ? { ...c, qty: c.qty + 1 }
              : c
          );
        }
        return [...prev, {
          productId: resolved.id,
          sku: matchedItem.product.sku,
          name: matchedItem.product.name,
          qty: 1,
        }];
      });

      setMessage({ type: "success", text: `Added 1x ${matchedItem.product.sku} to carton` });
    } else if (resolved.type === "lpn") {
      // Scanning an existing carton to continue packing
      const carton = cartons.find(c => c.id === resolved.id);
      if (carton) {
        if (audioEnabled) playBeep(true);
        setCurrentCarton(carton);
        // Load existing contents
        const { data: contents } = await supabase
          .from("lpn_contents")
          .select(`
            product_id,
            qty,
            product:products (sku, name)
          `)
          .eq("lpn_id", carton.id);

        setCartonContents((contents || []).map(c => ({
          productId: c.product_id,
          sku: (c.product as { sku: string; name: string })?.sku || "",
          name: (c.product as { sku: string; name: string })?.name || "",
          qty: c.qty,
        })));
        setMessage({ type: "success", text: `Resumed carton ${carton.lpn_number}` });
      }
    }
  }, [items, currentCarton, cartons, audioEnabled, outboundOrderId]);

  const handleCloseCarton = async () => {
    if (!currentCarton || cartonContents.length === 0) {
      setMessage({ type: "error", text: "Carton is empty" });
      return;
    }

    setSaving(true);
    try {
      // Save all contents to the LPN
      for (const content of cartonContents) {
        await addLPNContent({
          lpnId: currentCarton.id,
          productId: content.productId,
          qty: content.qty,
        });
      }

      await updateLPNStatus(currentCarton.id, "active", "staged");

      if (audioEnabled) playBeep(true);
      setMessage({ type: "success", text: `Carton ${currentCarton.lpn_number} closed and staged` });

      // Reset for next carton
      setCurrentCarton(null);
      setCartonContents([]);

      // Check if all items are packed
      const totalPacked = cartonContents.reduce((sum, c) => sum + c.qty, 0);
      const totalToPack = items.reduce((sum, i) => sum + i.qty_shipped, 0);
      if (totalPacked >= totalToPack && onComplete) {
        setTimeout(onComplete, 1500);
      }
    } catch (error) {
      if (audioEnabled) playBeep(false);
      setMessage({ type: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromCarton = (productId: string) => {
    setCartonContents(prev =>
      prev.map(c =>
        c.productId === productId
          ? { ...c, qty: c.qty - 1 }
          : c
      ).filter(c => c.qty > 0)
    );
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
            <Box className="w-5 h-5" />
            Pack Scanner
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {cartons.length} carton{cartons.length !== 1 ? "s" : ""}
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

        {/* Current Carton */}
        {currentCarton ? (
          <div className="mb-4 p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Box className="w-6 h-6 text-blue-600" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  {currentCarton.lpn_number}
                </span>
              </div>
              <span className="text-sm text-gray-500">
                {cartonContents.reduce((sum, c) => sum + c.qty, 0)} items
              </span>
            </div>

            {/* Carton Contents */}
            {cartonContents.length > 0 ? (
              <div className="space-y-2 mb-3">
                {cartonContents.map(content => (
                  <div
                    key={content.productId}
                    className="flex items-center justify-between py-2 px-3 bg-white dark:bg-gray-800 rounded"
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{content.sku}</span>
                      <span className="text-gray-500 ml-2">x{content.qty}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFromCarton(content.productId)}
                    >
                      -1
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 mb-3">Scan items to add to carton</p>
            )}

            {/* Scanner */}
            {scannerActive ? (
              <div className="mb-3">
                <BarcodeScanner
                  onScan={handleScan}
                  onClose={() => setScannerActive(false)}
                />
              </div>
            ) : (
              <Button
                onClick={() => setScannerActive(true)}
                className="w-full mb-3"
              >
                <ScanLine className="w-4 h-4 mr-2" />
                Scan Item to Add
              </Button>
            )}

            <Button
              onClick={handleCloseCarton}
              disabled={saving || cartonContents.length === 0}
              variant="outline"
              className="w-full"
            >
              Close & Stage Carton
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleCreateCarton}
            disabled={saving}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Carton
          </Button>
        )}
      </Card>

      {/* Order Items Summary */}
      <Card>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Items to Pack</h4>
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.product.sku}</p>
                  <p className="text-sm text-gray-500">{item.product.name}</p>
                </div>
              </div>
              <span className="font-medium text-gray-600 dark:text-gray-400">
                {item.qty_shipped} units
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Completed Cartons */}
      {cartons.filter(c => c.id !== currentCarton?.id).length > 0 && (
        <Card>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Completed Cartons</h4>
          <div className="space-y-2">
            {cartons.filter(c => c.id !== currentCarton?.id).map(carton => (
              <div
                key={carton.id}
                className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {carton.lpn_number}
                  </span>
                </div>
                <span className="text-sm text-gray-500 capitalize">{carton.stage}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
