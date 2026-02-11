"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Download,
  DollarSign,
  TrendingUp,
  Package,
  Users,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getClients, Client } from "@/lib/api/clients";
import {
  getSupplies,
  getSupplyUsage,
  SupplyWithInventory,
  SupplyUsageWithDetails,
} from "@/lib/api/supplies";

const CHART_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-amber-500",
  "bg-rose-500",
];

export default function SupplyUsageReportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [supplies, setSupplies] = useState<SupplyWithInventory[]>([]);
  const [usageData, setUsageData] = useState<SupplyUsageWithDetails[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedSupplyId, setSelectedSupplyId] = useState<string>("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(true);
  const [filtersLoading, setFiltersLoading] = useState(true);

  // Fetch clients and supplies for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [clientsData, suppliesData] = await Promise.all([
          getClients(),
          getSupplies({ active: true }),
        ]);
        setClients(clientsData);
        setSupplies(suppliesData);
      } catch (error) {
        console.error("Failed to fetch filter data:", error);
      } finally {
        setFiltersLoading(false);
      }
    };
    fetchFilters();
  }, []);

  // Fetch usage data
  useEffect(() => {
    const fetchUsage = async () => {
      setLoading(true);
      try {
        const data = await getSupplyUsage({
          clientId: selectedClientId || undefined,
          supplyId: selectedSupplyId || undefined,
          startDate: startDate + "T00:00:00",
          endDate: endDate + "T23:59:59",
        });
        setUsageData(data);
      } catch (error) {
        console.error("Failed to fetch supply usage:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsage();
  }, [selectedClientId, selectedSupplyId, startDate, endDate]);

  // Calculate supply breakdown
  const supplyBreakdown = useMemo(() => {
    const map = new Map<string, {
      supplyId: string;
      supplyName: string;
      unit: string;
      totalQty: number;
      totalCost: number;
      totalRevenue: number;
    }>();

    usageData.forEach((usage) => {
      const key = usage.supply_id;
      const existing = map.get(key);
      const revenue = usage.total || 0;
      // Estimate cost as 60% of revenue (configurable assumption)
      const cost = revenue * 0.6;

      if (existing) {
        existing.totalQty += usage.quantity || 0;
        existing.totalCost += cost;
        existing.totalRevenue += revenue;
      } else {
        map.set(key, {
          supplyId: usage.supply_id,
          supplyName: usage.supply?.name || "Unknown",
          unit: usage.supply?.unit || "ea",
          totalQty: usage.quantity || 0,
          totalCost: cost,
          totalRevenue: revenue,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [usageData]);

  // Calculate client breakdown
  const clientBreakdown = useMemo(() => {
    const map = new Map<string, {
      clientId: string;
      clientName: string;
      usageCount: number;
      totalQty: number;
      totalCost: number;
      totalRevenue: number;
    }>();

    usageData.forEach((usage) => {
      const key = usage.client_id;
      const existing = map.get(key);
      const revenue = usage.total || 0;
      const cost = revenue * 0.6;

      if (existing) {
        existing.usageCount++;
        existing.totalQty += usage.quantity || 0;
        existing.totalCost += cost;
        existing.totalRevenue += revenue;
      } else {
        map.set(key, {
          clientId: usage.client_id,
          clientName: usage.client?.company_name || "Unknown",
          usageCount: 1,
          totalQty: usage.quantity || 0,
          totalCost: cost,
          totalRevenue: revenue,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [usageData]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = usageData.reduce((sum, u) => sum + (u.total || 0), 0);
    const totalCost = totalRevenue * 0.6;
    const totalQty = usageData.reduce((sum, u) => sum + (u.quantity || 0), 0);
    const uniqueSupplies = new Set(usageData.map((u) => u.supply_id)).size;
    const uniqueClients = new Set(usageData.map((u) => u.client_id)).size;

    return {
      totalRevenue,
      totalCost,
      grossProfit: totalRevenue - totalCost,
      marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0,
      totalQty,
      uniqueSupplies,
      uniqueClients,
      usageCount: usageData.length,
    };
  }, [usageData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const exportToCSV = () => {
    // Detailed usage export
    const headers = [
      "Date",
      "Client",
      "Supply",
      "SKU",
      "Quantity",
      "Unit",
      "Unit Price",
      "Total",
      "Invoiced",
    ];

    const rows = usageData.map((usage) => [
      usage.created_at?.split("T")[0] || "",
      usage.client?.company_name || "",
      usage.supply?.name || "",
      usage.supply?.sku || "",
      (usage.quantity || 0).toString(),
      usage.supply?.unit || "",
      (usage.unit_price || 0).toFixed(2),
      (usage.total || 0).toFixed(2),
      usage.invoiced ? "Yes" : "No",
    ]);

    let csvContent = "Supply Usage Report\n";
    csvContent += `Period,${startDate} to ${endDate}\n\n`;

    // Summary section
    csvContent += "Summary\n";
    csvContent += `Total Revenue,${totals.totalRevenue.toFixed(2)}\n`;
    csvContent += `Estimated Cost,${totals.totalCost.toFixed(2)}\n`;
    csvContent += `Gross Profit,${totals.grossProfit.toFixed(2)}\n`;
    csvContent += `Usage Records,${totals.usageCount}\n\n`;

    // Client breakdown
    csvContent += "Usage by Client\n";
    csvContent += "Client,Usage Count,Quantity,Revenue\n";
    clientBreakdown.forEach((row) => {
      csvContent += `"${row.clientName}",${row.usageCount},${row.totalQty},${row.totalRevenue.toFixed(2)}\n`;
    });
    csvContent += "\n";

    // Detailed records
    csvContent += "Detailed Usage\n";
    csvContent += headers.join(",") + "\n";
    rows.forEach((row) => {
      csvContent += row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `supply-usage-report-${startDate}-to-${endDate}.csv`
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

  const maxSupplyRevenue = Math.max(...supplyBreakdown.map((s) => s.totalRevenue), 1);

  return (
    <AppShell
      title="Supply Usage Report"
      subtitle="Packing materials and supplies consumption tracking"
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
                  disabled={filtersLoading}
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
                  Supply
                </label>
                <select
                  value={selectedSupplyId}
                  onChange={(e) => setSelectedSupplyId(e.target.value)}
                  disabled={filtersLoading}
                  className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Supplies</option>
                  {supplies.map((supply) => (
                    <option key={supply.id} value={supply.id}>
                      {supply.name}
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
              <Button onClick={exportToCSV} disabled={loading || usageData.length === 0}>
                <Download className="w-4 h-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "..." : formatCurrency(totals.totalRevenue)}
                </p>
                <p className="text-sm text-gray-500">Total Revenue</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "..." : formatCurrency(totals.totalCost)}
                </p>
                <p className="text-sm text-gray-500">Est. Cost</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600">
                  {loading ? "..." : formatCurrency(totals.grossProfit)}
                </p>
                <p className="text-sm text-gray-500">
                  Profit ({totals.marginPercent.toFixed(0)}%)
                </p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "..." : totals.totalQty.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Units Used</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "..." : totals.uniqueClients}
                </p>
                <p className="text-sm text-gray-500">Clients</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Usage by Supply Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Total Usage by Supply
            </h3>
            {loading ? (
              <div className="animate-pulse h-48 bg-gray-100 rounded"></div>
            ) : supplyBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No usage data available
              </div>
            ) : (
              <div className="space-y-3">
                {supplyBreakdown.slice(0, 8).map((supply, index) => (
                  <div key={supply.supplyId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 truncate max-w-[200px]">
                        {supply.supplyName}
                      </span>
                      <span className="text-gray-500">
                        {supply.totalQty.toLocaleString()} {supply.unit} • {formatCurrency(supply.totalRevenue)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div
                        className={`h-6 rounded-full ${CHART_COLORS[index % CHART_COLORS.length]} transition-all duration-300`}
                        style={{ width: `${(supply.totalRevenue / maxSupplyRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Cost vs Revenue Breakdown */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cost vs Revenue by Supply
            </h3>
            {loading ? (
              <div className="animate-pulse h-48 bg-gray-100 rounded"></div>
            ) : supplyBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No usage data available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Supply
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Revenue
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Cost
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Profit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {supplyBreakdown.slice(0, 6).map((supply) => {
                      const profit = supply.totalRevenue - supply.totalCost;
                      return (
                        <tr key={supply.supplyId} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900 truncate max-w-[150px]">
                            {supply.supplyName}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {supply.totalQty.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(supply.totalRevenue)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900 text-right">
                            {formatCurrency(supply.totalCost)}
                          </td>
                          <td className={`px-4 py-2 text-sm text-right font-medium ${
                            profit >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {formatCurrency(profit)}
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

        {/* Usage by Client Table */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Usage by Client
          </h3>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-64 bg-gray-100 rounded"></div>
            </div>
          ) : clientBreakdown.length === 0 ? (
            <div className="text-center py-12">
              <Boxes className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No usage data found for the selected filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Usage Count
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Qty
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Est. Cost
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Profit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {clientBreakdown.map((row) => {
                    const profit = row.totalRevenue - row.totalCost;
                    return (
                      <tr key={row.clientId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {row.clientName}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {row.usageCount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {row.totalQty.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(row.totalRevenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(row.totalCost)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                          profit >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {formatCurrency(profit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setSelectedClientId(row.clientId)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Filter
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                      {totals.usageCount.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                      {totals.totalQty.toLocaleString()}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(totals.totalRevenue)}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(totals.totalCost)}
                    </td>
                    <td className={`px-6 py-3 text-sm font-semibold text-right ${
                      totals.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {formatCurrency(totals.grossProfit)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
