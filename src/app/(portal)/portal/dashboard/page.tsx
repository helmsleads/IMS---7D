"use client";

import { useEffect, useState } from "react";
import { Package, Truck, ClipboardList, Boxes, PackageCheck } from "lucide-react";
import { useClient } from "@/lib/client-auth";
import Card from "@/components/ui/Card";
import { createClient } from "@/lib/supabase";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!client) return;

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

      setLoading(false);
    };

    fetchDashboardData();
  }, [client]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "confirmed":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-purple-100 text-purple-800";
      case "packed":
        return "bg-indigo-100 text-indigo-800";
      case "shipped":
        return "bg-cyan-100 text-cyan-800";
      case "delivered":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white">
        <h1 className="text-2xl font-bold mb-2">
          {getGreeting()}, {client?.company_name}
        </h1>
        <p className="text-blue-100 mb-6">
          Welcome to your 7 Degrees inventory portal. Here&apos;s an overview of your account.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="/portal/request-shipment"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
          >
            <Truck className="w-5 h-5" />
            Request Shipment
          </a>
          <a
            href="/portal/inventory"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-400 transition-colors border border-blue-400"
          >
            <Package className="w-5 h-5" />
            View Inventory
          </a>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Products</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalProducts.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">SKUs in inventory</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Boxes className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Units</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.totalUnits.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">units in stock</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Orders</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.activeOrders}
              </p>
              <p className="text-xs text-gray-400">in progress</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-100 rounded-xl">
              <PackageCheck className="w-6 h-6 text-cyan-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Recent Arrivals</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats.recentArrivals}
              </p>
              <p className="text-xs text-gray-400">last 30 days</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Orders</h2>
            <a
              href="/portal/orders"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </a>
          </div>

          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{order.order_number}</p>
                    <p className="text-sm text-gray-500">
                      {order.item_count} items • {formatDate(order.created_at)}
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                      order.status
                    )}`}
                  >
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No orders yet</p>
              <a
                href="/portal/request-shipment"
                className="text-blue-600 hover:underline text-sm mt-1 inline-block"
              >
                Request your first shipment
              </a>
            </div>
          )}
        </Card>

        {/* Recent Arrivals */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Arrivals</h2>
            <a
              href="/portal/inventory"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </a>
          </div>

          {recentArrivalsList.length > 0 ? (
            <div className="space-y-3">
              {recentArrivalsList.map((arrival) => (
                <div
                  key={arrival.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="font-medium text-gray-900">{arrival.order_number}</p>
                    <p className="text-sm text-gray-500">{arrival.product_summary}</p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {formatDate(arrival.received_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <PackageCheck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No recent arrivals</p>
              <p className="text-sm mt-1">
                Inbound shipments will appear here
              </p>
            </div>
          )}
        </Card>

        {/* Active Orders */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Active Orders</h2>
            <a
              href="/portal/orders"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </a>
          </div>

          {activeOrdersList.length > 0 ? (
            <div className="space-y-3">
              {activeOrdersList.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{order.order_number}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                    <a
                      href={`/portal/orders/${order.id}`}
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Track
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Truck className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No active orders</p>
              <a
                href="/portal/request-shipment"
                className="text-blue-600 hover:underline text-sm mt-1 inline-block"
              >
                Request a shipment
              </a>
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <a
              href="/portal/request-shipment"
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div className="p-3 bg-blue-100 rounded-xl group-hover:bg-blue-200 transition-colors">
                <Truck className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Request Shipment</p>
                <p className="text-sm text-gray-500">Create a new outbound order</p>
              </div>
            </a>

            <a
              href="/portal/inventory"
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div className="p-3 bg-green-100 rounded-xl group-hover:bg-green-200 transition-colors">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">View Inventory</p>
                <p className="text-sm text-gray-500">Check your current stock levels</p>
              </div>
            </a>

            <a
              href="/portal/orders"
              className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            >
              <div className="p-3 bg-purple-100 rounded-xl group-hover:bg-purple-200 transition-colors">
                <ClipboardList className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Track Orders</p>
                <p className="text-sm text-gray-500">View order status and history</p>
              </div>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
