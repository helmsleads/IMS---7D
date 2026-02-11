"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Wrench,
  Download,
  DollarSign,
  TrendingUp,
  Users,
  FileText,
  Layers,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getClients, Client } from "@/lib/api/clients";
import { getServices, ServiceWithAddons } from "@/lib/api/services";
import { getUsageRecords, UsageFilters } from "@/lib/api/invoices";
import { UsageRecord } from "@/types/database";

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

interface ServiceInfo {
  id: string;
  name: string;
  type: "service" | "addon";
}

export default function ServiceUsageReportPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<ServiceWithAddons[]>([]);
  const [usageData, setUsageData] = useState<UsageRecord[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
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

  // Build service lookup map
  const serviceMap = useMemo(() => {
    const map = new Map<string, ServiceInfo>();
    services.forEach((svc) => {
      map.set(svc.id, { id: svc.id, name: svc.name, type: "service" });
      svc.service_addons?.forEach((addon) => {
        map.set(addon.id, { id: addon.id, name: addon.name, type: "addon" });
      });
    });
    return map;
  }, [services]);

  // Build client lookup map
  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((c) => map.set(c.id, c.company_name));
    return map;
  }, [clients]);

  // Fetch clients and services for filters
  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [clientsData, servicesData] = await Promise.all([
          getClients(),
          getServices(),
        ]);
        setClients(clientsData);
        setServices(servicesData);
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
        const filters: UsageFilters = {
          startDate: startDate + "T00:00:00",
          endDate: endDate + "T23:59:59",
        };

        if (selectedClientId) {
          filters.clientId = selectedClientId;
        }

        if (selectedServiceId) {
          // Check if it's a service or addon
          const svcInfo = serviceMap.get(selectedServiceId);
          if (svcInfo?.type === "service") {
            filters.serviceId = selectedServiceId;
          } else {
            filters.addonId = selectedServiceId;
          }
        }

        const data = await getUsageRecords(filters);
        setUsageData(data);
      } catch (error) {
        console.error("Failed to fetch usage data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (!filtersLoading) {
      fetchUsage();
    }
  }, [selectedClientId, selectedServiceId, startDate, endDate, filtersLoading, serviceMap]);

  // Calculate service breakdown
  const serviceBreakdown = useMemo(() => {
    const map = new Map<string, {
      serviceId: string;
      serviceName: string;
      serviceType: "service" | "addon";
      usageCount: number;
      totalQty: number;
      totalRevenue: number;
    }>();

    usageData.forEach((usage) => {
      const serviceId = usage.service_id || usage.addon_id || "unknown";
      const svcInfo = serviceMap.get(serviceId);
      const existing = map.get(serviceId);

      if (existing) {
        existing.usageCount++;
        existing.totalQty += usage.quantity || 0;
        existing.totalRevenue += usage.total || 0;
      } else {
        map.set(serviceId, {
          serviceId,
          serviceName: svcInfo?.name || usage.usage_type || "Unknown",
          serviceType: svcInfo?.type || "service",
          usageCount: 1,
          totalQty: usage.quantity || 0,
          totalRevenue: usage.total || 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [usageData, serviceMap]);

  // Calculate client breakdown
  const clientBreakdown = useMemo(() => {
    const map = new Map<string, {
      clientId: string;
      clientName: string;
      usageCount: number;
      totalQty: number;
      totalRevenue: number;
      servicesUsed: Set<string>;
    }>();

    usageData.forEach((usage) => {
      const key = usage.client_id;
      const existing = map.get(key);
      const serviceId = usage.service_id || usage.addon_id || "";

      if (existing) {
        existing.usageCount++;
        existing.totalQty += usage.quantity || 0;
        existing.totalRevenue += usage.total || 0;
        if (serviceId) existing.servicesUsed.add(serviceId);
      } else {
        const servicesUsed = new Set<string>();
        if (serviceId) servicesUsed.add(serviceId);
        map.set(key, {
          clientId: key,
          clientName: clientMap.get(key) || "Unknown",
          usageCount: 1,
          totalQty: usage.quantity || 0,
          totalRevenue: usage.total || 0,
          servicesUsed,
        });
      }
    });

    return Array.from(map.values())
      .map((row) => ({
        ...row,
        serviceCount: row.servicesUsed.size,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [usageData, clientMap]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalRevenue = usageData.reduce((sum, u) => sum + (u.total || 0), 0);
    const totalQty = usageData.reduce((sum, u) => sum + (u.quantity || 0), 0);
    const uniqueServices = new Set(usageData.map((u) => u.service_id || u.addon_id)).size;
    const uniqueClients = new Set(usageData.map((u) => u.client_id)).size;
    const invoicedRevenue = usageData
      .filter((u) => u.invoiced)
      .reduce((sum, u) => sum + (u.total || 0), 0);
    const uninvoicedRevenue = totalRevenue - invoicedRevenue;

    return {
      totalRevenue,
      invoicedRevenue,
      uninvoicedRevenue,
      totalQty,
      uniqueServices,
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
    const headers = [
      "Date",
      "Client",
      "Service/Addon",
      "Type",
      "Usage Type",
      "Quantity",
      "Unit Price",
      "Total",
      "Invoiced",
      "Reference",
    ];

    const rows = usageData.map((usage) => {
      const serviceId = usage.service_id || usage.addon_id || "";
      const svcInfo = serviceMap.get(serviceId);
      return [
        usage.usage_date?.split("T")[0] || "",
        clientMap.get(usage.client_id) || "",
        svcInfo?.name || usage.usage_type || "",
        svcInfo?.type || "service",
        usage.usage_type || "",
        (usage.quantity || 0).toString(),
        (usage.unit_price || 0).toFixed(2),
        (usage.total || 0).toFixed(2),
        usage.invoiced ? "Yes" : "No",
        usage.reference_id || "",
      ];
    });

    let csvContent = "Service Usage Report\n";
    csvContent += `Period,${startDate} to ${endDate}\n\n`;

    // Summary section
    csvContent += "Summary\n";
    csvContent += `Total Revenue,${totals.totalRevenue.toFixed(2)}\n`;
    csvContent += `Invoiced,${totals.invoicedRevenue.toFixed(2)}\n`;
    csvContent += `Uninvoiced,${totals.uninvoicedRevenue.toFixed(2)}\n`;
    csvContent += `Usage Records,${totals.usageCount}\n\n`;

    // Service breakdown
    csvContent += "Usage by Service\n";
    csvContent += "Service,Type,Usage Count,Quantity,Revenue\n";
    serviceBreakdown.forEach((row) => {
      csvContent += `"${row.serviceName}",${row.serviceType},${row.usageCount},${row.totalQty},${row.totalRevenue.toFixed(2)}\n`;
    });
    csvContent += "\n";

    // Client breakdown
    csvContent += "Usage by Client\n";
    csvContent += "Client,Usage Count,Services Used,Revenue\n";
    clientBreakdown.forEach((row) => {
      csvContent += `"${row.clientName}",${row.usageCount},${row.serviceCount},${row.totalRevenue.toFixed(2)}\n`;
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
      `service-usage-report-${startDate}-to-${endDate}.csv`
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

  const maxServiceRevenue = Math.max(...serviceBreakdown.map((s) => s.totalRevenue), 1);

  // Build flat list of services and addons for dropdown
  const serviceOptions = useMemo(() => {
    const options: { id: string; name: string; type: string }[] = [];
    services.forEach((svc) => {
      options.push({ id: svc.id, name: svc.name, type: "Service" });
      svc.service_addons?.forEach((addon) => {
        options.push({ id: addon.id, name: `  └ ${addon.name}`, type: "Add-on" });
      });
    });
    return options;
  }, [services]);

  return (
    <AppShell
      title="Service Usage Report"
      subtitle="Billable services and add-ons usage tracking"
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
                  Service
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  disabled={filtersLoading}
                  className="w-full sm:w-56 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Services & Add-ons</option>
                  {serviceOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name}
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
              <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-emerald-600">
                  {loading ? "..." : formatCurrency(totals.invoicedRevenue)}
                </p>
                <p className="text-sm text-gray-500">Invoiced</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-yellow-600">
                  {loading ? "..." : formatCurrency(totals.uninvoicedRevenue)}
                </p>
                <p className="text-sm text-gray-500">Uninvoiced</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">
                  {loading ? "..." : totals.uniqueServices}
                </p>
                <p className="text-sm text-gray-500">Services Used</p>
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
          {/* Usage by Service Chart */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Usage by Service
            </h3>
            {loading ? (
              <div className="animate-pulse h-48 bg-gray-100 rounded"></div>
            ) : serviceBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No usage data available
              </div>
            ) : (
              <div className="space-y-3">
                {serviceBreakdown.slice(0, 8).map((svc, index) => (
                  <div key={svc.serviceId}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 truncate max-w-[200px] flex items-center gap-1">
                        {svc.serviceName}
                        {svc.serviceType === "addon" && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                            Add-on
                          </span>
                        )}
                      </span>
                      <span className="text-gray-500">
                        {svc.usageCount} uses • {formatCurrency(svc.totalRevenue)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-6">
                      <div
                        className={`h-6 rounded-full ${CHART_COLORS[index % CHART_COLORS.length]} transition-all duration-300`}
                        style={{ width: `${(svc.totalRevenue / maxServiceRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Revenue Breakdown */}
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Revenue Breakdown
            </h3>
            {loading ? (
              <div className="animate-pulse h-48 bg-gray-100 rounded"></div>
            ) : serviceBreakdown.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No usage data available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Service
                      </th>
                      <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Uses
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Qty
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {serviceBreakdown.slice(0, 8).map((svc) => (
                      <tr key={svc.serviceId} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm text-gray-900 truncate max-w-[150px]">
                          {svc.serviceName}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full capitalize ${
                              svc.serviceType === "addon"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {svc.serviceType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {svc.usageCount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right">
                          {svc.totalQty.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(svc.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-sm font-semibold text-gray-900">
                        Total
                      </td>
                      <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                        {formatCurrency(totals.totalRevenue)}
                      </td>
                    </tr>
                  </tfoot>
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
              <Wrench className="w-12 h-12 text-gray-300 mx-auto mb-4" />
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
                      Services Used
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
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
                        {row.usageCount.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {row.totalQty.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                        {row.serviceCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                        {formatCurrency(row.totalRevenue)}
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
                  ))}
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
                      {totals.uniqueServices}
                    </td>
                    <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                      {formatCurrency(totals.totalRevenue)}
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
