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
    .select("id, total, amount_paid, due_date")
    .eq("status", "sent");

  if (error) {
    throw new Error(error.message);
  }

  const invoices = data || [];

  let totalOutstanding = 0;
  let overdueCount = 0;
  let overdueAmount = 0;

  invoices.forEach((inv) => {
    const outstanding = (inv.total || 0) - (inv.amount_paid || 0);
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
