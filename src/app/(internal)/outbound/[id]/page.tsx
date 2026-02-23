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
  Box,
  Plus,
  Zap,
  AlertCircle,
  Calendar,
  Globe,
  Building2,
} from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/internal/AppShell";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
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
import {
  getSupplies,
  getOrderSupplies,
  recordSupplyUsage,
  SupplyWithInventory,
  SupplyUsageWithDetails,
} from "@/lib/api/supplies";
import {
  recordBoxUsage,
  getOrderBoxUsage,
  BoxUsageRecord,
  PACKING_MATERIALS,
  BOX_TYPES,
  recordPackingMaterialUsage,
  getOrderPackingMaterialUsage,
  PackingMaterialRecord,
  suggestBoxesForOrder,
  BoxSuggestionResult,
} from "@/lib/api/box-usage";
import { getClientSettings, ClientSetting } from "@/lib/api/settings";
import PickingScanner from "@/components/internal/PickingScanner";
import PickScanner from "@/components/internal/PickScanner";
import { getWarehouseTasks, getPickListItems, WarehouseTaskWithRelations, PickListItemWithRelations } from "@/lib/api/warehouse-tasks";

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

// Carrier delivery estimates in business days
const CARRIER_DELIVERY_DAYS: Record<string, { min: number; max: number; name: string }> = {
  "ups_ground": { min: 3, max: 5, name: "UPS Ground" },
  "ups_2day": { min: 2, max: 2, name: "UPS 2-Day" },
  "ups_next_day": { min: 1, max: 1, name: "UPS Next Day" },
  "fedex_ground": { min: 3, max: 5, name: "FedEx Ground" },
  "fedex_express": { min: 2, max: 2, name: "FedEx Express" },
  "fedex_overnight": { min: 1, max: 1, name: "FedEx Overnight" },
  "usps_priority": { min: 2, max: 3, name: "USPS Priority" },
  "usps_first_class": { min: 3, max: 5, name: "USPS First Class" },
  "usps_ground": { min: 5, max: 7, name: "USPS Ground" },
  "dhl_express": { min: 2, max: 3, name: "DHL Express" },
  // Default fallbacks for common carrier names
  "ups": { min: 3, max: 5, name: "UPS" },
  "fedex": { min: 3, max: 5, name: "FedEx" },
  "usps": { min: 3, max: 5, name: "USPS" },
  "dhl": { min: 3, max: 5, name: "DHL" },
};

function getEstimatedDelivery(carrier: string | null, shippedDate: string | null): {
  minDate: Date | null;
  maxDate: Date | null;
  businessDays: { min: number; max: number };
  serviceName: string | null;
} | null {
  if (!shippedDate) return null;

  const shipDate = new Date(shippedDate);
  if (isNaN(shipDate.getTime())) return null;

  // Normalize carrier name for lookup
  const normalizedCarrier = carrier?.toLowerCase().replace(/[^a-z0-9]/g, "_") || "";

  // Find matching carrier config
  let deliveryConfig = CARRIER_DELIVERY_DAYS[normalizedCarrier];

  // Try partial matches if exact match not found
  if (!deliveryConfig) {
    for (const [key, config] of Object.entries(CARRIER_DELIVERY_DAYS)) {
      if (normalizedCarrier.includes(key) || key.includes(normalizedCarrier)) {
        deliveryConfig = config;
        break;
      }
    }
  }

  // Default to 3-7 business days if carrier not recognized
  if (!deliveryConfig) {
    deliveryConfig = { min: 3, max: 7, name: carrier || "Standard" };
  }

  // Calculate delivery dates (add business days, skipping weekends)
  const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dayOfWeek = result.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        added++;
      }
    }
    return result;
  };

  return {
    minDate: addBusinessDays(shipDate, deliveryConfig.min),
    maxDate: addBusinessDays(shipDate, deliveryConfig.max),
    businessDays: { min: deliveryConfig.min, max: deliveryConfig.max },
    serviceName: deliveryConfig.name,
  };
}

function formatEstimatedDelivery(estimate: ReturnType<typeof getEstimatedDelivery>): string {
  if (!estimate) return "—";

  const formatShortDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  if (estimate.minDate && estimate.maxDate) {
    if (estimate.businessDays.min === estimate.businessDays.max) {
      return formatShortDate(estimate.minDate);
    }
    return `${formatShortDate(estimate.minDate)} - ${formatShortDate(estimate.maxDate)}`;
  }

  return "—";
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

  // Confirm order modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Cancel confirmation modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Picking scanner state
  const [showPickingScanner, setShowPickingScanner] = useState(false);
  const [showPickScanner, setShowPickScanner] = useState(false);
  const [pickTask, setPickTask] = useState<WarehouseTaskWithRelations | null>(null);
  const [pickListItems, setPickListItems] = useState<PickListItemWithRelations[]>([]);

  // Supplies state
  const [supplies, setSupplies] = useState<SupplyWithInventory[]>([]);
  const [orderSupplies, setOrderSupplies] = useState<SupplyUsageWithDetails[]>([]);
  const [selectedSupplyId, setSelectedSupplyId] = useState("");
  const [supplyQty, setSupplyQty] = useState(1);
  const [addingSupply, setAddingSupply] = useState(false);

  // Client settings state
  const [clientSettings, setClientSettings] = useState<ClientSetting[]>([]);

  // Box usage state
  const [boxUsage, setBoxUsage] = useState<BoxUsageRecord[]>([]);
  const [selectedBoxCode, setSelectedBoxCode] = useState("");
  const [boxQty, setBoxQty] = useState(1);
  const [addingBox, setAddingBox] = useState(false);

  // Packing materials state
  const [packingMaterialUsage, setPackingMaterialUsage] = useState<PackingMaterialRecord[]>([]);
  const [selectedMaterialCode, setSelectedMaterialCode] = useState("");
  const [materialQty, setMaterialQty] = useState(1);
  const [addingMaterial, setAddingMaterial] = useState(false);

  // Box suggestions state
  const [boxSuggestions, setBoxSuggestions] = useState<BoxSuggestionResult | null>(null);

  // Helper to get client setting value
  const getClientSettingValue = (category: string, key: string): unknown => {
    const setting = clientSettings.find(
      (s) => s.category === category && s.setting_key === key
    );
    return setting?.setting_value ?? null;
  };

  const fetchOrder = async () => {
    try {
      const [orderData, locationsData, inventoryData, suppliesData, orderSuppliesData, boxUsageData, packingMaterialData] = await Promise.all([
        getOutboundOrder(orderId),
        getLocations(),
        getInventory(),
        getSupplies({ active: true }),
        getOrderSupplies(orderId),
        getOrderBoxUsage(orderId),
        getOrderPackingMaterialUsage(orderId),
      ]);
      if (!orderData) {
        setError("Order not found");
      } else {
        setOrder(orderData);
        setLocations(locationsData.filter((l) => l.active));
        setInventory(inventoryData);
        setSupplies(suppliesData);
        setOrderSupplies(orderSuppliesData);
        setBoxUsage(boxUsageData);
        setPackingMaterialUsage(packingMaterialData);
        // Set default location if only one
        if (locationsData.filter((l) => l.active).length === 1) {
          setShipLocationId(locationsData.filter((l) => l.active)[0].id);
        }

        // Fetch client settings if client exists
        if (orderData.client_id) {
          try {
            const settings = await getClientSettings(orderData.client_id);
            setClientSettings(settings);
          } catch (err) {
            console.error("Failed to fetch client settings:", err);
          }
        }

        // Calculate box suggestions based on order items
        // Fetch container types for products in this order
        const supabase = (await import("@/lib/supabase")).createClient();
        const productIds = orderData.items.map((item) => item.product_id);
        const { data: productData } = await supabase
          .from("products")
          .select("id, container_type")
          .in("id", productIds);

        if (productData) {
          const containerTypeMap = new Map(
            productData.map((p) => [p.id, p.container_type || "bottle"])
          );

          const itemsForSuggestion = orderData.items.map((item) => ({
            qty: item.qty_requested,
            containerType: (containerTypeMap.get(item.product_id) || "bottle") as "bottle" | "can" | "keg" | "bag_in_box" | "other",
          }));

          const suggestions = suggestBoxesForOrder(itemsForSuggestion);
          setBoxSuggestions(suggestions);
        }

        // Fetch pick task if order is confirmed or later
        try {
          const tasks = await getWarehouseTasks({
            orderId,
            orderType: "outbound",
          });
          const pickTaskData = tasks.find((t) => t.task_type === "pick");
          if (pickTaskData) {
            setPickTask(pickTaskData);
            const items = await getPickListItems(pickTaskData.id);
            setPickListItems(items);
          }
        } catch (err) {
          console.error("Failed to fetch pick task:", err);
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

  const handleStatusUpdate = async (newStatus: string, additionalFields?: { carrier?: string; tracking_number?: string }): Promise<boolean> => {
    if (!order) return false;
    setUpdating(true);
    try {
      await updateOutboundOrderStatus(order.id, newStatus, additionalFields);
      await fetchOrder();
      setShowShipModal(false);
      return true;
    } catch (err) {
      console.error("Failed to update status:", err);
      setError(err instanceof Error ? err.message : "Failed to update order status");
      return false;
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

  const handleAddSupply = async () => {
    if (!selectedSupplyId || supplyQty <= 0 || !order) return;

    setAddingSupply(true);
    try {
      await recordSupplyUsage(order.id, selectedSupplyId, supplyQty);
      // Refresh order supplies
      const updatedSupplies = await getOrderSupplies(orderId);
      setOrderSupplies(updatedSupplies);
      // Reset form
      setSelectedSupplyId("");
      setSupplyQty(1);
    } catch (err) {
      console.error("Failed to add supply:", err);
    } finally {
      setAddingSupply(false);
    }
  };

  // Get suggested supplies based on order items
  const getSuggestedSupplies = () => {
    if (!order) return [];

    const totalItems = order.items.reduce((sum, item) => sum + item.qty_requested, 0);
    const suggestions: { supply: SupplyWithInventory; reason: string; qty: number }[] = [];

    // Suggest boxes based on item count
    const boxSupply = supplies.find((s) =>
      s.category === "packaging" && s.name.toLowerCase().includes("box")
    );
    if (boxSupply) {
      const boxQty = Math.ceil(totalItems / 10); // 1 box per 10 items
      suggestions.push({ supply: boxSupply, reason: `${totalItems} items to pack`, qty: boxQty });
    }

    // Suggest tape for any order
    const tapeSupply = supplies.find((s) =>
      s.category === "packaging" && s.name.toLowerCase().includes("tape")
    );
    if (tapeSupply) {
      suggestions.push({ supply: tapeSupply, reason: "Standard packing", qty: 1 });
    }

    // Suggest bubble wrap for fragile items
    const bubbleWrap = supplies.find((s) =>
      s.category === "packaging" && s.name.toLowerCase().includes("bubble")
    );
    if (bubbleWrap && totalItems > 5) {
      suggestions.push({ supply: bubbleWrap, reason: "Protection for items", qty: Math.ceil(totalItems / 5) });
    }

    // Suggest packing peanuts for larger orders
    const peanutsSupply = supplies.find((s) =>
      s.category === "packaging" && (s.name.toLowerCase().includes("peanut") || s.name.toLowerCase().includes("fill"))
    );
    if (peanutsSupply && totalItems > 10) {
      suggestions.push({ supply: peanutsSupply, reason: "Void fill for larger order", qty: 1 });
    }

    return suggestions;
  };

  const supplyOptions = supplies.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.sku})`,
  }));

  const handleAddBox = async () => {
    if (!selectedBoxCode || boxQty <= 0 || !order) return;

    setAddingBox(true);
    try {
      const result = await recordBoxUsage(order.id, selectedBoxCode, boxQty);
      if (result) {
        setBoxUsage((prev) => [...prev, result]);
      }
      // Reset form
      setSelectedBoxCode("");
      setBoxQty(1);
    } catch (err) {
      console.error("Failed to add box:", err);
    } finally {
      setAddingBox(false);
    }
  };

  const handleAddPackingMaterial = async () => {
    if (!selectedMaterialCode || materialQty <= 0 || !order) return;

    setAddingMaterial(true);
    try {
      const result = await recordPackingMaterialUsage(order.id, selectedMaterialCode, materialQty);
      if (result) {
        setPackingMaterialUsage((prev) => [...prev, result]);
      }
      // Reset form
      setSelectedMaterialCode("");
      setMaterialQty(1);
    } catch (err) {
      console.error("Failed to add packing material:", err);
    } finally {
      setAddingMaterial(false);
    }
  };

  const suggestedSupplies = getSuggestedSupplies();

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

  // Client service options
  const rushProcessingEnabled = getClientSettingValue("fulfillment", "rush_processing_enabled") === true;
  const carrierPreference = getClientSettingValue("fulfillment", "carrier_preference") as string | null;
  const specialInstructions = getClientSettingValue("fulfillment", "special_instructions") as string | null;

  // Order-level fields (from portal orders)
  const orderIsRush = (order as any).is_rush === true;
  const orderPreferredCarrier = (order as any).preferred_carrier as string | null;
  const orderRequiresRepack = (order as any).requires_repack !== false; // Default true if not set

  // Combine client settings with order fields
  const isRushRequested = orderIsRush || isUrgent(order.notes) || (rushProcessingEnabled && order.notes?.toLowerCase().includes("rush"));
  const effectivePreferredCarrier = orderPreferredCarrier || carrierPreference;
  const hasServiceOptions = rushProcessingEnabled || effectivePreferredCarrier || specialInstructions || orderIsRush || !orderRequiresRepack;

  return (
    <AppShell
      title={order.order_number}
      subtitle={`Outbound order for ${order.client?.company_name || "Unknown Client"}`}
      actions={backLink}
    >
      <Breadcrumbs items={[
        { label: "Outbound", href: "/outbound" },
        { label: order.order_number || "Order Details" }
      ]} />
      {/* Urgent/Rush Banner */}
      {isRushRequested && (
        <div className="mb-6 bg-red-50 border-2 border-red-300 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <Zap className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <span className="font-semibold text-red-800 text-lg">Rush Order</span>
              {rushProcessingEnabled && (
                <p className="text-sm text-red-600">Client has rush processing enabled</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 text-red-700">
            <Flag className="w-4 h-4" />
            <span className="text-sm font-medium">Priority Fulfillment</span>
          </div>
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
                const estimatedDelivery = getEstimatedDelivery(order.carrier, order.shipped_date);
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

                  // Check if this is the delivered step and we should show estimate
                  const isDeliveredStep = step.key === "delivered";
                  const showEstimate = isDeliveredStep && !order.delivered_date && order.shipped_date && estimatedDelivery;

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
                              : showEstimate
                              ? "bg-purple-100 text-purple-600 ring-2 ring-purple-200"
                              : "bg-gray-200 text-gray-400"
                            }
                          `}
                        >
                          {isCompleted && !isCurrent ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : showEstimate ? (
                            <Calendar className="w-5 h-5" />
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
                              : showEstimate
                              ? "text-purple-700"
                              : "text-gray-400"
                          }`}
                        >
                          {showEstimate ? "Estimated Delivery" : step.label}
                          {isCurrent && (
                            <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                        </p>
                        {showEstimate ? (
                          <div>
                            <p className="text-sm text-purple-600 font-medium">
                              {formatEstimatedDelivery(estimatedDelivery)}
                            </p>
                            {estimatedDelivery?.serviceName && (
                              <p className="text-xs text-gray-500 mt-0.5">
                                via {order.carrier || estimatedDelivery.serviceName}
                                {estimatedDelivery.businessDays.min === estimatedDelivery.businessDays.max
                                  ? ` (${estimatedDelivery.businessDays.min} business day${estimatedDelivery.businessDays.min !== 1 ? "s" : ""})`
                                  : ` (${estimatedDelivery.businessDays.min}-${estimatedDelivery.businessDays.max} business days)`
                                }
                              </p>
                            )}
                          </div>
                        ) : (
                          <p
                            className={`text-sm ${
                              isCompleted ? "text-gray-600" : "text-gray-400"
                            }`}
                          >
                            {step.date ? formatDateTime(step.date) : "Pending"}
                          </p>
                        )}
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
                  onClick={() => setShowConfirmModal(true)}
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
                  {pickTask ? (
                    <Button
                      onClick={() => setShowPickScanner(true)}
                    >
                      <ScanLine className="w-4 h-4 mr-2" />
                      Pick Scanner (Task)
                    </Button>
                  ) : (
                    <Button
                      onClick={() => setShowPickingScanner(true)}
                    >
                      <ScanLine className="w-4 h-4 mr-2" />
                      Scan to Pick
                    </Button>
                  )}
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

          {/* Supplies Section - Show during packing */}
          {(order.status === "processing" || order.status === "packed") && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Box className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Packing Supplies
                  </h2>
                </div>
                <span className="text-sm text-gray-500">
                  {orderSupplies.length} supplies used
                </span>
              </div>

              {/* Suggested Supplies */}
              {suggestedSupplies.length > 0 && orderSupplies.length === 0 && (
                <div className="mb-6">
                  <p className="text-sm font-medium text-gray-700 mb-3">Suggested Supplies</p>
                  <div className="space-y-2">
                    {suggestedSupplies.map(({ supply, reason, qty }) => (
                      <div
                        key={supply.id}
                        className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3"
                      >
                        <div>
                          <p className="font-medium text-gray-900">{supply.name}</p>
                          <p className="text-xs text-blue-600">{reason}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSupplyId(supply.id);
                            setSupplyQty(qty);
                          }}
                          className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          Add {qty}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Supply Form */}
              <div className="space-y-3 mb-6">
                <p className="text-sm font-medium text-gray-700">Add Supply</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select
                      name="supply-select"
                      options={supplyOptions}
                      value={selectedSupplyId}
                      onChange={(e) => setSelectedSupplyId(e.target.value)}
                      placeholder="Select supply..."
                    />
                  </div>
                  <div className="w-20">
                    <Input
                      name="supply-qty"
                      type="number"
                      min={1}
                      value={supplyQty}
                      onChange={(e) => setSupplyQty(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <Button
                    onClick={handleAddSupply}
                    disabled={!selectedSupplyId || supplyQty <= 0 || addingSupply}
                    loading={addingSupply}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Supplies Used List */}
              {orderSupplies.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Supplies Used</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Supply
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Unit Price
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {orderSupplies.map((usage) => (
                          <tr key={usage.id}>
                            <td className="px-4 py-2">
                              <p className="font-medium text-gray-900 text-sm">
                                {usage.supply.name}
                              </p>
                              <p className="text-xs text-gray-500">{usage.supply.sku}</p>
                            </td>
                            <td className="px-4 py-2 text-right text-sm">
                              {usage.quantity} {usage.supply.unit}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-600">
                              ${usage.unit_price.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-medium">
                              ${usage.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                            Total Supplies Cost:
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-bold text-gray-900">
                            ${orderSupplies.reduce((sum, u) => sum + u.total, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Billing Note */}
                  <p className="text-xs text-gray-500 mt-3 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    Supplies will be recorded for billing
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  <Box className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No supplies added yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add supplies used for packing this order</p>
                </div>
              )}
            </Card>
          )}

          {/* Box Usage Section - 7Degrees Box Rates (only if repack required) */}
          {orderRequiresRepack && (order.status === "processing" || order.status === "packed" || order.status === "shipped") && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Box Usage
                  </h2>
                </div>
                <span className="text-sm text-gray-500">
                  7Degrees Box Rates
                </span>
              </div>

              {/* Preview for Processing - Shows what will be auto-assigned */}
              {order.status === "processing" && boxSuggestions && (boxSuggestions.totalBottles > 0 || boxSuggestions.totalCans > 0) && boxUsage.length === 0 && (
                <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <p className="text-sm font-semibold text-blue-800">Box Preview</p>
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      Will auto-assign when packed
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-3">
                    Based on {boxSuggestions.totalBottles > 0 ? `${boxSuggestions.totalBottles} bottle${boxSuggestions.totalBottles !== 1 ? "s" : ""}` : ""}
                    {boxSuggestions.totalBottles > 0 && boxSuggestions.totalCans > 0 ? " and " : ""}
                    {boxSuggestions.totalCans > 0 ? `${boxSuggestions.totalCans} can${boxSuggestions.totalCans !== 1 ? "s" : ""}` : ""}:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[...boxSuggestions.bottles, ...boxSuggestions.cans].map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      >
                        <span className="font-medium text-gray-700">{suggestion.qty}x</span>
                        <span className="text-gray-600">{suggestion.name}</span>
                        <span className="text-xs text-gray-400">(${(suggestion.qty * suggestion.price).toFixed(2)})</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm font-medium text-gray-700 mt-3">
                    Estimated Cost: <span className="text-purple-700">${boxSuggestions.estimatedCost.toFixed(2)}</span>
                  </p>
                  {boxSuggestions.hasNonBoxItems && (
                    <p className="text-xs text-amber-600 flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3 h-3" />
                      Some items (kegs, bag-in-box) don't use standard boxes
                    </p>
                  )}
                </div>
              )}

              {/* Auto-Assigned Notice for Packed/Shipped orders with boxes */}
              {(order.status === "packed" || order.status === "shipped") && boxUsage.length > 0 && (
                <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Boxes auto-assigned based on order contents</span>
                </div>
              )}

              {/* Manual Add for Processing - Allow early manual assignment */}
              {order.status === "processing" && boxUsage.length === 0 && boxSuggestions && (boxSuggestions.totalBottles > 0 || boxSuggestions.totalCans > 0) && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-sm font-medium text-gray-700">Or manually assign now:</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[...boxSuggestions.bottles, ...boxSuggestions.cans].map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={async () => {
                          setAddingBox(true);
                          try {
                            const result = await recordBoxUsage(order.id, suggestion.code, suggestion.qty);
                            if (result) {
                              setBoxUsage((prev) => [...prev, result]);
                            }
                          } catch (err) {
                            console.error("Failed to add suggested box:", err);
                          } finally {
                            setAddingBox(false);
                          }
                        }}
                        disabled={addingBox}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm hover:bg-purple-50 transition-colors disabled:opacity-50"
                      >
                        <span className="font-medium text-purple-700">{suggestion.qty}x</span>
                        <span className="text-gray-700">{suggestion.name}</span>
                        <span className="text-xs text-gray-500">(${(suggestion.qty * suggestion.price).toFixed(2)})</span>
                        <Plus className="w-3 h-3 text-purple-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Box Selection Grid - For manual additions */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">
                  {boxUsage.length > 0 ? "Add More Boxes" : "Select Box Type"}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BOX_TYPES.map((box) => (
                    <button
                      key={box.code}
                      onClick={() => setSelectedBoxCode(box.code)}
                      className={`
                        p-3 rounded-lg border-2 text-left transition-all
                        ${selectedBoxCode === box.code
                          ? "border-purple-500 bg-purple-50"
                          : box.isCan
                            ? "border-blue-200 hover:border-blue-400 hover:bg-blue-50"
                            : "border-gray-200 hover:border-purple-300 hover:bg-gray-50"
                        }
                      `}
                    >
                      <p className={`font-medium text-sm ${
                        selectedBoxCode === box.code ? "text-purple-700" : "text-gray-900"
                      }`}>
                        {box.name}
                      </p>
                      <p className={`text-xs ${
                        selectedBoxCode === box.code ? "text-purple-600" : box.isCan ? "text-blue-500" : "text-gray-500"
                      }`}>
                        ${box.price.toFixed(2)}
                        {box.isCan && <span className="ml-1 text-blue-400">(cans)</span>}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity and Add */}
              {selectedBoxCode && (
                <div className="flex gap-2 items-end mb-6 p-4 bg-purple-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setBoxQty(Math.max(1, boxQty - 1))}
                        className="w-10 h-10 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                      >
                        -
                      </button>
                      <Input
                        name="box-qty"
                        type="number"
                        min={1}
                        value={boxQty}
                        onChange={(e) => setBoxQty(parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                      />
                      <button
                        onClick={() => setBoxQty(boxQty + 1)}
                        className="w-10 h-10 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <Button
                    onClick={handleAddBox}
                    disabled={addingBox}
                    loading={addingBox}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add {boxQty} Box{boxQty > 1 ? "es" : ""}
                  </Button>
                </div>
              )}

              {/* Box Usage List */}
              {boxUsage.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">Boxes Used</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Box Type
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Price
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {boxUsage.map((usage) => (
                          <tr key={usage.id}>
                            <td className="px-4 py-2">
                              <p className="font-medium text-gray-900 text-sm">
                                {usage.box_name}
                              </p>
                            </td>
                            <td className="px-4 py-2 text-right text-sm">
                              {usage.quantity}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-600">
                              ${usage.unit_price.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-medium">
                              ${usage.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                            Total Box Cost:
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-bold text-purple-700">
                            ${boxUsage.reduce((sum, u) => sum + u.total, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-gray-500 border border-dashed border-gray-300 rounded-lg">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No boxes recorded yet</p>
                  <p className="text-xs text-gray-400 mt-1">Select a box type above to record usage</p>
                </div>
              )}

              {/* Packing Materials Section */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Packing Materials</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {PACKING_MATERIALS.map((material) => (
                    <button
                      key={material.code}
                      onClick={() => setSelectedMaterialCode(material.code)}
                      className={`
                        p-3 rounded-lg border-2 text-left transition-all
                        ${selectedMaterialCode === material.code
                          ? "border-amber-500 bg-amber-50"
                          : "border-gray-200 hover:border-amber-300 hover:bg-gray-50"
                        }
                      `}
                    >
                      <p className={`font-medium text-sm ${
                        selectedMaterialCode === material.code ? "text-amber-700" : "text-gray-900"
                      }`}>
                        {material.name}
                      </p>
                      <p className={`text-xs ${
                        selectedMaterialCode === material.code ? "text-amber-600" : "text-gray-500"
                      }`}>
                        ${material.price.toFixed(2)} / {material.unit}
                      </p>
                    </button>
                  ))}
                </div>

                {/* Quantity and Add for Materials */}
                {selectedMaterialCode && (
                  <div className="flex gap-2 items-end mb-4 p-4 bg-amber-50 rounded-lg">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setMaterialQty(Math.max(1, materialQty - 1))}
                          className="w-10 h-10 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                        >
                          -
                        </button>
                        <Input
                          name="material-qty"
                          type="number"
                          min={1}
                          value={materialQty}
                          onChange={(e) => setMaterialQty(parseInt(e.target.value) || 1)}
                          className="w-20 text-center"
                        />
                        <button
                          onClick={() => setMaterialQty(materialQty + 1)}
                          className="w-10 h-10 rounded-lg border border-gray-300 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-50"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <Button
                      onClick={handleAddPackingMaterial}
                      disabled={addingMaterial}
                      loading={addingMaterial}
                      className="bg-amber-600 hover:bg-amber-700"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                )}

                {/* Packing Materials Used List */}
                {packingMaterialUsage.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Material
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Qty
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Price
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {packingMaterialUsage.map((usage) => (
                          <tr key={usage.id}>
                            <td className="px-4 py-2">
                              <p className="font-medium text-gray-900 text-sm">
                                {usage.material_name}
                              </p>
                            </td>
                            <td className="px-4 py-2 text-right text-sm">
                              {usage.quantity}
                            </td>
                            <td className="px-4 py-2 text-right text-sm text-gray-600">
                              ${usage.unit_price.toFixed(2)}
                            </td>
                            <td className="px-4 py-2 text-right text-sm font-medium">
                              ${usage.total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm font-medium text-gray-900 text-right">
                            Total Materials Cost:
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-bold text-amber-700">
                            ${packingMaterialUsage.reduce((sum, u) => sum + u.total, 0).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Grand Total & Auto-billing Note */}
              {(boxUsage.length > 0 || packingMaterialUsage.length > 0) && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-semibold text-gray-900">Total Packaging Cost:</span>
                    <span className="text-lg font-bold text-gray-900">
                      ${(boxUsage.reduce((sum, u) => sum + u.total, 0) + packingMaterialUsage.reduce((sum, u) => sum + u.total, 0)).toFixed(2)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    All packaging charges automatically added to client billing
                  </p>
                </div>
              )}
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
                <div className="flex items-center gap-2">
                  <p className="text-2xl font-bold text-gray-900">
                    {order.order_number}
                  </p>
                  {/* Source Badge */}
                  {(order as any).source === "portal" ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-700"
                      title="Portal Order - Customer requested"
                    >
                      <Globe className="w-3 h-3" />
                      Portal
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600"
                      title="Internal Order - Staff created"
                    >
                      <Building2 className="w-3 h-3" />
                      Internal
                    </span>
                  )}
                </div>
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
                  <div className="text-gray-900">
                    <p>{order.ship_to_address}</p>
                    {(order as any).ship_to_address2 && (
                      <p>{(order as any).ship_to_address2}</p>
                    )}
                    {((order as any).ship_to_city || (order as any).ship_to_state || (order as any).ship_to_postal_code) && (
                      <p>
                        {(order as any).ship_to_city && `${(order as any).ship_to_city}, `}
                        {(order as any).ship_to_state} {(order as any).ship_to_postal_code}
                      </p>
                    )}
                    {(order as any).ship_to_country && (order as any).ship_to_country !== "US" && (order as any).ship_to_country !== "USA" && (
                      <p>{(order as any).ship_to_country}</p>
                    )}
                  </div>
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

          {/* Client Service Options - Show if any options are set */}
          {(hasServiceOptions || isRushRequested) && (
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                Service Options
              </h2>
              <div className="space-y-4">
                {/* Rush Processing */}
                {(rushProcessingEnabled || isRushRequested) && (
                  <div className={`p-3 rounded-lg ${isRushRequested ? "bg-red-50 border border-red-200" : "bg-gray-50"}`}>
                    <div className="flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${isRushRequested ? "text-red-600" : "text-gray-400"}`} />
                      <span className="text-sm font-medium text-gray-700">Rush Processing</span>
                      {rushProcessingEnabled && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                          Enabled
                        </span>
                      )}
                      {orderIsRush && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                          From Order
                        </span>
                      )}
                    </div>
                    {isRushRequested ? (
                      <p className="text-sm text-red-700 mt-1 font-medium">
                        {orderIsRush ? "Rush requested by customer" : "Rush requested for this order"}
                      </p>
                    ) : rushProcessingEnabled ? (
                      <p className="text-xs text-gray-500 mt-1">
                        Client has rush processing available
                      </p>
                    ) : null}
                  </div>
                )}

                {/* Packaging / Repack Status */}
                {!orderRequiresRepack && (
                  <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium text-gray-700">Packaging</span>
                      <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                        No Repack
                      </span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      Ship in original cases/packaging (no box fees)
                    </p>
                  </div>
                )}

                {/* Carrier Preference */}
                {effectivePreferredCarrier && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Truck className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Preferred Carrier</span>
                      {orderPreferredCarrier && (
                        <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">
                          From Order
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-blue-800 mt-1 font-semibold">
                      {effectivePreferredCarrier}
                    </p>
                    {order.carrier && order.carrier !== effectivePreferredCarrier && (
                      <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Order carrier differs from preference
                      </p>
                    )}
                  </div>
                )}

                {/* Special Instructions */}
                {specialInstructions && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-medium text-gray-700">Special Instructions</span>
                    </div>
                    <p className="text-sm text-amber-800 whitespace-pre-line">
                      {specialInstructions}
                    </p>
                  </div>
                )}

                {/* No active options message */}
                {!rushProcessingEnabled && !isRushRequested && !effectivePreferredCarrier && !specialInstructions && (
                  <p className="text-sm text-gray-500 text-center py-2">
                    No special service options for this client
                  </p>
                )}
              </div>
            </Card>
          )}

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

              {/* Pick Task Info */}
              {pickTask && (
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Pick Task</span>
                    <Link
                      href={`/tasks/${pickTask.id}`}
                      className="text-xs text-indigo-600 hover:text-indigo-700"
                    >
                      {pickTask.task_number}
                    </Link>
                  </div>
                  <div className="text-xs text-gray-500 space-y-1">
                    <div className="flex justify-between">
                      <span>Items</span>
                      <span>
                        {pickListItems.filter((i) => i.status === "picked").length} / {pickListItems.length} picked
                      </span>
                    </div>
                    {pickListItems.some((i) => i.status === "short") && (
                      <div className="flex justify-between text-amber-600">
                        <span>Short Picks</span>
                        <span>{pickListItems.filter((i) => i.status === "short").length}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Status</span>
                      <span className={`font-medium ${
                        pickTask.status === "completed" ? "text-green-600" :
                        pickTask.status === "in_progress" ? "text-blue-600" :
                        "text-amber-600"
                      }`}>
                        {pickTask.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              )}

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

      {/* Confirm Order Modal with Inventory Check */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => !updating && setShowConfirmModal(false)}
        title="Confirm Order"
      >
        {order && (() => {
          const itemAvailability = order.items.map((item) => {
            const totalAvailable = inventory
              .filter((inv) => inv.product_id === item.product_id)
              .reduce((sum, inv) => sum + inv.qty_on_hand, 0);
            const totalReserved = inventory
              .filter((inv) => inv.product_id === item.product_id)
              .reduce((sum, inv) => sum + (inv.qty_reserved || 0), 0);
            const effectiveAvailable = totalAvailable - totalReserved;
            const shortage = item.qty_requested - effectiveAvailable;

            return {
              item,
              totalAvailable,
              totalReserved,
              effectiveAvailable,
              shortage: shortage > 0 ? shortage : 0,
              status: effectiveAvailable >= item.qty_requested
                ? "sufficient" as const
                : effectiveAvailable > 0
                ? "partial" as const
                : "none" as const,
            };
          });

          const hasShortages = itemAvailability.some((a) => a.status !== "sufficient");
          const hasNoStock = itemAvailability.some((a) => a.status === "none");

          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Review inventory availability before confirming this order.
              </p>

              {hasShortages && (
                <div className={`p-3 rounded-lg border ${
                  hasNoStock ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
                }`}>
                  <div className="flex items-center gap-2">
                    <AlertCircle className={`w-4 h-4 ${hasNoStock ? "text-red-600" : "text-yellow-600"}`} />
                    <p className={`text-sm font-medium ${hasNoStock ? "text-red-800" : "text-yellow-800"}`}>
                      {hasNoStock
                        ? "Some items have no available inventory"
                        : "Some items have insufficient inventory"}
                    </p>
                  </div>
                  <p className={`text-xs mt-1 ml-6 ${hasNoStock ? "text-red-700" : "text-yellow-700"}`}>
                    You can still confirm the order, but fulfillment may be delayed.
                  </p>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Product</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">Requested</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">Available</th>
                      <th className="text-right py-2 px-3 font-medium text-gray-700">Reserved</th>
                      <th className="text-center py-2 px-3 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemAvailability.map(({ item, totalAvailable, totalReserved, effectiveAvailable, shortage, status }) => (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-2 px-3">
                          <div className="font-medium text-gray-900">{item.product?.name || "Unknown"}</div>
                          <div className="text-xs text-gray-500">{item.product?.sku}</div>
                        </td>
                        <td className="py-2 px-3 text-right font-medium">{item.qty_requested}</td>
                        <td className="py-2 px-3 text-right">{totalAvailable}</td>
                        <td className="py-2 px-3 text-right text-gray-500">{totalReserved}</td>
                        <td className="py-2 px-3 text-center">
                          {status === "sufficient" ? (
                            <span className="inline-flex items-center gap-1 text-green-700 bg-green-50 px-2 py-0.5 rounded-full text-xs font-medium">
                              <CheckCircle2 className="w-3 h-3" />
                              OK
                            </span>
                          ) : status === "partial" ? (
                            <span className="inline-flex items-center gap-1 text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full text-xs font-medium">
                              <AlertCircle className="w-3 h-3" />
                              Short {shortage}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-700 bg-red-50 px-2 py-0.5 rounded-full text-xs font-medium">
                              <XCircle className="w-3 h-3" />
                              No stock
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  variant="secondary"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={updating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    const success = await handleStatusUpdate("confirmed");
                    if (success) setShowConfirmModal(false);
                  }}
                  loading={updating}
                  disabled={updating}
                >
                  <ClipboardCheck className="w-4 h-4 mr-2" />
                  {hasShortages ? "Confirm Anyway" : "Confirm Order"}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

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

      {/* Task-driven Pick Scanner Modal */}
      {pickTask && (
        <Modal
          isOpen={showPickScanner}
          onClose={() => setShowPickScanner(false)}
          title="Pick Scanner (Task-Driven)"
          size="lg"
        >
          <PickScanner
            outboundOrderId={orderId}
            locationId={pickTask.source_location_id || shipLocationId}
            taskId={pickTask.id}
            onComplete={() => {
              setShowPickScanner(false);
              fetchOrder();
            }}
          />
        </Modal>
      )}
    </AppShell>
  );
}
