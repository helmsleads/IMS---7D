"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageX, Eye, Truck, ExternalLink, Flag, AlertTriangle, ArrowUpDown } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import Pagination from "@/components/ui/Pagination";
import { getOutboundOrders, OutboundOrderWithClient } from "@/lib/api/outbound";
import { handleApiError } from "@/lib/utils/error-handler";

const ITEMS_PER_PAGE = 25;

interface OutboundOrderWithCount extends OutboundOrderWithClient {
  item_count: number;
}

type StatusFilter = "all" | "pending" | "confirmed" | "processing" | "packed" | "shipped" | "delivered";

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "bg-gray-100 text-gray-700" },
  { key: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  { key: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  { key: "processing", label: "Processing", color: "bg-purple-100 text-purple-700" },
  { key: "packed", label: "Packed", color: "bg-indigo-100 text-indigo-700" },
  { key: "shipped", label: "Shipped", color: "bg-green-100 text-green-700" },
  { key: "delivered", label: "Delivered", color: "bg-gray-100 text-gray-700" },
];

function getStatusColor(status: string): string {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "confirmed":
      return "bg-blue-100 text-blue-800";
    case "processing":
      return "bg-purple-100 text-purple-800";
    case "packed":
      return "bg-indigo-100 text-indigo-800";
    case "shipped":
      return "bg-green-100 text-green-800";
    case "delivered":
      return "bg-gray-100 text-gray-800";
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isUrgent(order: OutboundOrderWithCount): boolean {
  if (!order.notes) return false;
  const lowerNotes = order.notes.toLowerCase();
  return lowerNotes.includes("rush") || lowerNotes.includes("urgent");
}

function isOldPending(order: OutboundOrderWithCount): boolean {
  if (order.status !== "pending" || !order.requested_at) return false;
  const requestedDate = new Date(order.requested_at);
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  return requestedDate < twoDaysAgo;
}

export default function OutboundPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OutboundOrderWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>("all");
  const [sortOldestFirst, setSortOldestFirst] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getOutboundOrders();
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
      pending: 0,
      confirmed: 0,
      processing: 0,
      packed: 0,
      shipped: 0,
      delivered: 0,
    };

    orders.forEach((order) => {
      if (order.status in counts) {
        counts[order.status as StatusFilter]++;
      }
    });

    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (selectedStatus !== "all") {
      filtered = filtered.filter((order) => order.status === selectedStatus);
    }

    // Sort by requested_at
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.requested_at || 0).getTime();
      const dateB = new Date(b.requested_at || 0).getTime();
      return sortOldestFirst ? dateA - dateB : dateB - dateA;
    });
  }, [orders, selectedStatus, sortOldestFirst]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, sortOldestFirst]);

  // Paginate the filtered results
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const columns = [
    {
      key: "order_number",
      header: "Order Number",
      render: (order: OutboundOrderWithCount) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{order.order_number}</span>
          {isUrgent(order) && (
            <span title="Rush/Urgent order">
              <Flag className="w-4 h-4 text-red-500" />
            </span>
          )}
          {isOldPending(order) && (
            <span title="Pending > 2 days">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (order: OutboundOrderWithCount) => (
        <span className="text-gray-900">{order.client?.company_name || "—"}</span>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (order: OutboundOrderWithCount) => (
        <span className="text-gray-600">
          {order.item_count !== undefined ? `${order.item_count} items` : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (order: OutboundOrderWithCount) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(order.status)}`}>
          {formatStatus(order.status)}
        </span>
      ),
    },
    {
      key: "requested_at",
      header: "Requested",
      render: (order: OutboundOrderWithCount) => (
        <span className="text-gray-600">{formatDate(order.requested_at)}</span>
      ),
    },
    {
      key: "shipping",
      header: "Carrier / Tracking",
      render: (order: OutboundOrderWithCount) => {
        if (!order.carrier && !order.tracking_number) {
          return <span className="text-gray-400">—</span>;
        }
        return (
          <div className="text-sm">
            {order.carrier && (
              <span className="text-gray-900">{order.carrier}</span>
            )}
            {order.carrier && order.tracking_number && (
              <span className="text-gray-400 mx-1">•</span>
            )}
            {order.tracking_number && (
              <span className="text-blue-600 inline-flex items-center gap-1">
                {order.tracking_number}
                <ExternalLink className="w-3 h-3" />
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      render: (order: OutboundOrderWithCount) => (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/outbound/${order.id}`);
            }}
          >
            <Eye className="w-4 h-4" />
          </Button>
          {(order.status === "confirmed" || order.status === "processing" || order.status === "packed") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                router.push(`/outbound/${order.id}`);
              }}
            >
              <Truck className="w-4 h-4 text-blue-600" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const actionButtons = (
    <Button onClick={() => router.push("/outbound/new")}>
      <Plus className="w-4 h-4 mr-1" />
      Create Order
    </Button>
  );

  if (!loading && orders.length === 0) {
    return (
      <AppShell
        title="Outbound Orders"
        subtitle="Shipment requests and fulfillment"
        actions={actionButtons}
      >
        <Card>
          <EmptyState
            icon={<PackageX className="w-12 h-12" />}
            title="No outbound orders yet"
            description="Create a shipment order to start fulfilling customer requests"
            action={
              <Button onClick={() => router.push("/outbound/new")}>
                <Plus className="w-4 h-4 mr-1" />
                Create Order
              </Button>
            }
          />
        </Card>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Outbound Orders" subtitle="Shipment requests and fulfillment">
        <FetchError message={error} onRetry={fetchOrders} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Outbound Orders"
      subtitle="Shipment requests and fulfillment"
      actions={actionButtons}
    >
      <div className="space-y-4 mb-4">
        {/* Status Tabs and Sort */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
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

          {/* Sort Toggle */}
          <button
            onClick={() => setSortOldestFirst(!sortOldestFirst)}
            className={`
              inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
              ${sortOldestFirst
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              }
            `}
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOldestFirst ? "Oldest First (FIFO)" : "Newest First"}
          </button>
        </div>
      </div>

      <Card padding="none">
        <Table
          columns={columns}
          data={paginatedOrders}
          loading={loading}
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
