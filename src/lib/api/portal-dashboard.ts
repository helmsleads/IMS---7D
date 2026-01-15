import { createClient } from "@/lib/supabase";

export interface ClientDashboardStats {
  inventory: {
    totalSKUs: number;
    totalUnits: number;
  };
  activeOrdersCount: number;
  recentArrivalsCount: number;
}

/**
 * Fetches dashboard statistics for a specific client
 * @param clientId - The client's UUID
 * @returns Dashboard stats including inventory summary, active orders, and recent arrivals
 */
export async function getClientDashboardStats(
  clientId: string
): Promise<ClientDashboardStats> {
  const supabase = createClient();

  // Fetch inventory stats - total SKUs and units for this client's products
  const { data: inventoryData } = await supabase
    .from("inventory")
    .select(`
      qty_on_hand,
      product:products!inner (
        id,
        client_id
      )
    `)
    .eq("product.client_id", clientId);

  const totalSKUs = inventoryData?.length || 0;
  const totalUnits = (inventoryData || []).reduce(
    (sum, item) => sum + (item.qty_on_hand || 0),
    0
  );

  // Fetch active outbound orders count (pending, confirmed, processing, packed, shipped)
  const { count: activeOrdersCount } = await supabase
    .from("outbound_orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ["pending", "confirmed", "processing", "packed", "shipped"]);

  // Fetch recent arrivals count (inbound orders received in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count: recentArrivalsCount } = await supabase
    .from("inbound_orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "received")
    .gte("updated_at", thirtyDaysAgo.toISOString());

  return {
    inventory: {
      totalSKUs,
      totalUnits,
    },
    activeOrdersCount: activeOrdersCount || 0,
    recentArrivalsCount: recentArrivalsCount || 0,
  };
}

/**
 * Fetches recent orders for a client
 * @param clientId - The client's UUID
 * @param limit - Maximum number of orders to return (default 5)
 * @returns Array of recent orders with item counts
 */
export async function getClientRecentOrders(
  clientId: string,
  limit: number = 5
) {
  const supabase = createClient();

  const { data } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      items:outbound_items(count)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    created_at: order.created_at,
    item_count: (order.items as unknown as { count: number }[])?.[0]?.count || 0,
  }));
}

/**
 * Fetches low stock items for a client
 * @param clientId - The client's UUID
 * @returns Array of products below their reorder point
 */
export async function getClientLowStockItems(clientId: string) {
  const supabase = createClient();

  const { data: inventoryData } = await supabase
    .from("inventory")
    .select(`
      id,
      qty_on_hand,
      product:products!inner (
        id,
        name,
        sku,
        reorder_point,
        client_id
      )
    `)
    .eq("product.client_id", clientId);

  return (inventoryData || [])
    .filter((item) => {
      const product = item.product as unknown as { reorder_point: number };
      return item.qty_on_hand <= product.reorder_point;
    })
    .map((item) => {
      const product = item.product as unknown as {
        id: string;
        name: string;
        sku: string;
        reorder_point: number;
      };
      return {
        id: item.id,
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        qtyOnHand: item.qty_on_hand,
        reorderPoint: product.reorder_point,
      };
    });
}
