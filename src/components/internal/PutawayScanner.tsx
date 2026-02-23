"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, ScanLine, AlertTriangle, CheckCircle, MapPin, Box, Volume2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { createClient } from "@/lib/supabase";
import { logScanEvent, resolveBarcode } from "@/lib/api/scan-events";
import { updateInventoryWithTransaction } from "@/lib/api/inventory-transactions";
import { moveLPN, getLPNByNumber, updateLPNStatus } from "@/lib/api/lpns";
import { getWarehouseTask, completePutawayTask, getWarehouseTasks, WarehouseTaskWithRelations } from "@/lib/api/warehouse-tasks";

interface PutawayScannerProps {
  locationId?: string;
  taskId?: string;
  onComplete?: () => void;
}

type ScanMode = "product_or_lpn" | "location";
type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "success" | "error";

interface ScannedProduct {
  id: string;
  name: string;
  sku: string;
  qty?: number;
}

interface ScannedLPN {
  id: string;
  lpn_number: string;
  container_type: string;
  contents: Array<{
    product: { name: string; sku: string };
    qty: number;
  }>;
}

interface ScannedLocation {
  id: string;
  name: string;
  code: string;
}

interface ScannedSublocation {
  id: string;
  code: string;
  name: string | null;
  location_id: string;
}

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

export default function PutawayScanner({
  locationId: defaultLocationId,
  taskId,
  onComplete,
}: PutawayScannerProps) {
  const [scanMode, setScanMode] = useState<ScanMode>("product_or_lpn");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scannerActive, setScannerActive] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Task-driven mode
  const [currentTask, setCurrentTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [taskLoading, setTaskLoading] = useState(!!taskId);

  // Scanned items
  const [scannedProduct, setScannedProduct] = useState<ScannedProduct | null>(null);
  const [scannedLPN, setScannedLPN] = useState<ScannedLPN | null>(null);
  const [scannedLocation, setScannedLocation] = useState<ScannedLocation | null>(null);
  const [scannedSublocation, setScannedSublocation] = useState<ScannedSublocation | null>(null);

  // Quantity input for products
  const [qty, setQty] = useState(1);

  // Load task data when in task-driven mode
  useEffect(() => {
    if (taskId) {
      loadTask(taskId);
    }
  }, [taskId]);

  async function loadTask(id: string) {
    setTaskLoading(true);
    try {
      const task = await getWarehouseTask(id);
      if (task) {
        setCurrentTask(task);
        // Pre-populate product info from task
        if (task.product) {
          setScannedProduct({
            id: task.product.id,
            name: task.product.name,
            sku: task.product.sku,
            qty: task.qty_requested,
          });
          setQty(task.qty_requested);
          setScanMode("location"); // Skip product scan, go straight to location
          setScanStatus("found");
          setMessage({ type: "success", text: "Task loaded. Scan destination location." });
        }
      }
    } catch (err) {
      console.error("Failed to load task:", err);
    } finally {
      setTaskLoading(false);
    }
  }

  async function handleNextTask() {
    // Find next pending putaway task
    try {
      const tasks = await getWarehouseTasks({
        taskType: "putaway",
        status: "pending",
      });
      if (tasks.length > 0) {
        resetScan();
        loadTask(tasks[0].id);
      } else {
        setMessage({ type: "success", text: "No more pending putaway tasks!" });
      }
    } catch {
      setMessage({ type: "error", text: "Failed to load next task" });
    }
  }

  // Recent putaways for display
  const [recentPutaways, setRecentPutaways] = useState<Array<{
    item: string;
    location: string;
    qty: number;
    time: Date;
  }>>([]);

  const resetScan = () => {
    setScanStatus("idle");
    setScannedProduct(null);
    setScannedLPN(null);
    setScannedLocation(null);
    setScannedSublocation(null);
    setScanMode("product_or_lpn");
    setQty(1);
    setMessage(null);
  };

  const handleScan = useCallback(async (code: string) => {
    setScannerActive(false);

    if (scanMode === "product_or_lpn") {
      // First scan - identify product or LPN
      const resolved = await resolveBarcode(code);

      if (!resolved) {
        if (audioEnabled) playBeep(false);
        setScanStatus("not_found");
        setMessage({ type: "error", text: `Barcode not found: ${code}` });
        return;
      }

      // Log the scan event
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      await logScanEvent({
        scanType: resolved.type,
        barcode: code,
        workflowStage: "putaway",
        productId: resolved.type === "product" ? resolved.id : undefined,
        lpnId: resolved.type === "lpn" ? resolved.id : undefined,
        scannedBy: user?.id,
      });

      if (audioEnabled) playBeep(true);

      if (resolved.type === "product") {
        setScannedProduct(resolved.data as unknown as ScannedProduct);
        setScannedLPN(null);
        setScanStatus("found");
        setScanMode("location");
        setMessage({ type: "success", text: "Product found. Now scan destination location." });
      } else if (resolved.type === "lpn") {
        // Fetch full LPN with contents
        const lpn = await getLPNByNumber(code);
        if (lpn) {
          setScannedLPN({
            id: lpn.id,
            lpn_number: lpn.lpn_number,
            container_type: lpn.container_type,
            contents: lpn.contents.map(c => ({
              product: { name: c.product.name, sku: c.product.sku },
              qty: c.qty,
            })),
          });
          setScannedProduct(null);
          setScanStatus("found");
          setScanMode("location");
          setMessage({ type: "success", text: "LPN found. Now scan destination location." });
        }
      }
    } else if (scanMode === "location") {
      // Second scan - identify location or sublocation
      const resolved = await resolveBarcode(code);

      if (!resolved) {
        if (audioEnabled) playBeep(false);
        setMessage({ type: "error", text: `Location not found: ${code}` });
        return;
      }

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (resolved.type === "location") {
        if (audioEnabled) playBeep(true);
        setScannedLocation(resolved.data as unknown as ScannedLocation);
        setScannedSublocation(null);

        await logScanEvent({
          scanType: "location",
          barcode: code,
          workflowStage: "putaway",
          locationId: resolved.id,
          scannedBy: user?.id,
        });

        setMessage({ type: "success", text: "Location scanned. Ready to confirm putaway." });
      } else if (resolved.type === "sublocation") {
        if (audioEnabled) playBeep(true);
        const sublocData = resolved.data as unknown as ScannedSublocation;
        setScannedSublocation(sublocData);

        // Fetch the parent location
        const { data: location } = await supabase
          .from("locations")
          .select("id, name, code")
          .eq("id", sublocData.location_id)
          .single();

        if (location) {
          setScannedLocation(location as ScannedLocation);
        }

        await logScanEvent({
          scanType: "sublocation",
          barcode: code,
          workflowStage: "putaway",
          sublocationId: resolved.id,
          locationId: sublocData.location_id,
          scannedBy: user?.id,
        });

        setMessage({ type: "success", text: "Sublocation scanned. Ready to confirm putaway." });
      } else {
        if (audioEnabled) playBeep(false);
        setMessage({ type: "error", text: "Please scan a location or bin code." });
      }
    }
  }, [scanMode, audioEnabled]);

  const handleConfirmPutaway = async () => {
    if (!scannedLocation) {
      setMessage({ type: "error", text: "Please scan a destination location." });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (scannedLPN) {
        // Move LPN to location
        await moveLPN(scannedLPN.id, scannedLocation.id, scannedSublocation?.id);
        await updateLPNStatus(scannedLPN.id, "active", "storage");

        // Update inventory for each item in the LPN
        for (const content of scannedLPN.contents) {
          // This is tracked at LPN level, no individual inventory update needed
        }

        setRecentPutaways(prev => [{
          item: `LPN ${scannedLPN.lpn_number}`,
          location: scannedSublocation?.code || scannedLocation.name,
          qty: scannedLPN.contents.reduce((sum, c) => sum + c.qty, 0),
          time: new Date(),
        }, ...prev.slice(0, 9)]);

        if (audioEnabled) playBeep(true);
        setMessage({ type: "success", text: `LPN ${scannedLPN.lpn_number} put away successfully!` });
      } else if (scannedProduct) {
        // Update inventory with transaction logging
        await updateInventoryWithTransaction({
          productId: scannedProduct.id,
          locationId: scannedLocation.id,
          sublocationId: scannedSublocation?.id,
          qtyChange: qty,
          transactionType: "putaway",
          performedBy: user?.id,
        });

        setRecentPutaways(prev => [{
          item: scannedProduct.sku,
          location: scannedSublocation?.code || scannedLocation.name,
          qty,
          time: new Date(),
        }, ...prev.slice(0, 9)]);

        if (audioEnabled) playBeep(true);
        setMessage({ type: "success", text: `${qty}x ${scannedProduct.sku} put away successfully!` });
      }

      // If in task mode, complete the task
      if (currentTask && scannedSublocation) {
        try {
          await completePutawayTask(currentTask.id, scannedSublocation.id);
        } catch (err) {
          console.error("Failed to complete putaway task:", err);
        }
      }

      // Reset for next scan
      setTimeout(() => {
        if (currentTask) {
          // In task mode, don't auto-reset — show "Next Task" button
          setCurrentTask(null);
        } else {
          resetScan();
        }
      }, 1500);
    } catch (error) {
      if (audioEnabled) playBeep(false);
      setMessage({ type: "error", text: (error as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (taskLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Task Info Banner */}
      {currentTask && (
        <Card>
          <div className="flex items-center gap-3 p-1">
            <div className="p-2 rounded-lg bg-blue-50">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-900">Task: {currentTask.task_number}</p>
              <p className="text-xs text-slate-500">
                {currentTask.product?.name} — {currentTask.qty_requested} units
                {currentTask.destination_sublocation && (
                  <span className="ml-1 text-indigo-600">
                    (Suggested: {currentTask.destination_sublocation.code})
                  </span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Scanner Controls */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            Putaway Scanner
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setAudioEnabled(!audioEnabled)}
          >
            <Volume2 className={`w-4 h-4 ${audioEnabled ? "text-blue-600" : "text-gray-400"}`} />
          </Button>
        </div>

        {/* Status Display */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
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

        {/* Scan Instructions */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {scanMode === "product_or_lpn"
              ? "Step 1: Scan a product barcode or LPN label"
              : "Step 2: Scan destination location or bin"}
          </p>
        </div>

        {/* Scanner */}
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
            {scanMode === "product_or_lpn" ? "Scan Product/LPN" : "Scan Location"}
          </Button>
        )}

        {/* Scanned Item Display */}
        {scannedProduct && (
          <div className="mb-4 p-4 border rounded-lg dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Package className="w-8 h-8 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{scannedProduct.name}</p>
                <p className="text-sm text-gray-500">{scannedProduct.sku}</p>
              </div>
            </div>
            <div className="mt-3">
              <label className="text-sm text-gray-600 dark:text-gray-400">Quantity</label>
              <div className="flex items-center gap-2 mt-1">
                <Button size="sm" variant="outline" onClick={() => setQty(Math.max(1, qty - 1))}>-</Button>
                <span className="w-12 text-center font-medium">{qty}</span>
                <Button size="sm" variant="outline" onClick={() => setQty(qty + 1)}>+</Button>
              </div>
            </div>
          </div>
        )}

        {scannedLPN && (
          <div className="mb-4 p-4 border rounded-lg dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Box className="w-8 h-8 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{scannedLPN.lpn_number}</p>
                <p className="text-sm text-gray-500 capitalize">{scannedLPN.container_type}</p>
              </div>
            </div>
            {scannedLPN.contents.length > 0 && (
              <div className="mt-3 text-sm">
                <p className="text-gray-600 dark:text-gray-400 mb-1">Contents:</p>
                {scannedLPN.contents.slice(0, 3).map((c, i) => (
                  <p key={i} className="text-gray-700 dark:text-gray-300">
                    {c.qty}x {c.product.sku}
                  </p>
                ))}
                {scannedLPN.contents.length > 3 && (
                  <p className="text-gray-500">+{scannedLPN.contents.length - 3} more items</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Scanned Location Display */}
        {scannedLocation && (
          <div className="mb-4 p-4 border rounded-lg dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center gap-3">
              <MapPin className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{scannedLocation.name}</p>
                {scannedSublocation && (
                  <p className="text-sm text-green-600">Bin: {scannedSublocation.code}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Confirm Button */}
        {(scannedProduct || scannedLPN) && scannedLocation && (
          <Button
            onClick={handleConfirmPutaway}
            disabled={saving}
            className="w-full"
          >
            {saving ? "Saving..." : "Confirm Putaway"}
          </Button>
        )}

        {/* Reset Button */}
        {(scannedProduct || scannedLPN || scannedLocation) && (
          <Button
            variant="outline"
            onClick={resetScan}
            className="w-full mt-2"
          >
            Reset
          </Button>
        )}
      </Card>

      {/* Next Task Button (task-driven mode) */}
      {taskId && !currentTask && message?.type === "success" && (
        <div className="flex gap-2">
          <Button onClick={handleNextTask} className="flex-1">
            Next Putaway Task
          </Button>
          {onComplete && (
            <Button variant="secondary" onClick={onComplete}>
              Done
            </Button>
          )}
        </div>
      )}

      {/* Recent Putaways */}
      {recentPutaways.length > 0 && (
        <Card>
          <h4 className="font-medium text-gray-900 dark:text-white mb-3">Recent Putaways</h4>
          <div className="space-y-2">
            {recentPutaways.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-2 border-b dark:border-gray-700 last:border-0">
                <span className="text-gray-700 dark:text-gray-300">{p.item}</span>
                <span className="text-gray-500">{p.qty}x to {p.location}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
