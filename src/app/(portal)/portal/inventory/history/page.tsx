"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  History,
  TrendingDown,
  TrendingUp,
  Package,
  Filter,
  Calendar,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
  getPortalInventoryTransactions,
  getPortalTransactionSummary,
  PortalInventoryTransaction,
} from "@/lib/api/portal-inventory-transactions";

const transactionLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  receive: { label: "Received", color: "text-green-700", bgColor: "bg-green-100" },
  ship: { label: "Shipped", color: "text-blue-700", bgColor: "bg-blue-100" },
  pick: { label: "Picked", color: "text-purple-700", bgColor: "bg-purple-100" },
  pack: { label: "Packed", color: "text-indigo-700", bgColor: "bg-indigo-100" },
  putaway: { label: "Put Away", color: "text-cyan-700", bgColor: "bg-cyan-100" },
  adjust: { label: "Adjusted", color: "text-yellow-700", bgColor: "bg-yellow-100" },
  return_restock: { label: "Returned", color: "text-teal-700", bgColor: "bg-teal-100" },
  transfer: { label: "Transferred", color: "text-orange-700", bgColor: "bg-orange-100" },
  cycle_count: { label: "Count Adj.", color: "text-amber-700", bgColor: "bg-amber-100" },
  reserve: { label: "Reserved", color: "text-violet-700", bgColor: "bg-violet-100" },
  release: { label: "Released", color: "text-lime-700", bgColor: "bg-lime-100" },
  damage_writeoff: { label: "Write-off", color: "text-red-700", bgColor: "bg-red-100" },
  expire: { label: "Expired", color: "text-rose-700", bgColor: "bg-rose-100" },
  quarantine: { label: "Quarantine", color: "text-red-700", bgColor: "bg-red-100" },
};

export default function PortalInventoryHistoryPage() {
  const { client } = useClient();
  const [transactions, setTransactions] = useState<PortalInventoryTransaction[]>([]);
  const [summary, setSummary] = useState({
    totalReceived: 0,
    totalShipped: 0,
    totalAdjusted: 0,
    totalReturns: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState({
    start: "",
    end: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;

      try {
        // Calculate date range for summary (last 30 days)
        const endDate = new Date().toISOString();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);

        const [txData, summaryData] = await Promise.all([
          getPortalInventoryTransactions({
            transactionType: filter !== "all" ? filter as any : undefined,
            startDate: dateRange.start || undefined,
            endDate: dateRange.end || undefined,
            limit: 100,
          }),
          getPortalTransactionSummary(30),
        ]);

        setTransactions(txData);
        setSummary(summaryData);
      } catch (error) {
        console.error("Failed to fetch transactions:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client, filter, dateRange]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/portal/inventory">
          <Button variant="ghost">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Inventory
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Inventory History
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track all inventory movements and changes
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Received (30d)</p>
              <p className="text-2xl font-bold text-green-600">
                +{summary.totalReceived.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-200" />
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Shipped (30d)</p>
              <p className="text-2xl font-bold text-blue-600">
                -{summary.totalShipped.toLocaleString()}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-blue-200" />
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Returns (30d)</p>
              <p className="text-2xl font-bold text-teal-600">
                +{summary.totalReturns.toLocaleString()}
              </p>
            </div>
            <Package className="w-8 h-8 text-teal-200" />
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Adjustments (30d)</p>
              <p className={`text-2xl font-bold ${summary.totalAdjusted >= 0 ? "text-yellow-600" : "text-red-600"}`}>
                {summary.totalAdjusted >= 0 ? "+" : ""}{summary.totalAdjusted.toLocaleString()}
              </p>
            </div>
            <History className="w-8 h-8 text-yellow-200" />
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="all">All Types</option>
              <option value="receive">Received</option>
              <option value="ship">Shipped</option>
              <option value="return_restock">Returns</option>
              <option value="adjust">Adjustments</option>
              <option value="cycle_count">Cycle Counts</option>
              <option value="transfer">Transfers</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="w-40"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="w-40"
            />
          </div>
        </div>
      </Card>

      {/* Transactions List */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Recent Transactions
          </h2>
          <span className="text-sm text-gray-500">({transactions.length})</span>
        </div>

        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No transactions found
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Product</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Before</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Change</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((tx) => {
                  const txInfo = transactionLabels[tx.transaction_type] || {
                    label: tx.transaction_type,
                    color: "text-gray-700",
                    bgColor: "bg-gray-100",
                  };
                  const isPositive = tx.qty_change > 0;

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatDateTime(tx.created_at)}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${txInfo.bgColor} ${txInfo.color}`}>
                          {txInfo.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {tx.product.sku}
                          </p>
                          <p className="text-sm text-gray-500 truncate max-w-[200px]">
                            {tx.product.name}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600 dark:text-gray-400">
                        {tx.qty_before.toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}>
                        {isPositive ? "+" : ""}{tx.qty_change.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-900 dark:text-white">
                        {tx.qty_after.toLocaleString()}
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
  );
}
