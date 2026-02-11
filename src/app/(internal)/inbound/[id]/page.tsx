"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle2,
  PackageCheck,
  ScanLine,
  XCircle,
  Plus,
  Trash2,
  Layers,
  AlertTriangle,
  MapPin,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import {
  getInboundOrder,
  updateInboundOrderStatus,
  receiveInboundItem,
  rejectInboundItem,
  receiveWithLot,
  receiveInboundItemToPallet,
  createPalletForReceiving,
  getInboundWorkflowRulesForOrder,
  generateLotNumber,
  placeOnInspectionHold,
  InboundOrderWithItems,
  InboundItemWithProduct,
  InboundWorkflowRules,
  RejectionReason,
} from "@/lib/api/inbound";
import { getLocations, Location } from "@/lib/api/locations";
import {
  getDamageReports,
  createDamageReport,
  DamageReportWithProduct,
} from "@/lib/api/damage-reports";
import {
  getSuggestedPutAway,
  confirmPutAway,
  SuggestedPutAway,
} from "@/lib/api/inventory";
import { getSublocations, SublocationWithLocation } from "@/lib/api/sublocations";
import { getPalletLPNs, LPNWithContents, LPN } from "@/lib/api/lpns";
import PalletContentsCard from "@/components/internal/PalletContentsCard";
import ReceivingScanner from "@/components/internal/ReceivingScanner";

const STATUS_STEPS = [
  { key: "ordered", label: "Ordered", icon: Package },
  { key: "in_transit", label: "In Transit", icon: Truck },
  { key: "arrived", label: "Arrived", icon: CheckCircle2 },
  { key: "received", label: "Received", icon: CheckCircle2 },
];

function getStatusIndex(status: string): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function getStatusColor(status: string): "default" | "warning" | "info" | "success" {
  switch (status) {
    case "ordered":
      return "warning";
    case "in_transit":
      return "info";
    case "arrived":
      return "info";
    case "received":
      return "success";
    default:
      return "default";
  }
}

function formatStatus(status: string): string {
  switch (status) {
    case "in_transit":
      return "In Transit";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InboundOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<InboundOrderWithItems | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");

  // Receiving state
  const [receivingItem, setReceivingItem] = useState<InboundItemWithProduct | null>(null);
  const [receiveQty, setReceiveQty] = useState(0);
  const [receiveLocationId, setReceiveLocationId] = useState("");
  const [receiving, setReceiving] = useState(false);
  const [showReceivingScanner, setShowReceivingScanner] = useState(false);

  // Pallet receive state
  const [receiveToPallet, setReceiveToPallet] = useState(false);
  const [selectedPalletId, setSelectedPalletId] = useState("");
  const [availablePallets, setAvailablePallets] = useState<LPNWithContents[]>([]);
  const [creatingPallet, setCreatingPallet] = useState(false);
  const [palletPreview, setPalletPreview] = useState<LPNWithContents | null>(null);

  // Lot entry state
  interface LotEntry {
    id: string;
    lotNumber: string;
    expirationDate: string;
    batchNumber: string;
    quantity: number;
  }
  const [lotEntries, setLotEntries] = useState<LotEntry[]>([]);

  // Rejection state
  const [rejectingItem, setRejectingItem] = useState<InboundItemWithProduct | null>(null);
  const [rejectQty, setRejectQty] = useState(1);
  const [rejectReason, setRejectReason] = useState<RejectionReason>("damaged");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // Damage report state
  const [damageReports, setDamageReports] = useState<DamageReportWithProduct[]>([]);
  const [reportingDamageItem, setReportingDamageItem] = useState<InboundItemWithProduct | null>(null);
  const [damageQty, setDamageQty] = useState(1);
  const [damageType, setDamageType] = useState("physical");
  const [damageDescription, setDamageDescription] = useState("");
  const [reportingDamage, setReportingDamage] = useState(false);

  // Put-away state
  interface PutAwayItem {
    itemId: string;
    productId: string;
    productName: string;
    productSku: string;
    qtyReceived: number;
    locationId: string;
    suggestion: SuggestedPutAway | null;
    selectedSublocationId: string;
    confirmed: boolean;
  }
  const [putAwayItems, setPutAwayItems] = useState<PutAwayItem[]>([]);
  const [sublocations, setSublocations] = useState<SublocationWithLocation[]>([]);
  const [confirmingPutAway, setConfirmingPutAway] = useState<string | null>(null);
  const [showPutAwaySection, setShowPutAwaySection] = useState(false);

  // Workflow rules state
  const [workflowRules, setWorkflowRules] = useState<InboundWorkflowRules | null>(null);
  const [inspectionAcknowledged, setInspectionAcknowledged] = useState(false);

  const fetchOrder = async () => {
    try {
      const [orderData, locationsData, damageData] = await Promise.all([
        getInboundOrder(orderId),
        getLocations(),
        getDamageReports({ referenceType: "inbound_order", referenceId: orderId }),
      ]);
      if (!orderData) {
        setError("Order not found");
      } else {
        setOrder(orderData);
        setLocations(locationsData.filter((l) => l.active));
        setDamageReports(damageData);
        // Set default location if only one
        if (locationsData.filter((l) => l.active).length === 1) {
          setReceiveLocationId(locationsData.filter((l) => l.active)[0].id);
        }

        // Fetch workflow rules if client is set
        if (orderData.client?.id) {
          try {
            const rules = await getInboundWorkflowRulesForOrder(orderId);
            setWorkflowRules(rules);
          } catch (err) {
            console.error("Failed to fetch workflow rules:", err);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch order:", err);
      setError("Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Load available pallets when receive-to-pallet is toggled on
  const loadPallets = async () => {
    try {
      const pallets = await getPalletLPNs();
      setAvailablePallets(pallets);
    } catch (err) {
      console.error("Failed to load pallets:", err);
    }
  };

  const handleCreatePallet = async () => {
    if (!receiveLocationId) return;
    setCreatingPallet(true);
    try {
      const newPallet = await createPalletForReceiving({
        locationId: receiveLocationId,
        inboundOrderId: orderId,
        notes: `Created for inbound ${order?.po_number || orderId}`,
      });
      setSelectedPalletId(newPallet.id);
      await loadPallets();
    } catch (err) {
      console.error("Failed to create pallet:", err);
    } finally {
      setCreatingPallet(false);
    }
  };

  // Update pallet preview when selected pallet changes
  useEffect(() => {
    if (selectedPalletId) {
      const found = availablePallets.find((p) => p.id === selectedPalletId);
      setPalletPreview(found || null);
    } else {
      setPalletPreview(null);
    }
  }, [selectedPalletId, availablePallets]);

  // Get damage reports for a specific product
  const getProductDamageReports = (productId: string) => {
    return damageReports.filter((r) => r.product_id === productId);
  };

  // Get total damaged quantity for a product
  const getProductDamagedQty = (productId: string) => {
    return getProductDamageReports(productId).reduce((sum, r) => sum + r.quantity, 0);
  };

  // Initialize put-away items for received products
  const initializePutAway = async (locationId: string) => {
    if (!order) return;

    // Get sublocations for the location
    const subs = await getSublocations(locationId);
    setSublocations(subs);

    // Create put-away items for received items
    const items: PutAwayItem[] = [];

    for (const item of order.items) {
      if (item.qty_received > 0 && item.product) {
        // Get suggestion for this product
        const suggestion = await getSuggestedPutAway(
          item.product_id,
          locationId,
          item.qty_received
        );

        items.push({
          itemId: item.id,
          productId: item.product_id,
          productName: item.product.name,
          productSku: item.product.sku,
          qtyReceived: item.qty_received,
          locationId,
          suggestion,
          selectedSublocationId: suggestion.suggestedSublocationId || "",
          confirmed: false,
        });
      }
    }

    setPutAwayItems(items);
    setShowPutAwaySection(items.length > 0);
  };

  // Update selected sublocation for a put-away item
  const updatePutAwaySelection = (itemId: string, sublocationId: string) => {
    setPutAwayItems((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, selectedSublocationId: sublocationId } : item
      )
    );
  };

  // Confirm put-away for a single item
  const handleConfirmPutAway = async (putAwayItem: PutAwayItem) => {
    if (!putAwayItem.selectedSublocationId) return;

    setConfirmingPutAway(putAwayItem.itemId);
    try {
      await confirmPutAway(
        putAwayItem.productId,
        putAwayItem.locationId,
        putAwayItem.selectedSublocationId
      );

      // Mark as confirmed
      setPutAwayItems((prev) =>
        prev.map((item) =>
          item.itemId === putAwayItem.itemId ? { ...item, confirmed: true } : item
        )
      );
    } catch (err) {
      console.error("Failed to confirm put-away:", err);
    } finally {
      setConfirmingPutAway(null);
    }
  };

  // Confirm all put-away items
  const handleConfirmAllPutAway = async () => {
    const unconfirmed = putAwayItems.filter((item) => !item.confirmed && item.selectedSublocationId);

    for (const item of unconfirmed) {
      await handleConfirmPutAway(item);
    }
  };

  // Get sublocation options for a location
  const getSublocationOptions = () => {
    return sublocations.map((sub) => ({
      value: sub.id,
      label: `${sub.code}${sub.name ? ` - ${sub.name}` : ""}`,
    }));
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!order) return;
    setUpdating(true);
    try {
      await updateInboundOrderStatus(order.id, newStatus);
      await fetchOrder();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(false);
    }
  };

  // Check if lot tracking should be enabled (product-level or workflow rules)
  const isLotTrackingRequired = (item: InboundItemWithProduct) => {
    if (item.product?.lot_tracking_enabled) return true;
    if (workflowRules?.enabled && (workflowRules.requiresLotTracking || workflowRules.autoCreateLots)) return true;
    return false;
  };

  const openReceiveModal = async (item: InboundItemWithProduct) => {
    const remaining = item.qty_expected - item.qty_received;
    setReceivingItem(item);
    setReceiveQty(remaining > 0 ? remaining : 0);
    setInspectionAcknowledged(false);

    // Initialize lot entries for lot-tracked products or when workflow rules require it
    const needsLot = isLotTrackingRequired(item);
    if (needsLot) {
      // Auto-generate lot number if workflow rules have autoCreateLots enabled
      let autoLotNumber = "";
      if (workflowRules?.enabled && workflowRules.autoCreateLots) {
        try {
          autoLotNumber = await generateLotNumber({
            format: workflowRules.lotFormat,
            sku: item.product?.sku,
            supplier: order?.supplier || undefined,
          });
        } catch {
          // Fallback to empty - user can type manually
        }
      }

      setLotEntries([{
        id: crypto.randomUUID(),
        lotNumber: autoLotNumber,
        expirationDate: "",
        batchNumber: "",
        quantity: remaining > 0 ? remaining : 0,
      }]);
    } else {
      setLotEntries([]);
    }

    // Load pallets for receive-to-pallet option
    loadPallets();
  };

  const closeReceiveModal = () => {
    setReceivingItem(null);
    setReceiveQty(0);
    setLotEntries([]);
    setReceiveToPallet(false);
    setSelectedPalletId("");
    setPalletPreview(null);
  };

  const addLotEntry = () => {
    setLotEntries((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        lotNumber: "",
        expirationDate: "",
        batchNumber: "",
        quantity: 0,
      },
    ]);
  };

  const removeLotEntry = (id: string) => {
    setLotEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  const updateLotEntry = (id: string, field: keyof LotEntry, value: string | number) => {
    setLotEntries((prev) =>
      prev.map((entry) =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const getTotalLotQuantity = () => {
    return lotEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  };

  const openRejectModal = (item: InboundItemWithProduct) => {
    const remaining = item.qty_expected - item.qty_received - (item.qty_rejected || 0);
    setRejectingItem(item);
    setRejectQty(Math.min(1, remaining));
    setRejectReason("damaged");
    setRejectNotes("");
  };

  const closeRejectModal = () => {
    setRejectingItem(null);
    setRejectQty(1);
    setRejectReason("damaged");
    setRejectNotes("");
  };

  const handleRejectItem = async () => {
    if (!rejectingItem || rejectQty <= 0 || !order) return;

    setRejecting(true);
    try {
      await rejectInboundItem(rejectingItem.id, rejectQty, rejectReason, rejectNotes || undefined);
      await fetchOrder();
      closeRejectModal();
    } catch (err) {
      console.error("Failed to reject item:", err);
    } finally {
      setRejecting(false);
    }
  };

  // Damage report handlers
  const openDamageModal = (item: InboundItemWithProduct) => {
    const remaining = item.qty_expected - item.qty_received - (item.qty_rejected || 0);
    setReportingDamageItem(item);
    setDamageQty(Math.min(1, remaining));
    setDamageType("physical");
    setDamageDescription("");
  };

  const closeDamageModal = () => {
    setReportingDamageItem(null);
    setDamageQty(1);
    setDamageType("physical");
    setDamageDescription("");
  };

  const handleReportDamage = async () => {
    if (!reportingDamageItem || damageQty <= 0 || !order) return;

    setReportingDamage(true);
    try {
      await createDamageReport({
        reference_type: "inbound_order",
        reference_id: order.id,
        product_id: reportingDamageItem.product_id,
        quantity: damageQty,
        damage_type: damageType,
        description: damageDescription || null,
      });
      await fetchOrder();
      closeDamageModal();
    } catch (err) {
      console.error("Failed to report damage:", err);
    } finally {
      setReportingDamage(false);
    }
  };

  const checkAndUpdateOrderStatus = async (updatedOrder: InboundOrderWithItems, locationId?: string) => {
    // Check if all items are fully received
    const allItemsReceived = updatedOrder.items.every(
      (item) => item.qty_received >= item.qty_expected
    );

    // If all items received and order is still in "arrived" status, mark as "received"
    if (allItemsReceived && updatedOrder.status === "arrived") {
      await updateInboundOrderStatus(updatedOrder.id, "received");
      await fetchOrder();

      // Initialize put-away section
      if (locationId) {
        await initializePutAway(locationId);
      }
    }
  };

  const handleReceiveItem = async () => {
    if (!receivingItem || !receiveLocationId || !order) return;

    const isLotTracked = isLotTrackingRequired(receivingItem);

    // Validate against workflow rules
    if (workflowRules?.enabled) {
      if (workflowRules.requiresLotTracking && !isLotTracked && !receiveToPallet) {
        alert("Lot information is required by workflow rules for this client");
        return;
      }
      if (workflowRules.requiresExpirationDates && isLotTracked && !receiveToPallet) {
        const missingExpiration = lotEntries.some(
          (e) => e.quantity > 0 && !e.expirationDate
        );
        if (missingExpiration) {
          alert("Expiration date is required by workflow rules for this client");
          return;
        }
      }
    }

    // For lot-tracked items, validate lot entries
    if (isLotTracked && !receiveToPallet) {
      const totalLotQty = getTotalLotQuantity();
      if (totalLotQty <= 0) return;

      // Validate all lot entries have lot numbers
      const invalidEntries = lotEntries.filter(
        (entry) => entry.quantity > 0 && !entry.lotNumber.trim()
      );
      if (invalidEntries.length > 0) {
        alert("Please enter a lot number for all lot entries with quantity > 0");
        return;
      }
    } else if (!receiveToPallet && receiveQty <= 0) {
      return;
    }

    // Validate pallet selection if receive-to-pallet is enabled
    if (receiveToPallet && !selectedPalletId) {
      alert("Please select or create a pallet first");
      return;
    }

    setReceiving(true);
    try {
      if (receiveToPallet) {
        // Receive to pallet
        const newTotal = receivingItem.qty_received + receiveQty;
        await receiveInboundItemToPallet({
          itemId: receivingItem.id,
          qtyReceived: newTotal,
          locationId: receiveLocationId,
          palletId: selectedPalletId,
        });
      } else if (isLotTracked) {
        // Process each lot entry separately
        let totalReceived = receivingItem.qty_received;
        for (const entry of lotEntries) {
          if (entry.quantity > 0 && entry.lotNumber.trim()) {
            totalReceived += entry.quantity;
            await receiveWithLot(
              receivingItem.id,
              totalReceived,
              receiveLocationId,
              entry.lotNumber.trim(),
              entry.expirationDate || null
            );
          }
        }
      } else {
        // Non-lot-tracked: use regular receive
        const newTotal = receivingItem.qty_received + receiveQty;
        await receiveInboundItem(receivingItem.id, newTotal, receiveLocationId);
      }

      // Log inspection hold if required by workflow rules
      if (workflowRules?.enabled && workflowRules.requiresInspection) {
        await placeOnInspectionHold(receivingItem.id, orderId, "Quality inspection required per workflow rules");
      }

      // Refresh order data
      const updatedOrder = await getInboundOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);

        // Check if all items fully received and update order status
        await checkAndUpdateOrderStatus(updatedOrder, receiveLocationId);
      }

      // Refresh pallets if we added to one
      if (receiveToPallet) {
        await loadPallets();
      }

      closeReceiveModal();
    } catch (err) {
      console.error("Failed to receive item:", err);
    } finally {
      setReceiving(false);
    }
  };

  const handleReceiveAll = async (item: InboundItemWithProduct) => {
    // For lot-tracked products or workflow-required lots, always open modal
    if (isLotTrackingRequired(item)) {
      openReceiveModal(item);
      return;
    }

    if (!receiveLocationId || !order) {
      openReceiveModal(item);
      return;
    }

    setReceiving(true);
    try {
      // Receive full quantity (API also updates inventory)
      await receiveInboundItem(item.id, item.qty_expected, receiveLocationId);

      // Refresh order data
      const updatedOrder = await getInboundOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);

        // Check if all items fully received and update order status
        await checkAndUpdateOrderStatus(updatedOrder, receiveLocationId);
      }
    } catch (err) {
      console.error("Failed to receive item:", err);
    } finally {
      setReceiving(false);
    }
  };

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const backLink = (
    <Link
      href="/inbound"
      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Inbound
    </Link>
  );

  if (loading) {
    return (
      <AppShell title="Loading..." actions={backLink}>
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </AppShell>
    );
  }

  if (error || !order) {
    return (
      <AppShell title="Error" actions={backLink}>
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-500">{error || "Order not found"}</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => router.push("/inbound")}
            >
              Back to Inbound
            </Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  const currentStatusIndex = getStatusIndex(order.status);
  const totalExpected = order.items.reduce((sum, item) => sum + item.qty_expected, 0);
  const totalReceived = order.items.reduce((sum, item) => sum + item.qty_received, 0);

  return (
    <AppShell
      title={order.po_number}
      subtitle={`Inbound shipment from ${order.supplier || "Unknown"}`}
      actions={backLink}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Order Status
            </h2>
            <div className="relative">
              {/* Progress Line */}
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200">
                <div
                  className="h-full bg-blue-600 transition-all duration-500"
                  style={{
                    width: `${(currentStatusIndex / (STATUS_STEPS.length - 1)) * 100}%`,
                  }}
                />
              </div>

              {/* Status Steps */}
              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, index) => {
                  const isCompleted = index <= currentStatusIndex;
                  const isCurrent = index === currentStatusIndex;
                  const Icon = step.icon;

                  return (
                    <div key={step.key} className="flex flex-col items-center">
                      <div
                        className={`
                          w-10 h-10 rounded-full flex items-center justify-center z-10 transition-colors
                          ${isCompleted
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-400"
                          }
                          ${isCurrent ? "ring-4 ring-blue-100" : ""}
                        `}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={`
                          mt-2 text-sm font-medium
                          ${isCompleted ? "text-gray-900" : "text-gray-400"}
                        `}
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Status Action */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              {order.status === "ordered" && (
                <Button
                  onClick={() => handleStatusUpdate("in_transit")}
                  loading={updating}
                  disabled={updating}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Mark In Transit
                </Button>
              )}

              {order.status === "in_transit" && (
                <Button
                  onClick={() => handleStatusUpdate("arrived")}
                  loading={updating}
                  disabled={updating}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Mark Arrived
                </Button>
              )}

              {order.status === "arrived" && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowReceivingScanner(true)}
                  >
                    <ScanLine className="w-4 h-4 mr-2" />
                    Scan to Receive
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleStatusUpdate("received")}
                    loading={updating}
                    disabled={updating}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                </div>
              )}

              {order.status === "received" && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Order Complete</span>
                </div>
              )}
            </div>
          </Card>

          {/* Line Items */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Line Items
              </h2>
              {order.status === "arrived" && locations.length > 0 && (
                <Select
                  name="receive-location"
                  options={locationOptions}
                  value={receiveLocationId}
                  onChange={(e) => setReceiveLocationId(e.target.value)}
                  placeholder="Select location"
                />
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expected Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Received Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    {order.status === "arrived" && (
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {order.items.map((item) => {
                    const rejected = item.qty_rejected || 0;
                    const damagedQty = getProductDamagedQty(item.product_id);
                    const remaining = item.qty_expected - item.qty_received - rejected - damagedQty;
                    const isComplete = remaining <= 0;
                    const isPartial = item.qty_received > 0 && remaining > 0;
                    const isPending = item.qty_received === 0 && rejected === 0 && damagedQty === 0;
                    const hasRejections = rejected > 0;
                    const hasDamage = damagedQty > 0;

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900">
                                {item.product?.name || "Unknown Product"}
                              </p>
                              {isLotTrackingRequired(item) && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded"
                                  title={
                                    item.product?.lot_tracking_enabled
                                      ? "Lot tracking enabled (product)"
                                      : "Lot tracking required (workflow)"
                                  }
                                >
                                  <Layers className="w-3 h-3" />
                                </span>
                              )}
                              {workflowRules?.enabled && workflowRules.requiresInspection && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded"
                                  title="Inspection required (workflow)"
                                >
                                  <ShieldCheck className="w-3 h-3" />
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {item.product?.sku || "—"}
                            </p>
                            {hasRejections && (
                              <p className="text-xs text-red-600 mt-1" title={item.rejection_reason || ""}>
                                {rejected} rejected
                              </p>
                            )}
                            {hasDamage && (
                              <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {damagedQty} damaged
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-900">{item.qty_expected}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              isComplete
                                ? "text-green-600 font-medium"
                                : isPartial
                                ? "text-yellow-600 font-medium"
                                : "text-gray-400"
                            }
                          >
                            {item.qty_received}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              remaining > 0
                                ? "text-gray-900 font-medium"
                                : "text-gray-400"
                            }
                          >
                            {remaining > 0 ? remaining : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isComplete && !hasRejections && (
                            <Badge variant="success">Complete</Badge>
                          )}
                          {isComplete && hasRejections && (
                            <Badge variant="warning">Partial (Rejected)</Badge>
                          )}
                          {isPartial && (
                            <Badge variant="warning">Partial</Badge>
                          )}
                          {isPending && (
                            <Badge variant="default">Pending</Badge>
                          )}
                        </td>
                        {order.status === "arrived" && (
                          <td className="px-4 py-3 text-right">
                            {remaining > 0 && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openReceiveModal(item)}
                                >
                                  Receive
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleReceiveAll(item)}
                                  disabled={receiving || (!isLotTrackingRequired(item) && !receiveLocationId)}
                                  title={
                                    isLotTrackingRequired(item)
                                      ? "Enter lot information"
                                      : !receiveLocationId
                                        ? "Select a location first"
                                        : "Receive all remaining"
                                  }
                                >
                                  {isLotTrackingRequired(item) ? (
                                    <Layers className="w-4 h-4" />
                                  ) : (
                                    <PackageCheck className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openRejectModal(item)}
                                  title="Mark as rejected"
                                >
                                  <XCircle className="w-4 h-4 text-red-500" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDamageModal(item)}
                                  title="Report damage"
                                >
                                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                                </Button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      Total
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {totalExpected}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {totalReceived}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {totalExpected - totalReceived > 0 ? totalExpected - totalReceived : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-gray-500">
                        {Math.round((totalReceived / totalExpected) * 100) || 0}%
                      </span>
                    </td>
                    {order.status === "arrived" && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Put-Away Section - Shows after receiving is complete */}
          {showPutAwaySection && putAwayItems.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Put-Away
                  </h2>
                </div>
                {putAwayItems.some((item) => !item.confirmed && item.selectedSublocationId) && (
                  <Button
                    size="sm"
                    onClick={handleConfirmAllPutAway}
                    disabled={confirmingPutAway !== null}
                  >
                    Confirm All Put-Away
                  </Button>
                )}
              </div>

              <p className="text-sm text-gray-500 mb-4">
                Assign sublocations for received items to complete the put-away process.
              </p>

              <div className="space-y-4">
                {putAwayItems.map((item) => (
                  <div
                    key={item.itemId}
                    className={`border rounded-lg p-4 ${
                      item.confirmed
                        ? "bg-green-50 border-green-200"
                        : "bg-white border-gray-200"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.productName}</p>
                        <p className="text-sm text-gray-500">{item.productSku}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          Quantity: <strong>{item.qtyReceived}</strong>
                        </p>
                        {item.suggestion && item.suggestion.reason && (
                          <p className="text-xs text-blue-600 mt-1">
                            Suggestion: {item.suggestion.reason}
                          </p>
                        )}
                      </div>

                      {item.confirmed ? (
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="text-sm font-medium">Put Away Complete</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Select
                            name={`sublocation-${item.itemId}`}
                            options={getSublocationOptions()}
                            value={item.selectedSublocationId}
                            onChange={(e) => updatePutAwaySelection(item.itemId, e.target.value)}
                            placeholder="Select sublocation"
                          />
                          <Button
                            size="sm"
                            onClick={() => handleConfirmPutAway(item)}
                            disabled={!item.selectedSublocationId || confirmingPutAway === item.itemId}
                            loading={confirmingPutAway === item.itemId}
                          >
                            Confirm
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Put-Away Progress</span>
                  <span className="font-medium">
                    {putAwayItems.filter((item) => item.confirmed).length} / {putAwayItems.length} items
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${
                        (putAwayItems.filter((item) => item.confirmed).length / putAwayItems.length) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <div className="space-y-4">
              {/* Reference Number - Large */}
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Reference #</p>
                <p className="text-2xl font-bold text-gray-900">
                  {order.po_number}
                </p>
              </div>

              {/* Status */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <Badge variant={getStatusColor(order.status)}>
                  {formatStatus(order.status)}
                </Badge>
              </div>

              {/* Ship From */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Ship From</p>
                <p className="font-medium text-gray-900">
                  {order.supplier || "—"}
                </p>
              </div>

              {/* Client (if any) */}
              {order.client && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Client</p>
                  <p className="font-medium text-gray-900">
                    {order.client.company_name}
                  </p>
                </div>
              )}

              {/* Expected Date */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Expected Date</p>
                <p className="font-medium text-gray-900">
                  {formatDate(order.expected_date)}
                </p>
              </div>

              {/* Created Date */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Created</p>
                <p className="font-medium text-gray-900">
                  {formatDateTime(order.created_at)}
                </p>
              </div>

              {/* Received Date */}
              {order.received_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Received</p>
                  <p className="font-medium text-green-600">
                    {formatDateTime(order.received_date)}
                  </p>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <p className="text-gray-700">{order.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Workflow Rules */}
          {workflowRules?.enabled && (
            <Card>
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-5 h-5 text-purple-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Workflow Rules
                </h2>
              </div>
              <div className="space-y-2">
                {workflowRules.requiresInspection && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <ShieldCheck className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span className="text-sm text-amber-800">Inspection required</span>
                  </div>
                )}
                {workflowRules.requiresLotTracking && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                    <Layers className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span className="text-sm text-purple-800">Lot tracking required</span>
                  </div>
                )}
                {workflowRules.autoCreateLots && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <Layers className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span className="text-sm text-blue-800">
                      Auto-create lots{workflowRules.lotFormat ? ` (${workflowRules.lotFormat})` : ""}
                    </span>
                  </div>
                )}
                {workflowRules.requiresExpirationDates && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <span className="text-sm text-orange-800">Expiration dates required</span>
                  </div>
                )}
                {workflowRules.requiresPo && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
                    <Package className="w-4 h-4 text-gray-600 flex-shrink-0" />
                    <span className="text-sm text-gray-800">PO number required</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Summary */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Receiving Summary
            </h2>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">
                    {totalReceived.toLocaleString()} / {totalExpected.toLocaleString()} units
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      totalReceived >= totalExpected
                        ? "bg-green-600"
                        : "bg-blue-600"
                    }`}
                    style={{
                      width: `${Math.min((totalReceived / totalExpected) * 100, 100) || 0}%`,
                    }}
                  />
                </div>
                <p className="text-center text-sm font-medium mt-2">
                  {Math.round((totalReceived / totalExpected) * 100) || 0}% Complete
                </p>
              </div>

              {/* Stats */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Line Items</span>
                  <span className="font-medium text-gray-900">
                    {order.items.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Expected</span>
                  <span className="font-medium text-gray-900">
                    {totalExpected.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Received</span>
                  <span className={`font-medium ${
                    totalReceived >= totalExpected
                      ? "text-green-600"
                      : "text-gray-900"
                  }`}>
                    {totalReceived.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining</span>
                  <span className={`font-medium ${
                    totalExpected - totalReceived > 0
                      ? "text-orange-600"
                      : "text-gray-400"
                  }`}>
                    {totalExpected - totalReceived > 0
                      ? (totalExpected - totalReceived).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Complete Receiving Button */}
              {order.status === "arrived" && totalReceived >= totalExpected && (
                <div className="border-t border-gray-200 pt-4">
                  <Button
                    onClick={() => handleStatusUpdate("received")}
                    loading={updating}
                    disabled={updating}
                    className="w-full"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Complete Receiving
                  </Button>
                </div>
              )}

              {/* All Done Message */}
              {order.status === "received" && (
                <div className="border-t border-gray-200 pt-4 space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-lg py-3">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Receiving Complete</span>
                  </div>

                  {/* Start Put-Away Button */}
                  {!showPutAwaySection && locations.length > 0 && (
                    <div>
                      <Select
                        label="Select Location for Put-Away"
                        name="putaway-location"
                        options={locationOptions}
                        value={receiveLocationId}
                        onChange={(e) => setReceiveLocationId(e.target.value)}
                        placeholder="Select location"
                      />
                      <Button
                        onClick={() => initializePutAway(receiveLocationId)}
                        disabled={!receiveLocationId}
                        className="w-full mt-2"
                        variant="secondary"
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        Start Put-Away
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Receive Item Modal */}
      <Modal
        isOpen={!!receivingItem}
        onClose={closeReceiveModal}
        title="Receive Item"
        size={receivingItem && isLotTrackingRequired(receivingItem) ? "lg" : "sm"}
      >
        {receivingItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {receivingItem.product?.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {receivingItem.product?.sku}
                  </p>
                </div>
                {isLotTrackingRequired(receivingItem) && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded">
                    <Layers className="w-3 h-3" />
                    Lot Tracked
                  </span>
                )}
              </div>
              <div className="mt-2 flex gap-4 text-sm">
                <span>
                  Expected: <strong>{receivingItem.qty_expected}</strong>
                </span>
                <span>
                  Received: <strong>{receivingItem.qty_received}</strong>
                </span>
                <span>
                  Remaining:{" "}
                  <strong>
                    {receivingItem.qty_expected - receivingItem.qty_received}
                  </strong>
                </span>
              </div>
            </div>

            <Select
              label="Location"
              name="modal-location"
              options={locationOptions}
              value={receiveLocationId}
              onChange={(e) => setReceiveLocationId(e.target.value)}
              placeholder="Select location"
              required
            />

            {/* Receive to Pallet Toggle */}
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div>
                <p className="text-sm font-medium text-blue-900">Receive to Pallet</p>
                <p className="text-xs text-blue-600">Add items directly to a pallet LPN</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={receiveToPallet}
                onClick={() => {
                  setReceiveToPallet(!receiveToPallet);
                  if (!receiveToPallet) {
                    loadPallets();
                  } else {
                    setSelectedPalletId("");
                    setPalletPreview(null);
                  }
                }}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                  ${receiveToPallet ? "bg-blue-600" : "bg-gray-300"}
                `}
              >
                <span
                  className={`
                    inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                    ${receiveToPallet ? "translate-x-6" : "translate-x-1"}
                  `}
                />
              </button>
            </div>

            {/* Pallet Selector */}
            {receiveToPallet && (
              <div className="space-y-3 border border-blue-200 rounded-lg p-3 bg-blue-50/50">
                <div className="flex items-center gap-2">
                  <Select
                    label="Select Pallet"
                    name="pallet-select"
                    options={availablePallets.map((p) => ({
                      value: p.id,
                      label: `${p.lpn_number}${p.location ? ` @ ${p.location.name}` : ""} (${
                        p.contents?.reduce((sum, c) => sum + c.qty, 0) || 0
                      } items)`,
                    }))}
                    value={selectedPalletId}
                    onChange={(e) => setSelectedPalletId(e.target.value)}
                    placeholder="Select existing pallet"
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleCreatePallet}
                  loading={creatingPallet}
                  disabled={creatingPallet || !receiveLocationId}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Create New Pallet
                </Button>

                {/* Pallet Contents Preview */}
                {palletPreview && palletPreview.contents && palletPreview.contents.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">Current Contents:</p>
                    <div className="max-h-32 overflow-y-auto">
                      {palletPreview.contents.map((c) => (
                        <div key={c.id} className="flex justify-between text-xs py-0.5">
                          <span className="text-gray-700">{c.product?.name || "Unknown"}</span>
                          <span className="font-medium">{c.qty}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Workflow Rule Warnings */}
            {workflowRules?.enabled && workflowRules.requiresInspection && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">Inspection Required</p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Items will be placed on inspection hold after receiving per workflow rules.
                  </p>
                </div>
              </div>
            )}

            {workflowRules?.enabled && workflowRules.requiresExpirationDates && (
              <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-orange-800">
                  Expiration date is required for all lot entries.
                </p>
              </div>
            )}

            {/* Quantity / Lot Entry Section */}
            {receiveToPallet ? (
              <Input
                label="Quantity to Receive"
                name="receive-qty-pallet"
                type="number"
                min={1}
                max={receivingItem.qty_expected - receivingItem.qty_received}
                value={receiveQty}
                onChange={(e) => setReceiveQty(parseInt(e.target.value) || 0)}
                required
              />
            ) : isLotTrackingRequired(receivingItem) ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Lot Information
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addLotEntry}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Lot
                  </Button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {lotEntries.map((entry, index) => (
                    <div
                      key={entry.id}
                      className="border border-gray-200 rounded-lg p-3 bg-white"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-gray-700">
                          Lot #{index + 1}
                        </span>
                        {lotEntries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLotEntry(entry.id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="Remove lot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Lot Number <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={entry.lotNumber}
                            onChange={(e) =>
                              updateLotEntry(entry.id, "lotNumber", e.target.value)
                            }
                            placeholder="Enter or scan"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Expiration Date
                          </label>
                          <input
                            type="date"
                            value={entry.expirationDate}
                            onChange={(e) =>
                              updateLotEntry(entry.id, "expirationDate", e.target.value)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Batch Number
                          </label>
                          <input
                            type="text"
                            value={entry.batchNumber}
                            onChange={(e) =>
                              updateLotEntry(entry.id, "batchNumber", e.target.value)
                            }
                            placeholder="Optional"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={receivingItem.qty_expected - receivingItem.qty_received}
                            value={entry.quantity}
                            onChange={(e) =>
                              updateLotEntry(entry.id, "quantity", parseInt(e.target.value) || 0)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Lot totals summary */}
                <div className="bg-blue-50 rounded-lg p-3 flex items-center justify-between">
                  <span className="text-sm text-blue-700">
                    Total from {lotEntries.length} lot{lotEntries.length !== 1 ? "s" : ""}:
                  </span>
                  <span className="font-semibold text-blue-900">
                    {getTotalLotQuantity()} units
                  </span>
                </div>
              </div>
            ) : (
              <Input
                label="Quantity to Receive"
                name="receive-qty"
                type="number"
                min={1}
                max={receivingItem.qty_expected - receivingItem.qty_received}
                value={receiveQty}
                onChange={(e) => setReceiveQty(parseInt(e.target.value) || 0)}
                required
              />
            )}

            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={closeReceiveModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReceiveItem}
                loading={receiving}
                disabled={
                  receiving ||
                  !receiveLocationId ||
                  (receiveToPallet && !selectedPalletId) ||
                  (receiveToPallet
                    ? receiveQty <= 0
                    : isLotTrackingRequired(receivingItem)
                    ? getTotalLotQuantity() <= 0 ||
                      lotEntries.some((e) => e.quantity > 0 && !e.lotNumber.trim()) ||
                      (workflowRules?.enabled && workflowRules.requiresExpirationDates &&
                        lotEntries.some((e) => e.quantity > 0 && !e.expirationDate))
                    : receiveQty <= 0)
                }
                className="flex-1"
              >
                {receiveToPallet
                  ? `Receive ${receiveQty} to Pallet`
                  : isLotTrackingRequired(receivingItem)
                  ? `Receive ${getTotalLotQuantity()} Units`
                  : `Receive ${receiveQty} Units`}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receiving Scanner Modal */}
      <Modal
        isOpen={showReceivingScanner}
        onClose={() => setShowReceivingScanner(false)}
        title="Scan to Receive"
        size="lg"
      >
        <ReceivingScanner
          inboundOrderId={orderId}
          defaultLocationId={receiveLocationId}
          onComplete={() => {
            setShowReceivingScanner(false);
            fetchOrder();
          }}
        />
      </Modal>

      {/* Reject Item Modal */}
      <Modal
        isOpen={!!rejectingItem}
        onClose={closeRejectModal}
        title="Reject Item"
        size="sm"
      >
        {rejectingItem && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="font-medium text-gray-900">
                {rejectingItem.product?.name}
              </p>
              <p className="text-sm text-gray-500">
                {rejectingItem.product?.sku}
              </p>
              <div className="mt-2 flex gap-4 text-sm">
                <span>
                  Expected: <strong>{rejectingItem.qty_expected}</strong>
                </span>
                <span>
                  Received: <strong>{rejectingItem.qty_received}</strong>
                </span>
                <span>
                  Rejectable:{" "}
                  <strong>
                    {rejectingItem.qty_expected - rejectingItem.qty_received - (rejectingItem.qty_rejected || 0)}
                  </strong>
                </span>
              </div>
            </div>

            <Select
              label="Rejection Reason"
              name="reject-reason"
              options={[
                { value: "damaged", label: "Damaged" },
                { value: "wrong_item", label: "Wrong Item" },
                { value: "expired", label: "Expired" },
                { value: "quality_issue", label: "Quality Issue" },
                { value: "other", label: "Other" },
              ]}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value as RejectionReason)}
              required
            />

            <Input
              label="Quantity to Reject"
              name="reject-qty"
              type="number"
              min={1}
              max={rejectingItem.qty_expected - rejectingItem.qty_received - (rejectingItem.qty_rejected || 0)}
              value={rejectQty}
              onChange={(e) => setRejectQty(parseInt(e.target.value) || 0)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={rejectNotes}
                onChange={(e) => setRejectNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-red-500"
                placeholder="Describe the issue..."
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={closeRejectModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleRejectItem}
                loading={rejecting}
                disabled={rejecting || rejectQty <= 0}
                className="flex-1"
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reject {rejectQty} Units
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Damage Report Modal */}
      <Modal
        isOpen={!!reportingDamageItem}
        onClose={closeDamageModal}
        title="Report Damage"
        size="sm"
      >
        {reportingDamageItem && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <p className="font-medium text-gray-900">
                {reportingDamageItem.product?.name}
              </p>
              <p className="text-sm text-gray-500">
                {reportingDamageItem.product?.sku}
              </p>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>
                  Reference: <strong>Inbound Order</strong>
                </p>
                <p>
                  Order: <strong>{order?.po_number}</strong>
                </p>
              </div>
            </div>

            <Select
              label="Damage Type"
              name="damage-type"
              options={[
                { value: "physical", label: "Physical Damage" },
                { value: "water", label: "Water Damage" },
                { value: "crushed", label: "Crushed/Bent" },
                { value: "torn", label: "Torn Packaging" },
                { value: "missing_parts", label: "Missing Parts" },
                { value: "contamination", label: "Contamination" },
                { value: "other", label: "Other" },
              ]}
              value={damageType}
              onChange={(e) => setDamageType(e.target.value)}
              required
            />

            <Input
              label="Quantity Damaged"
              name="damage-qty"
              type="number"
              min={1}
              max={reportingDamageItem.qty_expected - reportingDamageItem.qty_received - (reportingDamageItem.qty_rejected || 0) - getProductDamagedQty(reportingDamageItem.product_id)}
              value={damageQty}
              onChange={(e) => setDamageQty(parseInt(e.target.value) || 0)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={damageDescription}
                onChange={(e) => setDamageDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="Describe the damage..."
              />
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={closeDamageModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleReportDamage}
                loading={reportingDamage}
                disabled={reportingDamage || damageQty <= 0}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                <AlertTriangle className="w-4 h-4 mr-1" />
                Report Damage
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
