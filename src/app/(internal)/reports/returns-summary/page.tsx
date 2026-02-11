"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  RotateCcw,
  Download,
  Package,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getClients, Client } from "@/lib/api/clients";
import { getReturns, ReturnWithItems } from "@/lib/api/returns";
import { ReturnStatus } from "@/types/database";

const STATUS_OPTIONS: { value: ReturnStatus | ""; label: string }[] = [
  { value: "", label: "All Statuses" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "denied", label: "Denied" },
  { value: "shipped", label: "Shipped" },
  { value: "received", label: "Received" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_COLORS: Record<ReturnStatus, { bg: string; text: string; bar: string }> = {
  requested: { bg: "bg-blue-100", text: "text-blue-800", bar: "bg-blue-500" },
  approved: { bg: "bg-green-100", text: "text-green-800", bar: "bg-green-500" },
  denied: { bg: "bg-red-100", text: "text-red-800", bar: "bg-red-500" },
  shipped: { bg: "bg-purple-100", text: "text-purple-800", bar: "bg-purple-500" },
  received: { bg: "bg-cyan-100", text: "text-cyan-800", bar: "bg-cyan-500" },
  processing: { bg: "bg-yellow-100", text: "text-yellow-800", bar: "bg-yellow-500" },
  completed: { bg: "bg-emerald-100", text: "text-emerald-800", bar: "bg-emerald-500" },
  cancelled: { bg: "bg-gray-100", text: "text-gray-800", bar: "bg-gray-500" },
};

const REASON_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
];

export default function ReturnsSummaryReportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [allReturns, setAllReturns] = useState<ReturnWithItems[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<ReturnStatus | "">("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(true);
  const [clientsLoading, setClientsLoading] = useState(true);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await getClients();
        setClients(data);
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, []);

  useEffect(() => {
    const fetchReturns = async () => {
      setLoading(true);
      try {
        const data = await getReturns(
          selectedClientId ? { clientId: selectedClientId } : undefined
        );
        setAllReturns(data);
      } catch (error) {
        console.error("Failed to fetch returns:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchReturns();
  }, [selectedClientId]);

  // Filter returns by date range and status
  const filteredReturns = useMemo(() => {
    return allReturns.filter((ret) => {
      const returnDate = ret.created_at?.split("T")[0] || "";
      const inDateRange = returnDate >= startDate && returnDate <= endDate;
      const matchesStatus = !selectedStatus || ret.status === selectedStatus;
      return inDateRange && matchesStatus;
    });
  }, [allReturns, startDate, endDate, selectedStatus]);

  // Calculate status breakdown
  const statusBreakdown = useMemo(() => {
    const counts: Record<ReturnStatus, number> = {
      requested: 0,
      approved: 0,
      denied: 0,
      shipped: 0,
      received: 0,
      processing: 0,
      completed: 0,
      cancelled: 0,
    };

    filteredReturns.forEach((ret) => {
      if (ret.status in counts) {
        counts[ret.status]++;
      }
    });

    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        status: status as ReturnStatus,
        count,
        percentage: filteredReturns.length > 0
          ? (count / filteredReturns.length) * 100
          : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReturns]);

  // Calculate reason breakdown
  const reasonBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};

    filteredReturns.forEach((ret) => {
      const reason = ret.reason || "Not specified";
      counts[reason] = (counts[reason] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: filteredReturns.length > 0
          ? (count / filteredReturns.length) * 100
          : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredReturns]);

  // Calculate summary stats
  const totalItems = filteredReturns.reduce(
    (sum, ret) => sum + ret.items.reduce((itemSum, item) => itemSum + (item.qty_expected || 0), 0),
    0
  );
  const completedReturns = filteredReturns.filter((r) => r.status === "completed").length;
  const pendingReturns = filteredReturns.filter((r) =>
    ["requested", "approved", "shipped", "received", "processing"].includes(r.status)
  ).length;

  const exportToCSV = () => {
    const headers = [
      "Return Number",
      "Client",
      "Status",
      "Reason",
      "Created Date",
      "Items Count",
      "Total Qty Expected",
      "Total Qty Received",
    ];

    const rows = filteredReturns.map((ret) => {
      const itemsCount = ret.items.length;
      const qtyExpected = ret.items.reduce((sum, item) => sum + (item.qty_expected || 0), 0);
      const qtyReceived = ret.items.reduce((sum, item) => sum + (item.qty_received || 0), 0);

      return [
        ret.return_number || "",
        ret.client?.company_name || "",
        ret.status,
        ret.reason || "",
        ret.created_at?.split("T")[0] || "",
        itemsCount.toString(),
        qtyExpected.toString(),
        qtyReceived.toString(),
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `returns-summary-${startDate}-to-${endDate}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const backLink = (
    <Link
      href="/reports"
      className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to Reports
    </Link>
  );

  const maxStatusCount = Math.max(...statusBreakdown.map((s) => s.count), 1);
  const maxReasonCount = Math.max(...reasonBreakdown.map((r) => r.count), 1);

  return (
    <AppShell
      title="Returns Summary"
      subtitle="Overview of return requests and processing"
      actions={backLink}
    >
      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={clientsLoading}
                  className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Clients</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as ReturnStatus | "")}
                  className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-40 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button onClick={exportToCSV} disabled={loading || filteredReturns.length === 0}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : filteredReturns.length}
                </p>
                <p className="text-sm text-gray-500">Total Returns</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">
                  {loading ? "..." : pendingReturns}
                </p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {loading ? "..." : completedReturns}
                </p>
                <p className="text-sm text-gray-500">Completed</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? "..." : totalItems.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total Items</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status Breakdown Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Returns by Status
            </h3>
            {loading ? (
              <div className="animate-pulse h-48 bg-gray-100 rounded"></div>
            ) : statusBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No data available
              </div>
            ) : (
              <div className="space-y-3">
                {statusBreakdown.map(({ status, count, percentage }) => (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 capitalize">
                        {status}
                      </span>
                      <span className="text-gray-500">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div
                        className={`h-6 rounded-full ${STATUS_COLORS[status].bar} transition-all duration-300`}
                        style={{ width: `${(count / maxStatusCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Reason Breakdown Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Returns by Reason
            </h3>
            {loading ? (
              <div className="animate-pulse h-48 bg-gray-100 rounded"></div>
            ) : reasonBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No data available
              </div>
            ) : (
              <div className="space-y-3">
                {reasonBreakdown.slice(0, 8).map(({ reason, count, percentage }, index) => (
                  <div key={reason}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 truncate max-w-[200px]">
                        {reason}
                      </span>
                      <span className="text-gray-500">
                        {count} ({percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div
                        className={`h-6 rounded-full ${REASON_COLORS[index % REASON_COLORS.length]} transition-all duration-300`}
                        style={{ width: `${(count / maxReasonCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Returns Table */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Return Items
          </h3>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-64 bg-gray-100 rounded"></div>
            </div>
          ) : filteredReturns.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No returns found for the selected filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Return #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Items
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty Expected
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty Received
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredReturns.map((ret) => {
                    const qtyExpected = ret.items.reduce(
                      (sum, item) => sum + (item.qty_expected || 0),
                      0
                    );
                    const qtyReceived = ret.items.reduce(
                      (sum, item) => sum + (item.qty_received || 0),
                      0
                    );

                    return (
                      <tr key={ret.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {ret.return_number}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {ret.client?.company_name}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-900 truncate max-w-[200px] block">
                            {ret.reason || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                              STATUS_COLORS[ret.status]?.bg || "bg-gray-100"
                            } ${STATUS_COLORS[ret.status]?.text || "text-gray-800"}`}
                          >
                            {ret.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {ret.created_at
                            ? new Date(ret.created_at).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {ret.items.length}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {qtyExpected.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {qtyReceived.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/returns/${ret.id}`}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
