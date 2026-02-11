"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Package,
  Calendar,
  AlertTriangle,
  History,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { getPortalLotDetail, PortalLot } from "@/lib/api/portal-lots";

const transactionLabels: Record<string, { label: string; color: string }> = {
  receive: { label: "Received", color: "text-green-600" },
  ship: { label: "Shipped", color: "text-blue-600" },
  pick: { label: "Picked", color: "text-purple-600" },
  adjust: { label: "Adjusted", color: "text-yellow-600" },
  return_restock: { label: "Returned", color: "text-cyan-600" },
  transfer: { label: "Transferred", color: "text-indigo-600" },
  cycle_count: { label: "Count Adjustment", color: "text-orange-600" },
  expire: { label: "Expired", color: "text-red-600" },
  quarantine: { label: "Quarantined", color: "text-red-600" },
};

export default function PortalLotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { client } = useClient();
  const [lot, setLot] = useState<PortalLot | null>(null);
  const [transactions, setTransactions] = useState<Array<{
    id: string;
    transaction_type: string;
    qty_change: number;
    created_at: string;
    reference_type: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!client || !params.id) return;

      try {
        const data = await getPortalLotDetail(params.id as string);
        if (data) {
          setLot(data.lot);
          setTransactions(data.transactions);
        } else {
          setError("Lot not found");
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client, params.id]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getDaysUntilExpiration = (dateString: string | null) => {
    if (!dateString) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(dateString);
    expDate.setHours(0, 0, 0, 0);
    return Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !lot) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card>
          <div className="text-center py-8 text-red-600">
            {error || "Lot not found"}
          </div>
        </Card>
      </div>
    );
  }

  const daysUntil = getDaysUntilExpiration(lot.expiration_date);
  const isExpired = daysUntil !== null && daysUntil < 0;
  const isExpiringSoon = daysUntil !== null && daysUntil >= 0 && daysUntil <= 30;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-mono">
            {lot.lot_number}
          </h1>
          <p className="text-gray-500">{lot.product.name}</p>
        </div>
      </div>

      {/* Alert Banner */}
      {(isExpired || isExpiringSoon) && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          isExpired
            ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
            : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400"
        }`}>
          <AlertTriangle className="w-5 h-5" />
          <p>
            {isExpired
              ? `This lot expired ${Math.abs(daysUntil!)} days ago`
              : `This lot expires in ${daysUntil} days`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Lot Details */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Lot Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Lot Number</p>
                <p className="font-medium text-gray-900 dark:text-white font-mono">
                  {lot.lot_number}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                  lot.status === "active"
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : lot.status === "expired"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                    : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}>
                  {lot.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-500">Product SKU</p>
                <p className="font-medium text-gray-900 dark:text-white font-mono">
                  {lot.product.sku}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Quantity On Hand</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {lot.qty_on_hand.toLocaleString()} units
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Manufacture Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(lot.manufacture_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Expiration Date</p>
                <p className={`font-medium ${
                  isExpired ? "text-red-600" : isExpiringSoon ? "text-yellow-600" : "text-gray-900 dark:text-white"
                }`}>
                  {formatDate(lot.expiration_date)}
                </p>
              </div>
            </div>
          </Card>

          {/* Transaction History */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <History className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Transaction History
              </h2>
            </div>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No transaction history available
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => {
                  const txInfo = transactionLabels[tx.transaction_type] || {
                    label: tx.transaction_type,
                    color: "text-gray-600",
                  };
                  const isPositive = tx.qty_change > 0;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {isPositive ? (
                          <TrendingUp className="w-5 h-5 text-green-500" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className={`font-medium ${txInfo.color}`}>
                            {txInfo.label}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDateTime(tx.created_at)}
                          </p>
                        </div>
                      </div>
                      <span className={`font-medium ${
                        isPositive ? "text-green-600" : "text-red-600"
                      }`}>
                        {isPositive ? "+" : ""}{tx.qty_change.toLocaleString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {lot.product.name}
                </p>
                <p className="text-sm text-gray-500 font-mono">{lot.product.sku}</p>
              </div>
            </div>

            <div className="border-t dark:border-gray-700 pt-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900 dark:text-white">
                  {formatDate(lot.created_at)}
                </span>
              </div>
              {lot.expiration_date && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Days Until Expiration</span>
                  <span className={`font-medium ${
                    isExpired ? "text-red-600" : isExpiringSoon ? "text-yellow-600" : "text-green-600"
                  }`}>
                    {daysUntil !== null
                      ? daysUntil < 0
                        ? `${Math.abs(daysUntil)} days ago`
                        : `${daysUntil} days`
                      : "-"}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Stats */}
          <Card>
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
              Quick Stats
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total Received</span>
                <span className="font-medium text-green-600">
                  +{transactions
                    .filter(t => t.qty_change > 0)
                    .reduce((sum, t) => sum + t.qty_change, 0)
                    .toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Total Shipped</span>
                <span className="font-medium text-blue-600">
                  {transactions
                    .filter(t => t.qty_change < 0)
                    .reduce((sum, t) => sum + t.qty_change, 0)
                    .toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center border-t dark:border-gray-700 pt-3">
                <span className="text-gray-500">Current Balance</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {lot.qty_on_hand.toLocaleString()}
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
