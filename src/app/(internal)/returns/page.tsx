"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  RotateCcw,
  Plus,
  Search,
  Eye,
  CheckCircle,
  XCircle,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import FetchError from "@/components/ui/FetchError";
import StatusBadge from "@/components/ui/StatusBadge";
import { getReturns, updateReturnStatus, ReturnWithItems } from "@/lib/api/returns";
import { getClients, Client } from "@/lib/api/clients";
import { ReturnStatus } from "@/types/database";
import { handleApiError } from "@/lib/utils/error-handler";
import { formatDate } from "@/lib/utils/formatting";

const statusOptions: { value: ReturnStatus | ""; label: string }[] = [
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

export default function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnWithItems[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [returnsData, clientsData] = await Promise.all([
        getReturns({
          clientId: clientFilter || undefined,
          status: statusFilter || undefined,
        }),
        getClients(),
      ]);
      setReturns(returnsData);
      setClients(clientsData);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [clientFilter, statusFilter]);

  const filteredReturns = useMemo(() => {
    let filtered = returns;

    // Filter by search term (return number only)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((r) =>
        r.return_number.toLowerCase().includes(search)
      );
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      filtered = filtered.filter((r) => {
        const date = new Date(r.requested_at || r.created_at);
        return date >= start;
      });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((r) => {
        const date = new Date(r.requested_at || r.created_at);
        return date <= end;
      });
    }

    return filtered;
  }, [returns, searchTerm, startDate, endDate]);

  const getTotalItems = (items: ReturnWithItems["items"]) => {
    return items.reduce((sum, item) => sum + item.qty_requested, 0);
  };

  const handleStatusUpdate = async (id: string, status: "approved" | "denied") => {
    try {
      await updateReturnStatus(id, status);
      await fetchData();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (error && returns.length === 0) {
    return (
      <AppShell title="Returns" subtitle="Process return requests">
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Returns"
      subtitle="Process return requests"
      actions={
        <Button onClick={() => (window.location.href = "/returns/new")}>
          <Plus className="w-4 h-4 mr-2" />
          New Return
        </Button>
      }
    >
      {/* Filter Controls */}
      <div className="mb-6">
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Client Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client
            </label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ReturnStatus | "")}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Search Return Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Return Number
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search RMA..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        </Card>
      </div>

      {/* Returns List */}
      {loading ? (
        <Card>
          <div className="animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-4"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded mb-2"></div>
            ))}
          </div>
        </Card>
      ) : filteredReturns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<RotateCcw className="w-12 h-12" />}
            title={returns.length === 0 ? "No returns yet" : "No returns found"}
            description={
              returns.length === 0
                ? "Return requests will appear here"
                : "Try adjusting your filters"
            }
            action={
              returns.length === 0 ? (
                <Button onClick={() => (window.location.href = "/returns/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Return
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Return Number
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Client
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Original Order
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Items
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Requested
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map((returnItem) => (
                  <tr
                    key={returnItem.id}
                    className={`border-b border-gray-100 ${
                      returnItem.status === "requested"
                        ? "bg-yellow-50 hover:bg-yellow-100"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="py-3 px-4">
                      <Link
                        href={`/returns/${returnItem.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {returnItem.return_number}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-gray-900">
                      {returnItem.client?.company_name || "-"}
                    </td>
                    <td className="py-3 px-4">
                      {returnItem.original_order_id ? (
                        <Link
                          href={`/outbound/${returnItem.original_order_id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Order
                        </Link>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={returnItem.status} entityType="return" />
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {getTotalItems(returnItem.items)}
                    </td>
                    <td className="py-3 px-4 text-gray-600">
                      {formatDate(returnItem.requested_at || returnItem.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/returns/${returnItem.id}`}
                          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Link>
                        {returnItem.status === "requested" && (
                          <>
                            <button
                              onClick={() => handleStatusUpdate(returnItem.id, "approved")}
                              className="inline-flex items-center text-sm text-green-600 hover:text-green-800"
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleStatusUpdate(returnItem.id, "denied")}
                              className="inline-flex items-center text-sm text-red-600 hover:text-red-800"
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Deny
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
