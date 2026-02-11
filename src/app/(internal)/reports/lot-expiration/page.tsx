"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Download,
  AlertTriangle,
  Clock,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getExpiringLots, LotWithInventory } from "@/lib/api/lots";

const DAYS_OPTIONS = [
  { value: 30, label: "30 Days" },
  { value: 60, label: "60 Days" },
  { value: 90, label: "90 Days" },
];

export default function LotExpirationReportPage() {
  const [daysAhead, setDaysAhead] = useState(30);
  const [lots, setLots] = useState<LotWithInventory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getExpiringLots(daysAhead);
        setLots(data);
      } catch (error) {
        console.error("Failed to fetch expiring lots:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [daysAhead]);

  const getDaysUntilExpiration = (expirationDate: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expirationDate);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getExpirationBadge = (daysLeft: number) => {
    if (daysLeft < 0) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
          Expired
        </span>
      );
    }
    if (daysLeft <= 7) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
          {daysLeft} days
        </span>
      );
    }
    if (daysLeft <= 14) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
          {daysLeft} days
        </span>
      );
    }
    if (daysLeft <= 30) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
          {daysLeft} days
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
        {daysLeft} days
      </span>
    );
  };

  const getTotalQuantity = (lot: LotWithInventory): number => {
    return lot.lot_inventory.reduce((sum, inv) => sum + inv.qty_on_hand, 0);
  };

  const exportToCSV = () => {
    const headers = [
      "Lot Number",
      "Batch Number",
      "Product SKU",
      "Product Name",
      "Expiration Date",
      "Days Until Expiration",
      "Quantity on Hand",
      "Status",
    ];

    const rows = lots.map((lot) => {
      const daysLeft = lot.expiration_date
        ? getDaysUntilExpiration(lot.expiration_date)
        : "N/A";
      return [
        lot.lot_number || "",
        lot.batch_number || "",
        lot.product?.sku || "",
        lot.product?.name || "",
        lot.expiration_date || "",
        daysLeft.toString(),
        getTotalQuantity(lot).toString(),
        lot.status,
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
      `lot-expiration-report-${daysAhead}days-${new Date().toISOString().split("T")[0]}.csv`
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

  // Calculate summary stats
  const expiredCount = lots.filter(
    (lot) => lot.expiration_date && getDaysUntilExpiration(lot.expiration_date) < 0
  ).length;
  const criticalCount = lots.filter(
    (lot) =>
      lot.expiration_date &&
      getDaysUntilExpiration(lot.expiration_date) >= 0 &&
      getDaysUntilExpiration(lot.expiration_date) <= 7
  ).length;
  const warningCount = lots.filter(
    (lot) =>
      lot.expiration_date &&
      getDaysUntilExpiration(lot.expiration_date) > 7 &&
      getDaysUntilExpiration(lot.expiration_date) <= 30
  ).length;

  return (
    <AppShell
      title="Lot Expiration Report"
      subtitle="Track lot and batch expiration dates"
      actions={backLink}
    >
      <div className="space-y-6">
        {/* Filters and Export */}
        <Card>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Show lots expiring within:
              </label>
              <div className="flex gap-2">
                {DAYS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setDaysAhead(option.value)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                      daysAhead === option.value
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={exportToCSV} disabled={lots.length === 0}>
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </Button>
          </div>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{lots.length}</p>
                <p className="text-sm text-gray-500">Total Lots</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{expiredCount}</p>
                <p className="text-sm text-gray-500">Expired</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">{criticalCount}</p>
                <p className="text-sm text-gray-500">Critical (≤7 days)</p>
              </div>
            </div>
          </Card>
          <Card>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-yellow-600">{warningCount}</p>
                <p className="text-sm text-gray-500">Warning (≤30 days)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Table */}
        <Card>
          {loading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-gray-200 rounded w-1/4"></div>
              <div className="h-64 bg-gray-100 rounded"></div>
            </div>
          ) : lots.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">
                No lots expiring within the next {daysAhead} days
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lot / Batch
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Expiration Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Left
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qty on Hand
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {lots.map((lot) => {
                    const daysLeft = lot.expiration_date
                      ? getDaysUntilExpiration(lot.expiration_date)
                      : null;

                    return (
                      <tr key={lot.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            {lot.lot_number && (
                              <p className="text-sm font-medium text-gray-900">
                                Lot: {lot.lot_number}
                              </p>
                            )}
                            {lot.batch_number && (
                              <p className="text-sm text-gray-500">
                                Batch: {lot.batch_number}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {lot.product?.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {lot.product?.sku}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {lot.expiration_date
                            ? new Date(lot.expiration_date).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {daysLeft !== null && getExpirationBadge(daysLeft)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                          {getTotalQuantity(lot).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                              lot.status === "active"
                                ? "bg-green-100 text-green-800"
                                : lot.status === "quarantine"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {lot.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/lots/${lot.id}`}
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
