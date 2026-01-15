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
  InboundOrderWithItems,
  InboundItemWithProduct,
  RejectionReason,
} from "@/lib/api/inbound";
import { getLocations, Location } from "@/lib/api/locations";
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

  // Rejection state
  const [rejectingItem, setRejectingItem] = useState<InboundItemWithProduct | null>(null);
  const [rejectQty, setRejectQty] = useState(1);
  const [rejectReason, setRejectReason] = useState<RejectionReason>("damaged");
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const fetchOrder = async () => {
    try {
      const [orderData, locationsData] = await Promise.all([
        getInboundOrder(orderId),
        getLocations(),
      ]);
      if (!orderData) {
        setError("Order not found");
      } else {
        setOrder(orderData);
        setLocations(locationsData.filter((l) => l.active));
        // Set default location if only one
        if (locationsData.filter((l) => l.active).length === 1) {
          setReceiveLocationId(locationsData.filter((l) => l.active)[0].id);
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

  const openReceiveModal = (item: InboundItemWithProduct) => {
    const remaining = item.qty_expected - item.qty_received;
    setReceivingItem(item);
    setReceiveQty(remaining > 0 ? remaining : 0);
  };

  const closeReceiveModal = () => {
    setReceivingItem(null);
    setReceiveQty(0);
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

  const checkAndUpdateOrderStatus = async (updatedOrder: InboundOrderWithItems) => {
    // Check if all items are fully received
    const allItemsReceived = updatedOrder.items.every(
      (item) => item.qty_received >= item.qty_expected
    );

    // If all items received and order is still in "arrived" status, mark as "received"
    if (allItemsReceived && updatedOrder.status === "arrived") {
      await updateInboundOrderStatus(updatedOrder.id, "received");
      await fetchOrder();
    }
  };

  const handleReceiveItem = async () => {
    if (!receivingItem || !receiveLocationId || receiveQty <= 0 || !order) return;

    setReceiving(true);
    try {
      // 1. Calculate new total received for this item
      const newTotal = receivingItem.qty_received + receiveQty;

      // 2. Call receiveInboundItem API (this also updates inventory via update_inventory RPC)
      await receiveInboundItem(receivingItem.id, newTotal, receiveLocationId);

      // 3. Refresh order data
      const updatedOrder = await getInboundOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);

        // 4. Check if all items fully received and update order status
        await checkAndUpdateOrderStatus(updatedOrder);
      }

      closeReceiveModal();
    } catch (err) {
      console.error("Failed to receive item:", err);
    } finally {
      setReceiving(false);
    }
  };

  const handleReceiveAll = async (item: InboundItemWithProduct) => {
    if (!receiveLocationId || !order) {
      openReceiveModal(item);
      return;
    }

    setReceiving(true);
    try {
      // 1 & 2. Receive full quantity (API also updates inventory)
      await receiveInboundItem(item.id, item.qty_expected, receiveLocationId);

      // 3. Refresh order data
      const updatedOrder = await getInboundOrder(orderId);
      if (updatedOrder) {
        setOrder(updatedOrder);

        // 4. Check if all items fully received and update order status
        await checkAndUpdateOrderStatus(updatedOrder);
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
      Back to Inbound Orders
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
              Back to Inbound Orders
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
      subtitle={`Purchase order from ${order.supplier || "Unknown Supplier"}`}
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
                    const remaining = item.qty_expected - item.qty_received - rejected;
                    const isComplete = remaining <= 0;
                    const isPartial = item.qty_received > 0 && remaining > 0;
                    const isPending = item.qty_received === 0 && rejected === 0;
                    const hasRejections = rejected > 0;

                    return (
                      <tr key={item.id}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">
                              {item.product?.name || "Unknown Product"}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.product?.sku || "—"}
                            </p>
                            {hasRejections && (
                              <p className="text-xs text-red-600 mt-1" title={item.rejection_reason || ""}>
                                {rejected} rejected
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
                                  disabled={receiving || !receiveLocationId}
                                  title={!receiveLocationId ? "Select a location first" : "Receive all remaining"}
                                >
                                  <PackageCheck className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openRejectModal(item)}
                                  title="Mark as damaged/rejected"
                                >
                                  <XCircle className="w-4 h-4 text-red-500" />
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
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Order Info */}
          <Card>
            <div className="space-y-4">
              {/* PO Number - Large */}
              <div className="pb-4 border-b border-gray-200">
                <p className="text-sm text-gray-500 mb-1">PO Number</p>
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

              {/* Supplier */}
              <div>
                <p className="text-sm text-gray-500 mb-1">Supplier</p>
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
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-center gap-2 text-green-600 bg-green-50 rounded-lg py-3">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Receiving Complete</span>
                  </div>
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
        size="sm"
      >
        {receivingItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900">
                {receivingItem.product?.name}
              </p>
              <p className="text-sm text-gray-500">
                {receivingItem.product?.sku}
              </p>
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
                disabled={receiving || !receiveLocationId || receiveQty <= 0}
                className="flex-1"
              >
                Receive {receiveQty} Units
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
    </AppShell>
  );
}
