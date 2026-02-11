"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageCheck, Eye, Truck, Calendar, AlertCircle } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import Pagination from "@/components/ui/Pagination";
import { getInboundOrders, InboundOrder } from "@/lib/api/inbound";
import { handleApiError } from "@/lib/utils/error-handler";

const ITEMS_PER_PAGE = 25;

interface InboundOrderWithCount extends InboundOrder {
  item_count: number;
}

type StatusFilter = "all" | "ordered" | "in_transit" | "arrived" | "received";
type DateFilter = "all" | "today" | "this_week" | "overdue";

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "bg-gray-100 text-gray-700" },
  { key: "ordered", label: "Ordered", color: "bg-yellow-100 text-yellow-700" },
  { key: "in_transit", label: "In Transit", color: "bg-blue-100 text-blue-700" },
  { key: "arrived", label: "Arrived", color: "bg-purple-100 text-purple-700" },
  { key: "received", label: "Received", color: "bg-green-100 text-green-700" },
];

const DATE_FILTERS: { key: DateFilter; label: string; icon?: typeof Calendar }[] = [
  { key: "all", label: "All Dates" },
  { key: "today", label: "Today", icon: Calendar },
  { key: "this_week", label: "This Week", icon: Calendar },
  { key: "overdue", label: "Overdue", icon: AlertCircle },
];

function getStatusColor(status: string): string {
  switch (status) {
    case "ordered":
      return "bg-yellow-100 text-yellow-800";
    case "in_transit":
      return "bg-blue-100 text-blue-800";
    case "arrived":
      return "bg-purple-100 text-purple-800";
    case "received":
      return "bg-green-100 text-green-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
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
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (6 - day);
  d.setDate(diff);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isToday(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const today = new Date();
  return getStartOfDay(date).getTime() === getStartOfDay(today).getTime();
}

function isThisWeek(dateString: string | null): boolean {
  if (!dateString) return false;
  const date = new Date(dateString);
  const now = new Date();
  const weekStart = getStartOfWeek(now);
  const weekEnd = getEndOfWeek(now);
  return date >= weekStart && date <= weekEnd;
}

function isOverdue(order: InboundOrderWithCount): boolean {
  if (!order.expected_date || order.status === "received") return false;
  const expectedDate = new Date(order.expected_date);
  const today = getStartOfDay(new Date());
  return expectedDate < today;
}

export default function InboundPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<InboundOrderWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInboundOrders();
      setOrders(data);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: orders.length,
      ordered: 0,
      in_transit: 0,
      arrived: 0,
      received: 0,
    };

    orders.forEach((order) => {
      if (order.status in counts) {
        counts[order.status as StatusFilter]++;
      }
    });

    return counts;
  }, [orders]);

  const dateCounts = useMemo(() => {
    const counts: Record<DateFilter, number> = {
      all: orders.length,
      today: 0,
      this_week: 0,
      overdue: 0,
    };

    orders.forEach((order) => {
      if (isToday(order.expected_date)) counts.today++;
      if (isThisWeek(order.expected_date)) counts.this_week++;
      if (isOverdue(order)) counts.overdue++;
    });

    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Apply status filter
    if (selectedStatus !== "all") {
      filtered = filtered.filter((order) => order.status === selectedStatus);
    }

    // Apply date filter
    if (selectedDateFilter !== "all") {
      filtered = filtered.filter((order) => {
        switch (selectedDateFilter) {
          case "today":
            return isToday(order.expected_date);
          case "this_week":
            return isThisWeek(order.expected_date);
          case "overdue":
            return isOverdue(order);
          default:
            return true;
        }
      });
    }

    return filtered;
  }, [orders, selectedStatus, selectedDateFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedDateFilter]);

  // Paginate the filtered results
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const columns = [
    {
      key: "po_number",
      header: "Reference #",
      render: (order: InboundOrderWithCount) => (
        <span className="font-medium text-gray-900">{order.po_number}</span>
      ),
    },
    {
      key: "supplier",
      header: "Ship From",
      render: (order: InboundOrderWithCount) => (
        <span className="text-gray-900">{order.supplier || "—"}</span>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (order: InboundOrderWithCount) => (
        <span className="text-gray-600">
          {order.item_count !== undefined ? `${order.item_count} items` : "—"}
        </span>
      ),
    },
    {
      key: "expected_date",
      header: "Expected",
      render: (order: InboundOrderWithCount) => {
        const overdue = isOverdue(order);
        return (
          <span className={overdue ? "text-red-600 font-medium" : "text-gray-600"}>
            {formatDate(order.expected_date)}
            {overdue && <span className="ml-1 text-xs">(Overdue)</span>}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (order: InboundOrderWithCount) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
          {formatStatus(order.status)}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      render: (order: InboundOrderWithCount) => (
        <span className="text-sm text-gray-500">{formatDate(order.created_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (order: InboundOrderWithCount) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/inbound/${order.id}`);
            }}
            title="View order details"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {(order.status === "ordered" || order.status === "arrived") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/inbound/${order.id}`);
              }}
              title={order.status === "ordered" ? "Mark in transit" : "Receive items"}
            >
              <Truck className="w-4 h-4 text-green-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const actionButtons = (
    <Button onClick={() => router.push("/inbound/new")}>
      <Plus className="w-4 h-4 mr-1" />
      New Shipment
    </Button>
  );

  if (!loading && orders.length === 0) {
    return (
      <AppShell
        title="Inbound Shipments"
        subtitle="Incoming inventory and receiving"
        actions={actionButtons}
      >
        <Card>
          <EmptyState
            icon={<PackageCheck className="w-12 h-12" />}
            title="No inbound shipments yet"
            description="Create an inbound shipment to start receiving inventory"
            action={
              <Button onClick={() => router.push("/inbound/new")}>
                <Plus className="w-4 h-4 mr-1" />
                New Shipment
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Inbound Shipments" subtitle="Incoming inventory and receiving">
        <FetchError message={error} onRetry={fetchOrders} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Inbound Shipments"
      subtitle="Incoming inventory and receiving"
      actions={actionButtons}
    >
      <div className="space-y-4 mb-4">
        {/* Status Tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab.key;
            const count = statusCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setSelectedStatus(tab.key)}
                className={`
                  inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? tab.key === "all"
                      ? "bg-gray-900 text-white"
                      : tab.color.replace("100", "600").replace(/text-\w+-700/, "text-white")
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                  }
                `}
              >
                {tab.label}
                <span
                  className={`
                    inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-semibold rounded-full
                    ${isActive
                      ? "bg-white/20 text-white"
                      : tab.color
                    }
                  `}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <span className="text-sm text-gray-500 mr-2">Expected:</span>
          {DATE_FILTERS.map((filter) => {
            const isActive = selectedDateFilter === filter.key;
            const count = dateCounts[filter.key];
            const isOverdueFilter = filter.key === "overdue";
            return (
              <button
                key={filter.key}
                onClick={() => setSelectedDateFilter(filter.key)}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${isActive
                    ? isOverdueFilter
                      ? "bg-red-600 text-white"
                      : "bg-blue-600 text-white"
                    : isOverdueFilter && count > 0
                      ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                      : "bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100"
                  }
                `}
              >
                {filter.icon && <filter.icon className="w-3.5 h-3.5" />}
                {filter.label}
                {filter.key !== "all" && (
                  <span
                    className={`
                      inline-flex items-center justify-center min-w-[18px] h-4 px-1 text-xs font-semibold rounded-full
                      ${isActive
                        ? "bg-white/20"
                        : isOverdueFilter && count > 0
                          ? "bg-red-200 text-red-800"
                          : "bg-gray-200 text-gray-700"
                      }
                    `}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={paginatedOrders}
          loading={loading}
          onRowClick={(order) => router.push(`/inbound/${order.id}`)}
          emptyMessage={`No ${selectedStatus === "all" ? "" : formatStatus(selectedStatus).toLowerCase() + " "}orders found`}
        />
        <Pagination
          currentPage={currentPage}
          totalItems={filteredOrders.length}
          itemsPerPage={ITEMS_PER_PAGE}
          onPageChange={setCurrentPage}
        />
      </Card>
    </AppShell>
  );
}
