"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  PackageCheck,
  MapPin,
  Flag,
  Printer,
  FileText,
  Pencil,
  XCircle,
  User,
  ScanLine,
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
import ShippingModal, { ShippingData } from "@/components/internal/ShippingModal";
import Alert from "@/components/ui/Alert";
import DropdownMenu from "@/components/ui/DropdownMenu";
import {
  getOutboundOrder,
  updateOutboundOrderStatus,
  shipOutboundItem,
  deleteOutboundOrder,
  OutboundOrderWithItems,
  OutboundItemWithProduct,
} from "@/lib/api/outbound";
import { createClient } from "@/lib/supabase";
import { getLocations, Location } from "@/lib/api/locations";
import { getInventory, InventoryWithDetails } from "@/lib/api/inventory";
import PickingScanner from "@/components/internal/PickingScanner";

const STATUS_STEPS = [
  { key: "pending", label: "Pending", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: ClipboardCheck },
  { key: "processing", label: "Processing", icon: Package },
  { key: "packed", label: "Packed", icon: PackageCheck },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function getStatusIndex(status: string): number {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

function getStatusColor(status: string): "default" | "warning" | "info" | "success" {
  switch (status) {
    case "pending":
      return "warning";
    case "confirmed":
      return "info";
    case "processing":
      return "info";
    case "packed":
      return "info";
    case "shipped":
      return "success";
    case "delivered":
      return "success";
    default:
      return "default";
  }
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
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

function isUrgent(notes: string | null): boolean {
  if (!notes) return false;
  const lowerNotes = notes.toLowerCase();
  return lowerNotes.includes("rush") || lowerNotes.includes("urgent");
}

export default function OutboundOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;

  const [order, setOrder] = useState<OutboundOrderWithItems | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState("");
  const [pickingQty, setPickingQty] = useState<Record<string, number | undefined>>({});

  // Ship modal state
  const [shippingItem, setShippingItem] = useState<OutboundItemWithProduct | null>(null);
  const [shipQty, setShipQty] = useState(0);
  const [shipLocationId, setShipLocationId] = useState("");
  const [shipping, setShipping] = useState(false);

  // Ship order modal state
  const [showShipModal, setShowShipModal] = useState(false);
  const [shipSuccess, setShipSuccess] = useState("");

  // Cancel confirmation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Picking scanner state
  const [showPickingScanner, setShowPickingScanner] = useState(false);

  const fetchOrder = async () => {
    try {
      const [orderData, locationsData, inventoryData] = await Promise.all([
        getOutboundOrder(orderId),
        getLocations(),
        getInventory(),
      ]);
      if (!orderData) {
        setError("Order not found");
      } else {
        setOrder(orderData);
        setLocations(locationsData.filter((l) => l.active));
        setInventory(inventoryData);
        // Set default location if only one
        if (locationsData.filter((l) => l.active).length === 1) {
          setShipLocationId(locationsData.filter((l) => l.active)[0].id);
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

  const handleStatusUpdate = async (newStatus: string, additionalFields?: { carrier?: string; tracking_number?: string }) => {
    if (!order) return;
    setUpdating(true);
    try {
      await updateOutboundOrderStatus(order.id, newStatus, additionalFields);
      await fetchOrder();
      setShowShipModal(false);
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdating(false);
    }
  };

  const openShipItemModal = (item: OutboundItemWithProduct) => {
    const remaining = item.qty_requested - item.qty_shipped;
    setShippingItem(item);
    setShipQty(remaining > 0 ? remaining : 0);
  };

  const closeShipItemModal = () => {
    setShippingItem(null);
    setShipQty(0);
  };

  const checkAndUpdateOrderStatus = async (updatedOrder: OutboundOrderWithItems) => {
    // Check if all items are fully shipped
    const allItemsShipped = updatedOrder.items.every(
      (item) => item.qty_shipped >= item.qty_requested
    );

    // If all items shipped and order is still in "packed" status, open ship modal
    if (allItemsShipped && updatedOrder.status === "packed") {
      setShowShipModal(true);
    }
  };

  const handleShipItem = async () => {
    if (!shippingItem || !shipLocationId || shipQty <= 0 || !order) return;

    setShipping(true);
    try {
      const newTotal = shippingItem.qty_shipped + shipQty;
      await shipOutboundItem(shippingItem.id, newTotal, shipLocationId);

      const updatedOrder = await getOutboundOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);
        await checkAndUpdateOrderStatus(updatedOrder);
      }

      closeShipItemModal();
    } catch (err) {
      console.error("Failed to ship item:", err);
    } finally {
      setShipping(false);
    }
  };

  const handleShipAll = async (item: OutboundItemWithProduct) => {
    if (!shipLocationId || !order) {
      openShipItemModal(item);
      return;
    }

    setShipping(true);
    try {
      await shipOutboundItem(item.id, item.qty_requested, shipLocationId);

      const updatedOrder = await getOutboundOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);
        await checkAndUpdateOrderStatus(updatedOrder);
      }
    } catch (err) {
      console.error("Failed to ship item:", err);
    } finally {
      setShipping(false);
    }
  };

  const handleShipOrder = async (shippingData: ShippingData) => {
    if (!order) return;

    const supabase = createClient();

    try {
      // 1. Update order status to "shipped" with carrier and tracking info
      await updateOutboundOrderStatus(order.id, "shipped", {
        carrier: shippingData.carrier,
        tracking_number: shippingData.trackingNumber,
      });

      // 2. Log activity with shipping details
      await supabase.from("activity_log").insert({
        entity_type: "outbound_order",
        entity_id: order.id,
        action: "shipped",
        details: {
          order_number: order.order_number,
          carrier: shippingData.carrier,
          tracking_number: shippingData.trackingNumber,
          ship_date: shippingData.shipDate,
          notes: shippingData.notes,
          items_shipped: order.items.map((item) => ({
            product_id: item.product_id,
            product_name: item.product?.name,
            qty_shipped: item.qty_shipped,
          })),
          client_id: order.client_id,
          client_name: order.client?.company_name,
        },
      });

      // 3. Trigger client notification (placeholder)
      // TODO: Implement actual notification system (email, webhook, etc.)
      console.log("📧 Client notification placeholder:", {
        client: order.client?.company_name,
        orderNumber: order.order_number,
        carrier: shippingData.carrier,
        trackingNumber: shippingData.trackingNumber,
      });

      // 4. Show success message
      setShipSuccess(
        `Order ${order.order_number} shipped via ${shippingData.carrier}. Tracking: ${shippingData.trackingNumber}`
      );

      // 5. Close modal and refresh page
      setShowShipModal(false);
      await fetchOrder();

      // Clear success message after 5 seconds
      setTimeout(() => setShipSuccess(""), 5000);
    } catch (err) {
      console.error("Failed to ship order:", err);
      throw err; // Re-throw so ShippingModal can handle the error
    }
  };

  const locationOptions = locations.map((l) => ({
    value: l.id,
    label: l.name,
  }));

  const handlePrintPickList = () => {
    // TODO: Implement actual print functionality
    window.print();
  };

  const handlePrintPackingSlip = () => {
    // TODO: Implement actual print functionality
    window.print();
  };

  const handleCancelOrder = async () => {
    if (!order) return;

    setCancelling(true);
    try {
      await deleteOutboundOrder(order.id);
      router.push("/outbound");
    } catch (err) {
      console.error("Failed to cancel order:", err);
      setError(err instanceof Error ? err.message : "Failed to cancel order");
      setShowCancelModal(false);
    } finally {
      setCancelling(false);
    }
  };

  const dropdownMenuItems = order ? [
    {
      label: "Print Pick List",
      icon: <Printer className="w-4 h-4" />,
      onClick: handlePrintPickList,
    },
    {
      label: "Print Packing Slip",
      icon: <FileText className="w-4 h-4" />,
      onClick: handlePrintPackingSlip,
    },
    {
      label: "Edit Order",
      icon: <Pencil className="w-4 h-4" />,
      onClick: () => router.push(`/outbound/${order.id}/edit`),
      disabled: order.status !== "pending",
      divider: true,
    },
    {
      label: "View Client",
      icon: <User className="w-4 h-4" />,
      onClick: () => order.client && router.push(`/clients/${order.client.id}`),
      disabled: !order.client,
    },
    {
      label: "Cancel Order",
      icon: <XCircle className="w-4 h-4" />,
      onClick: () => setShowCancelModal(true),
      variant: "danger" as const,
      disabled: order.status !== "pending",
      divider: true,
    },
  ] : [];

  const backLink = (
    <div className="flex items-center gap-3">
      <Link
        href="/outbound"
        className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Outbound Orders
      </Link>
      {order && (
        <DropdownMenu items={dropdownMenuItems} align="right" />
      )}
    </div>
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
              onClick={() => router.push("/outbound")}
            >
              Back to Outbound Orders
            </Button>
          </div>
        </Card>
      </AppShell>
    );
  }

  const currentStatusIndex = getStatusIndex(order.status);
  const totalRequested = order.items.reduce((sum, item) => sum + item.qty_requested, 0);
  const totalShipped = order.items.reduce((sum, item) => sum + item.qty_shipped, 0);
  const allItemsShipped = order.items.every((item) => item.qty_shipped >= item.qty_requested);
  const canPick = order.status === "confirmed" || order.status === "processing";

  return (
    <AppShell
      title={order.order_number}
      subtitle={`Outbound order for ${order.client?.company_name || "Unknown Client"}`}
      actions={backLink}
    >
      {/* Urgent Banner */}
      {isUrgent(order.notes) && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-2">
          <Flag className="w-5 h-5 text-red-500" />
          <span className="font-medium text-red-700">Rush/Urgent Order</span>
        </div>
      )}

      {/* Ship Success Alert */}
      {shipSuccess && (
        <div className="mb-6">
          <Alert
            type="success"
            message={shipSuccess}
            onClose={() => setShipSuccess("")}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status Timeline */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              Order Timeline
            </h2>

            {/* Vertical Timeline */}
            <div className="space-y-0">
              {(() => {
                const timelineSteps = [
                  { key: "pending", label: "Requested", date: order.requested_at },
                  { key: "confirmed", label: "Confirmed", date: order.confirmed_at },
                  { key: "processing", label: "Processing", date: getStatusIndex(order.status) >= 2 ? order.confirmed_at : null },
                  { key: "packed", label: "Packed", date: getStatusIndex(order.status) >= 3 ? order.shipped_date : null },
                  { key: "shipped", label: "Shipped", date: order.shipped_date },
                  { key: "delivered", label: "Delivered", date: order.delivered_date },
                ];

                return timelineSteps.map((step, index) => {
                  const stepIndex = STATUS_STEPS.findIndex(s => s.key === step.key);
                  const isCompleted = stepIndex <= currentStatusIndex && stepIndex !== -1;
                  const isCurrent = stepIndex === currentStatusIndex;
                  const isLast = index === timelineSteps.length - 1;
                  const StepIcon = STATUS_STEPS[stepIndex]?.icon || Clock;

                  return (
                    <div key={step.key} className="flex gap-4">
                      {/* Timeline Line & Icon */}
                      <div className="flex flex-col items-center">
                        <div
                          className={`
                            w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors
                            ${isCompleted
                              ? "bg-green-600 text-white"
                              : isCurrent
                              ? "bg-blue-600 text-white ring-4 ring-blue-100"
                              : "bg-gray-200 text-gray-400"
                            }
                          `}
                        >
                          {isCompleted && !isCurrent ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <StepIcon className="w-5 h-5" />
                          )}
                        </div>
                        {!isLast && (
                          <div
                            className={`w-0.5 h-12 ${
                              isCompleted ? "bg-green-600" : "bg-gray-200"
                            }`}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                        <p
                          className={`font-medium ${
                            isCurrent
                              ? "text-blue-600"
                              : isCompleted
                              ? "text-gray-900"
                              : "text-gray-400"
                          }`}
                        >
                          {step.label}
                          {isCurrent && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </p>
                        <p
                          className={`text-sm ${
                            isCompleted ? "text-gray-600" : "text-gray-400"
                          }`}
                        >
                          {step.date ? formatDateTime(step.date) : "Pending"}
                        </p>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Status Actions */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              {order.status === "pending" && (
                <Button
                  onClick={() => handleStatusUpdate("confirmed")}
                  loading={updating}
                  disabled={updating}
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  Confirm Order
                </Button>
              )}

              {order.status === "confirmed" && (
                <Button
                  onClick={() => handleStatusUpdate("processing")}
                  loading={updating}
                  disabled={updating}
                >
                  <Package className="w-4 h-4 mr-2" />
                  Start Picking
                </Button>
              )}

              {order.status === "processing" && (
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowPickingScanner(true)}
                  >
                    <ScanLine className="w-4 h-4 mr-2" />
                    Scan to Pick
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => handleStatusUpdate("packed")}
                    loading={updating}
                    disabled={updating}
                  >
                    <PackageCheck className="w-4 h-4 mr-2" />
                    Mark Packed
                  </Button>
                </div>
              )}

              {order.status === "packed" && (
                <Button
                  onClick={() => setShowShipModal(true)}
                  loading={updating}
                  disabled={updating}
                >
                  <Truck className="w-4 h-4 mr-2" />
                  Ship Order
                </Button>
              )}

              {order.status === "shipped" && (
                <Button
                  onClick={() => handleStatusUpdate("delivered")}
                  loading={updating}
                  disabled={updating}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Delivered
                </Button>
              )}

              {order.status === "delivered" && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Order Delivered</span>
                </div>
              )}
            </div>
          </Card>

          {/* Pick List - Show enhanced version during processing */}
          {order.status === "processing" ? (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Pick List
                </h2>
                <div className="text-sm text-gray-500">
                  {order.items.filter(i => i.qty_shipped >= i.qty_requested).length} / {order.items.length} items picked
                </div>
              </div>

              <div className="space-y-4">
                {order.items.map((item) => {
                  const remaining = item.qty_requested - item.qty_shipped;
                  const isComplete = remaining <= 0;
                  const isPartial = item.qty_shipped > 0 && remaining > 0;

                  // Get inventory locations for this product
                  const productInventory = inventory.filter(
                    (inv) => inv.product_id === item.product_id && inv.qty_on_hand > 0
                  );

                  // Get current picking qty for this item
                  const currentPickQty = pickingQty[item.id] ?? remaining;

                  return (
                    <div
                      key={item.id}
                      className={`border rounded-lg overflow-hidden transition-colors ${
                        isComplete
                          ? "border-green-300 bg-green-50"
                          : isPartial
                          ? "border-yellow-300 bg-yellow-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      {/* Item Header */}
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isComplete ? (
                            <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
                              <CheckCircle2 className="w-5 h-5 text-white" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <Package className="w-5 h-5 text-gray-500" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.product?.name || "Unknown Product"}
                            </p>
                            <p className="text-sm text-gray-500">
                              SKU: {item.product?.sku || "—"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Requested</p>
                          <p className="text-xl font-bold text-gray-900">{item.qty_requested}</p>
                        </div>
                      </div>

                      {/* Pick Details - Show if not complete */}
                      {!isComplete && (
                        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                          {/* Available Locations */}
                          <div className="mb-3">
                            <p className="text-xs font-medium text-gray-500 uppercase mb-2">
                              Available Locations
                            </p>
                            {productInventory.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {productInventory.map((inv) => (
                                  <button
                                    key={inv.id}
                                    onClick={() => setShipLocationId(inv.location_id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                                      shipLocationId === inv.location_id
                                        ? "bg-blue-600 text-white"
                                        : "bg-white border border-gray-300 text-gray-700 hover:border-blue-500"
                                    }`}
                                  >
                                    <MapPin className="w-3.5 h-3.5" />
                                    {inv.location.name}
                                    <span className={`font-medium ${
                                      shipLocationId === inv.location_id ? "text-blue-100" : "text-gray-900"
                                    }`}>
                                      ({inv.qty_on_hand} avail)
                                    </span>
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-red-600">No stock available</p>
                            )}
                          </div>

                          {/* Pick Controls */}
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-sm text-gray-600">Pick Qty:</label>
                              <input
                                type="number"
                                min={1}
                                max={remaining}
                                value={currentPickQty}
                                onChange={(e) => setPickingQty({
                                  ...pickingQty,
                                  [item.id]: Math.min(Math.max(1, parseInt(e.target.value) || 1), remaining)
                                })}
                                className="w-20 px-3 py-2 border border-gray-300 rounded-md text-center font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              />
                              <span className="text-sm text-gray-500">of {remaining} remaining</span>
                            </div>

                            <div className="flex gap-2 ml-auto">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={async () => {
                                  if (!shipLocationId) return;
                                  const newTotal = item.qty_shipped + currentPickQty;
                                  await shipOutboundItem(item.id, newTotal, shipLocationId);
                                  const updatedOrder = await getOutboundOrder(orderId);
                                  if (updatedOrder) {
                                    setOrder(updatedOrder);
                                    setPickingQty({ ...pickingQty, [item.id]: undefined });
                                    await checkAndUpdateOrderStatus(updatedOrder);
                                  }
                                }}
                                disabled={!shipLocationId || shipping}
                              >
                                Pick {currentPickQty}
                              </Button>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (!shipLocationId) return;
                                  await shipOutboundItem(item.id, item.qty_requested, shipLocationId);
                                  const updatedOrder = await getOutboundOrder(orderId);
                                  if (updatedOrder) {
                                    setOrder(updatedOrder);
                                    await checkAndUpdateOrderStatus(updatedOrder);
                                  }
                                }}
                                disabled={!shipLocationId || shipping}
                              >
                                <PackageCheck className="w-4 h-4 mr-1" />
                                Pick All
                              </Button>
                            </div>
                          </div>

                          {/* Progress */}
                          {isPartial && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-600">Progress</span>
                                <span className="font-medium">{item.qty_shipped} / {item.qty_requested}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-yellow-500 h-2 rounded-full transition-all"
                                  style={{ width: `${(item.qty_shipped / item.qty_requested) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Completed State */}
                      {isComplete && (
                        <div className="px-4 py-2 bg-green-100 border-t border-green-200 flex items-center justify-between">
                          <span className="text-sm font-medium text-green-800">
                            Fully picked
                          </span>
                          <span className="text-sm text-green-700">
                            {item.qty_shipped} units
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          ) : (
            /* Standard Line Items Table - For non-processing states */
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Line Items
                </h2>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Requested
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Picked
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Shipped
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {order.items.map((item) => {
                      const remaining = item.qty_requested - item.qty_shipped;
                      const isComplete = remaining <= 0;
                      const isPartial = item.qty_shipped > 0 && remaining > 0;
                      const isPending = item.qty_shipped === 0;
                      const isShipped = order.status === "shipped" || order.status === "delivered";

                      return (
                        <tr key={item.id} className={isComplete ? "bg-green-50/50" : ""}>
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">
                                {item.product?.name || "Unknown Product"}
                              </p>
                              <p className="text-sm text-gray-500">
                                SKU: {item.product?.sku || "—"}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-gray-900 font-medium">{item.qty_requested}</span>
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
                              {item.qty_shipped}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {isShipped ? (
                              <span className="text-green-600 font-medium">
                                {item.qty_shipped}
                              </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                          <td className="px-4 py-3 text-center">
                            {isShipped && isComplete ? (
                              <Badge variant="success">Shipped</Badge>
                            ) : isComplete ? (
                              <Badge variant="success">Picked</Badge>
                            ) : isPartial ? (
                              <Badge variant="warning">Partial</Badge>
                            ) : (
                              <Badge variant="default">Pending</Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        Total ({order.items.length} items)
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {totalRequested}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {totalShipped}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {(order.status === "shipped" || order.status === "delivered") ? totalShipped : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-500">
                          {Math.round((totalShipped / totalRequested) * 100) || 0}% picked
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <div className="space-y-4">
              {/* Order Number - Large */}
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-500 mb-1">Order Number</p>
                <p className="text-2xl font-bold text-gray-900">
                  {order.order_number}
                </p>
              </div>

              {/* Status */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <Badge variant={getStatusColor(order.status)}>
                  {formatStatus(order.status)}
                </Badge>
              </div>

              {/* Client */}
              {order.client && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Client</p>
                  <Link
                    href={`/clients/${order.client.id}`}
                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {order.client.company_name}
                  </Link>
                </div>
              )}

              {/* Ship To Address */}
              {order.ship_to_address && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Ship To</p>
                  <p className="text-gray-900 whitespace-pre-line">
                    {order.ship_to_address}
                  </p>
                </div>
              )}

              {/* Requested Date */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Requested</p>
                <p className="font-medium text-gray-900">
                  {formatDateTime(order.requested_at)}
                </p>
              </div>

              {/* Confirmed Date */}
              {order.confirmed_at && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Confirmed</p>
                  <p className="font-medium text-gray-900">
                    {formatDateTime(order.confirmed_at)}
                  </p>
                </div>
              )}

              {/* Shipping Info */}
              {(order.carrier || order.tracking_number) && (
                <div className="pt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-500 mb-2">Shipping Info</p>
                  {order.carrier && (
                    <p className="font-medium text-gray-900">{order.carrier}</p>
                  )}
                  {order.tracking_number && (
                    <p className="text-blue-600">{order.tracking_number}</p>
                  )}
                </div>
              )}

              {/* Shipped Date */}
              {order.shipped_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Shipped</p>
                  <p className="font-medium text-green-600">
                    {formatDateTime(order.shipped_date)}
                  </p>
                </div>
              )}

              {/* Delivered Date */}
              {order.delivered_date && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Delivered</p>
                  <p className="font-medium text-green-600">
                    {formatDateTime(order.delivered_date)}
                  </p>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className={`pt-4 border-t ${isUrgent(order.notes) ? "border-red-200" : "border-gray-200"}`}>
                  <p className="text-sm text-gray-500 mb-1">Notes</p>
                  <div
                    className={`${
                      isUrgent(order.notes)
                        ? "bg-red-50 border border-red-200 rounded-lg p-3"
                        : ""
                    }`}
                  >
                    {isUrgent(order.notes) && (
                      <div className="flex items-center gap-1.5 text-red-600 text-sm font-medium mb-1">
                        <Flag className="w-3.5 h-3.5" />
                        Rush/Urgent
                      </div>
                    )}
                    <p className={isUrgent(order.notes) ? "text-red-800" : "text-gray-700"}>
                      {order.notes}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Fulfillment Summary */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Fulfillment Summary
            </h2>
            <div className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium text-gray-900">
                    {totalShipped.toLocaleString()} / {totalRequested.toLocaleString()} units
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${
                      totalShipped >= totalRequested
                        ? "bg-green-600"
                        : "bg-blue-600"
                    }`}
                    style={{
                      width: `${Math.min((totalShipped / totalRequested) * 100, 100) || 0}%`,
                    }}
                  />
                </div>
                <p className="text-center text-sm font-medium mt-2">
                  {Math.round((totalShipped / totalRequested) * 100) || 0}% Picked
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
                  <span className="text-gray-600">Total Requested</span>
                  <span className="font-medium text-gray-900">
                    {totalRequested.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Picked</span>
                  <span className={`font-medium ${
                    totalShipped >= totalRequested
                      ? "text-green-600"
                      : "text-gray-900"
                  }`}>
                    {totalShipped.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Remaining</span>
                  <span className={`font-medium ${
                    totalRequested - totalShipped > 0
                      ? "text-orange-600"
                      : "text-gray-400"
                  }`}>
                    {totalRequested - totalShipped > 0
                      ? (totalRequested - totalShipped).toLocaleString()
                      : "—"}
                  </span>
                </div>
              </div>

              {/* Ready to Ship */}
              {canPick && allItemsShipped && (
                <div className="border-t border-gray-200 pt-4">
                  <Button
                    onClick={() => handleStatusUpdate("packed")}
                    loading={updating}
                    disabled={updating}
                    className="w-full"
                  >
                    <PackageCheck className="w-4 h-4 mr-2" />
                    Mark as Packed
                  </Button>
                </div>
              )}

              {/* Delivered Message */}
              {order.status === "delivered" && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-lg py-3">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Order Delivered</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Pick Item Modal */}
      <Modal
        isOpen={!!shippingItem}
        onClose={closeShipItemModal}
        title="Pick Item"
        size="sm"
      >
        {shippingItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">
                {shippingItem.product?.name}
              </p>
              <p className="text-sm text-gray-500">
                {shippingItem.product?.sku}
              </p>
              <div className="mt-2 flex gap-4 text-sm">
                <span>
                  Requested: <strong>{shippingItem.qty_requested}</strong>
                </span>
                <span>
                  Picked: <strong>{shippingItem.qty_shipped}</strong>
                </span>
                <span>
                  Remaining:{" "}
                  <strong>
                    {shippingItem.qty_requested - shippingItem.qty_shipped}
                  </strong>
                </span>
              </div>
            </div>

            <Select
              label="Pick from Location"
              name="modal-location"
              options={locationOptions}
              value={shipLocationId}
              onChange={(e) => setShipLocationId(e.target.value)}
              placeholder="Select location"
              required
            />

            <Input
              label="Quantity to Pick"
              name="ship-qty"
              type="number"
              min={1}
              max={shippingItem.qty_requested - shippingItem.qty_shipped}
              value={shipQty}
              onChange={(e) => setShipQty(parseInt(e.target.value) || 0)}
              required
            />

            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                variant="secondary"
                onClick={closeShipItemModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleShipItem}
                loading={shipping}
                disabled={shipping || !shipLocationId || shipQty <= 0}
                className="flex-1"
              >
                Pick {shipQty} Units
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Ship Order Modal */}
      <ShippingModal
        isOpen={showShipModal}
        onClose={() => setShowShipModal(false)}
        onSubmit={handleShipOrder}
        orderNumber={order?.order_number}
        initialCarrier={order?.carrier || ""}
        initialTrackingNumber={order?.tracking_number || ""}
      />

      {/* Cancel Order Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => !cancelling && setShowCancelModal(false)}
        title="Cancel Order"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg">
            <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
            <div>
              <p className="font-medium text-red-800">
                Are you sure you want to cancel this order?
              </p>
              <p className="text-sm text-red-600 mt-1">
                This action cannot be undone.
              </p>
            </div>
          </div>

          {order && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Order</p>
              <p className="font-semibold text-gray-900">{order.order_number}</p>
              {order.client && (
                <>
                  <p className="text-sm text-gray-500 mt-2">Client</p>
                  <p className="font-medium text-gray-900">{order.client.company_name}</p>
                </>
              )}
              <p className="text-sm text-gray-500 mt-2">Items</p>
              <p className="font-medium text-gray-900">{order.items.length} line items</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCancelModal(false)}
              disabled={cancelling}
              className="flex-1"
            >
              Keep Order
            </Button>
            <Button
              type="button"
              onClick={handleCancelOrder}
              loading={cancelling}
              disabled={cancelling}
              className="flex-1 bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancel Order
            </Button>
          </div>
        </div>
      </Modal>

      {/* Picking Scanner Modal */}
      <Modal
        isOpen={showPickingScanner}
        onClose={() => setShowPickingScanner(false)}
        title="Scan to Pick"
        size="lg"
      >
        <PickingScanner
          outboundOrderId={orderId}
          onComplete={() => {
            setShowPickingScanner(false);
            fetchOrder();
          }}
        />
      </Modal>
    </AppShell>
  );
}
