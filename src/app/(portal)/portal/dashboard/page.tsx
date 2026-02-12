"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Truck, ClipboardList, Boxes, PackageCheck, MessageSquare, RotateCcw, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import StatCard from "@/components/ui/StatCard";
import Spinner from "@/components/ui/Spinner";
import { createClient } from "@/lib/supabase";
import {
  getPortalUnreadCount,
  getPortalOpenReturnsCount,
  getPortalMonthlyProfit,
  MonthlyProfitability,
} from "@/lib/api/portal-dashboard";
import { formatDate, formatCurrency, getGreeting } from "@/lib/utils/formatting";
import StatusBadge from "@/components/ui/StatusBadge";

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

/* ── Order Progress Dots ── */
const ORDER_STAGES = ["pending", "confirmed", "processing", "packed", "shipped", "delivered"] as const;

function OrderProgressDots({ status }: { status: string }) {
  const currentIdx = ORDER_STAGES.indexOf(status as typeof ORDER_STAGES[number]);

  return (
    <div className="flex items-center gap-1 mt-1.5">
      {ORDER_STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div
            key={stage}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              isCurrent
                ? "w-5 bg-cyan-500"
                : isCompleted
                ? "w-1.5 bg-cyan-400"
                : "w-1.5 bg-slate-200"
            }`}
            title={stage}
          />
        );
      })}
    </div>
  );
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      // Skip if no client or staff preview mode without a real client
      if (!client || client.id === "staff-preview") {
        setLoading(false);
        return;
      }

      const supabase = createClient();

      // Fetch inventory stats for this client
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

      // Fetch active orders count
      const { count: activeOrders } = await supabase
        .from("outbound_orders")
        .select("id", { count: "exact", head: true })
        .eq("client_id", client.id)
        .in("status", ["pending", "confirmed", "processing", "packed", "shipped"]);

      // Fetch recent arrivals (inbound orders received in last 30 days)
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

      // Fetch recent orders
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

      // Fetch active orders (not yet delivered)
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

      // Fetch recent arrivals (inbound orders with status "received")
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

          // Build product summary (e.g., "Product A, Product B +2 more")
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

      // Fetch unread messages count using API function
      const unreadCount = await getPortalUnreadCount(client.id);
      setUnreadMessages(unreadCount);

      // Fetch open returns count using API function
      const returnsCount = await getPortalOpenReturnsCount(client.id);
      setOpenReturns(returnsCount);

      // Fetch this month's profitability using API function
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

      {/* Stats Grid — Staggered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-widget-enter stagger-1">
          <StatCard
            icon={<Package className="w-6 h-6 text-blue-600" />}
            iconColor="bg-blue-100"
            label="Total Products"
            value={stats.totalProducts}
          />
        </div>
        <div className="animate-widget-enter stagger-2">
          <StatCard
            icon={<Boxes className="w-6 h-6 text-green-600" />}
            iconColor="bg-green-100"
            label="Total Units"
            value={stats.totalUnits}
          />
        </div>
        <div className="animate-widget-enter stagger-3">
          <StatCard
            icon={<Truck className="w-6 h-6 text-purple-600" />}
            iconColor="bg-purple-100"
            label="Active Orders"
            value={stats.activeOrders}
          />
        </div>
        <div className="animate-widget-enter stagger-4">
          <StatCard
            icon={<PackageCheck className="w-6 h-6 text-cyan-600" />}
            iconColor="bg-cyan-100"
            label="Recent Arrivals"
            value={stats.recentArrivals}
          />
        </div>
      </div>

      {/* Secondary Stats Row — Staggered */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Unread Messages Widget */}
        <div className="animate-widget-enter stagger-5">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${unreadMessages > 0 ? "bg-red-100" : "bg-slate-100"}`}>
                  <MessageSquare className={`w-6 h-6 ${unreadMessages > 0 ? "text-red-600" : "text-slate-500"}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Unread Messages</p>
                  <p className={`text-2xl font-bold ${unreadMessages > 0 ? "text-red-600" : "text-slate-900"}`}>
                    {unreadMessages}
                  </p>
                </div>
              </div>
              <Link
                href="/portal/messages"
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium whitespace-nowrap"
              >
                View Messages
              </Link>
            </div>
          </Card>
        </div>

        {/* Open Returns Widget */}
        <div className="animate-widget-enter stagger-6">
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${openReturns > 0 ? "bg-orange-100" : "bg-slate-100"}`}>
                  <RotateCcw className={`w-6 h-6 ${openReturns > 0 ? "text-orange-600" : "text-slate-500"}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Open Returns</p>
                  <p className={`text-2xl font-bold ${openReturns > 0 ? "text-orange-600" : "text-slate-900"}`}>
                    {openReturns}
                  </p>
                </div>
              </div>
              <Link
                href="/portal/returns"
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium whitespace-nowrap"
              >
                View Returns
              </Link>
            </div>
          </Card>
        </div>

        {/* This Month's Profitability Widget — Accent Card */}
        <div className="animate-widget-enter stagger-7">
          <Card accent={profitability.netProfit >= 0 ? "green" : "red"}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg ${profitability.netProfit >= 0 ? "bg-green-100" : "bg-red-100"}`}>
                  <TrendingUp className={`w-5 h-5 ${profitability.netProfit >= 0 ? "text-green-600" : "text-red-600"}`} />
                </div>
                <p className="text-sm font-medium text-slate-700">This Month&apos;s Profitability</p>
              </div>
              <Link
                href="/portal/profitability"
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium whitespace-nowrap"
              >
                Details
              </Link>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-2xl font-bold ${profitability.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(profitability.netProfit)}
                </p>
                <p className="text-xs text-slate-500">net profit</p>
              </div>
              <div className="text-right">
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                  profitability.marginPercentage >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                }`}>
                  {profitability.marginPercentage >= 0 ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {Math.abs(profitability.marginPercentage).toFixed(1)}%
                </div>
                <p className="text-xs text-slate-500 mt-1">margin</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="animate-widget-enter stagger-1">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent Orders</h2>
              <Link
                href="/portal/orders"
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
              >
                View All
              </Link>
            </div>

            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{order.order_number}</p>
                      <p className="text-sm text-slate-500">
                        {order.item_count} items &middot; {formatDate(order.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} entityType="outbound" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No orders yet</p>
                <Link
                  href="/portal/request-shipment"
                  className="text-cyan-600 hover:underline text-sm mt-1 inline-block"
                >
                  Request your first shipment
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Recent Arrivals */}
        <div className="animate-widget-enter stagger-2">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Recent Arrivals</h2>
              <Link
                href="/portal/inventory"
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
              >
                View All
              </Link>
            </div>

            {recentArrivalsList.length > 0 ? (
              <div className="space-y-3">
                {recentArrivalsList.map((arrival) => (
                  <div
                    key={arrival.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{arrival.order_number}</p>
                      <p className="text-sm text-slate-500">{arrival.product_summary}</p>
                    </div>
                    <span className="text-sm text-slate-400">
                      {formatDate(arrival.received_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <PackageCheck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No recent arrivals</p>
                <p className="text-sm mt-1">
                  Inbound shipments will appear here
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* Active Orders — with Progress Dots */}
        <div className="animate-widget-enter stagger-3">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Active Orders</h2>
              <Link
                href="/portal/orders"
                className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
              >
                View All
              </Link>
            </div>

            {activeOrdersList.length > 0 ? (
              <div className="space-y-3">
                {activeOrdersList.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{order.order_number}</p>
                        <p className="text-sm text-slate-500">
                          {formatDate(order.created_at)}
                        </p>
                        <OrderProgressDots status={order.status} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={order.status} entityType="outbound" />
                      <Link
                        href={`/portal/orders/${order.id}`}
                        className="text-sm text-cyan-600 hover:text-cyan-700 font-medium"
                      >
                        Track
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No active orders</p>
                <Link
                  href="/portal/request-shipment"
                  className="text-cyan-600 hover:underline text-sm mt-1 inline-block"
                >
                  Request a shipment
                </Link>
              </div>
            )}
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="animate-widget-enter stagger-4">
          <Card>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link
                href="/portal/request-shipment"
                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
              >
                <div className="p-3 bg-cyan-100 rounded-xl group-hover:bg-cyan-200 transition-colors">
                  <Truck className="w-5 h-5 text-cyan-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Request Shipment</p>
                  <p className="text-sm text-slate-500">Create a new outbound order</p>
                </div>
              </Link>

              <Link
                href="/portal/inventory"
                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
              >
                <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                  <Package className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">View Inventory</p>
                  <p className="text-sm text-slate-500">Check your current stock levels</p>
                </div>
              </Link>

              <Link
                href="/portal/orders"
                className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
              >
                <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                  <ClipboardList className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">Track Orders</p>
                  <p className="text-sm text-slate-500">View order status and history</p>
                </div>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
