import { createClient } from "@/lib/supabase";

export interface OrderTimelineEvent {
  id: string;
  event_type: "status_change" | "scan" | "note";
  title: string;
  description: string | null;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface OrderTrackingDetail {
  id: string;
  order_number: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  ship_to_address: string | null;
  created_at: string;
  confirmed_at: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  items: Array<{
    id: string;
    qty_requested: number;
    qty_shipped: number;
    product: {
      sku: string;
      name: string;
    };
  }>;
  cartons: Array<{
    lpn_number: string;
    stage: string;
  }>;
  timeline: OrderTimelineEvent[];
}

/**
 * Get order tracking detail with timeline
 */
export async function getPortalOrderTracking(
  orderId: string
): Promise<OrderTrackingDetail | null> {
  const supabase = createClient();

  // Get user's client_id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user.id)
    .single();

  if (!userData?.client_id) {
    throw new Error("Not associated with a client");
  }

  // Get the order
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      client_id,
      status,
      carrier,
      tracking_number,
      ship_to_address,
      created_at,
      confirmed_at,
      shipped_date,
      delivered_date,
      items:outbound_items (
        id,
        qty_requested,
        qty_shipped,
        product:products (sku, name)
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError) {
    if (orderError.code === "PGRST116") return null;
    throw new Error(orderError.message);
  }

  // Verify access
  if (order.client_id !== userData.client_id) {
    throw new Error("Access denied");
  }

  // Get cartons
  const { data: cartons } = await supabase
    .from("lpns")
    .select("lpn_number, stage")
    .eq("reference_type", "outbound_order")
    .eq("reference_id", orderId);

  // Build timeline from various sources
  const timeline: OrderTimelineEvent[] = [];

  // Add order creation
  timeline.push({
    id: `created-${order.id}`,
    event_type: "status_change",
    title: "Order Created",
    description: `Order ${order.order_number} was created`,
    timestamp: order.created_at,
  });

  // Add confirmation
  if (order.confirmed_at) {
    timeline.push({
      id: `confirmed-${order.id}`,
      event_type: "status_change",
      title: "Order Confirmed",
      description: "Order was confirmed and queued for fulfillment",
      timestamp: order.confirmed_at,
    });
  }

  // Get scan events for this order
  const { data: scanEvents } = await supabase
    .from("scan_events")
    .select("id, workflow_stage, barcode, scanned_at")
    .eq("reference_type", "outbound_order")
    .eq("reference_id", orderId)
    .order("scanned_at");

  // Group scan events by stage
  const stageLabels: Record<string, string> = {
    picking: "Items Picked",
    packing: "Items Packed",
    shipping: "Shipment Verified",
  };

  const stageEvents: Record<string, { first: string; count: number }> = {};
  for (const scan of scanEvents || []) {
    if (!stageEvents[scan.workflow_stage]) {
      stageEvents[scan.workflow_stage] = {
        first: scan.scanned_at,
        count: 0,
      };
    }
    stageEvents[scan.workflow_stage].count++;
  }

  for (const [stage, data] of Object.entries(stageEvents)) {
    timeline.push({
      id: `scan-${stage}-${orderId}`,
      event_type: "scan",
      title: stageLabels[stage] || `${stage} scan`,
      description: `${data.count} item${data.count !== 1 ? "s" : ""} scanned`,
      timestamp: data.first,
      metadata: { stage, count: data.count },
    });
  }

  // Add shipping
  if (order.shipped_date) {
    timeline.push({
      id: `shipped-${order.id}`,
      event_type: "status_change",
      title: "Order Shipped",
      description: order.carrier && order.tracking_number
        ? `Shipped via ${order.carrier} - ${order.tracking_number}`
        : "Order has been shipped",
      timestamp: order.shipped_date,
      metadata: {
        carrier: order.carrier,
        tracking_number: order.tracking_number,
      },
    });
  }

  // Add delivery
  if (order.delivered_date) {
    timeline.push({
      id: `delivered-${order.id}`,
      event_type: "status_change",
      title: "Order Delivered",
      description: "Order has been delivered",
      timestamp: order.delivered_date,
    });
  }

  // Sort timeline by timestamp
  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    carrier: order.carrier,
    tracking_number: order.tracking_number,
    ship_to_address: order.ship_to_address,
    created_at: order.created_at,
    confirmed_at: order.confirmed_at,
    shipped_date: order.shipped_date,
    delivered_date: order.delivered_date,
    items: (order.items || []).map(item => ({
      id: item.id,
      qty_requested: item.qty_requested,
      qty_shipped: item.qty_shipped,
      product: item.product as { sku: string; name: string },
    })),
    cartons: (cartons || []).map(c => ({
      lpn_number: c.lpn_number,
      stage: c.stage,
    })),
    timeline,
  };
}

/**
 * Get recent orders with basic tracking info
 */
export async function getPortalRecentOrders(
  limit: number = 10
): Promise<Array<{
  id: string;
  order_number: string;
  status: string;
  item_count: number;
  created_at: string;
  shipped_date: string | null;
}>> {
  const supabase = createClient();

  // Get user's client_id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user.id)
    .single();

  if (!userData?.client_id) {
    return [];
  }

  const { data, error } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      shipped_date,
      items:outbound_items(count)
    `)
    .eq("client_id", userData.client_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map(order => ({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    item_count: (order.items as unknown as Array<{ count: number }>)?.[0]?.count || 0,
    created_at: order.created_at,
    shipped_date: order.shipped_date,
  }));
}

/**
 * Check inventory availability for requested items (before submitting shipment request)
 */
export async function checkPortalOrderAvailability(
  items: Array<{ productId: string; qtyRequested: number }>
): Promise<Array<{
  productId: string;
  sku: string;
  name: string;
  qtyRequested: number;
  qtyAvailable: number;
  canFulfill: boolean;
  shortfall: number;
}>> {
  const supabase = createClient();

  // Get user's client_id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user.id)
    .single();

  if (!userData?.client_id) {
    throw new Error("Not associated with a client");
  }

  const results: Array<{
    productId: string;
    sku: string;
    name: string;
    qtyRequested: number;
    qtyAvailable: number;
    canFulfill: boolean;
    shortfall: number;
  }> = [];

  for (const item of items) {
    // Get product info
    const { data: product } = await supabase
      .from("products")
      .select("id, sku, name, client_id")
      .eq("id", item.productId)
      .single();

    if (!product || product.client_id !== userData.client_id) {
      continue;
    }

    // Get available inventory
    const { data: inventory } = await supabase
      .from("inventory")
      .select("qty_on_hand, qty_reserved")
      .eq("product_id", item.productId)
      .eq("stage", "available");

    const totalOnHand = (inventory || []).reduce((sum, inv) => sum + inv.qty_on_hand, 0);
    const totalReserved = (inventory || []).reduce((sum, inv) => sum + inv.qty_reserved, 0);
    const available = totalOnHand - totalReserved;

    results.push({
      productId: product.id,
      sku: product.sku,
      name: product.name,
      qtyRequested: item.qtyRequested,
      qtyAvailable: available,
      canFulfill: available >= item.qtyRequested,
      shortfall: Math.max(0, item.qtyRequested - available),
    });
  }

  return results;
}
