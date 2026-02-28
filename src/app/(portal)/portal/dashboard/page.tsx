"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Package, Truck, Boxes, PackageCheck, Settings } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import StatCard from "@/components/ui/StatCard";
import Spinner from "@/components/ui/Spinner";
import FetchError from "@/components/ui/FetchError";
import { handleApiError } from "@/lib/utils/error-handler";
import DashboardCustomizer from "@/components/dashboard/DashboardCustomizer";
import DynamicWidgetGrid from "@/components/dashboard/DynamicWidgetGrid";
import { PORTAL_WIDGET_COMPONENTS } from "@/components/dashboard/portal";
import { PORTAL_WIDGETS } from "@/lib/dashboard/portal-widgets";
import { useDashboardLayout } from "@/lib/hooks/useDashboardLayout";
import { createClient } from "@/lib/supabase";
import {
  getPortalUnreadCount,
  getPortalOpenReturnsCount,
  getPortalMonthlyProfit,
  getClientInventoryValueOverTime,
  getClientOrderFulfillmentSpeed,
  getClientSpendingBreakdown,
  getClientProductPerformance,
  getClientStockProjection,
  MonthlyProfitability,
  InventoryValuePoint,
  FulfillmentSpeedPoint,
  SpendingCategory,
  ProductPerformancePoint,
  StockProjectionPoint,
} from "@/lib/api/portal-dashboard";
import { formatDate, formatCurrency, getGreeting } from "@/lib/utils/formatting";

interface DashboardStats {
  totalProducts: number;
  totalUnits: number;
  activeOrders: number;
  recentArrivals: number;
}

interface RecentOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  item_count: number;
}

interface RecentArrival {
  id: string;
  order_number: string;
  received_at: string;
  product_summary: string;
}

export default function PortalDashboardPage() {
  const { client } = useClient();
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalUnits: 0,
    activeOrders: 0,
    recentArrivals: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [activeOrdersList, setActiveOrdersList] = useState<RecentOrder[]>([]);
  const [recentArrivalsList, setRecentArrivalsList] = useState<RecentArrival[]>([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [openReturns, setOpenReturns] = useState(0);
  const [profitability, setProfitability] = useState<MonthlyProfitability>({
    netProfit: 0,
    totalRevenue: 0,
    totalCost: 0,
    marginPercentage: 0,
    orderCount: 0,
    unitsSold: 0,
  });
  const [inventoryValueOverTime, setInventoryValueOverTime] = useState<InventoryValuePoint[]>([]);
  const [fulfillmentSpeed, setFulfillmentSpeed] = useState<FulfillmentSpeedPoint[]>([]);
  const [spendingBreakdown, setSpendingBreakdown] = useState<SpendingCategory[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformancePoint[]>([]);
  const [stockProjection, setStockProjection] = useState<StockProjectionPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  } = useDashboardLayout("portal", PORTAL_WIDGETS, client?.id, "client");

  const fetchData = useCallback(async () => {
    if (!client || client.id === "staff-preview") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: inventoryData } = await supabase
        .from("inventory")
        .select(`
          qty_on_hand,
          product:products!inner (
            id,
            client_id
          )
        `)
        .eq("product.client_id", client.id);

      const totalProducts = inventoryData?.length || 0;
      const totalUnits = (inventoryData || []).reduce(
        (sum, item) => sum + (item.qty_on_hand || 0),
        0
      );

      const { count: activeOrders } = await supabase
        .from("outbound_orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .in("status", ["pending", "confirmed", "processing", "packed", "shipped"]);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentArrivals } = await supabase
        .from("inbound_orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .eq("status", "received")
        .gte("updated_at", thirtyDaysAgo.toISOString());

      setStats({
        totalProducts,
        totalUnits,
        activeOrders: activeOrders || 0,
        recentArrivals: recentArrivals || 0,
      });

      const { data: recentData } = await supabase
        .from("outbound_orders")
        .select(`
          id,
          order_number,
          status,
          created_at,
          items:outbound_items(count)
        `)
        .eq("client_id", client.id)
        .order("created_at", { ascending: false })
        .limit(5);

      setRecentOrders(
        (recentData || []).map((order) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          created_at: order.created_at,
          item_count: (order.items as unknown as { count: number }[])?.[0]?.count || 0,
        }))
      );

      const { data: activeData } = await supabase
        .from("outbound_orders")
        .select(`
          id,
          order_number,
          status,
          created_at,
          items:outbound_items(count)
        `)
        .eq("client_id", client.id)
        .in("status", ["pending", "confirmed", "processing", "packed", "shipped"])
        .order("created_at", { ascending: false })
        .limit(5);

      setActiveOrdersList(
        (activeData || []).map((order) => ({
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          created_at: order.created_at,
          item_count: (order.items as unknown as { count: number }[])?.[0]?.count || 0,
        }))
      );

      const { data: arrivalsData } = await supabase
        .from("inbound_orders")
        .select(`
          id,
          order_number,
          updated_at,
          items:inbound_items (
            qty_expected,
            product:products (
              name
            )
          )
        `)
        .eq("client_id", client.id)
        .eq("status", "received")
        .order("updated_at", { ascending: false })
        .limit(5);

      setRecentArrivalsList(
        (arrivalsData || []).map((arrival) => {
          const items = arrival.items as unknown as Array<{
            qty_expected: number;
            product: { name: string } | { name: string }[];
          }>;

          const productNames = items.map((item) => {
            const product = Array.isArray(item.product) ? item.product[0] : item.product;
            return product?.name || "Unknown";
          });

          let summary = "";
          if (productNames.length === 0) {
            summary = "No items";
          } else if (productNames.length <= 2) {
            summary = productNames.join(", ");
          } else {
            summary = `${productNames.slice(0, 2).join(", ")} +${productNames.length - 2} more`;
          }

          return {
            id: arrival.id,
            order_number: arrival.order_number,
            received_at: arrival.updated_at,
            product_summary: summary,
          };
        })
      );

      const unreadCount = await getPortalUnreadCount(client.id);
      setUnreadMessages(unreadCount);

      const returnsCount = await getPortalOpenReturnsCount(client.id);
      setOpenReturns(returnsCount);

      const profitData = await getPortalMonthlyProfit(client.id);
      setProfitability(profitData);

      // Fetch new widget data in parallel
      const [valueOverTime, speed, spending, performance, projection] = await Promise.all([
        getClientInventoryValueOverTime(client.id),
        getClientOrderFulfillmentSpeed(client.id),
        getClientSpendingBreakdown(client.id),
        getClientProductPerformance(client.id),
        getClientStockProjection(client.id),
      ]);
      setInventoryValueOverTime(valueOverTime);
      setFulfillmentSpeed(speed);
      setSpendingBreakdown(spending);
      setProductPerformance(performance);
      setStockProjection(projection);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error) {
    return <FetchError message={error} onRetry={fetchData} />;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="md" />
      </div>
    );
  }

  // Build widget props map
  const widgetProps: Record<string, Record<string, unknown>> = {
    "unread-messages": { unreadMessages },
    "open-returns": { openReturns },
    "profitability": { profitability },
    "recent-orders": { recentOrders },
    "recent-arrivals": { recentArrivalsList },
    "active-orders": { activeOrdersList },
    "quick-actions": {},
    "inventory-value-over-time": { valueData: inventoryValueOverTime },
    "order-fulfillment-speed": { speedData: fulfillmentSpeed },
    "spending-breakdown": { spendingData: spendingBreakdown },
    "product-performance": { performanceData: productPerformance },
    "stock-projection": { projectionData: stockProjection },
  };

  const handleQuickAdd = (id: string) => {
    toggleWidget(id);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Message */}
      <div className="mb-8 animate-widget-enter">
        <h2 className="text-2xl font-semibold text-slate-900">
          {getGreeting()}, {client?.company_name}
        </h2>
        <p className="text-slate-500 mt-1">
          Welcome to your 7 Degrees inventory portal. Here&apos;s an overview of your account.
        </p>
        <div className="flex flex-wrap gap-3 mt-4">
          <Link
            href="/portal/request-shipment"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-teal-700 transition-all shadow-sm text-sm"
          >
            <Truck className="w-4 h-4" />
            Request Shipment
          </Link>
          <Link
            href="/portal/inventory"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 font-medium rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors text-sm"
          >
            <Package className="w-4 h-4" />
            View Inventory
          </Link>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="animate-widget-enter" style={{ animationDelay: "50ms" }}>
          <StatCard
            icon={<Package className="w-6 h-6" />}
            iconColor="bg-cyan-50 text-cyan-600"
            label="Total Products"
            value={loading ? "\u2014" : stats.totalProducts}
            loading={loading}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "100ms" }}>
          <StatCard
            icon={<Boxes className="w-6 h-6" />}
            iconColor="bg-green-50 text-green-600"
            label="Total Units"
            value={loading ? "\u2014" : stats.totalUnits}
            loading={loading}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "150ms" }}>
          <StatCard
            icon={<Truck className="w-6 h-6" />}
            iconColor="bg-purple-50 text-purple-600"
            label="Active Orders"
            value={loading ? "\u2014" : stats.activeOrders}
            loading={loading}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "200ms" }}>
          <StatCard
            icon={<PackageCheck className="w-6 h-6" />}
            iconColor="bg-amber-50 text-amber-600"
            label="Recent Arrivals"
            value={loading ? "\u2014" : stats.recentArrivals}
            loading={loading}
          />
        </div>
      </div>

      {/* Customize button + Customizer Panel */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowCustomizer(!showCustomizer)}
          className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            showCustomizer
              ? "bg-cyan-100 text-cyan-700"
              : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300"
          }`}
        >
          <Settings className="w-4 h-4" />
          Customize
        </button>
      </div>

      {showCustomizer && (
        <DashboardCustomizer
          widgets={widgets}
          registry={PORTAL_WIDGETS}
          isCustomized={isCustomized}
          onToggle={toggleWidget}
          onMove={moveWidget}
          onReorder={reorderByIds}
          onResize={resizeWidget}
          onReset={resetToDefaults}
          onClose={() => setShowCustomizer(false)}
          accent="cyan"
        />
      )}

      {/* Dynamic Widget Grid */}
      <DynamicWidgetGrid
        layout={enabledWidgets}
        componentMap={PORTAL_WIDGET_COMPONENTS}
        widgetProps={widgetProps}
        loading={loading}
        onCustomize={() => setShowCustomizer(true)}
        quickAddIds={["recent-orders", "quick-actions", "active-orders"]}
        onQuickAdd={handleQuickAdd}
        quickAddLabels={{
          "recent-orders": "Recent Orders",
          "quick-actions": "Quick Actions",
          "active-orders": "Active Orders",
        }}
      />
    </div>
  );
}
