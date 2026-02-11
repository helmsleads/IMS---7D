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

/**
 * Gets the count of unread messages for a client
 * @param clientId - The client's UUID
 * @returns Count of unread messages (messages from warehouse to client)
 */
export async function getPortalUnreadCount(clientId: string): Promise<number> {
  // Guard against invalid client IDs (e.g., "staff-preview")
  if (!clientId || clientId === "staff-preview") {
    return 0;
  }

  const supabase = createClient();

  // First get all conversation IDs for this client
  const { data: conversations, error: convError } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", clientId);

  if (convError || !conversations || conversations.length === 0) {
    if (convError && convError.message) {
      console.error("Error fetching conversations:", convError.message);
    }
    return 0;
  }

  const conversationIds = conversations.map((c) => c.id);

  // Count unread messages from users (warehouse staff) in client's conversations
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .eq("sender_type", "user") // Messages from warehouse to client
    .is("read_at", null);

  if (error) {
    console.error("Error fetching unread messages count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Gets the count of open returns for a client
 * @param clientId - The client's UUID
 * @returns Count of returns with status pending, processing, or inspecting
 */
export async function getPortalOpenReturnsCount(clientId: string): Promise<number> {
  // Guard against invalid client IDs (e.g., "staff-preview")
  if (!clientId || clientId === "staff-preview") {
    return 0;
  }

  const supabase = createClient();

  const { count, error } = await supabase
    .from("returns")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ["pending", "processing", "inspecting"]);

  if (error) {
    console.error("Error fetching open returns count:", error);
    return 0;
  }

  return count || 0;
}

export interface MonthlyProfitability {
  netProfit: number;
  totalRevenue: number;
  totalCost: number;
  marginPercentage: number;
  orderCount: number;
  unitsSold: number;
}

/**
 * Gets the monthly profitability data for a client
 * Calculates profit based on delivered orders in the current month
 * @param clientId - The client's UUID
 * @returns Profitability data including net profit, revenue, cost, and margin
 */
export async function getPortalMonthlyProfit(
  clientId: string
): Promise<MonthlyProfitability> {
  // Guard against invalid client IDs (e.g., "staff-preview")
  if (!clientId || clientId === "staff-preview") {
    return {
      netProfit: 0,
      totalRevenue: 0,
      totalCost: 0,
      marginPercentage: 0,
      orderCount: 0,
      unitsSold: 0,
    };
  }

  const supabase = createClient();

  // Calculate start of current month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // Fetch delivered orders this month
  const { data: ordersThisMonth, error: ordersError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      items:outbound_items (
        qty_shipped,
        product_id
      )
    `)
    .eq("client_id", clientId)
    .eq("status", "delivered")
    .gte("delivered_date", startOfMonth.toISOString());

  if (ordersError) {
    console.error("Error fetching orders for profitability:", ordersError);
    return {
      netProfit: 0,
      totalRevenue: 0,
      totalCost: 0,
      marginPercentage: 0,
      orderCount: 0,
      unitsSold: 0,
    };
  }

  // Get product values for profit calculation
  const { data: productValues, error: valuesError } = await supabase
    .from("client_product_values")
    .select("product_id, sale_price, cost")
    .eq("client_id", clientId);

  if (valuesError) {
    console.error("Error fetching product values:", valuesError);
    return {
      netProfit: 0,
      totalRevenue: 0,
      totalCost: 0,
      marginPercentage: 0,
      orderCount: ordersThisMonth?.length || 0,
      unitsSold: 0,
    };
  }

  // Build value map for quick lookups
  const valueMap = new Map(
    (productValues || []).map((pv) => [
      pv.product_id,
      { sale_price: pv.sale_price || 0, cost: pv.cost || 0 },
    ])
  );

  let totalRevenue = 0;
  let totalCost = 0;
  let unitsSold = 0;

  (ordersThisMonth || []).forEach((order) => {
    const items = order.items as unknown as Array<{
      qty_shipped: number;
      product_id: string;
    }>;
    (items || []).forEach((item) => {
      const values = valueMap.get(item.product_id) || {
        sale_price: 0,
        cost: 0,
      };
      const qty = item.qty_shipped || 0;
      totalRevenue += qty * values.sale_price;
      totalCost += qty * values.cost;
      unitsSold += qty;
    });
  });

  const netProfit = totalRevenue - totalCost;
  const marginPercentage =
    totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  return {
    netProfit,
    totalRevenue,
    totalCost,
    marginPercentage,
    orderCount: ordersThisMonth?.length || 0,
    unitsSold,
  };
}
