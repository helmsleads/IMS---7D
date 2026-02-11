"use client";

import { useEffect, useState } from "react";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Clock,
  FileText,
  Plus,
  ArrowRightLeft,
  RotateCcw,
  Mail,
  Calendar,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Archive,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import Card from "@/components/ui/Card";
import FetchError from "@/components/ui/FetchError";
import StockAdjustmentModal from "@/components/internal/StockAdjustmentModal";
import { createClient } from "@/lib/supabase";
import { getDashboardStats, getLowStockItems, getExpectedArrivals, getOrdersToShip, getOrdersRequiringAttention, getAgedInventory, getOrderVelocity, DashboardStats, RecentActivity, ExpectedArrival, OrderToShip, AgedInventorySummary, OrderVelocity } from "@/lib/api/dashboard";
import { getReturns, ReturnWithItems } from "@/lib/api/returns";
import { getExpiringLots, LotWithInventory } from "@/lib/api/lots";
import { getInvoices, InvoiceWithItems } from "@/lib/api/invoices";
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
  const [pendingReturns, setPendingReturns] = useState<ReturnWithItems[]>([]);
  const [expiringLots, setExpiringLots] = useState<LotWithInventory[]>([]);
  const [outstandingInvoices, setOutstandingInvoices] = useState<InvoiceWithItems[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [agedInventory, setAgedInventory] = useState<AgedInventorySummary | null>(null);
  const [orderVelocity, setOrderVelocity] = useState<OrderVelocity | null>(null);
  const [attentionRequired, setAttentionRequired] = useState<{
    urgentOutbound: { id: string; order_number: string; status: string; requested_at: string | null; client: { company_name: string } | null }[];
    overdueInbound: { id: string; po_number: string; status: string; expected_date: string | null; supplier: string }[];
  } | null>(null);
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

    // Fetch dashboard stats, low stock items, expected arrivals, orders to ship, and new widgets data
    try {
      const [dashboardData, lowStock, arrivals, toShip, returns, lots, invoices, aged, velocity, attention] = await Promise.all([
        getDashboardStats(),
        getLowStockItems(),
        getExpectedArrivals(),
        getOrdersToShip(),
        getReturns({ status: "requested" }),
        getExpiringLots(30),
        getInvoices({ status: "sent" }),
        getAgedInventory(),
        getOrderVelocity(),
        getOrdersRequiringAttention(),
      ]);
      setStats(dashboardData.stats);
      setRecentActivity(dashboardData.recentActivity);
      setLowStockItems(lowStock);
      setExpectedArrivals(arrivals);
      setOrdersToShip(toShip);
      setPendingReturns(returns);
      setExpiringLots(lots);
      setOutstandingInvoices(invoices);
      setAgedInventory(aged);
      setOrderVelocity(velocity);
      setAttentionRequired(attention);

      // Fetch unread messages count
      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
      setUnreadMessagesCount(count || 0);
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

        {/* Attention Required */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Attention Required</h3>
          </div>
          {(!attentionRequired || (attentionRequired.urgentOutbound.length === 0 && attentionRequired.overdueInbound.length === 0)) ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-500 text-sm">No items need attention</p>
            </div>
          ) : (
            <div className="space-y-3">
              {attentionRequired.urgentOutbound.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-600 mb-2">
                    Stale Outbound ({attentionRequired.urgentOutbound.length})
                  </p>
                  {attentionRequired.urgentOutbound.map((order) => {
                    const days = order.requested_at
                      ? Math.floor((Date.now() - new Date(order.requested_at).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    return (
                      <Link
                        key={order.id}
                        href={`/outbound/${order.id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-gray-50 -mx-2 px-2 rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{order.order_number}</p>
                          <p className="text-xs text-gray-500 truncate">{order.client?.company_name || "Unknown"}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 ml-2">
                          {days}d pending
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
              {attentionRequired.overdueInbound.length > 0 && (
                <div className={attentionRequired.urgentOutbound.length > 0 ? "border-t border-gray-100 pt-3" : ""}>
                  <p className="text-xs font-medium text-orange-600 mb-2">
                    Overdue Inbound ({attentionRequired.overdueInbound.length})
                  </p>
                  {attentionRequired.overdueInbound.map((order) => {
                    const daysOverdue = order.expected_date
                      ? Math.floor((Date.now() - new Date(order.expected_date).getTime()) / (1000 * 60 * 60 * 24))
                      : 0;
                    return (
                      <Link
                        key={order.id}
                        href={`/inbound/${order.id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-gray-50 -mx-2 px-2 rounded"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{order.po_number}</p>
                          <p className="text-xs text-gray-500 truncate">{order.supplier}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 ml-2">
                          {daysOverdue}d overdue
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
            <div className="flex items-center gap-3">
              {lowStockItems.length > 0 && (
                <>
                  <Link
                    href="/reports/reorder-suggestions"
                    className="text-sm text-green-600 hover:text-green-800 font-medium"
                  >
                    Reorder
                  </Link>
                  <Link
                    href="/inventory?filter=low-stock"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View All
                  </Link>
                </>
              )}
            </div>
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

        {/* Pending Returns */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pending Returns</h3>
            <Link
              href="/returns"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              pendingReturns.length > 0 ? "bg-orange-100" : "bg-gray-100"
            }`}>
              <RotateCcw className={`w-6 h-6 ${
                pendingReturns.length > 0 ? "text-orange-600" : "text-gray-400"
              }`} />
            </div>
            <div>
              <p className={`text-2xl font-semibold ${
                pendingReturns.length > 0 ? "text-orange-600" : "text-gray-900"
              }`}>
                {loading ? "—" : pendingReturns.length}
              </p>
              <p className="text-sm text-gray-500">
                {pendingReturns.length === 1 ? "Return" : "Returns"} awaiting approval
              </p>
            </div>
          </div>
        </Card>

        {/* Unread Messages */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Messages</h3>
            <Link
              href="/messages"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View Inbox
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              unreadMessagesCount > 0 ? "bg-blue-100" : "bg-gray-100"
            }`}>
              <Mail className={`w-6 h-6 ${
                unreadMessagesCount > 0 ? "text-blue-600" : "text-gray-400"
              }`} />
            </div>
            <div>
              <p className={`text-2xl font-semibold ${
                unreadMessagesCount > 0 ? "text-blue-600" : "text-gray-900"
              }`}>
                {loading ? "—" : unreadMessagesCount}
              </p>
              <p className="text-sm text-gray-500">
                Unread {unreadMessagesCount === 1 ? "message" : "messages"}
              </p>
            </div>
          </div>
        </Card>

        {/* Expiring Lots */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Expiring Lots</h3>
            <Link
              href="/reports/lot-expiration"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View All
            </Link>
          </div>
          {expiringLots.length === 0 ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-500 text-sm">No lots expiring soon</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-semibold text-orange-600">
                    {loading ? "—" : expiringLots.length}
                  </p>
                  <p className="text-sm text-gray-500">
                    Lots expiring in 30 days
                  </p>
                </div>
              </div>
              <div className="space-y-2 border-t border-gray-100 pt-3">
                {expiringLots.slice(0, 3).map((lot) => {
                  const daysLeft = lot.expiration_date
                    ? Math.ceil(
                        (new Date(lot.expiration_date).getTime() - new Date().getTime()) /
                          (1000 * 60 * 60 * 24)
                      )
                    : 0;
                  return (
                    <Link
                      key={lot.id}
                      href={`/lots/${lot.id}`}
                      className="flex items-center justify-between py-1 hover:bg-gray-50 -mx-2 px-2 rounded"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {lot.lot_number || lot.batch_number}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {lot.product?.name}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        daysLeft <= 7
                          ? "bg-red-100 text-red-700"
                          : daysLeft <= 14
                          ? "bg-orange-100 text-orange-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {daysLeft <= 0 ? "Expired" : `${daysLeft}d`}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        {/* Inventory Aging */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Inventory Aging</h3>
            <Link
              href="/reports"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View Reports
            </Link>
          </div>
          {!agedInventory || (agedInventory.over30Days === 0 && agedInventory.over60Days === 0 && agedInventory.over90Days === 0) ? (
            <div className="text-center py-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-2">
                <Archive className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-gray-500 text-sm">All inventory is moving</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">30-60 days</span>
                  <span className={`font-medium ${agedInventory.over30Days > 0 ? "text-yellow-600" : "text-gray-900"}`}>
                    {agedInventory.over30Days} items
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">60-90 days</span>
                  <span className={`font-medium ${agedInventory.over60Days > 0 ? "text-orange-600" : "text-gray-900"}`}>
                    {agedInventory.over60Days} items
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">90+ days</span>
                  <span className={`font-medium ${agedInventory.over90Days > 0 ? "text-red-600" : "text-gray-900"}`}>
                    {agedInventory.over90Days} items
                  </span>
                </div>
              </div>
              {agedInventory.oldestItems.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-500 mb-2">Oldest items</p>
                  <div className="space-y-2">
                    {agedInventory.oldestItems.slice(0, 3).map((item) => (
                      <div key={`${item.productId}-${item.locationName}`} className="flex items-center justify-between text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{item.sku}</p>
                          <p className="text-xs text-gray-500 truncate">{item.locationName}</p>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 ml-2">
                          {item.daysSinceLastMove}d
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </Card>

        {/* Order Velocity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Order Velocity</h3>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              orderVelocity?.trend === "up" ? "bg-green-100" :
              orderVelocity?.trend === "down" ? "bg-red-100" :
              "bg-gray-100"
            }`}>
              {orderVelocity?.trend === "up" ? (
                <TrendingUp className="w-6 h-6 text-green-600" />
              ) : orderVelocity?.trend === "down" ? (
                <TrendingDown className="w-6 h-6 text-red-600" />
              ) : (
                <TrendingUp className="w-6 h-6 text-gray-400" />
              )}
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? "—" : orderVelocity?.shippedThisWeek || 0}
              </p>
              <p className="text-sm text-gray-500">
                Shipped this week
                {orderVelocity && orderVelocity.trendPercent !== 0 && (
                  <span className={`ml-1 ${
                    orderVelocity.trend === "up" ? "text-green-600" : "text-red-600"
                  }`}>
                    ({orderVelocity.trendPercent > 0 ? "+" : ""}{orderVelocity.trendPercent}%)
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="space-y-2 border-t border-gray-100 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Shipped last week</span>
              <span className="font-medium text-gray-900">
                {orderVelocity?.shippedLastWeek || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Received this week</span>
              <span className="font-medium text-gray-900">
                {orderVelocity?.receivedThisWeek || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Received last week</span>
              <span className="font-medium text-gray-900">
                {orderVelocity?.receivedLastWeek || 0}
              </span>
            </div>
          </div>
        </Card>

        {/* Outstanding Invoices */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Outstanding Invoices</h3>
            <Link
              href="/billing"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              View Billing
            </Link>
          </div>
          {(() => {
            const totalOutstanding = outstandingInvoices.reduce(
              (sum, inv) => sum + (inv.total - (inv.amount_paid || 0)),
              0
            );
            const overdueCount = outstandingInvoices.filter((inv) => {
              if (!inv.due_date) return false;
              return new Date(inv.due_date) < new Date();
            }).length;

            return (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    totalOutstanding > 0 ? "bg-green-100" : "bg-gray-100"
                  }`}>
                    <CreditCard className={`w-6 h-6 ${
                      totalOutstanding > 0 ? "text-green-600" : "text-gray-400"
                    }`} />
                  </div>
                  <div>
                    <p className="text-2xl font-semibold text-gray-900">
                      {loading ? "—" : formatCurrency(totalOutstanding)}
                    </p>
                    <p className="text-sm text-gray-500">Outstanding balance</p>
                  </div>
                </div>
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Open invoices</span>
                    <span className="font-medium text-gray-900">
                      {outstandingInvoices.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Overdue</span>
                    <span className={`font-medium ${
                      overdueCount > 0 ? "text-red-600" : "text-gray-900"
                    }`}>
                      {overdueCount}
                    </span>
                  </div>
                </div>
              </>
            );
          })()}
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
