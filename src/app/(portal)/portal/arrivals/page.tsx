"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  PackageOpen,
  Search,
  CheckCircle2,
  Truck,
  ChevronRight,
  RefreshCw,
  Calendar,
  Package,
  User,
  FileText,
  Clock,
  CalendarPlus,
  AlertCircle,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import { createClient } from "@/lib/supabase";
import { formatDate } from "@/lib/utils/formatting";
import { handleApiError } from "@/lib/utils/error-handler";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import StatusBadge from "@/components/ui/StatusBadge";
import Table from "@/components/ui/Table";
import FetchError from "@/components/ui/FetchError";
import ScheduleArrivalForm from "@/components/portal/ScheduleArrivalForm";

interface InboundOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  received_date: string | null;
  expected_date: string | null;
  carrier: string | null;
  tracking_number: string | null;
  item_count: number;
  total_units: number;
  appointment_status: string | null;
  appointment_rejection_reason: string | null;
}

interface ArrivalDetail {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  received_date: string | null;
  expected_date: string | null;
  carrier: string | null;
  tracking_number: string | null;
  preferred_time_slot: string | null;
  notes: string | null;
  received_by: string | null;
  appointment_status: string | null;
  appointment_rejection_reason: string | null;
  items: {
    id: string;
    product_name: string;
    sku: string;
    qty_expected: number;
    qty_received: number;
  }[];
}

interface ArrivalItem {
  id: string;
  product_name: string;
  sku: string;
  qty_expected: number;
  qty_received: number;
}

type StatusFilter = "all" | "pending" | "received";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Arrivals" },
  { value: "pending", label: "Pending" },
  { value: "received", label: "Received" },
];

type DateFilter = "this_week" | "this_month" | "last_30_days" | "all_time";

const DATE_FILTER_OPTIONS: { value: string; label: string }[] = [
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

const arrivalItemColumns: {
  key: string;
  header: React.ReactNode;
  render?: (item: ArrivalItem) => React.ReactNode;
  hideOnMobile?: boolean;
  mobilePriority?: number;
  align?: "left" | "center" | "right";
}[] = [
  {
    key: "product",
    header: "Product",
    mobilePriority: 1,
    render: (item: ArrivalItem) => (
      <div>
        <p className="font-medium text-slate-900">{item.product_name}</p>
        <p className="text-sm text-slate-500 font-mono">{item.sku}</p>
      </div>
    ),
  },
  {
    key: "qty_expected",
    header: "Expected",
    align: "right" as const,
    render: (item: ArrivalItem) => (
      <span className="text-slate-600">{item.qty_expected.toLocaleString()}</span>
    ),
  },
  {
    key: "qty_received",
    header: "Received",
    align: "right" as const,
    render: (item: ArrivalItem) => {
      const isShort = item.qty_received < item.qty_expected;
      const isOver = item.qty_received > item.qty_expected;
      return (
        <div>
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
        </div>
      );
    },
  },
];

type PageTab = "arrivals" | "schedule";

export default function PortalArrivalsPage() {
  const { client } = useClient();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<PageTab>(
    searchParams.get("tab") === "schedule" ? "schedule" : "arrivals"
  );
  const [arrivals, setArrivals] = useState<InboundOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("last_30_days");
  const [selectedArrival, setSelectedArrival] = useState<ArrivalDetail | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchArrivalDetail = async (arrivalId: string) => {
    setModalLoading(true);

    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("inbound_orders")
      .select(`
        id,
        order_number,
        status,
        created_at,
        received_date,
        expected_date,
        carrier,
        tracking_number,
        preferred_time_slot,
        notes,
        received_by,
        appointment_status,
        appointment_rejection_reason,
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

    if (fetchError || !data) {
      handleApiError(fetchError);
      setModalLoading(false);
      return;
    }

    const detail: ArrivalDetail = {
      id: data.id,
      order_number: data.order_number,
      status: data.status,
      created_at: data.created_at,
      received_date: data.received_date,
      expected_date: data.expected_date,
      carrier: data.carrier,
      tracking_number: data.tracking_number,
      preferred_time_slot: data.preferred_time_slot,
      notes: data.notes,
      received_by: data.received_by,
      appointment_status: data.appointment_status,
      appointment_rejection_reason: data.appointment_rejection_reason,
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

    setError(null);

    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("inbound_orders")
      .select(`
        id,
        order_number,
        status,
        created_at,
        received_date,
        expected_date,
        carrier,
        tracking_number,
        appointment_status,
        appointment_rejection_reason,
        items:inbound_items (
          qty_expected
        )
      `)
      .eq("client_id", client.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      const message = handleApiError(fetchError);
      setError(message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const arrivalsData = (data || []).map((order) => {
      const items = order.items as { qty_expected: number }[];
      return {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        created_at: order.created_at,
        received_date: order.received_date,
        expected_date: order.expected_date,
        carrier: order.carrier,
        tracking_number: order.tracking_number,
        item_count: items.length,
        total_units: items.reduce((sum, item) => sum + (item.qty_expected || 0), 0),
        appointment_status: order.appointment_status as string | null,
        appointment_rejection_reason: order.appointment_rejection_reason as string | null,
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

    // Date filter - use received_date for received orders, created_at for others
    let matchesDate = true;
    const dateRangeStart = getDateFilterRange(dateFilter);
    if (dateRangeStart) {
      const orderDate = order.received_date ? new Date(order.received_date) : new Date(order.created_at);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    );
  }

  const handleScheduleSuccess = () => {
    setActiveTab("arrivals");
    fetchArrivals(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Arrivals</h1>
        <p className="text-slate-500 mt-1">Inventory received at 7 Degrees</p>
      </div>

      {/* Page Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("arrivals")}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
            ${activeTab === "arrivals"
              ? "border-cyan-500 text-cyan-700"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }
          `}
        >
          <PackageOpen className="w-4 h-4" />
          Arrivals
        </button>
        <button
          onClick={() => setActiveTab("schedule")}
          className={`
            flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
            ${activeTab === "schedule"
              ? "border-cyan-500 text-cyan-700"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }
          `}
        >
          <CalendarPlus className="w-4 h-4" />
          Book Dock Appointment
        </button>
      </div>

      {/* Schedule Tab */}
      {activeTab === "schedule" && (
        <ScheduleArrivalForm onSuccess={handleScheduleSuccess} />
      )}

      {/* Arrivals Tab */}
      {activeTab === "arrivals" && (
        <>
      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((tab) => {
          const count = statusCounts[tab.value] || 0;
          const isActive = statusFilter === tab.value;

          return (
            <Button
              key={tab.value}
              variant={isActive ? "primary" : "secondary"}
              size="sm"
              onClick={() => setStatusFilter(tab.value)}
              className="rounded-lg whitespace-nowrap"
            >
              {tab.label}
              <span
                className={`
                  ml-2 px-2 py-0.5 rounded-full text-xs
                  ${isActive ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-600"}
                `}
              >
                {count}
              </span>
            </Button>
          );
        })}
      </div>

      {/* Search and Date Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10 pointer-events-none" />
          <Input
            type="text"
            placeholder="Search by order number or tracking..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Date Filter */}
        <div className="sm:w-48">
          <Select
            name="dateFilter"
            options={DATE_FILTER_OPTIONS}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as DateFilter)}
            placeholder="Date range"
          />
        </div>
      </div>

      {/* Error State */}
      {error && (
        <FetchError
          message={error}
          onRetry={() => fetchArrivals()}
        />
      )}

      {/* Arrivals List */}
      {!error && (
        <>
          {filteredArrivals.length > 0 ? (
            <div className="space-y-3">
              {filteredArrivals.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <div className="p-4">
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono font-bold text-lg text-slate-900">
                            {order.order_number}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Created {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {order.appointment_status && (
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              order.appointment_status === "pending_approval"
                                ? "bg-amber-100 text-amber-800"
                                : order.appointment_status === "approved"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {order.appointment_status === "pending_approval"
                              ? "Pending Approval"
                              : order.appointment_status === "approved"
                              ? "Approved"
                              : "Rejected"}
                          </span>
                        )}
                        <StatusBadge status={order.status} entityType="inbound" />
                      </div>
                    </div>

                    {/* Order Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-3 border-t border-slate-100">
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Items</p>
                        <p className="font-semibold text-slate-900">
                          {order.item_count} product{order.item_count !== 1 ? "s" : ""}
                        </p>
                        <p className="text-sm text-slate-500">{order.total_units.toLocaleString()} units</p>
                      </div>

                      {order.expected_date && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Expected</p>
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-900">{formatDate(order.expected_date)}</span>
                          </div>
                        </div>
                      )}

                      {order.received_date && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Received</p>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-slate-900">{formatDate(order.received_date)}</span>
                          </div>
                        </div>
                      )}

                      {order.tracking_number && (
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Tracking</p>
                          <div className="flex items-center gap-1.5">
                            <Truck className="w-4 h-4 text-slate-400" />
                            <span className="font-mono text-sm text-slate-900 truncate">{order.tracking_number}</span>
                          </div>
                          {order.carrier && (
                            <p className="text-xs text-slate-500">{order.carrier}</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">
                      Created {formatDate(order.created_at)}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchArrivalDetail(order.id)}
                      className="text-cyan-600 hover:text-cyan-700 hover:bg-transparent"
                    >
                      View Details
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
              <PackageOpen className="w-16 h-16 mx-auto mb-4 text-slate-300" />
              {searchQuery || statusFilter !== "all" || dateFilter !== "all_time" ? (
                <>
                  <p className="text-lg text-slate-600">No arrivals match your filters</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setDateFilter("all_time");
                    }}
                    className="text-cyan-600 hover:text-cyan-700 mt-2"
                  >
                    Clear all filters
                  </Button>
                </>
              ) : (
                <p className="text-lg text-slate-600">No arrivals recorded yet</p>
              )}
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>
          {filteredArrivals.length > 0 && (
            <>Showing {filteredArrivals.length} of {arrivals.length} arrivals</>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fetchArrivals(true)}
          disabled={refreshing}
          loading={refreshing}
          className="text-cyan-600 hover:bg-cyan-50"
        >
          {!refreshing && <RefreshCw className="w-4 h-4 mr-1" />}
          {refreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

        </>
      )}

      {/* Detail Modal */}
      <Modal
        isOpen={!!selectedArrival || modalLoading}
        onClose={closeModal}
        title={selectedArrival?.order_number || "Loading..."}
        size="xl"
        footer={<Button variant="secondary" onClick={closeModal}>Close</Button>}
      >
        {modalLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : selectedArrival && (
          <div className="space-y-6">
            {/* Status and meta info */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={selectedArrival.status} entityType="inbound" />
              {selectedArrival.appointment_status && (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    selectedArrival.appointment_status === "pending_approval"
                      ? "bg-amber-100 text-amber-800"
                      : selectedArrival.appointment_status === "approved"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {selectedArrival.appointment_status === "pending_approval"
                    ? "Pending Approval"
                    : selectedArrival.appointment_status === "approved"
                    ? "Approved"
                    : "Rejected"}
                </span>
              )}
              {selectedArrival.tracking_number && (
                <span className="text-sm text-slate-500">
                  Tracking: <span className="font-mono">{selectedArrival.tracking_number}</span>
                </span>
              )}
            </div>

            {/* Rejection Reason */}
            {selectedArrival.appointment_status === "rejected" && selectedArrival.appointment_rejection_reason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Appointment Declined</p>
                  <p className="text-sm text-red-700 mt-1">
                    {selectedArrival.appointment_rejection_reason}
                  </p>
                </div>
              </div>
            )}

            <p className="text-sm text-slate-500">
              {selectedArrival.status === "received"
                ? `Received on ${formatDate(selectedArrival.received_date!)}`
                : `Created on ${formatDate(selectedArrival.created_at)}`}
            </p>

            {/* Delivery Info */}
            {(selectedArrival.expected_date || selectedArrival.carrier || selectedArrival.preferred_time_slot) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
                {selectedArrival.expected_date && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Expected</span>
                    </div>
                    <p className="font-medium text-slate-900 text-sm">{formatDate(selectedArrival.expected_date)}</p>
                  </div>
                )}
                {selectedArrival.preferred_time_slot && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Time Slot</span>
                    </div>
                    <p className="font-medium text-slate-900 text-sm">
                      {selectedArrival.preferred_time_slot === "am" ? "AM (8am–12pm)" : "PM (12pm–5pm)"}
                    </p>
                  </div>
                )}
                {selectedArrival.carrier && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Truck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-500 uppercase tracking-wide">Carrier</span>
                    </div>
                    <p className="font-medium text-slate-900 text-sm">{selectedArrival.carrier}</p>
                  </div>
                )}
              </div>
            )}

            {/* Products List */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-slate-500" />
                <h3 className="font-semibold text-slate-900">
                  Products Received ({selectedArrival.items.length})
                </h3>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <Table<ArrivalItem>
                  columns={arrivalItemColumns}
                  data={selectedArrival.items}
                  mobileView="table"
                />
              </div>
              {/* Totals Summary */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 border-t-0 rounded-b-lg px-4 py-3 -mt-px">
                <span className="font-medium text-slate-700">Total</span>
                <div className="flex items-center gap-8">
                  <span className="font-semibold text-slate-900">
                    {selectedArrival.items.reduce((sum, item) => sum + item.qty_expected, 0).toLocaleString()}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {selectedArrival.items.reduce((sum, item) => sum + item.qty_received, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Received By */}
            {selectedArrival.received_by && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Received By</h3>
                </div>
                <p className="text-slate-700 bg-slate-50 px-4 py-3 rounded-lg">
                  {selectedArrival.received_by}
                </p>
              </div>
            )}

            {/* Notes */}
            {selectedArrival.notes && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Notes</h3>
                </div>
                <p className="text-slate-700 bg-slate-50 px-4 py-3 rounded-lg whitespace-pre-wrap">
                  {selectedArrival.notes}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
