"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle,
  ChevronRight,
  Filter,
} from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  getPortalLots,
  getPortalExpiringLotsSummary,
  PortalLot,
} from "@/lib/api/portal-lots";

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  quarantine: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  expired: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  depleted: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function PortalLotsPage() {
  const { client } = useClient();
  const [lots, setLots] = useState<PortalLot[]>([]);
  const [summary, setSummary] = useState({
    expiring7Days: 0,
    expiring30Days: 0,
    expiring90Days: 0,
    expired: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "expiring" | "expired">("all");

  useEffect(() => {
    const fetchData = async () => {
      if (!client) return;

      try {
        const [lotsData, summaryData] = await Promise.all([
          getPortalLots(filter === "expiring" ? { expiringWithinDays: 30 } : filter === "expired" ? { status: "expired" } : undefined),
          getPortalExpiringLotsSummary(),
        ]);

        setLots(lotsData);
        setSummary(summaryData);
      } catch (error) {
        console.error("Failed to fetch lots:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [client, filter]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "No expiration";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
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

  const getExpirationStatus = (dateString: string | null) => {
    const days = getDaysUntilExpiration(dateString);
    if (days === null) return { color: "text-gray-500", label: "No expiration" };
    if (days < 0) return { color: "text-red-600", label: "Expired" };
    if (days <= 7) return { color: "text-red-600", label: `${days} days left` };
    if (days <= 30) return { color: "text-yellow-600", label: `${days} days left` };
    if (days <= 90) return { color: "text-blue-600", label: `${days} days left` };
    return { color: "text-green-600", label: `${days} days left` };
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Lot Tracking
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Monitor lot expirations and inventory by lot
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.expiring7Days}
              </p>
              <p className="text-sm text-gray-500">Expiring in 7 days</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.expiring30Days}
              </p>
              <p className="text-sm text-gray-500">Expiring in 30 days</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.expiring90Days}
              </p>
              <p className="text-sm text-gray-500">Expiring in 90 days</p>
            </div>
          </div>
        </Card>

        <Card className="!p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 dark:bg-gray-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.expired}
              </p>
              <p className="text-sm text-gray-500">Expired lots</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All Lots
          </Button>
          <Button
            variant={filter === "expiring" ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter("expiring")}
          >
            Expiring Soon
          </Button>
          <Button
            variant={filter === "expired" ? "primary" : "outline"}
            size="sm"
            onClick={() => setFilter("expired")}
          >
            Expired
          </Button>
        </div>
      </div>

      {/* Lots List */}
      <Card>
        {lots.length === 0 ? (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              {filter === "all"
                ? "No lots found for your products"
                : filter === "expiring"
                ? "No lots expiring within 30 days"
                : "No expired lots"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {lots.map((lot) => {
              const expStatus = getExpirationStatus(lot.expiration_date);
              return (
                <Link
                  key={lot.id}
                  href={`/portal/lots/${lot.id}`}
                  className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-gray-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 dark:text-white font-mono">
                          {lot.lot_number}
                        </p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[lot.status] || statusColors.active}`}>
                          {lot.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {lot.product.sku} - {lot.product.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {lot.qty_on_hand.toLocaleString()} units
                      </p>
                      <p className={`text-sm ${expStatus.color}`}>
                        {lot.expiration_date ? formatDate(lot.expiration_date) : "No expiration"}
                      </p>
                    </div>
                    <div className="text-right min-w-[100px]">
                      <p className={`text-sm font-medium ${expStatus.color}`}>
                        {expStatus.label}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
