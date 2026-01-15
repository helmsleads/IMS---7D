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
