"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  FileText,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";
import { getContainerBadge, getUnitLabel } from "@/lib/labels";
import Breadcrumbs from "@/components/ui/Breadcrumbs";
import FetchError from "@/components/ui/FetchError";
import { handleApiError } from "@/lib/utils/error-handler";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  container_type: string | null;
  qty_requested: number;
  qty_picked: number;
  qty_shipped: number;
  status: string;
  image_url: string | null;
}

interface OrderDetail {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  ship_to_address: string;
  ship_to_address2: string | null;
  ship_to_city: string;
  ship_to_state: string;
  ship_to_zip: string;
  ship_to_country: string;
  notes: string | null;
  is_rush: boolean;
  preferred_carrier: string | null;
  tracking_number: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  client_shipping_cost: number | null;
  items: OrderItem[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: CheckCircle2,
  },
  processing: {
    label: "Processing",
    color: "text-purple-700",
    bgColor: "bg-purple-100",
    icon: Package,
  },
  packed: {
    label: "Packed",
    color: "text-indigo-700",
    bgColor: "bg-indigo-100",
    icon: Package,
  },
  shipped: {
    label: "Shipped",
    color: "text-cyan-700",
    bgColor: "bg-cyan-100",
    icon: Truck,
  },
  delivered: {
    label: "Delivered",
    color: "text-green-700",
    bgColor: "bg-green-100",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-700",
    bgColor: "bg-red-100",
    icon: XCircle,
  },
};

const STATUS_STEPS = ["pending", "confirmed", "processing", "packed", "shipped", "delivered"];

const TIMELINE_STEPS = [
  {
    key: "requested",
    status: "pending",
    label: "Requested",
    description: "Your order has been received and is awaiting confirmation.",
  },
  {
    key: "confirmed",
    status: "confirmed",
    label: "Confirmed",
    description: "Your order has been confirmed and will be processed soon.",
  },
  {
    key: "processing",
    status: "processing",
    label: "Processing",
    description: "Your order is being picked and prepared for packing.",
  },
  {
    key: "packed",
    status: "packed",
    label: "Packed",
    description: "Your order has been packed and is ready for shipment.",
  },
  {
    key: "shipped",
    status: "shipped",
    label: "Shipped",
    description: "Your order is on its way to the destination.",
  },
  {
    key: "delivered",
    status: "delivered",
    label: "Delivered",
    description: "Your order has been delivered successfully.",
  },
];

// Generate tracking URL based on carrier
const getTrackingUrl = (carrier: string | null, trackingNumber: string): string | null => {
  if (!carrier || !trackingNumber) return null;

  const carrierLower = carrier.toLowerCase();

  if (carrierLower.includes("ups")) {
    return `https://www.ups.com/track?tracknum=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes("fedex")) {
    return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes("usps")) {
    return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(trackingNumber)}`;
  }
  if (carrierLower.includes("dhl")) {
    return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(trackingNumber)}`;
  }

  return null;
};

// Get display name for carrier
const getCarrierDisplayName = (carrier: string | null): string => {
  if (!carrier) return "Unknown Carrier";

  const carrierLower = carrier.toLowerCase();
  if (carrierLower.includes("ups")) return "UPS";
  if (carrierLower.includes("fedex")) return "FedEx";
  if (carrierLower.includes("usps")) return "USPS";
  if (carrierLower.includes("dhl")) return "DHL";
  if (carrierLower.includes("freight") || carrierLower.includes("ltl")) return "Freight / LTL";

  return carrier;
};

export default function OrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { client } = useClient();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!client || !orderId) return;

      const supabase = createClient();

      const { data, error: fetchError } = await supabase
        .from("outbound_orders")
        .select(`
          id,
          order_number,
          status,
          created_at,
          ship_to_address,
          ship_to_address2,
          ship_to_city,
          ship_to_state,
          ship_to_zip,
          ship_to_country,
          notes,
          is_rush,
          preferred_carrier,
          tracking_number,
          shipped_date,
          delivered_date,
          client_shipping_cost,
          client_id,
          is_multi_client,
          items:outbound_items (
            id,
            qty_requested,
            qty_shipped,
            product:products (
              id,
              name,
              sku,
              image_url,
              client_id,
              container_type
            )
          )
        `)
        .eq("id", orderId)
        .single();

      if (fetchError || !data) {
        setError(handleApiError(fetchError || "Order not found"));
        setLoading(false);
        return;
      }

      // Validate client access: primary client OR has items via product ownership
      const isPrimaryClient = data.client_id === client.id;
      const hasOwnedItems = (data.items || []).some((item: any) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        return product?.client_id === client.id;
      });

      if (!isPrimaryClient && !hasOwnedItems) {
        setError("You don't have permission to view this order");
        setLoading(false);
        return;
      }

      // Filter items to only show this client's products for multi-client orders
      const allItems = data.items || [];
      const visibleItems = data.is_multi_client
        ? allItems.filter((item: any) => {
            const product = Array.isArray(item.product) ? item.product[0] : item.product;
            return product?.client_id === client.id;
          })
        : allItems;

      // Transform data
      const orderDetail: OrderDetail = {
        id: data.id,
        order_number: data.order_number,
        status: data.status,
        created_at: data.created_at,
        ship_to_address: data.ship_to_address,
        ship_to_address2: data.ship_to_address2,
        ship_to_city: data.ship_to_city,
        ship_to_state: data.ship_to_state,
        ship_to_zip: data.ship_to_zip,
        ship_to_country: data.ship_to_country,
        notes: data.notes,
        is_rush: data.is_rush || false,
        preferred_carrier: data.preferred_carrier,
        tracking_number: data.tracking_number,
        shipped_date: data.shipped_date,
        delivered_date: data.delivered_date,
        client_shipping_cost: data.client_shipping_cost ?? null,
        items: visibleItems.map((item: {
          id: string;
          qty_requested: number;
          qty_shipped: number;
          product: { id: string; name: string; sku: string; image_url: string | null; client_id?: string | null; container_type?: string | null } | { id: string; name: string; sku: string; image_url: string | null; client_id?: string | null; container_type?: string | null }[];
        }) => {
          const product = Array.isArray(item.product) ? item.product[0] : item.product;
          const qtyShipped = item.qty_shipped || 0;
          return {
            id: item.id,
            product_id: product?.id || "",
            product_name: product?.name || "Unknown",
            sku: product?.sku || "",
            container_type: product?.container_type || null,
            qty_requested: item.qty_requested,
            qty_picked: qtyShipped,
            qty_shipped: qtyShipped,
            status: qtyShipped >= item.qty_requested ? "shipped" : qtyShipped > 0 ? "partial" : "pending",
            image_url: product?.image_url || null,
          };
        }),
      };

      setOrder(orderDetail);
      setLoading(false);
    };

    fetchOrder();
  }, [client, orderId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const copyTrackingNumber = async () => {
    if (order?.tracking_number) {
      await navigator.clipboard.writeText(order.tracking_number);
      setCopiedTracking(true);
      setTimeout(() => setCopiedTracking(false), 2000);
    }
  };

  const getCurrentStepIndex = () => {
    if (!order) return -1;
    if (order.status === "cancelled") return -1;
    return TIMELINE_STEPS.findIndex((step) => step.status === order.status);
  };

  const unitBreakdown = (() => {
    if (!order) return "";
    const grouped: Record<string, number> = {};
    for (const item of order.items) {
      const label = getUnitLabel(item.container_type);
      grouped[label] = (grouped[label] || 0) + item.qty_requested;
    }
    return Object.entries(grouped)
      .map(([label, qty]) => `${qty.toLocaleString()} ${label}`)
      .join(", ");
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-cyan-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          homeHref="/portal"
          items={[
            { label: "Orders", href: "/portal/orders" },
            { label: "Error" },
          ]}
        />
        <FetchError message={error || "We couldn't find the order you're looking for."} />
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const currentStepIndex = getCurrentStepIndex();

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs
        homeHref="/portal"
        items={[
          { label: "Orders", href: "/portal/orders" },
          { label: order.order_number },
        ]}
      />

      {/* Order Header */}
      <div className="bg-white rounded-lg border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-semibold text-slate-900 font-mono">
                {order.order_number}
              </h1>
              {order.is_rush && (
                <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                  Rush Order
                </span>
              )}
            </div>
            <p className="text-slate-500">
              Requested on {formatDateTime(order.created_at)}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
          >
            <StatusIcon className="w-4 h-4" />
            {statusConfig.label}
          </span>
        </div>
      </div>

      {/* Status Timeline */}
      {order.status !== "cancelled" && (
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-6">Order Progress</h2>

          {/* Vertical Timeline */}
          <div className="relative">
            {TIMELINE_STEPS.map((step, index) => {
              const isCompleted = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const isPending = index > currentStepIndex;
              const isLast = index === TIMELINE_STEPS.length - 1;

              // Get date for this step
              let stepDate: string | null = null;
              if (step.key === "requested") {
                stepDate = order.created_at;
              } else if (step.key === "shipped" && order.shipped_date) {
                stepDate = order.shipped_date;
              } else if (step.key === "delivered" && order.delivered_date) {
                stepDate = order.delivered_date;
              }

              return (
                <div key={step.key} className="relative flex gap-4">
                  {/* Vertical Line */}
                  {!isLast && (
                    <div
                      className={`absolute left-[15px] top-8 w-0.5 h-full ${
                        isCompleted && index < currentStepIndex ? "bg-green-500" : "bg-slate-200"
                      }`}
                    />
                  )}

                  {/* Circle/Check */}
                  <div className="relative z-10 flex-shrink-0">
                    {isCompleted ? (
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          isCurrent
                            ? "bg-cyan-600 text-white ring-4 ring-cyan-100"
                            : "bg-green-500 text-white"
                        }`}
                      >
                        <Check className="w-4 h-4" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className={`flex-1 pb-8 ${isLast ? "pb-0" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-medium ${
                          isCurrent
                            ? "text-cyan-600"
                            : isCompleted
                            ? "text-slate-900"
                            : "text-slate-400"
                        }`}
                      >
                        {step.label}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 text-xs font-medium rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${isPending ? "text-slate-400" : "text-slate-500"}`}>
                      {isCompleted ? (
                        stepDate ? formatDate(stepDate) : "Completed"
                      ) : (
                        "Pending"
                      )}
                    </p>
                    {isCurrent && (
                      <p className="text-sm text-slate-600 mt-2 bg-slate-50 p-3 rounded-lg">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cancelled Status */}
      {order.status === "cancelled" && (
        <div className="bg-red-50 rounded-lg border border-red-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900">Order Cancelled</h3>
              <p className="text-sm text-red-700">This order has been cancelled and will not be processed.</p>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Info */}
      {(order.status === "shipped" || order.status === "delivered") && order.tracking_number && (() => {
        const trackingUrl = getTrackingUrl(order.preferred_carrier, order.tracking_number);
        const carrierName = getCarrierDisplayName(order.preferred_carrier);

        return (
          <div className="bg-cyan-50 rounded-lg border border-cyan-200 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Truck className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-cyan-900">Shipping Information</h3>
                  <div className="mt-3 space-y-2">
                    {/* Carrier */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-cyan-700">Carrier:</span>
                      <span className="font-medium text-cyan-900">{carrierName}</span>
                    </div>

                    {/* Tracking Number */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-cyan-700">Tracking:</span>
                      <span className="font-mono font-medium text-cyan-900 bg-cyan-100 px-2 py-0.5 rounded">
                        {order.tracking_number}
                      </span>
                      <button
                        onClick={copyTrackingNumber}
                        className="p-1 hover:bg-cyan-100 rounded transition-colors"
                        title="Copy tracking number"
                      >
                        {copiedTracking ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4 text-cyan-600" />
                        )}
                      </button>
                    </div>

                    {/* Dates */}
                    {order.shipped_date && (
                      <p className="text-sm text-cyan-700">
                        Shipped: <span className="font-medium text-cyan-900">{formatDateTime(order.shipped_date)}</span>
                      </p>
                    )}
                    {order.delivered_date && (
                      <p className="text-sm text-cyan-700">
                        Delivered: <span className="font-medium text-cyan-900">{formatDateTime(order.delivered_date)}</span>
                      </p>
                    )}
                    {order.client_shipping_cost != null && (
                      <div className="flex items-center gap-2 pt-2 mt-2 border-t border-cyan-200">
                        <span className="text-sm text-cyan-700">Shipping Cost:</span>
                        <span className="font-semibold text-cyan-900">${order.client_shipping_cost.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Track Package Button */}
              {trackingUrl ? (
                <a
                  href={trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-cyan-600 text-white font-medium rounded-xl hover:bg-cyan-700 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  Track Package
                </a>
              ) : (
                <div className="text-sm text-cyan-600 bg-cyan-100 px-3 py-2 rounded-lg">
                  Use tracking number above to track your package on the carrier&apos;s website
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-900">Order Items</h2>
              </div>
              <span className="text-sm text-slate-500">
                {order.items.length} item{order.items.length !== 1 ? "s" : ""} | {unitBreakdown}
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {order.items.map((item) => {
              const isPartiallyShipped = item.qty_shipped > 0 && item.qty_shipped < item.qty_requested;
              const isFullyShipped = item.qty_shipped >= item.qty_requested;

              return (
                <div key={item.id} className="p-4 flex items-center gap-4">
                  {/* Product Image */}
                  <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.product_name}
                        width={64}
                        height={64}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      <Package className="w-6 h-6 text-slate-400" />
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{item.product_name}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-500 font-mono">{item.sku}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getContainerBadge(item.container_type).color}`}>
                        {getContainerBadge(item.container_type).label}
                      </span>
                    </div>
                  </div>

                  {/* Quantities */}
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-3">
                      {/* Qty Requested */}
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide">Requested</p>
                        <p className="font-semibold text-slate-900">
                          {item.qty_requested.toLocaleString()} <span className="text-xs font-normal text-slate-500">{getUnitLabel(item.container_type)}</span>
                        </p>
                      </div>

                      {/* Qty Shipped (if applicable) */}
                      {(order.status === "shipped" || order.status === "delivered" || item.qty_shipped > 0) && (
                        <div className="pl-3 border-l border-slate-200">
                          <p className="text-xs text-slate-500 uppercase tracking-wide">Shipped</p>
                          <p className={`font-semibold ${isPartiallyShipped ? "text-yellow-600" : isFullyShipped ? "text-green-600" : "text-slate-400"}`}>
                            {item.qty_shipped > 0 ? (
                              <>{item.qty_shipped.toLocaleString()} <span className="text-xs font-normal">{getUnitLabel(item.container_type)}</span></>
                            ) : "\u2014"}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Partial shipment warning */}
                    {isPartiallyShipped && (
                      <p className="text-xs text-yellow-600 mt-1">
                        Partial shipment ({item.qty_requested - item.qty_shipped} remaining)
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shipping Address & Notes */}
        <div className="space-y-6">
          {/* Shipping Address */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-900">Shipping Address</h2>
              </div>
            </div>
            <div className="p-4">
              <p className="text-slate-900">{order.ship_to_address}</p>
              {order.ship_to_address2 && (
                <p className="text-slate-900">{order.ship_to_address2}</p>
              )}
              <p className="text-slate-900">
                {order.ship_to_city}, {order.ship_to_state} {order.ship_to_zip}
              </p>
              <p className="text-slate-500">{order.ship_to_country}</p>
            </div>
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <h2 className="font-semibold text-slate-900">Special Instructions</h2>
                </div>
              </div>
              <div className="p-4">
                <p className="text-slate-700 text-sm">{order.notes}</p>
              </div>
            </div>
          )}

          {/* Order Info */}
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                <h2 className="font-semibold text-slate-900">Order Details</h2>
              </div>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Order ID</span>
                <span className="font-mono text-slate-900 text-xs">{order.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Created</span>
                <span className="text-slate-900">{formatDate(order.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Last Updated</span>
                <span className="text-slate-900">{formatDate(order.created_at)}</span>
              </div>
              {order.preferred_carrier && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Preferred Carrier</span>
                  <span className="text-slate-900">{order.preferred_carrier}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
