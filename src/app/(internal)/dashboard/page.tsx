"use client";

import { useEffect, useState } from "react";
import {
  Package,
  DollarSign,
  AlertTriangle,
  Clock,
  Settings,
} from "lucide-react";
import AppShell from "@/components/internal/AppShell";
import StatCard from "@/components/ui/StatCard";
import FetchError from "@/components/ui/FetchError";
import StockAdjustmentModal from "@/components/internal/StockAdjustmentModal";
import DashboardCustomizer from "@/components/dashboard/DashboardCustomizer";
import DynamicWidgetGrid from "@/components/dashboard/DynamicWidgetGrid";
import { ADMIN_WIDGET_COMPONENTS } from "@/components/dashboard/admin";
import { ADMIN_WIDGETS } from "@/lib/dashboard/admin-widgets";
import { useDashboardLayout } from "@/lib/hooks/useDashboardLayout";
import { createClient } from "@/lib/supabase";
import { formatCurrency, getGreeting } from "@/lib/utils/formatting";
import {
  getDashboardStats,
  getLowStockItems,
  getExpectedArrivals,
  getOrdersToShip,
  getOrdersRequiringAttention,
  getAgedInventory,
  getOrderVelocity,
  DashboardStats,
  RecentActivity,
  ExpectedArrival,
  OrderToShip,
  AgedInventorySummary,
  OrderVelocity,
} from "@/lib/api/dashboard";
import { getReturns, ReturnWithItems } from "@/lib/api/returns";
import { getExpiringLots, LotWithInventory } from "@/lib/api/lots";
import { getInvoices, InvoiceWithItems } from "@/lib/api/invoices";
import { handleApiError } from "@/lib/utils/error-handler";

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
  const [showCustomizer, setShowCustomizer] = useState(false);

  const {
    widgets,
    enabledWidgets,
    isCustomized,
    toggleWidget,
    moveWidget,
    reorderByIds,
    resizeWidget,
    resetToDefaults,
  } = useDashboardLayout("admin", ADMIN_WIDGETS);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserName(user.email.split("@")[0]);
    }

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

  // Build widget props map — routes fetched data to each widget id
  const widgetProps: Record<string, Record<string, unknown>> = {
    "recent-activity": { recentActivity },
    "quick-actions": { onStockAdjustment: () => setShowStockAdjustment(true) },
    "attention-required": { attentionRequired },
    "low-stock-alerts": { lowStockItems },
    "expected-arrivals": { expectedArrivals },
    "orders-to-ship": { ordersToShip },
    "orders-summary": { stats },
    "inventory-overview": { stats },
    "pending-returns": { count: pendingReturns.length, loading },
    "unread-messages": { count: unreadMessagesCount, loading },
    "expiring-lots": { expiringLots, loading },
    "inventory-aging": { agedInventory },
    "order-velocity": { orderVelocity },
    "outstanding-invoices": { outstandingInvoices, loading },
  };

  const handleQuickAdd = (id: string) => {
    toggleWidget(id);
  };

  return (
    <AppShell
      title="Dashboard"
      subtitle="Overview of your warehouse operations"
      actions={
        <button
          onClick={() => setShowCustomizer(!showCustomizer)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            showCustomizer
              ? "bg-indigo-100 text-indigo-700"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
          }`}
        >
          <Settings className="w-4 h-4" />
          Customize
        </button>
      }
    >
      {/* Welcome Message */}
      <div className="mb-8 animate-widget-enter">
        <h2 className="text-2xl font-semibold text-slate-900">
          {getGreeting()}{userName ? `, ${userName}` : ""}!
        </h2>
        <p className="text-slate-500 mt-1">
          Here&apos;s what&apos;s happening at 7D Warehouse today.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="animate-widget-enter" style={{ animationDelay: "50ms" }}>
          <StatCard
            icon={<Package className="w-6 h-6" />}
            iconColor="bg-blue-50 text-blue-600"
            label="Total Products"
            value={loading ? "\u2014" : stats?.totalProducts || 0}
            loading={loading}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "100ms" }}>
          <StatCard
            icon={<DollarSign className="w-6 h-6" />}
            iconColor="bg-green-50 text-green-600"
            label="Inventory Value"
            value={loading ? "\u2014" : formatCurrency(stats?.totalInventoryValue || 0, 0)}
            loading={loading}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "150ms" }}>
          <StatCard
            icon={<AlertTriangle className="w-6 h-6" />}
            iconColor={stats && stats.lowStockCount > 0 ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-400"}
            label="Low Stock Alerts"
            value={loading ? "\u2014" : stats?.lowStockCount || 0}
            loading={loading}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "200ms" }}>
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            iconColor={pendingOrdersTotal > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"}
            label="Pending Orders"
            value={loading ? "\u2014" : pendingOrdersTotal}
            loading={loading}
          />
        </div>
      </div>

      {/* Customizer Panel */}
      {showCustomizer && (
        <div className="mb-8">
          <DashboardCustomizer
            widgets={widgets}
            registry={ADMIN_WIDGETS}
            isCustomized={isCustomized}
            onToggle={toggleWidget}
            onMove={moveWidget}
            onReorder={reorderByIds}
            onResize={resizeWidget}
            onReset={resetToDefaults}
            onClose={() => setShowCustomizer(false)}
            accent="indigo"
          />
        </div>
      )}

      {/* Dynamic Widget Grid */}
      <DynamicWidgetGrid
        layout={enabledWidgets}
        componentMap={ADMIN_WIDGET_COMPONENTS}
        widgetProps={widgetProps}
        loading={loading}
        onCustomize={() => setShowCustomizer(true)}
        quickAddIds={["recent-activity", "quick-actions", "orders-summary"]}
        onQuickAdd={handleQuickAdd}
        quickAddLabels={{
          "recent-activity": "Recent Activity",
          "quick-actions": "Quick Actions",
          "orders-summary": "Orders Summary",
        }}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentModal
        isOpen={showStockAdjustment}
        onClose={() => setShowStockAdjustment(false)}
        onComplete={() => setShowStockAdjustment(false)}
      />
    </AppShell>
  );
}
