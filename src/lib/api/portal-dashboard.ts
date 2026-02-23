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

// ---------------------------------------------------------------------------
// Inventory Value Over Time
// ---------------------------------------------------------------------------

export interface InventoryValuePoint {
  month: string;
  value: number;
}

/**
 * Gets inventory value over the last 12 months for a client.
 * Calculates a running cumulative value from inventory transactions.
 * Falls back to current inventory value distributed evenly when no
 * transaction data is available.
 * @param clientId - The client's UUID
 * @returns Array of monthly inventory value data points
 */
export async function getClientInventoryValueOverTime(
  clientId: string
): Promise<InventoryValuePoint[]> {
  if (!clientId || clientId === "staff-preview") return [];

  const supabase = createClient();

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // Build the last 12 months list (oldest first)
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: monthNames[d.getMonth()],
    });
  }

  const twelveMonthsAgo = new Date(
    now.getFullYear(),
    now.getMonth() - 11,
    1
  );

  try {
    // Fetch inventory transactions for this client's products over last 12 months
    const { data: transactions, error } = await supabase
      .from("inventory_transactions")
      .select(`
        qty_change,
        unit_cost,
        created_at,
        product:products!inner (
          id,
          client_id
        )
      `)
      .eq("product.client_id", clientId)
      .gte("created_at", twelveMonthsAgo.toISOString());

    if (error) {
      console.error("Error fetching inventory transactions:", error);
      return [];
    }

    // If we have transactions, bucket them by month
    if (transactions && transactions.length > 0) {
      // Accumulate value change per month
      const monthlyValue = new Map<string, number>();
      months.forEach((m) => monthlyValue.set(`${m.year}-${m.month}`, 0));

      transactions.forEach((t) => {
        const date = new Date(t.created_at);
        const key = `${date.getFullYear()}-${date.getMonth()}`;
        const change = (t.qty_change || 0) * (t.unit_cost || 0);
        monthlyValue.set(key, (monthlyValue.get(key) || 0) + change);
      });

      // Build running cumulative value
      let running = 0;
      return months.map((m) => {
        const key = `${m.year}-${m.month}`;
        running += monthlyValue.get(key) || 0;
        return { month: m.label, value: Math.max(0, Math.round(running)) };
      });
    }

    // Fallback: use current inventory value distributed evenly
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

    // Get product values for cost reference
    const { data: productValues } = await supabase
      .from("client_product_values")
      .select("product_id, cost")
      .eq("client_id", clientId);

    const costMap = new Map(
      (productValues || []).map((pv) => [pv.product_id, pv.cost || 0])
    );

    let totalValue = 0;
    (inventoryData || []).forEach((item) => {
      const product = item.product as unknown as { id: string; client_id: string };
      const cost = costMap.get(product.id) || 0;
      totalValue += (item.qty_on_hand || 0) * cost;
    });

    // Distribute evenly across months
    return months.map((m) => ({
      month: m.label,
      value: Math.round(totalValue),
    }));
  } catch (err) {
    console.error("Error in getClientInventoryValueOverTime:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Order Fulfillment Speed
// ---------------------------------------------------------------------------

export interface FulfillmentSpeedPoint {
  month: string;
  avgDays: number;
}

/**
 * Gets average order fulfillment speed (days from creation to shipment)
 * over the last 6 months for a client.
 * @param clientId - The client's UUID
 * @returns Array of monthly average fulfillment day data points
 */
export async function getClientOrderFulfillmentSpeed(
  clientId: string
): Promise<FulfillmentSpeedPoint[]> {
  if (!clientId || clientId === "staff-preview") return [];

  const supabase = createClient();

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: monthNames[d.getMonth()],
    });
  }

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  try {
    const { data: orders, error } = await supabase
      .from("outbound_orders")
      .select("id, created_at, shipped_date, status")
      .eq("client_id", clientId)
      .in("status", ["shipped", "delivered"])
      .not("shipped_date", "is", null)
      .gte("shipped_date", sixMonthsAgo.toISOString());

    if (error) {
      console.error("Error fetching fulfillment speed data:", error);
      return [];
    }

    // Bucket orders by shipped month
    const buckets = new Map<string, number[]>();
    months.forEach((m) => buckets.set(`${m.year}-${m.month}`, []));

    (orders || []).forEach((order) => {
      const shippedDate = new Date(order.shipped_date);
      const createdDate = new Date(order.created_at);
      const key = `${shippedDate.getFullYear()}-${shippedDate.getMonth()}`;
      const diffMs = shippedDate.getTime() - createdDate.getTime();
      const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.push(diffDays);
      }
    });

    return months.map((m) => {
      const key = `${m.year}-${m.month}`;
      const days = buckets.get(key) || [];
      const avg =
        days.length > 0
          ? days.reduce((sum, d) => sum + d, 0) / days.length
          : 0;
      return { month: m.label, avgDays: Math.round(avg * 10) / 10 };
    });
  } catch (err) {
    console.error("Error in getClientOrderFulfillmentSpeed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Spending Breakdown
// ---------------------------------------------------------------------------

export interface SpendingCategory {
  category: string;
  amount: number;
  color: string;
}

/**
 * Gets an estimated spending breakdown for a client based on invoices.
 * Splits total spend into Storage, Pick & Pack, Shipping, and Other
 * using industry-standard warehouse cost ratios.
 * @param clientId - The client's UUID
 * @returns Array of spending category breakdowns with assigned colors
 */
export async function getClientSpendingBreakdown(
  clientId: string
): Promise<SpendingCategory[]> {
  if (!clientId || clientId === "staff-preview") return [];

  const supabase = createClient();

  const colors = ["#4F46E5", "#06B6D4", "#10B981", "#F59E0B"];

  try {
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, total")
      .eq("client_id", clientId)
      .in("status", ["sent", "paid"]);

    if (error) {
      console.error("Error fetching invoices for spending breakdown:", error);
      return [];
    }

    const total = (invoices || []).reduce(
      (sum, inv) => sum + (inv.total || 0),
      0
    );

    if (total <= 0) return [];

    return [
      { category: "Storage", amount: Math.round(total * 0.4), color: colors[0] },
      { category: "Pick & Pack", amount: Math.round(total * 0.3), color: colors[1] },
      { category: "Shipping", amount: Math.round(total * 0.2), color: colors[2] },
      { category: "Other", amount: Math.round(total * 0.1), color: colors[3] },
    ];
  } catch (err) {
    console.error("Error in getClientSpendingBreakdown:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Product Performance (Bubble Chart Data)
// ---------------------------------------------------------------------------

export interface ProductPerformancePoint {
  x: number; // units sold
  y: number; // margin percentage
  name: string;
  z?: number; // optional bubble size (revenue)
}

/**
 * Gets product performance data for a client — units sold vs. margin —
 * suitable for a scatter / bubble chart.
 * @param clientId - The client's UUID
 * @returns Array of product performance data points
 */
export async function getClientProductPerformance(
  clientId: string
): Promise<ProductPerformancePoint[]> {
  if (!clientId || clientId === "staff-preview") return [];

  const supabase = createClient();

  try {
    // Fetch shipped / delivered outbound items for this client
    const { data: orderItems, error: itemsError } = await supabase
      .from("outbound_items")
      .select(`
        qty_shipped,
        product_id,
        product:products!inner (
          id,
          name
        ),
        order:outbound_orders!inner (
          id,
          client_id,
          status
        )
      `)
      .eq("order.client_id", clientId)
      .in("order.status", ["shipped", "delivered"]);

    if (itemsError) {
      console.error("Error fetching outbound items for performance:", itemsError);
      return [];
    }

    // Fetch product values for margin calculation
    const { data: productValues, error: valuesError } = await supabase
      .from("client_product_values")
      .select("product_id, sale_price, cost")
      .eq("client_id", clientId);

    if (valuesError) {
      console.error("Error fetching product values for performance:", valuesError);
      return [];
    }

    const valueMap = new Map(
      (productValues || []).map((pv) => [
        pv.product_id,
        { sale_price: pv.sale_price || 0, cost: pv.cost || 0 },
      ])
    );

    // Aggregate units shipped per product
    const productMap = new Map<
      string,
      { name: string; totalUnits: number }
    >();

    (orderItems || []).forEach((item) => {
      const product = Array.isArray(item.product)
        ? item.product[0]
        : (item.product as unknown as { id: string; name: string });
      if (!product) return;

      const existing = productMap.get(product.id);
      const qty = item.qty_shipped || 0;
      if (existing) {
        existing.totalUnits += qty;
      } else {
        productMap.set(product.id, {
          name: product.name,
          totalUnits: qty,
        });
      }
    });

    // Build result
    const results: ProductPerformancePoint[] = [];
    productMap.forEach((data, productId) => {
      const values = valueMap.get(productId) || { sale_price: 0, cost: 0 };
      const margin =
        values.sale_price > 0
          ? ((values.sale_price - values.cost) / values.sale_price) * 100
          : 0;
      const revenue = data.totalUnits * values.sale_price;

      results.push({
        x: data.totalUnits,
        y: Math.round(margin * 10) / 10,
        name: data.name,
        z: Math.round(revenue),
      });
    });

    return results;
  } catch (err) {
    console.error("Error in getClientProductPerformance:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Stock Projection
// ---------------------------------------------------------------------------

export interface StockProjectionPoint {
  date: string;
  actual: number | null;
  projected: number | null;
}

/**
 * Projects stock levels for a client over the next 30 days based on
 * the average daily outbound rate from the last 30 days. Also includes
 * the past 7 days of actual stock level as context.
 * @param clientId - The client's UUID
 * @returns Array of daily stock projection data points
 */
export async function getClientStockProjection(
  clientId: string
): Promise<StockProjectionPoint[]> {
  if (!clientId || clientId === "staff-preview") return [];

  const supabase = createClient();

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  const formatDate = (d: Date): string =>
    `${monthNames[d.getMonth()]} ${d.getDate()}`;

  try {
    // Get current total inventory for this client
    const { data: inventoryData, error: invError } = await supabase
      .from("inventory")
      .select(`
        qty_on_hand,
        product:products!inner (
          id,
          client_id
        )
      `)
      .eq("product.client_id", clientId);

    if (invError) {
      console.error("Error fetching inventory for projection:", invError);
      return [];
    }

    const currentStock = (inventoryData || []).reduce(
      (sum, item) => sum + (item.qty_on_hand || 0),
      0
    );

    // Get daily outbound rate from shipped orders in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentShipped, error: shippedError } = await supabase
      .from("outbound_items")
      .select(`
        qty_shipped,
        order:outbound_orders!inner (
          id,
          client_id,
          status,
          shipped_date
        )
      `)
      .eq("order.client_id", clientId)
      .eq("order.status", "shipped")
      .gte("order.shipped_date", thirtyDaysAgo.toISOString());

    if (shippedError) {
      console.error("Error fetching recent shipments for projection:", shippedError);
      return [];
    }

    const totalShipped = (recentShipped || []).reduce(
      (sum, item) => sum + (item.qty_shipped || 0),
      0
    );

    const dailyRate = totalShipped / 30;

    const now = new Date();
    const results: StockProjectionPoint[] = [];

    // Past 7 days — "actual" values (approximate: current stock adjusted)
    for (let i = 7; i >= 1; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      // Estimate past stock by adding back the daily rate * days ago
      const estimatedPast = Math.round(currentStock + dailyRate * i);
      results.push({
        date: formatDate(d),
        actual: estimatedPast,
        projected: null,
      });
    }

    // Today — both actual and projected
    results.push({
      date: formatDate(now),
      actual: currentStock,
      projected: currentStock,
    });

    // Next 30 days — projected only
    for (let i = 1; i <= 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() + i);
      const projected = Math.max(0, Math.round(currentStock - dailyRate * i));
      results.push({
        date: formatDate(d),
        actual: null,
        projected,
      });
    }

    return results;
  } catch (err) {
    console.error("Error in getClientStockProjection:", err);
    return [];
  }
}
