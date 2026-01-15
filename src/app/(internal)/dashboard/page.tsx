"use client";

import { useEffect, useState } from "react";
import { Package, DollarSign, AlertTriangle, Clock, FileText, Plus, ArrowRightLeft } from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import FetchError from "@/components/ui/FetchError";
import StockAdjustmentModal from "@/components/internal/StockAdjustmentModal";
import { createClient } from "@/lib/supabase";
import { getDashboardStats, getLowStockItems, getExpectedArrivals, getOrdersToShip, DashboardStats, RecentActivity, ExpectedArrival, OrderToShip } from "@/lib/api/dashboard";
import { handleApiError } from "@/lib/utils/error-handler";
import Link from "next/link";

interface LowStockItem {
  id: string;
  product_id: string;
  location_id: string;
  qty_on_hand: number;
  product: {
    id: string;
    sku: string;
    name: string;
    reorder_point: number;
  };
  location: {
    id: string;
    name: string;
  };
}

export default function DashboardPage() {
  const [userName, setUserName] = useState<string>("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
  const [expectedArrivals, setExpectedArrivals] = useState<ExpectedArrival[]>([]);
  const [ordersToShip, setOrdersToShip] = useState<OrderToShip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStockAdjustment, setShowStockAdjustment] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    // Get user info
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserName(user.email.split("@")[0]);
    }

    // Fetch dashboard stats, low stock items, expected arrivals, and orders to ship
    try {
      const [dashboardData, lowStock, arrivals, toShip] = await Promise.all([
        getDashboardStats(),
        getLowStockItems(),
        getExpectedArrivals(),
        getOrdersToShip(),
      ]);
      setStats(dashboardData.stats);
      setRecentActivity(dashboardData.recentActivity);
      setLowStockItems(lowStock);
      setExpectedArrivals(arrivals);
      setOrdersToShip(toShip);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatActivityAction = (activity: RecentActivity) => {
    const actionMap: Record<string, string> = {
      created: "Created",
      updated: "Updated",
      deleted: "Deleted",
      status_changed: "Status changed",
      stock_adjustment: "Stock adjusted",
      shipped: "Shipped",
      received: "Received",
    };
    return actionMap[activity.action] || activity.action;
  };

  const formatActivityEntity = (activity: RecentActivity) => {
    const entityMap: Record<string, string> = {
      product: "Product",
      client: "Client",
      inbound_order: "Inbound Order",
      outbound_order: "Outbound Order",
      inventory: "Inventory",
      outbound_item: "Outbound Item",
      inbound_item: "Inbound Item",
    };
    return entityMap[activity.entity_type] || activity.entity_type;
  };

  const pendingOrdersTotal = stats
    ? stats.pendingInbound + stats.pendingOutbound
    : 0;

  if (error) {
    return (
      <AppShell
        title="Dashboard"
        subtitle="Overview of your warehouse operations"
      >
        <FetchError message={error} onRetry={fetchData} />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Dashboard"
      subtitle="Overview of your warehouse operations"
    >
      {/* Welcome Message */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">
          {getGreeting()}{userName ? `, ${userName}` : ""}!
        </h2>
        <p className="text-gray-600 mt-1">
          Here&apos;s what&apos;s happening at 7D Warehouse today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Products */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? "—" : stats?.totalProducts || 0}
              </p>
              <p className="text-sm text-gray-500">Total Products</p>
            </div>
          </div>
        </Card>

        {/* Total Inventory Value */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? "—" : formatCurrency(stats?.totalInventoryValue || 0)}
              </p>
              <p className="text-sm text-gray-500">Inventory Value</p>
            </div>
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              stats && stats.lowStockCount > 0
                ? "bg-red-100"
                : "bg-gray-100"
            }`}>
              <AlertTriangle className={`w-6 h-6 ${
                stats && stats.lowStockCount > 0
                  ? "text-red-600"
                  : "text-gray-400"
              }`} />
            </div>
            <div>
              <p className={`text-2xl font-semibold ${
                stats && stats.lowStockCount > 0
                  ? "text-red-600"
                  : "text-gray-900"
              }`}>
                {loading ? "—" : stats?.lowStockCount || 0}
              </p>
              <p className="text-sm text-gray-500">Low Stock Alerts</p>
            </div>
          </div>
        </Card>

        {/* Pending Orders */}
        <Card>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              pendingOrdersTotal > 0
                ? "bg-amber-100"
                : "bg-gray-100"
            }`}>
              <Clock className={`w-6 h-6 ${
                pendingOrdersTotal > 0
                  ? "text-amber-600"
                  : "text-gray-400"
              }`} />
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? "—" : pendingOrdersTotal}
              </p>
              <p className="text-sm text-gray-500">Pending Orders</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            {recentActivity.length > 0 && (
              <Link
                href="/activity"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View All
              </Link>
            )}
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-gray-500 text-sm">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.slice(0, 10).map((activity) => {
                const details = activity.details as Record<string, string>;
                const identifier = details?.order_number || details?.po_number || details?.sku || details?.company_name || details?.name || "";
                const userName = activity.user_email?.split("@")[0] || "System";

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 text-sm"
                  >
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                      activity.action === "created" ? "bg-green-500" :
                      activity.action === "deleted" ? "bg-red-500" :
                      activity.action === "shipped" ? "bg-purple-500" :
                      activity.action === "received" ? "bg-blue-500" :
                      "bg-gray-400"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900">
                        {formatActivityEntity(activity)}{" "}
                        {identifier && (
                          <span className="font-medium">{identifier}</span>
                        )}{" "}
                        <span className="text-gray-500">
                          {formatActivityAction(activity).toLowerCase()}
                        </span>
                        {userName !== "System" && (
                          <span className="text-gray-500"> by {userName}</span>
                        )}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {new Date(activity.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/inbound/new"
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">New PO</span>
            </Link>
            <Link
              href="/outbound/new"
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-700">New Order</span>
            </Link>
            <button
              onClick={() => setShowStockAdjustment(true)}
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-left"
            >
              <ArrowRightLeft className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-gray-700">Stock Adjustment</span>
            </button>
            <Link
              href="/products?action=new"
              className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700">Add Product</span>
            </Link>
          </div>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
            {lowStockItems.length > 0 && (
              <Link
                href="/inventory?filter=low-stock"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View All
              </Link>
            )}
          </div>
          {lowStockItems.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <Package className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-500 text-sm">All items are well stocked</p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockItems.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {item.product.name}
                    </p>
                    <p className="text-xs text-gray-500">{item.product.sku}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-red-600 font-medium">
                      {item.qty_on_hand} units
                    </p>
                    <p className="text-xs text-gray-500">
                      Reorder at {item.product.reorder_point}
                    </p>
                  </div>
                </div>
              ))}
              {lowStockItems.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  and {lowStockItems.length - 5} more...
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Expected Arrivals */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Expected Arrivals</h3>
            {expectedArrivals.length > 0 && (
              <Link
                href="/inbound"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View All
              </Link>
            )}
          </div>
          {expectedArrivals.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <Package className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">No pending arrivals</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expectedArrivals.slice(0, 5).map((arrival) => {
                const isOverdue = arrival.expected_date && new Date(arrival.expected_date) < new Date(new Date().toISOString().split("T")[0]);
                return (
                  <Link
                    key={arrival.id}
                    href={`/inbound/${arrival.id}`}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {arrival.po_number}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{arrival.supplier}</p>
                    </div>
                    <div className="text-right ml-4">
                      <p className={`font-medium ${isOverdue ? "text-red-600" : "text-gray-900"}`}>
                        {arrival.expected_date
                          ? new Date(arrival.expected_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "No date"}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {arrival.status.replace("_", " ")}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {expectedArrivals.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  and {expectedArrivals.length - 5} more...
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Orders to Ship */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Orders to Ship</h3>
            {ordersToShip.length > 0 && (
              <Link
                href="/outbound"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View All
              </Link>
            )}
          </div>
          {ordersToShip.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-2">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">No orders to ship</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ordersToShip.slice(0, 5).map((order) => {
                const isRush = order.is_rush;
                return (
                  <Link
                    key={order.id}
                    href={`/outbound/${order.id}`}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          {order.order_number}
                        </p>
                        {isRush && (
                          <span className="inline-flex px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                            Rush
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {order.client?.company_name || "Unknown client"}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium text-gray-900">
                        {order.items_count} item{order.items_count !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-gray-500">
                        {order.requested_at
                          ? new Date(order.requested_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "No date"}
                      </p>
                    </div>
                  </Link>
                );
              })}
              {ordersToShip.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  and {ordersToShip.length - 5} more...
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Orders Summary */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Orders Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Inbound to receive</span>
              <span className="font-medium text-gray-900">
                {stats?.pendingInbound || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Outbound to ship</span>
              <span className="font-medium text-gray-900">
                {stats?.pendingOutbound || 0}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Ship today</span>
                <span className={`font-medium ${
                  stats && stats.ordersToShipToday > 0
                    ? "text-amber-600"
                    : "text-gray-900"
                }`}>
                  {stats?.ordersToShipToday || 0}
                </span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">Receive today</span>
                <span className={`font-medium ${
                  stats && stats.ordersToReceiveToday > 0
                    ? "text-blue-600"
                    : "text-gray-900"
                }`}>
                  {stats?.ordersToReceiveToday || 0}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Inventory Overview */}
        <Card>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Units</span>
              <span className="font-medium text-gray-900">
                {stats?.totalUnitsInStock.toLocaleString() || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Value</span>
              <span className="font-medium text-gray-900">
                {formatCurrency(stats?.totalInventoryValue || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Low Stock Items</span>
              <span className={`font-medium ${
                stats && stats.lowStockCount > 0
                  ? "text-red-600"
                  : "text-gray-900"
              }`}>
                {stats?.lowStockCount || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Active Clients</span>
              <span className="font-medium text-gray-900">
                {stats?.totalClients || 0}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={showStockAdjustment}
        onClose={() => setShowStockAdjustment(false)}
        onComplete={() => setShowStockAdjustment(false)}
      />
    </AppShell>
  );
}
