"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Truck, Boxes, PackageCheck, Settings } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import StatCard from "@/components/ui/StatCard";
import Spinner from "@/components/ui/Spinner";
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
  MonthlyProfitability,
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
  const [loading, setLoading] = useState(true);
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
  } = useDashboardLayout("portal", PORTAL_WIDGETS);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!client || client.id === "staff-preview") {
        setLoading(false);
        return;
      }

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

      setLoading(false);
    };

    fetchDashboardData();
  }, [client]);

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
  };

  const handleQuickAdd = (id: string) => {
    toggleWidget(id);
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section — Gradient Mesh Hero */}
      <div className="relative bg-gradient-to-br from-cyan-600 via-teal-600 to-blue-700 rounded-2xl p-8 text-white overflow-hidden animate-widget-enter">
        {/* Depth circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute bottom-4 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
        <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-white/15 rounded-full blur-xl" />
        {/* Dot grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10">
          <h1 className="text-2xl font-bold mb-2">
            {getGreeting()}, {client?.company_name}
          </h1>
          <p className="text-white/80 mb-6">
            Welcome to your 7 Degrees inventory portal. Here&apos;s an overview of your account.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/portal/request-shipment"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-cyan-700 font-semibold rounded-xl hover:bg-cyan-50 transition-colors shadow-lg"
            >
              <Truck className="w-5 h-5" />
              Request Shipment
            </Link>
            <Link
              href="/portal/inventory"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white/15 text-white font-semibold rounded-xl hover:bg-white/25 transition-colors border border-white/20 backdrop-blur-sm"
            >
              <Package className="w-5 h-5" />
              View Inventory
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-widget-enter" style={{ animationDelay: "50ms" }}>
          <StatCard
            icon={<Package className="w-6 h-6 text-blue-600" />}
            iconColor="bg-blue-100"
            label="Total Products"
            value={stats.totalProducts}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "100ms" }}>
          <StatCard
            icon={<Boxes className="w-6 h-6 text-green-600" />}
            iconColor="bg-green-100"
            label="Total Units"
            value={stats.totalUnits}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "150ms" }}>
          <StatCard
            icon={<Truck className="w-6 h-6 text-purple-600" />}
            iconColor="bg-purple-100"
            label="Active Orders"
            value={stats.activeOrders}
          />
        </div>
        <div className="animate-widget-enter" style={{ animationDelay: "200ms" }}>
          <StatCard
            icon={<PackageCheck className="w-6 h-6 text-cyan-600" />}
            iconColor="bg-cyan-100"
            label="Recent Arrivals"
            value={stats.recentArrivals}
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
