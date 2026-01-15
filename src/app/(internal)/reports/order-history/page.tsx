"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Table from "@/components/ui/Table";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface OutboundOrder {
  id: string;
  order_number: string;
  status: string;
  requested_at: string | null;
  shipped_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  client: {
    id: string;
    company_name: string;
  } | null;
  outbound_items: {
    id: string;
    qty: number;
  }[];
}

interface Client {
  id: string;
  company_name: string;
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "packed", label: "Packed" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-yellow-100 text-yellow-800",
  packed: "bg-purple-100 text-purple-800",
  shipped: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export default function OrderHistoryReportPage() {
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient();

      // Fetch clients for filter
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, company_name")
        .eq("active", true)
        .order("company_name");

      setClients(clientsData || []);

      // Fetch orders
      const { data: ordersData, error } = await supabase
        .from("outbound_orders")
        .select(`
          id,
          order_number,
          status,
          requested_at,
          shipped_at,
          carrier,
          tracking_number,
          client:clients (
            id,
            company_name
          ),
          outbound_items (
            id,
            qty
          )
        `)
        .order("requested_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch orders:", error);
      } else {
        setOrders((ordersData || []) as unknown as OutboundOrder[]);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Client filter
      if (selectedClient && order.client?.id !== selectedClient) {
        return false;
      }

      // Status filter
      if (selectedStatus && order.status !== selectedStatus) {
        return false;
      }

      // Date range filter
      const orderDate = order.requested_at ? new Date(order.requested_at) : null;

      if (startDate && orderDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (orderDate < start) return false;
      }

      if (endDate && orderDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (orderDate > end) return false;
      }

      return true;
    });
  }, [orders, selectedClient, selectedStatus, startDate, endDate]);

  const clientOptions = [
    { value: "", label: "All Clients" },
    ...clients.map((client) => ({ value: client.id, label: client.company_name })),
  ];

  const exportToCSV = () => {
    const headers = ["Order #", "Client", "Date", "Status", "Items", "Total Qty", "Carrier", "Tracking"];
    const rows = filteredOrders.map((order) => {
      const itemCount = order.outbound_items?.length || 0;
      const totalQty = order.outbound_items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
      return [
        order.order_number || "",
        order.client?.company_name || "",
        order.requested_at ? new Date(order.requested_at).toLocaleDateString() : "",
        order.status || "",
        itemCount,
        totalQty,
        order.carrier || "",
        order.tracking_number || "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `order-history-${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearFilters = () => {
    setStartDate("");
    setEndDate("");
    setSelectedClient("");
    setSelectedStatus("");
  };

  const columns = [
    {
      key: "order_number",
      header: "Order #",
      render: (order: OutboundOrder) => (
        <Link
          href={`/outbound/${order.id}`}
          className="font-medium text-blue-600 hover:text-blue-800"
        >
          {order.order_number}
        </Link>
      ),
    },
    {
      key: "client",
      header: "Client",
      render: (order: OutboundOrder) => (
        <span className="text-gray-900">{order.client?.company_name || "—"}</span>
      ),
    },
    {
      key: "date",
      header: "Date",
      render: (order: OutboundOrder) => (
        <span className="text-gray-600">
          {order.requested_at
            ? new Date(order.requested_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (order: OutboundOrder) => (
        <span
          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full capitalize ${
            statusColors[order.status] || "bg-gray-100 text-gray-800"
          }`}
        >
          {order.status}
        </span>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (order: OutboundOrder) => {
        const itemCount = order.outbound_items?.length || 0;
        const totalQty = order.outbound_items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0;
        return (
          <span className="text-gray-600">
            {itemCount} item{itemCount !== 1 ? "s" : ""} ({totalQty} units)
          </span>
        );
      },
    },
    {
      key: "carrier",
      header: "Carrier",
      render: (order: OutboundOrder) => (
        <span className="text-gray-600">{order.carrier || "—"}</span>
      ),
    },
    {
      key: "tracking",
      header: "Tracking",
      render: (order: OutboundOrder) => (
        <span className="text-gray-600 font-mono text-sm">
          {order.tracking_number || "—"}
        </span>
      ),
    },
  ];

  const actionButtons = (
    <Button onClick={exportToCSV} disabled={filteredOrders.length === 0}>
      <Download className="w-4 h-4 mr-1" />
      Export CSV
    </Button>
  );

  const hasFilters = startDate || endDate || selectedClient || selectedStatus;

  return (
    <AppShell
      title="Order History"
      subtitle="Complete history of outbound orders"
      actions={actionButtons}
    >
      {/* Back Link */}
      <div className="mb-6">
        <Link
          href="/reports"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Reports
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-40">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="w-48">
            <Select
              label="Client"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              options={clientOptions}
            />
          </div>
          <div className="w-40">
            <Select
              label="Status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              options={statusOptions}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
        <div className="mt-3 text-sm text-gray-500">
          Showing {filteredOrders.length} of {orders.length} orders
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900">
              {filteredOrders.length}
            </p>
            <p className="text-sm text-gray-500">Total Orders</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-semibold text-green-600">
              {filteredOrders.filter((o) => o.status === "delivered").length}
            </p>
            <p className="text-sm text-gray-500">Delivered</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-semibold text-indigo-600">
              {filteredOrders.filter((o) => o.status === "shipped").length}
            </p>
            <p className="text-sm text-gray-500">Shipped</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-semibold text-amber-600">
              {filteredOrders.filter((o) => ["pending", "confirmed", "processing", "packed"].includes(o.status)).length}
            </p>
            <p className="text-sm text-gray-500">In Progress</p>
          </div>
        </Card>
      </div>

      {/* Table */}
      <div className="mt-6">
        <Card padding="none">
          <Table
            columns={columns}
            data={filteredOrders}
            loading={loading}
            emptyMessage="No orders found matching your filters"
          />
        </Card>
      </div>
    </AppShell>
  );
}
