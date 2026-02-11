"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Download,
  DollarSign,
  Percent,
  ShoppingCart,
  Package,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getClients, Client } from "@/lib/api/clients";
import {
  calculateClientProfitability,
  getClientProfitabilityReport,
  ClientProfitability,
  ProfitabilityReport,
} from "@/lib/api/profitability";

interface ClientProfitabilityRow extends ClientProfitability {
  clientName: string;
}

export default function ClientProfitabilityReportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [loading, setLoading] = useState(false);
  const [clientsLoading, setClientsLoading] = useState(true);

  // Data for "All Clients" view
  const [clientBreakdown, setClientBreakdown] = useState<ClientProfitabilityRow[]>([]);

  // Data for single client view
  const [clientReport, setClientReport] = useState<ProfitabilityReport | null>(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const data = await getClients();
        setClients(data.filter((c) => c.active));
      } catch (error) {
        console.error("Failed to fetch clients:", error);
      } finally {
        setClientsLoading(false);
      }
    };
    fetchClients();
  }, []);

  const fetchReport = async () => {
    setLoading(true);
    try {
      if (selectedClientId) {
        // Single client report
        const report = await getClientProfitabilityReport(
          selectedClientId,
          startDate,
          endDate
        );
        setClientReport(report);
        setClientBreakdown([]);
      } else {
        // All clients breakdown
        const results: ClientProfitabilityRow[] = [];
        for (const client of clients) {
          try {
            const profitability = await calculateClientProfitability(
              client.id,
              startDate,
              endDate
            );
            if (profitability.orderCount > 0) {
              results.push({
                ...profitability,
                clientName: client.company_name,
              });
            }
          } catch (error) {
            console.error(`Failed to fetch profitability for ${client.company_name}:`, error);
          }
        }
        // Sort by revenue descending
        results.sort((a, b) => b.totalRevenue - a.totalRevenue);
        setClientBreakdown(results);
        setClientReport(null);
      }
    } catch (error) {
      console.error("Failed to fetch report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!clientsLoading && clients.length > 0) {
      fetchReport();
    }
  }, [selectedClientId, startDate, endDate, clientsLoading]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const exportToCSV = () => {
    let csvContent = "";

    if (selectedClientId && clientReport) {
      // Export single client report
      // Summary section
      csvContent += "Client Profitability Report\n";
      csvContent += `Period,${startDate} to ${endDate}\n`;
      csvContent += `Client,${clients.find((c) => c.id === selectedClientId)?.company_name || ""}\n\n`;

      csvContent += "Summary\n";
      csvContent += `Total Revenue,${clientReport.totalRevenue}\n`;
      csvContent += `Total Cost,${clientReport.totalCost}\n`;
      csvContent += `Gross Profit,${clientReport.grossProfit}\n`;
      csvContent += `Margin %,${clientReport.marginPercent.toFixed(1)}%\n`;
      csvContent += `Order Count,${clientReport.orderCount}\n\n`;

      // Product breakdown
      csvContent += "Product Breakdown\n";
      csvContent += "Product,Quantity,Revenue,Cost,Profit,Margin %\n";
      for (const product of clientReport.productBreakdown) {
        csvContent += `"${product.productName}",${product.totalQuantity},${product.totalRevenue},${product.totalCost},${product.grossProfit},${product.marginPercent.toFixed(1)}%\n`;
      }
    } else {
      // Export all clients breakdown
      csvContent += "Client Profitability Report - All Clients\n";
      csvContent += `Period,${startDate} to ${endDate}\n\n`;

      csvContent += "Client,Orders,Revenue,Cost,Profit,Margin %\n";
      for (const row of clientBreakdown) {
        csvContent += `"${row.clientName}",${row.orderCount},${row.totalRevenue},${row.totalCost},${row.grossProfit},${row.marginPercent.toFixed(1)}%\n`;
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `profitability-report-${startDate}-to-${endDate}.csv`
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

  // Calculate totals for all clients view
  const totals = clientBreakdown.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.totalRevenue,
      cost: acc.cost + row.totalCost,
      profit: acc.profit + row.grossProfit,
      orders: acc.orders + row.orderCount,
    }),
    { revenue: 0, cost: 0, profit: 0, orders: 0 }
  );
  const totalMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

  // For single client view
  const singleClientTotals = clientReport || {
    totalRevenue: 0,
    totalCost: 0,
    grossProfit: 0,
    marginPercent: 0,
    orderCount: 0,
    productBreakdown: [],
  };

  const summaryData = selectedClientId ? singleClientTotals : {
    totalRevenue: totals.revenue,
    totalCost: totals.cost,
    grossProfit: totals.profit,
    marginPercent: totalMargin,
    orderCount: totals.orders,
  };

  return (
    <AppShell
      title="Client Profitability Report"
      subtitle="Revenue, costs, and profit margins by client"
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
              <Button
                onClick={exportToCSV}
                disabled={loading || (clientBreakdown.length === 0 && !clientReport)}
              >
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
                  {loading ? "..." : formatCurrency(summaryData.totalRevenue)}
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
                  {loading ? "..." : formatCurrency(summaryData.totalCost)}
                </p>
                <p className="text-sm text-gray-500">Total Cost</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                summaryData.grossProfit >= 0 ? "bg-emerald-100" : "bg-red-100"
              }`}>
                {summaryData.grossProfit >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div>
                <p className={`text-xl font-bold ${
                  summaryData.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
                }`}>
                  {loading ? "..." : formatCurrency(summaryData.grossProfit)}
                </p>
                <p className="text-sm text-gray-500">Gross Profit</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Percent className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "..." : formatPercent(summaryData.marginPercent)}
                </p>
                <p className="text-sm text-gray-500">Margin</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "..." : summaryData.orderCount.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Orders</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Client Breakdown Table (when viewing all clients) */}
        {!selectedClientId && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Client Breakdown
            </h3>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-64 bg-gray-100 rounded"></div>
              </div>
            ) : clientBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No order data found for the selected period</p>
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
                        Orders
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Profit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Margin
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clientBreakdown.map((row) => (
                      <tr key={row.clientId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-gray-900">
                            {row.clientName}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {row.orderCount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(row.totalRevenue)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {formatCurrency(row.totalCost)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                          row.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}>
                          {formatCurrency(row.grossProfit)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            row.marginPercent >= 30
                              ? "bg-green-100 text-green-800"
                              : row.marginPercent >= 15
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {formatPercent(row.marginPercent)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            onClick={() => setSelectedClientId(row.clientId)}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                        Total
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {totals.orders.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(totals.revenue)}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(totals.cost)}
                      </td>
                      <td className={`px-6 py-3 text-sm font-semibold text-right ${
                        totals.profit >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {formatCurrency(totals.profit)}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatPercent(totalMargin)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Product Breakdown Table (when viewing single client) */}
        {selectedClientId && clientReport && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Product Breakdown
            </h3>
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-64 bg-gray-100 rounded"></div>
              </div>
            ) : clientReport.productBreakdown.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No product data found for the selected period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Product
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Revenue
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Cost
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Profit
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clientReport.productBreakdown
                      .sort((a, b) => b.totalRevenue - a.totalRevenue)
                      .map((product) => (
                        <tr key={product.productId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm font-medium text-gray-900">
                              {product.productName}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {product.totalQuantity.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(product.totalRevenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCurrency(product.totalCost)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                            product.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
                          }`}>
                            {formatCurrency(product.grossProfit)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              product.marginPercent >= 30
                                ? "bg-green-100 text-green-800"
                                : product.marginPercent >= 15
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {formatPercent(product.marginPercent)}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                        Total
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {clientReport.productBreakdown
                          .reduce((sum, p) => sum + p.totalQuantity, 0)
                          .toLocaleString()}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(clientReport.totalRevenue)}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(clientReport.totalCost)}
                      </td>
                      <td className={`px-6 py-3 text-sm font-semibold text-right ${
                        clientReport.grossProfit >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}>
                        {formatCurrency(clientReport.grossProfit)}
                      </td>
                      <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                        {formatPercent(clientReport.marginPercent)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </AppShell>
  );
}
