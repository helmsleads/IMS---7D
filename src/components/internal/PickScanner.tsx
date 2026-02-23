"use client";

import { useEffect, useState, useCallback } from "react";
import { Package, ScanLine, AlertTriangle, CheckCircle, ShoppingCart, Volume2, MapPin } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import BarcodeScanner from "@/components/ui/BarcodeScanner";
import { createClient } from "@/lib/supabase";
import { logScanEvent, resolveBarcode } from "@/lib/api/scan-events";
import { updateInventoryWithTransaction } from "@/lib/api/inventory-transactions";
import { getPickListItems, recordPickItem, recordShortPick, PickListItemWithRelations } from "@/lib/api/warehouse-tasks";

interface PickItem {
  id: string;
  product_id: string;
  qty_requested: number;
  qty_picked: number;
  product: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
  };
  suggested_location?: {
    id: string;
    name: string;
    sublocation_code?: string;
  };
  // Pick list item reference (when task-driven)
  pickListItemId?: string;
  lot_number?: string;
}

interface PickScannerProps {
  outboundOrderId: string;
  locationId: string;
  taskId?: string;
  onComplete?: () => void;
}

type ScanStatus = "idle" | "scanning" | "found" | "not_found" | "wrong_item" | "success";

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

export default function PickScanner({
  outboundOrderId,
  locationId,
  taskId,
  onComplete,
}: PickScannerProps) {
  const [items, setItems] = useState<PickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [pendingQty, setPendingQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "warning"; text: string } | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);

  const fetchItems = useCallback(async () => {
    // If task-driven, load from pick_list_items instead
    if (taskId) {
      try {
        const pickListItems = await getPickListItems(taskId);
        const mapped: PickItem[] = pickListItems
          .filter((pli) => pli.status !== "picked" && pli.status !== "skipped")
          .map((pli) => ({
            id: pli.outbound_item_id || pli.id,
            product_id: pli.product_id || "",
            qty_requested: pli.qty_allocated,
            qty_picked: pli.qty_picked,
            product: {
              id: pli.product?.id || "",
              name: pli.product?.name || "Unknown",
              sku: pli.product?.sku || "",
              barcode: pli.product?.barcode || null,
            },
            suggested_location: pli.sublocation ? {
              id: pli.location?.id || "",
              name: pli.location?.name || "",
              sublocation_code: pli.sublocation.code,
            } : pli.location ? {
              id: pli.location.id,
              name: pli.location.name,
            } : undefined,
            pickListItemId: pli.id,
            lot_number: pli.lot?.lot_number,
          }));
        setItems(mapped);
        setLoading(false);
        return;
      } catch (err) {
        console.error("Failed to load pick list items:", err);
      }
    }

    const supabase = createClient();

    // Get order items with suggested pick locations
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

    // Transform and add suggested locations
    const itemsWithLocations: PickItem[] = [];

    for (const item of data || []) {
      // Get suggested pick location (inventory with available qty)
      const { data: inventory } = await supabase
        .from("inventory")
        .select(`
          qty_on_hand,
          qty_reserved,
          location:locations (id, name),
          sublocation:sublocations (code)
        `)
        .eq("product_id", item.product_id)
        .eq("location_id", locationId)
        .eq("stage", "available")
        .gt("qty_on_hand", 0)
        .order("created_at")
        .limit(1)
        .single();

      itemsWithLocations.push({
        id: item.id,
        product_id: item.product_id,
        qty_requested: item.qty_requested,
        qty_picked: item.qty_shipped || 0,
        product: item.product as PickItem["product"],
        suggested_location: inventory ? {
          id: (inventory.location as { id: string })?.id,
          name: (inventory.location as { name: string })?.name,
          sublocation_code: (inventory.sublocation as { code: string })?.code,
        } : undefined,
      });
    }

    setItems(itemsWithLocations);
    setLoading(false);
  }, [outboundOrderId, locationId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const currentItem = items[currentItemIndex];
  const remainingQty = currentItem ? currentItem.qty_requested - currentItem.qty_picked : 0;
  const allItemsPicked = items.every(item => item.qty_picked >= item.qty_requested);

  const handleScan = useCallback(async (code: string) => {
    setScannedCode(code);
    setScannerActive(false);
    setMessage(null);

    const resolved = await resolveBarcode(code);

    if (!resolved || resolved.type !== "product") {
      if (audioEnabled) playBeep(false);
      setScanStatus("not_found");
      setMessage({ type: "error", text: `Product not found: ${code}` });
      return;
    }

    // Log the scan event
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    await logScanEvent({
      scanType: "product",
      barcode: code,
      workflowStage: "picking",
      productId: resolved.id,
      referenceType: "outbound_order",
      referenceId: outboundOrderId,
      scannedBy: user?.id,
    });

    // Check if this is the current item to pick
    if (currentItem && resolved.id === currentItem.product_id) {
      if (audioEnabled) playBeep(true);
      setScanStatus("found");
      setPendingQty(1);
      setMessage({ type: "success", text: "Correct item! Add quantity to pick." });
    } else {
      // Check if it's in the pick list at all
      const matchedIndex = items.findIndex(item => item.product_id === resolved.id);
      if (matchedIndex >= 0) {
        if (audioEnabled) playBeep(true);
        // Allow picking out of order
        setCurrentItemIndex(matchedIndex);
        setScanStatus("found");
        setPendingQty(1);
        setMessage({ type: "warning", text: "Item found (out of sequence). Add quantity to pick." });
      } else {
        if (audioEnabled) playBeep(false);
        setScanStatus("wrong_item");
        setMessage({ type: "error", text: "This item is not in the pick list for this order." });
      }
    }
  }, [currentItem, items, audioEnabled, outboundOrderId]);

  const handleAddQty = (qty: number) => {
    if (!currentItem) return;
    const maxQty = currentItem.qty_requested - currentItem.qty_picked;
    const newQty = Math.min(pendingQty + qty, maxQty);
    setPendingQty(newQty);
  };

  const handlePickAll = () => {
    if (!currentItem) return;
    setPendingQty(remainingQty);
  };

  const handleShortPick = async () => {
    if (!currentItem) return;
    const shortQty = currentItem.qty_requested - currentItem.qty_picked;
    if (shortQty <= 0) return;

    setSaving(true);
    try {
      if (currentItem.pickListItemId) {
        await recordShortPick(currentItem.pickListItemId, shortQty, "Short pick reported by scanner");
      }

      if (audioEnabled) playBeep(true);
      setMessage({ type: "warning", text: `Short pick: ${shortQty} units of ${currentItem.product.sku}` });

      // Move to next item
      const nextIncomplete = items.findIndex((item, idx) =>
        idx > currentItemIndex && item.qty_picked < item.qty_requested
      );
      if (nextIncomplete >= 0) {
        setTimeout(() => {
          setCurrentItemIndex(nextIncomplete);
          setPendingQty(0);
          setScanStatus("idle");
        }, 1000);
      }
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmPick = async () => {
    if (!currentItem || pendingQty <= 0) return;

    setSaving(true);
    setMessage(null);

    try {
      const newQtyPicked = currentItem.qty_picked + pendingQty;

      // If task-driven, use recordPickItem which handles everything
      if (currentItem.pickListItemId) {
        await recordPickItem(currentItem.pickListItemId, pendingQty);
      } else {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        // Update inventory with transaction logging (pick = deduct)
        await updateInventoryWithTransaction({
          productId: currentItem.product_id,
          locationId,
          qtyChange: -pendingQty,
          transactionType: "pick",
          referenceType: "outbound_order",
          referenceId: outboundOrderId,
          performedBy: user?.id,
        });

        // Update the outbound item qty_shipped
        const { error: updateError } = await supabase
          .from("outbound_items")
          .update({ qty_shipped: newQtyPicked })
          .eq("id", currentItem.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }

      // Update local state
      setItems(prev => prev.map((item, idx) =>
        idx === currentItemIndex
          ? { ...item, qty_picked: newQtyPicked }
          : item
      ));

      if (audioEnabled) playBeep(true);
      setMessage({ type: "success", text: `Picked ${pendingQty}x ${currentItem.product.sku}` });

      // Move to next item if current is complete
      if (newQtyPicked >= currentItem.qty_requested) {
        const nextIncomplete = items.findIndex((item, idx) =>
          idx > currentItemIndex && item.qty_picked < item.qty_requested
        );
        if (nextIncomplete >= 0) {
          setTimeout(() => {
            setCurrentItemIndex(nextIncomplete);
            setPendingQty(0);
            setScanStatus("idle");
            setMessage(null);
          }, 1000);
        } else {
          // Check if all items are complete
          const allComplete = items.every((item, idx) =>
            idx === currentItemIndex
              ? newQtyPicked >= item.qty_requested
              : item.qty_picked >= item.qty_requested
          );
          if (allComplete && onComplete) {
            setTimeout(onComplete, 1500);
          }
        }
      } else {
        setPendingQty(0);
        setScanStatus("idle");
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
      {/* Progress Header */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Pick Scanner
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              {items.filter(i => i.qty_picked >= i.qty_requested).length} / {items.length} items
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

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-4">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{
              width: `${(items.filter(i => i.qty_picked >= i.qty_requested).length / items.length) * 100}%`,
            }}
          />
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

        {allItemsPicked ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-900 dark:text-white">All Items Picked!</p>
            <p className="text-gray-500 mt-2">Ready for packing</p>
          </div>
        ) : currentItem ? (
          <>
            {/* Current Item to Pick */}
            <div className="mb-4 p-4 border-2 border-blue-500 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-10 h-10 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{currentItem.product.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{currentItem.product.sku}</p>
                    {currentItem.lot_number && (
                      <p className="text-xs text-slate-500 mt-0.5">Lot: {currentItem.lot_number}</p>
                    )}
                    {currentItem.suggested_location && (
                      <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" />
                        {currentItem.suggested_location.name}
                        {currentItem.suggested_location.sublocation_code && (
                          <span> / {currentItem.suggested_location.sublocation_code}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {currentItem.qty_picked} / {currentItem.qty_requested}
                  </p>
                  <p className="text-sm text-gray-500">picked</p>
                </div>
              </div>
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
                Scan Item
              </Button>
            )}

            {/* Quantity Controls (shown after successful scan) */}
            {scanStatus === "found" && (
              <div className="mb-4 p-4 border rounded-lg dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Quantity to pick:</p>
                <div className="flex items-center gap-2 mb-3">
                  <Button size="sm" variant="outline" onClick={() => setPendingQty(Math.max(0, pendingQty - 1))}>-</Button>
                  <span className="w-16 text-center text-xl font-bold">{pendingQty}</span>
                  <Button size="sm" variant="outline" onClick={() => handleAddQty(1)}>+</Button>
                  <Button size="sm" variant="outline" onClick={handlePickAll}>Pick All ({remainingQty})</Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleConfirmPick}
                    disabled={saving || pendingQty <= 0}
                    className="flex-1"
                  >
                    {saving ? "Saving..." : `Confirm Pick (${pendingQty})`}
                  </Button>
                  {currentItem.pickListItemId && (
                    <Button
                      variant="secondary"
                      onClick={handleShortPick}
                      disabled={saving}
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      Short
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </Card>

      {/* Pick List */}
      <Card>
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Pick List</h4>
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                idx === currentItemIndex
                  ? "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800"
                  : item.qty_picked >= item.qty_requested
                  ? "bg-green-50 dark:bg-green-900/20"
                  : "bg-gray-50 dark:bg-gray-800"
              }`}
              onClick={() => {
                if (item.qty_picked < item.qty_requested) {
                  setCurrentItemIndex(idx);
                  setPendingQty(0);
                  setScanStatus("idle");
                }
              }}
            >
              <div className="flex items-center gap-3">
                {item.qty_picked >= item.qty_requested ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Package className="w-5 h-5 text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.product.sku}</p>
                  <p className="text-sm text-gray-500">{item.product.name}</p>
                </div>
              </div>
              <span className={`font-medium ${
                item.qty_picked >= item.qty_requested
                  ? "text-green-600"
                  : "text-gray-600 dark:text-gray-400"
              }`}>
                {item.qty_picked} / {item.qty_requested}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
