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
import { handleApiError } from "@/lib/utils/error-handler";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import FetchError from "@/components/ui/FetchError";

interface Order {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
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
  const { client, isStaffPreview, availableClients, switchClient } = useClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [staffSelectedClientId, setStaffSelectedClientId] = useState<string>("");
  const [staffAllClients, setStaffAllClients] = useState<{ id: string; company_name: string }[]>([]);
  const [staffClientsLoading, setStaffClientsLoading] = useState(false);
  const [staffClientsError, setStaffClientsError] = useState<string>("");

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const fetchStaffClients = async () => {
    if (!isStaffPreview || !client || isUuid(client.id)) return;
    if (availableClients.length > 0) return; // already have scoped list
    setStaffClientsLoading(true);
    setStaffClientsError("");
    try {
      const res = await fetch("/api/portal/staff-clients");
      const data = await res.json();
      if (!res.ok) {
        setStaffClientsError(data.error || "Failed to load clients");
        setStaffAllClients([]);
      } else {
        setStaffAllClients(data.clients || []);
      }
    } catch (e) {
      setStaffClientsError(e instanceof Error ? e.message : "Failed to load clients");
      setStaffAllClients([]);
    } finally {
      setStaffClientsLoading(false);
    }
  };

  useEffect(() => {
    const loadStaffClients = async () => {
      await fetchStaffClients();
    };
    loadStaffClients();
  }, [isStaffPreview, client, availableClients]);

  const fetchOrders = async (isRefresh = false) => {
    if (!client) return;
    if (!isUuid(client.id)) {
      // Staff preview mode uses a non-UUID sentinel id (e.g. "staff-preview").
      // Prevent invalid UUID errors from Supabase RPC.
      if (isStaffPreview) {
        setOrders([]);
        setError(
          "Staff preview mode: select a client to view their orders (use the client switcher), or open portal with ?view_user=...&view_client=... impersonation."
        );
      } else {
        setOrders([]);
        setError("Invalid client session. Please log in again.");
      }
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      setError(null);
      const supabase = createClient();

      // Get all order IDs this client has access to (primary client OR product owner)
      const { data: orderIds, error: rpcErr } = await supabase
        .rpc("get_client_order_ids", { p_client_id: client.id });

      if (rpcErr) throw rpcErr;

      if (!orderIds || orderIds.length === 0) {
        setOrders([]);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from("outbound_orders")
        .select(`
          id,
          order_number,
          status,
          created_at,
          ship_to_city,
          ship_to_state,
          is_rush,
          tracking_number,
          preferred_carrier,
          items:outbound_items (
            qty_requested
          )
        `)
        .in("id", orderIds)
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;

      const ordersData = (data || []).map((order) => {
        const items = order.items as { qty_requested: number }[];
        return {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          created_at: order.created_at,
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
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  // Staff preview mode client picker (client.id is not a UUID)
  if (error && isStaffPreview && client?.id && !isUuid(client.id)) {
    const options =
      availableClients.length > 0
        ? availableClients.map((a) => ({
            id: a.client_id,
            label: a.client?.company_name || a.client_id,
          }))
        : staffAllClients.map((c) => ({
            id: c.id,
            label: c.company_name || c.id,
          }));
    const selected = staffSelectedClientId || options[0]?.id || "";

    return (
      <div className="max-w-xl mx-auto py-12 px-4 space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="font-semibold text-amber-800">Staff Preview Mode</p>
          <p className="text-sm text-amber-700 mt-1">{error}</p>
        </div>

        {staffClientsError ? (
          <FetchError message={staffClientsError} onRetry={fetchStaffClients} />
        ) : staffClientsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : options.length > 0 ? (
          <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              Select client to view orders
            </label>
            <select
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              aria-label="Select client"
              value={selected}
              onChange={(e) => setStaffSelectedClientId(e.target.value)}
            >
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                if (!selected) return;
                setError(null);
                setLoading(true);
                switchClient(selected);
              }}
            >
              View Orders
            </Button>
          </div>
        ) : (
          <FetchError message="No clients available to preview for this user." />
        )}
      </div>
    );
  }

  if (error) {
    return <FetchError message={error} onRetry={() => fetchOrders()} />;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">My Orders</h1>
          <p className="text-slate-500 mt-1">Track and manage your shipment requests</p>
        </div>
        <Link href="/portal/request-shipment">
          <Button variant="primary" className="gap-2 rounded-lg">
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
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
                ${isActive
                  ? "bg-cyan-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }
              `}
            >
              {tab.label}
              <span
                className={`
                  px-2 py-0.5 rounded-full text-xs
                  ${isActive ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-600"}
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
        <Input
          type="text"
          placeholder="Search by order number or city..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 py-3 rounded-xl border-slate-200"
        />
      </div>

      {/* Orders List */}
      {filteredOrders.length > 0 ? (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
              >
                <div className="p-4">
                  {/* Order Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-bold text-lg text-slate-900">
                          {order.order_number}
                        </span>
                        {order.is_rush && (
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                            Rush
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">
                        Requested {formatDate(order.created_at, "short")}
                      </p>
                    </div>
                    <StatusBadge status={order.status} entityType="outbound" />
                  </div>

                  {/* Order Info Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-3 border-t border-slate-100">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Items</p>
                      <p className="font-semibold text-slate-900">
                        {order.item_count} product{order.item_count !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-slate-500">{order.total_units.toLocaleString()} units</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Destination</p>
                      <p className="font-semibold text-slate-900">
                        {order.ship_to_city}, {order.ship_to_state}
                      </p>
                    </div>
                    {(order.status === "shipped" || order.status === "delivered") && order.tracking_number && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tracking</p>
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-cyan-600" />
                          <span className="font-mono text-sm text-slate-900">{order.tracking_number}</span>
                        </div>
                        {order.carrier && (
                          <p className="text-sm text-slate-500">{order.carrier}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                    Created {formatDate(order.created_at, "short")}
                  </span>
                  <Link href={`/portal/orders/${order.id}`}>
                    <Button variant="ghost" size="sm" className="gap-1 text-cyan-600 hover:text-cyan-700 hover:bg-transparent">
                      View Details
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </Link>
                </div>
              </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          {searchQuery || statusFilter !== "all" ? (
            <>
              <p className="text-lg text-slate-600">No orders match your filters</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="text-cyan-600 hover:text-cyan-700 mt-2"
              >
                Clear all filters
              </Button>
            </>
          ) : (
            <>
              <p className="text-lg text-slate-600 mb-4">No orders yet</p>
              <Link href="/portal/request-shipment">
                <Button variant="primary" className="gap-2 rounded-lg">
                  <Package className="w-4 h-4" />
                  Request Your First Shipment
                </Button>
              </Link>
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-slate-500">
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
          className="gap-2 text-cyan-600 hover:bg-cyan-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>
    </div>
  );
}
