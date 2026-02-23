"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Search,
  Truck,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";
import { formatDate } from "@/lib/utils/formatting";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
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
        <Link href="/portal/request-shipment">
          <Button variant="primary" className="gap-2 rounded-xl">
            <Package className="w-4 h-4" />
            New Shipment
          </Button>
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
        <Input
          type="text"
          placeholder="Search by order number or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 py-3 rounded-xl border-gray-200"
        />
      </div>

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
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
                        Requested {formatDate(order.created_at, "short")}
                      </p>
                    </div>
                    <StatusBadge status={order.status} entityType="outbound" />
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
                    Last updated {formatDate(order.updated_at, "short")}
                  </span>
                  <Link href={`/portal/orders/${order.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-blue-600 hover:text-blue-700 hover:bg-transparent">
                      View Details
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          {searchQuery || statusFilter !== "all" ? (
            <>
              <p className="text-lg text-gray-600">No orders match your filters</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-blue-600 hover:text-blue-700 mt-2"
              >
                Clear all filters
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg text-gray-600 mb-4">No orders yet</p>
              <Link href="/portal/request-shipment">
                <Button variant="primary" className="gap-2 rounded-xl">
                  <Package className="w-4 h-4" />
                  Request Your First Shipment
                </Button>
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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="gap-2 text-blue-600 hover:bg-blue-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
