"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";

interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  ship_to_city: string;
  ship_to_state: string;
  is_rush: boolean;
  item_count: number;
  total_units: number;
  tracking_number: string | null;
  carrier: string | null;
}

type StatusFilter = "all" | "active" | "completed";

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

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Orders" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

const ACTIVE_STATUSES = ["pending", "confirmed", "processing", "packed", "shipped"];

export default function PortalOrdersPage() {
  const { client } = useClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchOrders = async (isRefresh = false) => {
    if (!client) return;

    if (isRefresh) {
      setRefreshing(true);
    }

    const supabase = createClient();

    const { data } = await supabase
      .from("outbound_orders")
      .select(`
        id,
        order_number,
        status,
        created_at,
        updated_at,
        ship_to_city,
        ship_to_state,
        is_rush,
        tracking_number,
        preferred_carrier,
        items:outbound_items (
          qty_requested
        )
      `)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    const ordersData = (data || []).map((order) => {
      const items = order.items as { qty_requested: number }[];
      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        ship_to_city: order.ship_to_city,
        ship_to_state: order.ship_to_state,
        is_rush: order.is_rush || false,
        item_count: items.length,
        total_units: items.reduce((sum, item) => sum + item.qty_requested, 0),
        tracking_number: order.tracking_number || null,
        carrier: order.preferred_carrier || null,
      };
    });

    setOrders(ordersData);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchOrders();
  }, [client]);

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.ship_to_city.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === "active") {
      matchesStatus = ACTIVE_STATUSES.includes(order.status);
    } else if (statusFilter === "completed") {
      matchesStatus = order.status === "delivered";
    }

    return matchesSearch && matchesStatus;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = {
      all: orders.length,
      active: 0,
      completed: 0,
    };
    orders.forEach((order) => {
      if (ACTIVE_STATUSES.includes(order.status)) {
        counts.active += 1;
      } else if (order.status === "delivered") {
        counts.completed += 1;
      }
    });
    return counts;
  };

  const statusCounts = getStatusCounts();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
          <p className="text-gray-500 mt-1">Track and manage your shipment requests</p>
        </div>
        <Link
          href="/portal/request-shipment"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <Package className="w-4 h-4" />
          New Shipment
        </Link>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => {
          const count = statusCounts[tab.value] || 0;
          const isActive = statusFilter === tab.value;

          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors
                ${isActive
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }
              `}
            >
              {tab.label}
              <span
                className={`
                  px-2 py-0.5 rounded-full text-xs
                  ${isActive ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600"}
                `}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by order number or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md hover:border-gray-300 transition-all"
              >
                <div className="p-4">
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-bold text-lg text-gray-900">
                          {order.order_number}
                        </span>
                        {order.is_rush && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                            Rush
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        Requested {formatDate(order.created_at)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusConfig.label}
                    </span>
                  </div>

                  {/* Order Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Items</p>
                      <p className="font-semibold text-gray-900">
                        {order.item_count} product{order.item_count !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-gray-500">{order.total_units.toLocaleString()} units</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Destination</p>
                      <p className="font-semibold text-gray-900">
                        {order.ship_to_city}, {order.ship_to_state}
                      </p>
                    </div>
                    {(order.status === "shipped" || order.status === "delivered") && order.tracking_number && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tracking</p>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-cyan-600" />
                          <span className="font-mono text-sm text-gray-900">{order.tracking_number}</span>
                        </div>
                        {order.carrier && (
                          <p className="text-sm text-gray-500">{order.carrier}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    Last updated {formatDate(order.updated_at)}
                  </span>
                  <Link
                    href={`/portal/orders/${order.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          {searchQuery || statusFilter !== "all" ? (
            <>
              <p className="text-lg text-gray-600">No orders match your filters</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-blue-600 hover:underline mt-2"
              >
                Clear all filters
              </button>
            </>
          ) : (
            <>
              <p className="text-lg text-gray-600 mb-4">No orders yet</p>
              <Link
                href="/portal/request-shipment"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                <Package className="w-4 h-4" />
                Request Your First Shipment
              </Link>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {filteredOrders.length > 0 && (
            <>Showing {filteredOrders.length} of {orders.length} orders</>
          )}
        </span>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>
  );
}
