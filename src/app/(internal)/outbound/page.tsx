"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, PackageX, Eye, Truck, ExternalLink, Flag, AlertTriangle, ArrowUpDown, Globe, Building2, Zap } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Table from "@/components/ui/Table";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import Pagination from "@/components/ui/Pagination";
import { getOutboundOrders, OutboundOrderWithClient } from "@/lib/api/outbound";
import { handleApiError } from "@/lib/utils/error-handler";
import { formatDate, formatStatus } from "@/lib/utils/formatting";
import StatusBadge from "@/components/ui/StatusBadge";

const ITEMS_PER_PAGE = 25;

interface OutboundOrderWithCount extends OutboundOrderWithClient {
  item_count: number;
  source?: 'portal' | 'internal' | 'api';
  is_rush?: boolean | null;
  preferred_carrier?: string | null;
}

type StatusFilter = "all" | "pending" | "confirmed" | "processing" | "packed" | "shipped" | "delivered";
type SourceFilter = "all" | "portal" | "internal";

const STATUS_TABS: { key: StatusFilter; label: string; color: string }[] = [
  { key: "all", label: "All", color: "bg-gray-100 text-gray-700" },
  { key: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  { key: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-700" },
  { key: "processing", label: "Processing", color: "bg-purple-100 text-purple-700" },
  { key: "packed", label: "Packed", color: "bg-indigo-100 text-indigo-700" },
  { key: "shipped", label: "Shipped", color: "bg-green-100 text-green-700" },
  { key: "delivered", label: "Delivered", color: "bg-gray-100 text-gray-700" },
];

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
  const [selectedSource, setSelectedSource] = useState<SourceFilter>("all");
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

  const sourceCounts = useMemo(() => {
    const counts: Record<SourceFilter, number> = {
      all: orders.length,
      portal: 0,
      internal: 0,
    };

    orders.forEach((order) => {
      if (order.source === "portal") {
        counts.portal++;
      } else {
        counts.internal++;
      }
    });

    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (selectedStatus !== "all") {
      filtered = filtered.filter((order) => order.status === selectedStatus);
    }

    if (selectedSource !== "all") {
      filtered = filtered.filter((order) => {
        if (selectedSource === "portal") return order.source === "portal";
        return order.source !== "portal"; // internal includes api and undefined
      });
    }

    // Sort by requested_at
    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.requested_at || 0).getTime();
      const dateB = new Date(b.requested_at || 0).getTime();
      return sortOldestFirst ? dateA - dateB : dateB - dateA;
    });
  }, [orders, selectedStatus, selectedSource, sortOldestFirst]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedStatus, selectedSource, sortOldestFirst]);

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
          {/* Source Badge */}
          {order.source === "portal" ? (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700"
              title="Portal Order - Customer requested"
            >
              <Globe className="w-3 h-3" />
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium rounded bg-gray-100 text-gray-600"
              title="Internal Order - Staff created"
            >
              <Building2 className="w-3 h-3" />
            </span>
          )}
          <span className="font-medium text-gray-900">{order.order_number}</span>
          {/* Rush indicator - check both is_rush flag and notes */}
          {(order.is_rush || isUrgent(order)) && (
            <span title="Rush/Urgent order" className="flex items-center">
              <Zap className="w-4 h-4 text-red-500" />
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
        <StatusBadge status={order.status} entityType="outbound" />
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
        const hasShippingInfo = order.carrier || order.tracking_number;
        const hasPreferred = order.preferred_carrier && !order.carrier;

        if (!hasShippingInfo && !hasPreferred) {
          return <span className="text-gray-400">—</span>;
        }
        return (
          <div className="text-sm">
            {/* Show preferred carrier if no actual carrier set */}
            {hasPreferred && (
              <span className="text-purple-600 text-xs" title="Customer preferred carrier">
                Preferred: {order.preferred_carrier}
              </span>
            )}
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
        {/* Source Filter and Sort */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Source:</span>
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setSelectedSource("all")}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${selectedSource === "all"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                  }
                `}
              >
                All
                <span className="text-xs text-gray-400">({sourceCounts.all})</span>
              </button>
              <button
                onClick={() => setSelectedSource("portal")}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${selectedSource === "portal"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                  }
                `}
              >
                <Globe className="w-3.5 h-3.5" />
                Portal
                <span className={`text-xs ${selectedSource === "portal" ? "text-purple-200" : "text-gray-400"}`}>
                  ({sourceCounts.portal})
                </span>
              </button>
              <button
                onClick={() => setSelectedSource("internal")}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                  ${selectedSource === "internal"
                    ? "bg-gray-700 text-white shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                  }
                `}
              >
                <Building2 className="w-3.5 h-3.5" />
                Internal
                <span className={`text-xs ${selectedSource === "internal" ? "text-gray-300" : "text-gray-400"}`}>
                  ({sourceCounts.internal})
                </span>
              </button>
            </div>
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
