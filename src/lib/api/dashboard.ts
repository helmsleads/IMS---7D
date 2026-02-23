import { createClient } from "@/lib/supabase";

export interface DashboardStats {
  totalProducts: number;
  totalClients: number;
  totalInventoryValue: number;
  totalUnitsInStock: number;
  lowStockCount: number;
  pendingInbound: number;
  pendingOutbound: number;
  ordersToShipToday: number;
  ordersToReceiveToday: number;
}

export interface RecentActivity {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
}

export interface DashboardData {
  stats: DashboardStats;
  recentActivity: RecentActivity[];
}

export async function getDashboardStats(): Promise<DashboardData> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch all stats in parallel
  const [
    productsResult,
    clientsResult,
    inventoryResult,
    lowStockResult,
    pendingInboundResult,
    pendingOutboundResult,
    shipTodayResult,
    receiveTodayResult,
    activityResult,
  ] = await Promise.all([
    // Total active products
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("active", true),

    // Total active clients
    supabase
      .from("clients")
      .select("*", { count: "exact", head: true })
      .eq("active", true),

    // Inventory summary (total value and units)
    supabase
      .from("inventory")
      .select(`
        qty_on_hand,
        product:products (
          unit_cost
        )
      `),

    // Low stock items (where qty_on_hand <= reorder_point)
    supabase
      .from("inventory")
      .select(`
        qty_on_hand,
        product:products (
          reorder_point
        )
      `),

    // Pending inbound orders
    supabase
      .from("inbound_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "confirmed", "in_transit"]),

    // Pending outbound orders
    supabase
      .from("outbound_orders")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "confirmed", "processing", "packed"]),

    // Orders to ship today (outbound with requested_at = today and not yet shipped)
    supabase
      .from("outbound_orders")
      .select("*", { count: "exact", head: true })
      .gte("requested_at", today)
      .lt("requested_at", today + "T23:59:59")
      .in("status", ["confirmed", "processing", "packed"]),

    // Orders to receive today (inbound with expected_date = today)
    supabase
      .from("inbound_orders")
      .select("*", { count: "exact", head: true })
      .eq("expected_date", today)
      .in("status", ["confirmed", "in_transit"]),

    // Recent activity (last 10)
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  // Calculate inventory totals
  const inventoryData = inventoryResult.data || [];
  const totalUnitsInStock = inventoryData.reduce(
    (sum, item) => sum + (item.qty_on_hand || 0),
    0
  );
  const totalInventoryValue = inventoryData.reduce(
    (sum, item) => {
      const product = item.product as unknown as { unit_cost: number } | null;
      const unitCost = product?.unit_cost || 0;
      return sum + (item.qty_on_hand || 0) * unitCost;
    },
    0
  );

  // Calculate low stock count
  const lowStockData = lowStockResult.data || [];
  const lowStockCount = lowStockData.filter((item) => {
    const product = item.product as unknown as { reorder_point: number } | null;
    const reorderPoint = product?.reorder_point || 0;
    return item.qty_on_hand <= reorderPoint && item.qty_on_hand > 0;
  }).length;

  return {
    stats: {
      totalProducts: productsResult.count || 0,
      totalClients: clientsResult.count || 0,
      totalInventoryValue,
      totalUnitsInStock,
      lowStockCount,
      pendingInbound: pendingInboundResult.count || 0,
      pendingOutbound: pendingOutboundResult.count || 0,
      ordersToShipToday: shipTodayResult.count || 0,
      ordersToReceiveToday: receiveTodayResult.count || 0,
    },
    recentActivity: (activityResult.data || []).map((activity) => ({
      ...activity,
      user_email: (activity.details as { user_email?: string })?.user_email || null,
    })) as RecentActivity[],
  };
}

export async function getLowStockItems(): Promise<{
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
}[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      id,
      product_id,
      location_id,
      qty_on_hand,
      product:products (
        id,
        sku,
        name,
        reorder_point
      ),
      location:locations (
        id,
        name
      )
    `);

  if (error) {
    throw new Error(error.message);
  }

  // Filter to only low stock items
  return (data || []).filter((item) => {
    const product = item.product as unknown as { reorder_point: number } | null;
    const reorderPoint = product?.reorder_point || 0;
    return item.qty_on_hand <= reorderPoint && item.qty_on_hand > 0;
  }) as unknown as {
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
  }[];
}

export interface ExpectedArrival {
  id: string;
  po_number: string;
  supplier: string;
  expected_date: string | null;
  status: string;
}

export async function getExpectedArrivals(): Promise<ExpectedArrival[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inbound_orders")
    .select(`
      id,
      po_number,
      supplier,
      expected_date,
      status
    `)
    .in("status", ["in_transit", "confirmed"])
    .order("expected_date", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as ExpectedArrival[];
}

export interface OrderToShip {
  id: string;
  order_number: string;
  status: string;
  requested_at: string | null;
  is_rush: boolean;
  client: {
    company_name: string;
  } | null;
  items_count: number;
}

export async function getOrdersToShip(): Promise<OrderToShip[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      status,
      requested_at,
      is_rush,
      client:clients (
        company_name
      ),
      outbound_items (
        id
      )
    `)
    .in("status", ["confirmed", "processing"])
    .order("requested_at", { ascending: true })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    requested_at: order.requested_at,
    is_rush: order.is_rush || false,
    client: order.client as unknown as { company_name: string } | null,
    items_count: Array.isArray(order.outbound_items) ? order.outbound_items.length : 0,
  }));
}

export async function getOrdersRequiringAttention(): Promise<{
  urgentOutbound: {
    id: string;
    order_number: string;
    status: string;
    requested_at: string | null;
    client: { company_name: string } | null;
  }[];
  overdueInbound: {
    id: string;
    po_number: string;
    status: string;
    expected_date: string | null;
    supplier: string;
  }[];
}> {
  const supabase = createClient();
  const today = new Date();
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(today.getDate() - 2);

  const [urgentOutboundResult, overdueInboundResult] = await Promise.all([
    // Outbound orders pending for more than 2 days
    supabase
      .from("outbound_orders")
      .select(`
        id,
        order_number,
        status,
        requested_at,
        client:clients (
          company_name
        )
      `)
      .eq("status", "pending")
      .lt("requested_at", twoDaysAgo.toISOString())
      .order("requested_at", { ascending: true })
      .limit(5),

    // Inbound orders past expected date
    supabase
      .from("inbound_orders")
      .select(`
        id,
        po_number,
        status,
        expected_date,
        supplier
      `)
      .in("status", ["confirmed", "in_transit"])
      .lt("expected_date", today.toISOString().split("T")[0])
      .order("expected_date", { ascending: true })
      .limit(5),
  ]);

  return {
    // Cast through unknown to handle Supabase's array return for joins
    urgentOutbound: (urgentOutboundResult.data || []) as unknown as {
      id: string;
      order_number: string;
      status: string;
      requested_at: string | null;
      client: { company_name: string } | null;
    }[],
    overdueInbound: (overdueInboundResult.data || []) as unknown as {
      id: string;
      po_number: string;
      status: string;
      expected_date: string | null;
      supplier: string;
    }[],
  };
}

export async function getPendingReturnsCount(): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("returns")
    .select("*", { count: "exact", head: true })
    .eq("status", "requested");

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

export async function getUnreadMessagesCount(): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);

  if (error) {
    throw new Error(error.message);
  }

  return count || 0;
}

export interface ExpiringLotsCount {
  count: number;
  soonest: {
    id: string;
    lot_number: string | null;
    batch_number: string | null;
    expiration_date: string;
    days_until_expiration: number;
    product: {
      id: string;
      name: string;
      sku: string;
    };
  }[];
}

export async function getExpiringLotsCount(daysAhead: number = 30): Promise<ExpiringLotsCount> {
  const supabase = createClient();

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const { data, error } = await supabase
    .from("lots")
    .select(`
      id,
      lot_number,
      batch_number,
      expiration_date,
      product:products (id, name, sku)
    `)
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .lte("expiration_date", futureDate.toISOString().split("T")[0])
    .order("expiration_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lotsWithDays = (data || []).map((lot) => {
    const expDate = new Date(lot.expiration_date);
    expDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: lot.id,
      lot_number: lot.lot_number,
      batch_number: lot.batch_number,
      expiration_date: lot.expiration_date,
      days_until_expiration: daysUntil,
      product: lot.product as unknown as { id: string; name: string; sku: string },
    };
  });

  return {
    count: lotsWithDays.length,
    soonest: lotsWithDays.slice(0, 3),
  };
}

export interface OutstandingInvoicesTotal {
  totalOutstanding: number;
  invoiceCount: number;
  overdueCount: number;
  overdueAmount: number;
}

export async function getOutstandingInvoicesTotal(): Promise<OutstandingInvoicesTotal> {
  const supabase = createClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("invoices")
    .select("id, total, due_date")
    .eq("status", "sent");

  if (error) {
    throw new Error(error.message);
  }

  const invoices = data || [];

  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  invoices.forEach((inv) => {
    const outstanding = inv.total || 0;
    totalOutstanding += outstanding;

    if (inv.due_date && inv.due_date < today) {
      overdueCount++;
      overdueAmount += outstanding;
    }
  });

  return {
    totalOutstanding,
    invoiceCount: invoices.length,
    overdueCount,
    overdueAmount,
  };
}

// ============================================
// Aged Inventory
// ============================================

export interface AgedInventorySummary {
  over30Days: number;
  over60Days: number;
  over90Days: number;
  oldestItems: {
    productId: string;
    productName: string;
    sku: string;
    locationName: string;
    qtyOnHand: number;
    daysSinceLastMove: number;
  }[];
}

/**
 * Get inventory aging summary — items that haven't had transactions recently.
 * Uses the most recent inventory_transaction per product/location to determine age.
 */
export async function getAgedInventory(): Promise<AgedInventorySummary> {
  const supabase = createClient();

  // Get all inventory with qty > 0
  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select(`
      product_id,
      location_id,
      qty_on_hand,
      product:products (id, name, sku),
      location:locations (id, name)
    `)
    .gt("qty_on_hand", 0);

  if (invError) {
    throw new Error(invError.message);
  }

  if (!inventory || inventory.length === 0) {
    return { over30Days: 0, over60Days: 0, over90Days: 0, oldestItems: [] };
  }

  // Get the most recent transaction for each product/location pair
  const { data: recentTxns, error: txnError } = await supabase
    .from("inventory_transactions")
    .select("product_id, location_id, created_at")
    .order("created_at", { ascending: false });

  if (txnError) {
    throw new Error(txnError.message);
  }

  // Build a map of the most recent transaction per product+location
  const lastMoveMap = new Map<string, string>();
  for (const txn of recentTxns || []) {
    const key = `${txn.product_id}|${txn.location_id}`;
    if (!lastMoveMap.has(key)) {
      lastMoveMap.set(key, txn.created_at);
    }
  }

  const now = Date.now();
  let over30 = 0;
  let over60 = 0;
  let over90 = 0;

  const itemsWithAge = inventory.map((item) => {
    const key = `${item.product_id}|${item.location_id}`;
    const lastMove = lastMoveMap.get(key);
    const daysSince = lastMove
      ? Math.floor((now - new Date(lastMove).getTime()) / (1000 * 60 * 60 * 24))
      : 999; // No transaction ever — very old

    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const location = Array.isArray(item.location) ? item.location[0] : item.location;

    return {
      productId: item.product_id,
      productName: (product as { name: string })?.name || "Unknown",
      sku: (product as { sku: string })?.sku || "",
      locationName: (location as { name: string })?.name || "Unknown",
      qtyOnHand: item.qty_on_hand,
      daysSinceLastMove: daysSince,
    };
  });

  for (const item of itemsWithAge) {
    if (item.daysSinceLastMove >= 90) over90++;
    else if (item.daysSinceLastMove >= 60) over60++;
    else if (item.daysSinceLastMove >= 30) over30++;
  }

  // Sort by age descending, take top 5
  const oldestItems = itemsWithAge
    .sort((a, b) => b.daysSinceLastMove - a.daysSinceLastMove)
    .slice(0, 5);

  return {
    over30Days: over30,
    over60Days: over60,
    over90Days: over90,
    oldestItems,
  };
}

// ============================================
// Order Velocity
// ============================================

export interface OrderVelocity {
  shippedThisWeek: number;
  shippedLastWeek: number;
  receivedThisWeek: number;
  receivedLastWeek: number;
  trend: "up" | "down" | "flat";
  trendPercent: number;
}

/**
 * Get order velocity — shipped and received counts for this week vs last week.
 */
export async function getOrderVelocity(): Promise<OrderVelocity> {
  const supabase = createClient();

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  // This week (Monday to now)
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() + mondayOffset);
  thisWeekStart.setHours(0, 0, 0, 0);

  // Last week (Monday to Sunday)
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setMilliseconds(-1);

  const [shippedThis, shippedLast, receivedThis, receivedLast] =
    await Promise.all([
      supabase
        .from("outbound_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "shipped")
        .gte("shipped_date", thisWeekStart.toISOString()),

      supabase
        .from("outbound_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "shipped")
        .gte("shipped_date", lastWeekStart.toISOString())
        .lt("shipped_date", thisWeekStart.toISOString()),

      supabase
        .from("inbound_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "received")
        .gte("received_date", thisWeekStart.toISOString()),

      supabase
        .from("inbound_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "received")
        .gte("received_date", lastWeekStart.toISOString())
        .lt("received_date", thisWeekStart.toISOString()),
    ]);

  const stw = shippedThis.count || 0;
  const slw = shippedLast.count || 0;
  const rtw = receivedThis.count || 0;
  const rlw = receivedLast.count || 0;

  // Trend based on shipped orders
  let trend: "up" | "down" | "flat" = "flat";
  let trendPercent = 0;

  if (slw > 0) {
    trendPercent = Math.round(((stw - slw) / slw) * 100);
    trend = trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "flat";
  } else if (stw > 0) {
    trend = "up";
    trendPercent = 100;
  }

  return {
    shippedThisWeek: stw,
    shippedLastWeek: slw,
    receivedThisWeek: rtw,
    receivedLastWeek: rlw,
    trend,
    trendPercent,
  };
}

// ============================================
// Reorder Suggestions
// ============================================

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  sku: string;
  clientId: string | null;
  clientName: string | null;
  locationId: string;
  locationName: string;
  currentQty: number;
  reorderPoint: number;
  suggestedQty: number;
  supplier: string | null;
}

/**
 * Generate reorder suggestions for products below their reorder point.
 * Suggested quantity = 2x reorder point - current quantity (brings to 2x safety stock).
 */
export async function getReorderSuggestions(): Promise<ReorderSuggestion[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      product_id,
      location_id,
      qty_on_hand,
      client_id,
      product:products (id, name, sku, reorder_point, supplier),
      location:locations (id, name),
      client:clients (id, company_name)
    `)
    .gt("qty_on_hand", -1);

  if (error) {
    throw new Error(error.message);
  }

  const suggestions: ReorderSuggestion[] = [];

  for (const row of data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const location = Array.isArray(row.location) ? row.location[0] : row.location;
    const client = Array.isArray(row.client) ? row.client[0] : row.client;

    const reorderPoint = (product as { reorder_point?: number })?.reorder_point || 0;
    if (reorderPoint <= 0) continue;
    if (row.qty_on_hand > reorderPoint) continue;

    // Suggest ordering enough to reach 2x reorder point
    const suggestedQty = reorderPoint * 2 - row.qty_on_hand;

    suggestions.push({
      productId: row.product_id,
      productName: (product as { name: string })?.name || "Unknown",
      sku: (product as { sku: string })?.sku || "",
      clientId: row.client_id || null,
      clientName: (client as { company_name: string })?.company_name || null,
      locationId: row.location_id,
      locationName: (location as { name: string })?.name || "Unknown",
      currentQty: row.qty_on_hand,
      reorderPoint,
      suggestedQty,
      supplier: (product as { supplier?: string })?.supplier || null,
    });
  }

  // Sort by urgency (lowest qty relative to reorder point first)
  suggestions.sort((a, b) => {
    const aRatio = a.currentQty / a.reorderPoint;
    const bRatio = b.currentQty / b.reorderPoint;
    return aRatio - bRatio;
  });

  return suggestions;
}

// ============================================
// Fulfillment Funnel
// ============================================

export interface FulfillmentFunnelData {
  stage: string;
  count: number;
  color: string;
}

export async function getOrderFulfillmentFunnel(): Promise<FulfillmentFunnelData[]> {
  const supabase = createClient();
  const stages = [
    { status: "pending", label: "Pending", color: "#94A3B8" },
    { status: "confirmed", label: "Confirmed", color: "#3B82F6" },
    { status: "processing", label: "Processing", color: "#8B5CF6" },
    { status: "packed", label: "Packed", color: "#F59E0B" },
    { status: "shipped", label: "Shipped", color: "#06B6D4" },
    { status: "delivered", label: "Delivered", color: "#10B981" },
  ];

  const results = await Promise.all(
    stages.map((s) =>
      supabase
        .from("outbound_orders")
        .select("*", { count: "exact", head: true })
        .eq("status", s.status)
    )
  );

  return stages.map((s, idx) => ({
    stage: s.label,
    count: results[idx].count || 0,
    color: s.color,
  }));
}

// ============================================
// Inbound vs Outbound Flow (30 days)
// ============================================

export interface DailyFlowPoint {
  date: string;
  inbound: number;
  outbound: number;
}

export async function getInboundOutboundFlow(): Promise<DailyFlowPoint[]> {
  const supabase = createClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split("T")[0];

  const [inboundResult, outboundResult] = await Promise.all([
    supabase
      .from("inbound_orders")
      .select("received_date")
      .eq("status", "received")
      .gte("received_date", startDate),
    supabase
      .from("outbound_orders")
      .select("shipped_date")
      .in("status", ["shipped", "delivered"])
      .gte("shipped_date", startDate),
  ]);

  // Build daily counts
  const dailyMap = new Map<string, { inbound: number; outbound: number }>();
  const today = new Date();
  for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { inbound: 0, outbound: 0 });
  }

  for (const row of inboundResult.data || []) {
    if (row.received_date) {
      const key = row.received_date.split("T")[0];
      const entry = dailyMap.get(key);
      if (entry) entry.inbound++;
    }
  }

  for (const row of outboundResult.data || []) {
    if (row.shipped_date) {
      const key = row.shipped_date.split("T")[0];
      const entry = dailyMap.get(key);
      if (entry) entry.outbound++;
    }
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...counts,
    }));
}

// ============================================
// Inventory Value by Category (Treemap)
// ============================================

export interface CategoryValue {
  name: string;
  value: number;
  color: string;
}

const CATEGORY_COLORS = [
  "#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#6366F1",
];

export async function getInventoryValueByCategory(): Promise<CategoryValue[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      qty_on_hand,
      product:products (
        category,
        unit_cost
      )
    `)
    .gt("qty_on_hand", 0);

  if (error) throw new Error(error.message);

  const categoryMap = new Map<string, number>();

  for (const row of data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const category = (product as { category?: string })?.category || "Uncategorized";
    const cost = (product as { unit_cost?: number })?.unit_cost || 0;
    const value = row.qty_on_hand * cost;
    categoryMap.set(category, (categoryMap.get(category) || 0) + value);
  }

  return Array.from(categoryMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, value], idx) => ({
      name,
      value: Math.round(value),
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    }));
}

// ============================================
// On-Time Shipment Rate (weekly for 8 weeks)
// ============================================

export interface OnTimeDataPoint {
  week: string;
  rate: number;
  total: number;
  onTime: number;
}

export async function getOnTimeShipmentRate(): Promise<OnTimeDataPoint[]> {
  const supabase = createClient();
  const eightWeeksAgo = new Date();
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);

  const { data, error } = await supabase
    .from("outbound_orders")
    .select("requested_at, shipped_date, status")
    .in("status", ["shipped", "delivered"])
    .gte("shipped_date", eightWeeksAgo.toISOString());

  if (error) throw new Error(error.message);

  // Group by week
  const weekMap = new Map<string, { total: number; onTime: number }>();
  const now = new Date();

  for (let w = 0; w < 8; w++) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (7 * (7 - w)));
    const key = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    weekMap.set(key, { total: 0, onTime: 0 });
  }

  const weekKeys = Array.from(weekMap.keys());

  for (const order of data || []) {
    if (!order.shipped_date) continue;
    const shippedDate = new Date(order.shipped_date);
    const weekIdx = Math.floor((now.getTime() - shippedDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const mappedIdx = 7 - weekIdx;
    if (mappedIdx < 0 || mappedIdx >= 8) continue;

    const key = weekKeys[mappedIdx];
    const entry = weekMap.get(key);
    if (!entry) continue;

    entry.total++;
    // On-time: shipped on or before requested date
    if (order.requested_at && order.shipped_date <= order.requested_at) {
      entry.onTime++;
    }
  }

  return weekKeys.map((week) => {
    const entry = weekMap.get(week)!;
    return {
      week,
      rate: entry.total > 0 ? Math.round((entry.onTime / entry.total) * 100) : 0,
      total: entry.total,
      onTime: entry.onTime,
    };
  });
}

// ============================================
// Invoice Aging Buckets
// ============================================

export interface InvoiceAgingData {
  current: number;
  over30: number;
  over60: number;
  over90: number;
  total: number;
}

export async function getInvoiceAgingBuckets(): Promise<InvoiceAgingData> {
  const supabase = createClient();
  const today = new Date();

  const { data, error } = await supabase
    .from("invoices")
    .select("total, due_date")
    .eq("status", "sent");

  if (error) throw new Error(error.message);

  let current = 0, over30 = 0, over60 = 0, over90 = 0;

  for (const inv of data || []) {
    const outstanding = inv.total || 0;
    if (outstanding <= 0) continue;

    if (!inv.due_date) {
      current += outstanding;
      continue;
    }

    const daysOverdue = Math.floor(
      (today.getTime() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysOverdue > 90) over90 += outstanding;
    else if (daysOverdue > 60) over60 += outstanding;
    else if (daysOverdue > 30) over30 += outstanding;
    else current += outstanding;
  }

  return { current, over30, over60, over90, total: current + over30 + over60 + over90 };
}

// ============================================
// Supplier Lead Times
// ============================================

export interface SupplierLeadTime {
  supplier: string;
  avgDays: number;
  orderCount: number;
}

export async function getSupplierLeadTimes(): Promise<SupplierLeadTime[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inbound_orders")
    .select("supplier, created_at, received_date")
    .eq("status", "received")
    .not("received_date", "is", null);

  if (error) throw new Error(error.message);

  const supplierMap = new Map<string, { totalDays: number; count: number }>();

  for (const order of data || []) {
    const supplier = order.supplier || "Unknown";
    const created = new Date(order.created_at);
    const received = new Date(order.received_date);
    const days = Math.max(0, Math.floor((received.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)));

    const entry = supplierMap.get(supplier) || { totalDays: 0, count: 0 };
    entry.totalDays += days;
    entry.count++;
    supplierMap.set(supplier, entry);
  }

  return Array.from(supplierMap.entries())
    .map(([supplier, { totalDays, count }]) => ({
      supplier,
      avgDays: Math.round(totalDays / count),
      orderCount: count,
    }))
    .sort((a, b) => b.avgDays - a.avgDays)
    .slice(0, 8);
}

// ============================================
// Return Rate by Product
// ============================================

export interface ProductReturnRate {
  productName: string;
  sku: string;
  returnCount: number;
  totalShipped: number;
  rate: number;
}

export async function getReturnRateByProduct(): Promise<ProductReturnRate[]> {
  const supabase = createClient();

  const [returnsResult, shippedResult] = await Promise.all([
    supabase
      .from("return_items")
      .select(`
        qty_returned,
        product:products (name, sku)
      `),
    supabase
      .from("outbound_items")
      .select(`
        qty_shipped,
        product:products (name, sku)
      `)
      .gt("qty_shipped", 0),
  ]);

  const productReturns = new Map<string, { name: string; sku: string; returned: number }>();
  const productShipped = new Map<string, number>();

  for (const item of returnsResult.data || []) {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const sku = (product as { sku: string })?.sku || "unknown";
    const name = (product as { name: string })?.name || "Unknown";
    const entry = productReturns.get(sku) || { name, sku, returned: 0 };
    entry.returned += item.qty_returned || 0;
    productReturns.set(sku, entry);
  }

  for (const item of shippedResult.data || []) {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const sku = (product as { sku: string })?.sku || "unknown";
    productShipped.set(sku, (productShipped.get(sku) || 0) + (item.qty_shipped || 0));
  }

  const results: ProductReturnRate[] = [];
  for (const [sku, entry] of productReturns) {
    const shipped = productShipped.get(sku) || 0;
    if (shipped === 0 && entry.returned === 0) continue;
    results.push({
      productName: entry.name,
      sku,
      returnCount: entry.returned,
      totalShipped: shipped,
      rate: shipped > 0 ? Math.round((entry.returned / shipped) * 1000) / 10 : 100,
    });
  }

  return results.sort((a, b) => b.rate - a.rate).slice(0, 10);
}

// ============================================
// Days of Supply
// ============================================

export interface DaysOfSupplyItem {
  productName: string;
  sku: string;
  qtyOnHand: number;
  avgDailyUsage: number;
  daysOfSupply: number;
}

export async function getDaysOfSupply(): Promise<DaysOfSupplyItem[]> {
  const supabase = createClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Get current inventory and recent outbound items for usage
  const [inventoryResult, usageResult] = await Promise.all([
    supabase
      .from("inventory")
      .select(`
        qty_on_hand,
        product:products (name, sku)
      `)
      .gt("qty_on_hand", 0),
    supabase
      .from("outbound_items")
      .select(`
        qty_shipped,
        product:products (sku),
        order:outbound_orders!inner (shipped_date)
      `)
      .gt("qty_shipped", 0)
      .gte("order.shipped_date", thirtyDaysAgo.toISOString()),
  ]);

  // Sum qty on hand per SKU
  const stockMap = new Map<string, { name: string; qty: number }>();
  for (const row of inventoryResult.data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const sku = (product as { sku: string })?.sku || "unknown";
    const name = (product as { name: string })?.name || "Unknown";
    const entry = stockMap.get(sku) || { name, qty: 0 };
    entry.qty += row.qty_on_hand;
    stockMap.set(sku, entry);
  }

  // Sum shipped in last 30 days per SKU
  const usageMap = new Map<string, number>();
  for (const row of usageResult.data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const sku = (product as { sku: string })?.sku || "unknown";
    usageMap.set(sku, (usageMap.get(sku) || 0) + (row.qty_shipped || 0));
  }

  const results: DaysOfSupplyItem[] = [];
  for (const [sku, stock] of stockMap) {
    const totalShipped = usageMap.get(sku) || 0;
    const avgDaily = totalShipped / 30;
    const days = avgDaily > 0 ? Math.round(stock.qty / avgDaily) : 999;

    results.push({
      productName: stock.name,
      sku,
      qtyOnHand: stock.qty,
      avgDailyUsage: Math.round(avgDaily * 10) / 10,
      daysOfSupply: days,
    });
  }

  return results
    .filter((r) => r.avgDailyUsage > 0)
    .sort((a, b) => a.daysOfSupply - b.daysOfSupply)
    .slice(0, 10);
}

// ============================================
// Revenue by Client
// ============================================

export interface ClientRevenue {
  clientName: string;
  revenue: number;
  orderCount: number;
}

export async function getRevenueByClient(): Promise<ClientRevenue[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("invoices")
    .select(`
      total,
      client:clients (company_name)
    `)
    .in("status", ["sent", "paid"]);

  if (error) throw new Error(error.message);

  const clientMap = new Map<string, { revenue: number; count: number }>();

  for (const inv of data || []) {
    const client = Array.isArray(inv.client) ? inv.client[0] : inv.client;
    const name = (client as { company_name: string })?.company_name || "Unknown";
    const entry = clientMap.get(name) || { revenue: 0, count: 0 };
    entry.revenue += inv.total || 0;
    entry.count++;
    clientMap.set(name, entry);
  }

  return Array.from(clientMap.entries())
    .map(([clientName, { revenue, count }]) => ({
      clientName,
      revenue: Math.round(revenue),
      orderCount: count,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);
}

// ============================================
// Daily Throughput Timeline (14 days)
// ============================================

export interface DailyThroughput {
  date: string;
  picked: number;
  packed: number;
  shipped: number;
}

export async function getDailyThroughputTimeline(): Promise<DailyThroughput[]> {
  const supabase = createClient();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const startDate = fourteenDaysAgo.toISOString();

  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("transaction_type, created_at")
    .in("transaction_type", ["pick", "pack", "ship"])
    .gte("created_at", startDate);

  if (error) throw new Error(error.message);

  // Build daily map for the last 14 days
  const dailyMap = new Map<string, { picked: number; packed: number; shipped: number }>();
  const today = new Date();
  for (let d = new Date(fourteenDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    dailyMap.set(key, { picked: 0, packed: 0, shipped: 0 });
  }

  for (const txn of data || []) {
    const key = txn.created_at.split("T")[0];
    const entry = dailyMap.get(key);
    if (!entry) continue;

    if (txn.transaction_type === "pick") entry.picked++;
    else if (txn.transaction_type === "pack") entry.packed++;
    else if (txn.transaction_type === "ship") entry.shipped++;
  }

  return Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({
      date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      ...counts,
    }));
}

// ============================================
// Order Cycle Time
// ============================================

export interface CycleTimeBucket {
  bucket: string;
  count: number;
}

export async function getOrderCycleTime(): Promise<CycleTimeBucket[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outbound_orders")
    .select("requested_at, shipped_date")
    .in("status", ["shipped", "delivered"])
    .not("shipped_date", "is", null);

  if (error) throw new Error(error.message);

  const buckets: Record<string, number> = {
    "0-1 days": 0,
    "2-3 days": 0,
    "4-7 days": 0,
    "8-14 days": 0,
    "15+ days": 0,
  };

  for (const order of data || []) {
    if (!order.requested_at || !order.shipped_date) continue;
    const requested = new Date(order.requested_at);
    const shipped = new Date(order.shipped_date);
    const days = Math.max(0, Math.floor((shipped.getTime() - requested.getTime()) / (1000 * 60 * 60 * 24)));

    if (days <= 1) buckets["0-1 days"]++;
    else if (days <= 3) buckets["2-3 days"]++;
    else if (days <= 7) buckets["4-7 days"]++;
    else if (days <= 14) buckets["8-14 days"]++;
    else buckets["15+ days"]++;
  }

  return Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
}

// ============================================
// ABC Analysis
// ============================================

export interface ABCItem {
  sku: string;
  productName: string;
  value: number;
  cumulativePercent: number;
  category: "A" | "B" | "C";
}

export async function getABCAnalysis(): Promise<ABCItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      qty_on_hand,
      product:products (name, sku, unit_cost)
    `)
    .gt("qty_on_hand", 0);

  if (error) throw new Error(error.message);

  // Aggregate value per SKU
  const skuMap = new Map<string, { name: string; value: number }>();

  for (const row of data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const sku = (product as { sku: string })?.sku || "unknown";
    const name = (product as { name: string })?.name || "Unknown";
    const unitCost = (product as { unit_cost: number })?.unit_cost || 0;
    const value = row.qty_on_hand * unitCost;

    const entry = skuMap.get(sku) || { name, value: 0 };
    entry.value += value;
    skuMap.set(sku, entry);
  }

  // Sort by value descending
  const sorted = Array.from(skuMap.entries())
    .map(([sku, { name, value }]) => ({ sku, productName: name, value }))
    .sort((a, b) => b.value - a.value);

  const totalValue = sorted.reduce((sum, item) => sum + item.value, 0);
  if (totalValue === 0) return [];

  let cumulative = 0;
  const results: ABCItem[] = [];

  for (const item of sorted.slice(0, 20)) {
    cumulative += item.value;
    const cumulativePercent = Math.round((cumulative / totalValue) * 1000) / 10;

    let category: "A" | "B" | "C" = "C";
    if (cumulativePercent <= 80) category = "A";
    else if (cumulativePercent <= 95) category = "B";

    results.push({
      sku: item.sku,
      productName: item.productName,
      value: Math.round(item.value),
      cumulativePercent,
      category,
    });
  }

  return results;
}

// ============================================
// Inventory Turnover by Category
// ============================================

export interface CategoryTurnover {
  category: string;
  turnoverRatio: number;
  totalShipped: number;
  avgInventory: number;
}

export async function getInventoryTurnoverByCategory(): Promise<CategoryTurnover[]> {
  const supabase = createClient();
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [shippedResult, inventoryResult] = await Promise.all([
    supabase
      .from("outbound_items")
      .select(`
        qty_shipped,
        product:products (category),
        order:outbound_orders!inner (shipped_date, status)
      `)
      .gt("qty_shipped", 0)
      .gte("order.shipped_date", ninetyDaysAgo.toISOString())
      .in("order.status", ["shipped", "delivered"]),
    supabase
      .from("inventory")
      .select(`
        qty_on_hand,
        product:products (category)
      `)
      .gt("qty_on_hand", 0),
  ]);

  if (shippedResult.error) throw new Error(shippedResult.error.message);
  if (inventoryResult.error) throw new Error(inventoryResult.error.message);

  // Sum shipped qty by category
  const shippedMap = new Map<string, number>();
  for (const row of shippedResult.data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const category = (product as { category?: string })?.category || "Uncategorized";
    shippedMap.set(category, (shippedMap.get(category) || 0) + (row.qty_shipped || 0));
  }

  // Sum current inventory by category
  const inventoryMap = new Map<string, number>();
  for (const row of inventoryResult.data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const category = (product as { category?: string })?.category || "Uncategorized";
    inventoryMap.set(category, (inventoryMap.get(category) || 0) + (row.qty_on_hand || 0));
  }

  const results: CategoryTurnover[] = [];
  const allCategories = new Set([...shippedMap.keys(), ...inventoryMap.keys()]);

  for (const category of allCategories) {
    const totalShipped = shippedMap.get(category) || 0;
    const avgInventory = inventoryMap.get(category) || 0;
    const turnoverRatio = avgInventory > 0 ? Math.round((totalShipped / avgInventory) * 100) / 100 : 0;

    results.push({ category, turnoverRatio, totalShipped, avgInventory });
  }

  return results.sort((a, b) => b.turnoverRatio - a.turnoverRatio).slice(0, 8);
}

// ============================================
// Stock Level Heatmap
// ============================================

export interface StockHeatmapCell {
  productName: string;
  locationName: string;
  qtyOnHand: number;
  fillPercent: number;
}

export async function getStockLevelHeatmap(): Promise<StockHeatmapCell[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      qty_on_hand,
      product:products (name),
      location:locations (name)
    `)
    .gt("qty_on_hand", 0)
    .order("qty_on_hand", { ascending: false });

  if (error) throw new Error(error.message);

  // Aggregate by product + location
  const cellMap = new Map<string, { productName: string; locationName: string; qtyOnHand: number }>();

  for (const row of data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const location = Array.isArray(row.location) ? row.location[0] : row.location;
    const productName = (product as { name: string })?.name || "Unknown";
    const locationName = (location as { name: string })?.name || "Unknown";
    const key = `${productName}|${locationName}`;

    const entry = cellMap.get(key) || { productName, locationName, qtyOnHand: 0 };
    entry.qtyOnHand += row.qty_on_hand;
    cellMap.set(key, entry);
  }

  // Get top products by total qty
  const productTotals = new Map<string, number>();
  for (const cell of cellMap.values()) {
    productTotals.set(cell.productName, (productTotals.get(cell.productName) || 0) + cell.qtyOnHand);
  }
  const topProducts = Array.from(productTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);

  // Get top locations by total qty
  const locationTotals = new Map<string, number>();
  for (const cell of cellMap.values()) {
    locationTotals.set(cell.locationName, (locationTotals.get(cell.locationName) || 0) + cell.qtyOnHand);
  }
  const topLocations = Array.from(locationTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name]) => name);

  // Filter to top products x top locations
  const filteredCells = Array.from(cellMap.values()).filter(
    (cell) => topProducts.includes(cell.productName) && topLocations.includes(cell.locationName)
  );

  const maxQty = Math.max(...filteredCells.map((c) => c.qtyOnHand), 1);

  return filteredCells.map((cell) => ({
    productName: cell.productName,
    locationName: cell.locationName,
    qtyOnHand: cell.qtyOnHand,
    fillPercent: Math.round((cell.qtyOnHand / maxQty) * 100),
  }));
}

// ============================================
// Reorder Proximity
// ============================================

export interface ReorderProximityItem {
  productName: string;
  sku: string;
  currentQty: number;
  reorderPoint: number;
  maxQty: number;
  percentToReorder: number;
}

export async function getReorderProximity(): Promise<ReorderProximityItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      qty_on_hand,
      product:products (name, sku, reorder_point)
    `)
    .gt("qty_on_hand", 0);

  if (error) throw new Error(error.message);

  // Aggregate qty per product (by SKU)
  const skuMap = new Map<string, { name: string; sku: string; reorderPoint: number; qty: number }>();

  for (const row of data || []) {
    const product = Array.isArray(row.product) ? row.product[0] : row.product;
    const sku = (product as { sku: string })?.sku || "unknown";
    const name = (product as { name: string })?.name || "Unknown";
    const reorderPoint = (product as { reorder_point: number })?.reorder_point || 0;
    if (reorderPoint <= 0) continue;

    const entry = skuMap.get(sku) || { name, sku, reorderPoint, qty: 0 };
    entry.qty += row.qty_on_hand;
    skuMap.set(sku, entry);
  }

  const results: ReorderProximityItem[] = [];

  for (const [, entry] of skuMap) {
    const percentToReorder = Math.round((entry.qty / entry.reorderPoint) * 100);
    const maxQty = entry.reorderPoint * 3;

    results.push({
      productName: entry.name,
      sku: entry.sku,
      currentQty: entry.qty,
      reorderPoint: entry.reorderPoint,
      maxQty,
      percentToReorder,
    });
  }

  return results.sort((a, b) => a.percentToReorder - b.percentToReorder).slice(0, 8);
}

// ============================================
// Inventory Accuracy Trend
// ============================================

export interface AccuracyDataPoint {
  date: string;
  accuracyPercent: number;
  totalCounted: number;
}

export async function getInventoryAccuracyTrend(): Promise<AccuracyDataPoint[]> {
  const supabase = createClient();

  const { data: cycleCounts, error: ccError } = await supabase
    .from("cycle_counts")
    .select(`
      id,
      completed_at,
      cycle_count_items (
        expected_qty,
        counted_qty
      )
    `)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(10);

  if (ccError) throw new Error(ccError.message);

  const results: AccuracyDataPoint[] = [];

  for (const cc of cycleCounts || []) {
    const items = Array.isArray(cc.cycle_count_items) ? cc.cycle_count_items : [];
    if (items.length === 0) continue;

    const accurateCount = items.filter(
      (item: { expected_qty: number; counted_qty: number }) => item.counted_qty === item.expected_qty
    ).length;
    const accuracyPercent = Math.round((accurateCount / items.length) * 1000) / 10;

    results.push({
      date: new Date(cc.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      accuracyPercent,
      totalCounted: items.length,
    });
  }

  // Reverse so oldest is first (chart reads left to right)
  return results.reverse();
}

// ============================================
// Profit Margin Waterfall
// ============================================

export interface WaterfallItem {
  name: string;
  value: number;
  type: "increase" | "decrease" | "total";
}

export async function getProfitMarginWaterfall(): Promise<WaterfallItem[]> {
  const supabase = createClient();

  const [invoiceResult, costResult] = await Promise.all([
    supabase
      .from("invoices")
      .select("total")
      .in("status", ["sent", "paid"]),
    supabase
      .from("outbound_items")
      .select(`
        qty_shipped,
        product:products (unit_cost),
        order:outbound_orders!inner (status)
      `)
      .in("order.status", ["shipped", "delivered"])
      .gt("qty_shipped", 0),
  ]);

  if (invoiceResult.error) throw new Error(invoiceResult.error.message);
  if (costResult.error) throw new Error(costResult.error.message);

  // Calculate total revenue
  const revenue = (invoiceResult.data || []).reduce((sum, inv) => sum + (inv.total || 0), 0);

  // Calculate product costs
  let productCosts = 0;
  for (const item of costResult.data || []) {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const unitCost = (product as { unit_cost: number })?.unit_cost || 0;
    productCosts += (item.qty_shipped || 0) * unitCost;
  }

  // Warehousing fees estimate (15% of revenue)
  const warehousingFees = Math.round(revenue * 0.15);

  // Net profit
  const netProfit = Math.round(revenue - productCosts - warehousingFees);

  return [
    { name: "Revenue", value: Math.round(revenue), type: "total" },
    { name: "Product Costs", value: Math.round(productCosts), type: "decrease" },
    { name: "Warehousing Fees", value: warehousingFees, type: "decrease" },
    { name: "Net Profit", value: netProfit, type: "total" },
  ];
}

// ============================================
// Monthly Revenue Trend (12 months)
// ============================================

export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
}

export async function getMonthlyRevenueTrend(): Promise<MonthlyRevenuePoint[]> {
  const supabase = createClient();
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("invoices")
    .select("total, created_at")
    .in("status", ["sent", "paid"])
    .gte("created_at", twelveMonthsAgo.toISOString());

  if (error) throw new Error(error.message);

  // Build a map of all 12 months
  const monthMap = new Map<string, number>();
  const monthLabels = new Map<string, string>();
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    monthMap.set(key, 0);
    monthLabels.set(key, label);
  }

  for (const inv of data || []) {
    if (!inv.created_at) continue;
    const d = new Date(inv.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) || 0) + (inv.total || 0));
    }
  }

  return Array.from(monthMap.entries()).map(([key, revenue]) => ({
    month: monthLabels.get(key) || key,
    revenue: Math.round(revenue),
  }));
}

// ============================================
// Receiving Accuracy by Supplier
// ============================================

export interface SupplierAccuracy {
  supplier: string;
  accuracyPercent: number;
  totalOrders: number;
}

export async function getReceivingAccuracyBySupplier(): Promise<SupplierAccuracy[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inbound_orders")
    .select(`
      id,
      supplier,
      inbound_items (
        qty_expected,
        qty_received
      )
    `)
    .eq("status", "received");

  if (error) throw new Error(error.message);

  const supplierMap = new Map<string, { accurate: number; total: number }>();

  for (const order of data || []) {
    const supplier = order.supplier || "Unknown";
    const items = Array.isArray(order.inbound_items) ? order.inbound_items : [];
    if (items.length === 0) continue;

    const entry = supplierMap.get(supplier) || { accurate: 0, total: 0 };
    entry.total++;

    // Order is accurate if all items have qty_received == qty_expected
    const allAccurate = items.every(
      (item: { qty_expected: number; qty_received: number }) => item.qty_received === item.qty_expected
    );
    if (allAccurate) entry.accurate++;

    supplierMap.set(supplier, entry);
  }

  return Array.from(supplierMap.entries())
    .map(([supplier, { accurate, total }]) => ({
      supplier,
      accuracyPercent: total > 0 ? Math.round((accurate / total) * 1000) / 10 : 0,
      totalOrders: total,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders)
    .slice(0, 8);
}

// ============================================
// Inbound Forecast Calendar
// ============================================

export interface CalendarDay {
  date: string;
  count: number;
}

export async function getInboundForecastCalendar(): Promise<CalendarDay[]> {
  const supabase = createClient();
  const today = new Date();
  const ninetyDaysOut = new Date();
  ninetyDaysOut.setDate(ninetyDaysOut.getDate() + 90);

  const todayStr = today.toISOString().split("T")[0];
  const endStr = ninetyDaysOut.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("inbound_orders")
    .select("expected_date")
    .in("status", ["pending", "confirmed", "in_transit"])
    .not("expected_date", "is", null)
    .gte("expected_date", todayStr)
    .lte("expected_date", endStr);

  if (error) throw new Error(error.message);

  const dayMap = new Map<string, number>();

  for (const order of data || []) {
    if (!order.expected_date) continue;
    const key = order.expected_date.split("T")[0];
    dayMap.set(key, (dayMap.get(key) || 0) + 1);
  }

  return Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================
// Returns by Reason
// ============================================

export interface ReturnReasonData {
  reason: string;
  count: number;
  color: string;
}

const RETURN_REASON_COLORS = [
  "#EF4444", "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6",
];

export async function getReturnsByReason(): Promise<ReturnReasonData[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("returns")
    .select("reason");

  if (error) throw new Error(error.message);

  const reasonMap = new Map<string, number>();

  for (const ret of data || []) {
    const reason = ret.reason || "Unknown";
    reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
  }

  return Array.from(reasonMap.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .map((item, idx) => ({
      ...item,
      color: RETURN_REASON_COLORS[idx % RETURN_REASON_COLORS.length],
    }));
}

// ============================================
// Damage Rate Trend (6 months)
// ============================================

export interface DamageRatePoint {
  month: string;
  count: number;
}

export async function getDamageRateTrend(): Promise<DamageRatePoint[]> {
  const supabase = createClient();
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("damage_reports")
    .select("created_at")
    .gte("created_at", sixMonthsAgo.toISOString());

  if (error) throw new Error(error.message);

  // Build a map of all 6 months
  const monthMap = new Map<string, number>();
  const monthLabels = new Map<string, string>();
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short" });
    monthMap.set(key, 0);
    monthLabels.set(key, label);
  }

  for (const report of data || []) {
    if (!report.created_at) continue;
    const d = new Date(report.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) || 0) + 1);
    }
  }

  return Array.from(monthMap.entries()).map(([key, count]) => ({
    month: monthLabels.get(key) || key,
    count,
  }));
}

// ============================================
// Expiration Timeline
// ============================================

export interface ExpirationTimelineItem {
  productName: string;
  lotNumber: string;
  expirationDate: string;
  daysUntilExpiry: number;
}

export async function getExpirationTimeline(): Promise<ExpirationTimelineItem[]> {
  const supabase = createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 180);
  const futureStr = futureDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("lots")
    .select(`
      lot_number,
      expiration_date,
      product:products (name)
    `)
    .eq("status", "active")
    .not("expiration_date", "is", null)
    .gte("expiration_date", todayStr)
    .lte("expiration_date", futureStr)
    .order("expiration_date", { ascending: true })
    .limit(10);

  if (error) throw new Error(error.message);

  return (data || []).map((lot) => {
    const product = Array.isArray(lot.product) ? lot.product[0] : lot.product;
    const expDate = new Date(lot.expiration_date);
    expDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    return {
      productName: (product as { name: string })?.name || "Unknown",
      lotNumber: lot.lot_number || "",
      expirationDate: lot.expiration_date,
      daysUntilExpiry: daysUntil,
    };
  });
}
