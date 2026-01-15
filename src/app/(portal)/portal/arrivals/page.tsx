"use client";

import { useEffect, useState } from "react";
import {
  PackageOpen,
  Search,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  ChevronRight,
  RefreshCw,
  Calendar,
  ChevronDown,
  X,
  Package,
  User,
  FileText,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";

interface InboundOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  expected_date: string | null;
  received_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  item_count: number;
  total_units: number;
}

interface ArrivalDetail {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  received_at: string | null;
  expected_date: string | null;
  carrier: string | null;
  tracking_number: string | null;
  notes: string | null;
  received_by: string | null;
  items: {
    id: string;
    product_name: string;
    sku: string;
    qty_expected: number;
    qty_received: number;
  }[];
}

type StatusFilter = "all" | "pending" | "received";

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  pending: {
    label: "Pending",
    color: "text-yellow-700",
    bgColor: "bg-yellow-100",
    icon: Clock,
  },
  in_transit: {
    label: "In Transit",
    color: "text-blue-700",
    bgColor: "bg-blue-100",
    icon: Truck,
  },
  received: {
    label: "Received",
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
  { value: "all", label: "All Arrivals" },
  { value: "pending", label: "Pending" },
  { value: "received", label: "Received" },
];

type DateFilter = "this_week" | "this_month" | "last_30_days" | "all_time";

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "all_time", label: "All Time" },
];

const getDateFilterRange = (filter: DateFilter): Date | null => {
  const now = new Date();

  switch (filter) {
    case "this_week": {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      return startOfWeek;
    }
    case "this_month": {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);
      return startOfMonth;
    }
    case "last_30_days": {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      return thirtyDaysAgo;
    }
    case "all_time":
    default:
      return null;
  }
};

export default function PortalArrivalsPage() {
  const { client } = useClient();
  const [arrivals, setArrivals] = useState<InboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("last_30_days");
  const [selectedArrival, setSelectedArrival] = useState<ArrivalDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchArrivalDetail = async (arrivalId: string) => {
    setModalLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase
      .from("inbound_orders")
      .select(`
        id,
        order_number,
        status,
        created_at,
        received_at,
        expected_date,
        carrier,
        tracking_number,
        notes,
        received_by,
        items:inbound_items (
          id,
          qty_expected,
          qty_received,
          product:products (
            name,
            sku
          )
        )
      `)
      .eq("id", arrivalId)
      .single();

    if (error || !data) {
      console.error("Error fetching arrival detail:", error);
      setModalLoading(false);
      return;
    }

    const detail: ArrivalDetail = {
      id: data.id,
      order_number: data.order_number,
      status: data.status,
      created_at: data.created_at,
      received_at: data.received_at,
      expected_date: data.expected_date,
      carrier: data.carrier,
      tracking_number: data.tracking_number,
      notes: data.notes,
      received_by: data.received_by,
      items: (data.items || []).map((item: {
        id: string;
        qty_expected: number;
        qty_received: number;
        product: { name: string; sku: string } | { name: string; sku: string }[];
      }) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        return {
          id: item.id,
          product_name: product?.name || "Unknown",
          sku: product?.sku || "",
          qty_expected: item.qty_expected || 0,
          qty_received: item.qty_received || 0,
        };
      }),
    };

    setSelectedArrival(detail);
    setModalLoading(false);
  };

  const closeModal = () => {
    setSelectedArrival(null);
  };

  const fetchArrivals = async (isRefresh = false) => {
    if (!client) return;

    if (isRefresh) {
      setRefreshing(true);
    }

    const supabase = createClient();

    const { data } = await supabase
      .from("inbound_orders")
      .select(`
        id,
        order_number,
        status,
        created_at,
        updated_at,
        expected_date,
        received_at,
        carrier,
        tracking_number,
        items:inbound_items (
          qty_expected
        )
      `)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    const arrivalsData = (data || []).map((order) => {
      const items = order.items as { qty_expected: number }[];
      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
        expected_date: order.expected_date,
        received_at: order.received_at,
        carrier: order.carrier,
        tracking_number: order.tracking_number,
        item_count: items.length,
        total_units: items.reduce((sum, item) => sum + (item.qty_expected || 0), 0),
      };
    });

    setArrivals(arrivalsData);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchArrivals();
  }, [client]);

  const filteredArrivals = arrivals.filter((order) => {
    const matchesSearch =
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);

    let matchesStatus = true;
    if (statusFilter === "pending") {
      matchesStatus = order.status === "pending" || order.status === "in_transit";
    } else if (statusFilter === "received") {
      matchesStatus = order.status === "received";
    }

    // Date filter - use received_at for received orders, created_at for others
    let matchesDate = true;
    const dateRangeStart = getDateFilterRange(dateFilter);
    if (dateRangeStart) {
      const orderDate = order.received_at ? new Date(order.received_at) : new Date(order.created_at);
      matchesDate = orderDate >= dateRangeStart;
    }

    return matchesSearch && matchesStatus && matchesDate;
  });

  const getStatusCounts = () => {
    const counts: Record<string, number> = {
      all: arrivals.length,
      pending: 0,
      received: 0,
    };
    arrivals.forEach((order) => {
      if (order.status === "pending" || order.status === "in_transit") {
        counts.pending += 1;
      } else if (order.status === "received") {
        counts.received += 1;
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Arrivals</h1>
        <p className="text-gray-500 mt-1">Inventory received at 7 Degrees</p>
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

      {/* Search and Date Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order number or tracking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Date Filter */}
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            className="appearance-none w-full sm:w-48 pl-10 pr-10 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
          >
            {DATE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Arrivals List */}
      {filteredArrivals.length > 0 ? (
        <div className="space-y-3">
          {filteredArrivals.map((order) => {
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
                      </div>
                      <p className="text-sm text-gray-500">
                        Created {formatDate(order.created_at)}
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-t border-gray-100">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Items</p>
                      <p className="font-semibold text-gray-900">
                        {order.item_count} product{order.item_count !== 1 ? "s" : ""}
                      </p>
                      <p className="text-sm text-gray-500">{order.total_units.toLocaleString()} units</p>
                    </div>

                    {order.expected_date && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected</p>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{formatDate(order.expected_date)}</span>
                        </div>
                      </div>
                    )}

                    {order.received_at && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Received</p>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <span className="font-medium text-gray-900">{formatDate(order.received_at)}</span>
                        </div>
                      </div>
                    )}

                    {order.tracking_number && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tracking</p>
                        <div className="flex items-center gap-1.5">
                          <Truck className="w-4 h-4 text-gray-400" />
                          <span className="font-mono text-sm text-gray-900 truncate">{order.tracking_number}</span>
                        </div>
                        {order.carrier && (
                          <p className="text-xs text-gray-500">{order.carrier}</p>
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
                  <button
                    onClick={() => fetchArrivalDetail(order.id)}
                    className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    View Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <PackageOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          {searchQuery || statusFilter !== "all" || dateFilter !== "all_time" ? (
            <>
              <p className="text-lg text-gray-600">No arrivals match your filters</p>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setDateFilter("all_time");
                }}
                className="text-blue-600 hover:underline mt-2"
              >
                Clear all filters
              </button>
            </>
          ) : (
            <p className="text-lg text-gray-600">No arrivals recorded yet</p>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>
          {filteredArrivals.length > 0 && (
            <>Showing {filteredArrivals.length} of {arrivals.length} arrivals</>
          )}
        </span>
        <button
          onClick={() => fetchArrivals(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Detail Modal */}
      {(selectedArrival || modalLoading) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={closeModal}
          />

          {/* Modal */}
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {modalLoading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                </div>
              ) : selectedArrival && (
                <>
                  {/* Modal Header */}
                  <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 font-mono">
                        {selectedArrival.order_number}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {selectedArrival.status === "received"
                          ? `Received on ${formatDate(selectedArrival.received_at!)}`
                          : `Created on ${formatDate(selectedArrival.created_at)}`}
                      </p>
                    </div>
                    <button
                      onClick={closeModal}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
                    {/* Status Badge */}
                    <div className="flex items-center gap-3">
                      {(() => {
                        const config = STATUS_CONFIG[selectedArrival.status] || STATUS_CONFIG.pending;
                        const Icon = config.icon;
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
                            <Icon className="w-4 h-4" />
                            {config.label}
                          </span>
                        );
                      })()}
                      {selectedArrival.tracking_number && (
                        <span className="text-sm text-gray-500">
                          Tracking: <span className="font-mono">{selectedArrival.tracking_number}</span>
                        </span>
                      )}
                    </div>

                    {/* Products List */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-gray-500" />
                        <h3 className="font-semibold text-gray-900">
                          Products Received ({selectedArrival.items.length})
                        </h3>
                      </div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">
                                Product
                              </th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                                Expected
                              </th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">
                                Received
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedArrival.items.map((item) => {
                              const isShort = item.qty_received < item.qty_expected;
                              const isOver = item.qty_received > item.qty_expected;
                              return (
                                <tr key={item.id} className="border-b border-gray-100 last:border-0">
                                  <td className="py-3 px-4">
                                    <p className="font-medium text-gray-900">{item.product_name}</p>
                                    <p className="text-sm text-gray-500 font-mono">{item.sku}</p>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className="text-gray-600">{item.qty_expected.toLocaleString()}</span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <span className={`font-semibold ${isShort ? "text-yellow-600" : isOver ? "text-blue-600" : "text-green-600"}`}>
                                      {item.qty_received.toLocaleString()}
                                    </span>
                                    {isShort && (
                                      <p className="text-xs text-yellow-600">
                                        Short {item.qty_expected - item.qty_received}
                                      </p>
                                    )}
                                    {isOver && (
                                      <p className="text-xs text-blue-600">
                                        Over {item.qty_received - item.qty_expected}
                                      </p>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 border-t border-gray-200">
                              <td className="py-3 px-4 font-medium text-gray-700">Total</td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-900">
                                {selectedArrival.items.reduce((sum, item) => sum + item.qty_expected, 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-gray-900">
                                {selectedArrival.items.reduce((sum, item) => sum + item.qty_received, 0).toLocaleString()}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>

                    {/* Received By */}
                    {selectedArrival.received_by && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-500" />
                          <h3 className="font-semibold text-gray-900">Received By</h3>
                        </div>
                        <p className="text-gray-700 bg-gray-50 px-4 py-3 rounded-xl">
                          {selectedArrival.received_by}
                        </p>
                      </div>
                    )}

                    {/* Notes */}
                    {selectedArrival.notes && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-4 h-4 text-gray-500" />
                          <h3 className="font-semibold text-gray-900">Notes</h3>
                        </div>
                        <p className="text-gray-700 bg-gray-50 px-4 py-3 rounded-xl whitespace-pre-wrap">
                          {selectedArrival.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <button
                      onClick={closeModal}
                      className="px-4 py-2 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
