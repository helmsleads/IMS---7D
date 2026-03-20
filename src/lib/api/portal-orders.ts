import { createClient } from "@/lib/supabase";

export interface ClientOrder {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  shipToAddress: string;
  shipToAddress2: string | null;
  shipToCity: string;
  shipToState: string;
  shipToPostalCode: string;
  shipToCountry: string;
  notes: string | null;
  isRush: boolean;
  preferredCarrier: string | null;
  trackingNumber: string | null;
  itemCount: number;
  totalUnits: number;
}

export interface ClientOrderDetail extends ClientOrder {
  items: {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    qtyRequested: number;
    qtyPicked: number;
    status: string;
  }[];
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

/**
 * Fetches orders for a specific client with optional status filter.
 * Uses RPC to include multi-client orders where the client has items via product ownership.
 * @param clientId - The client's UUID
 * @param status - Optional status to filter by
 * @returns Array of client orders
 */
export async function getClientOrders(
  clientId: string,
  status?: OrderStatus
): Promise<ClientOrder[]> {
  const supabase = createClient();

  // Get all order IDs this client has access to (primary client OR product owner)
  const { data: orderIds, error: rpcError } = await supabase
    .rpc("get_client_order_ids", { p_client_id: clientId });

  if (rpcError || !orderIds || orderIds.length === 0) {
    if (rpcError) console.error("Error fetching client order IDs:", rpcError);
    return [];
  }

  let query = supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      updated_at,
      ship_to_address,
      ship_to_address2,
      ship_to_city,
      ship_to_state,
      ship_to_zip,
      ship_to_country,
      notes,
      is_rush,
      preferred_carrier,
      tracking_number,
      items:outbound_items (
        qty_requested
      )
    `)
    .in("id", orderIds)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching client orders:", error);
    return [];
  }

  return (data || []).map((order) => {
    const items = order.items as { qty_requested: number }[];
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      shipToAddress: order.ship_to_address,
      shipToAddress2: order.ship_to_address2,
      shipToCity: order.ship_to_city,
      shipToState: order.ship_to_state,
      shipToPostalCode: order.ship_to_zip,
      shipToCountry: order.ship_to_country,
      notes: order.notes,
      isRush: order.is_rush || false,
      preferredCarrier: order.preferred_carrier,
      trackingNumber: order.tracking_number,
      itemCount: items.length,
      totalUnits: items.reduce((sum, item) => sum + item.qty_requested, 0),
    };
  });
}

/**
 * Fetches a single order with full details, validating client access.
 * Access is granted if the client is the primary client OR has items via product ownership.
 * Items are filtered to only show the portal user's client's products.
 * @param orderId - The order's UUID
 * @param clientId - The client's UUID (for validation)
 * @returns Order details or null if not found/unauthorized
 */
export async function getClientOrder(
  orderId: string,
  clientId: string
): Promise<ClientOrderDetail | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      updated_at,
      ship_to_address,
      ship_to_address2,
      ship_to_city,
      ship_to_state,
      ship_to_zip,
      ship_to_country,
      notes,
      is_rush,
      preferred_carrier,
      tracking_number,
      client_id,
      is_multi_client,
      items:outbound_items (
        id,
        qty_requested,
        qty_shipped,
        product:products (
          id,
          name,
          sku,
          client_id
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !data) {
    console.error("Error fetching order:", error);
    return null;
  }

  // Validate client access: primary client OR has items via product ownership
  const isPrimaryClient = data.client_id === clientId;
  const hasOwnedItems = (data.items || []).some((item: any) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return product?.client_id === clientId;
  });

  if (!isPrimaryClient && !hasOwnedItems) {
    console.error("Unauthorized: Client has no access to this order");
    return null;
  }

  // Filter items to only show this client's products (for multi-client orders)
  const allItems = data.items || [];
  const visibleItems = data.is_multi_client
    ? allItems.filter((item: any) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        return product?.client_id === clientId;
      })
    : allItems;

  // Transform the data (outbound_items has qty_shipped, not qty_picked; no status column)
  const items = visibleItems.map((item: {
    id: string;
    qty_requested: number;
    qty_shipped: number;
    product: { id: string; name: string; sku: string; client_id?: string | null } | { id: string; name: string; sku: string; client_id?: string | null }[];
  }) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      id: item.id,
      productId: product?.id || "",
      productName: product?.name || "Unknown",
      sku: product?.sku || "",
      qtyRequested: item.qty_requested,
      qtyPicked: item.qty_shipped || 0,
      status: item.qty_shipped >= item.qty_requested ? "shipped" : item.qty_shipped > 0 ? "partial" : "pending",
    };
  });

  return {
    id: data.id,
    orderNumber: data.order_number,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    shipToAddress: data.ship_to_address,
    shipToAddress2: data.ship_to_address2,
    shipToCity: data.ship_to_city,
    shipToState: data.ship_to_state,
    shipToPostalCode: data.ship_to_zip,
    shipToCountry: data.ship_to_country,
    notes: data.notes,
    isRush: data.is_rush || false,
    preferredCarrier: data.preferred_carrier,
    trackingNumber: data.tracking_number,
    itemCount: items.length,
    totalUnits: items.reduce((sum, item) => sum + item.qtyRequested, 0),
    items,
  };
}

/**
 * Gets order status counts for a client (for dashboard/filters).
 * Uses RPC to include multi-client orders.
 * @param clientId - The client's UUID
 * @returns Object with status counts
 */
export async function getClientOrderStatusCounts(
  clientId: string
): Promise<Record<string, number>> {
  const supabase = createClient();

  // Get all order IDs this client has access to
  const { data: orderIds, error: rpcError } = await supabase
    .rpc("get_client_order_ids", { p_client_id: clientId });

  if (rpcError || !orderIds || orderIds.length === 0) {
    if (rpcError) console.error("Error fetching client order IDs:", rpcError);
    return {};
  }

  const { data, error } = await supabase
    .from("outbound_orders")
    .select("status")
    .in("id", orderIds);

  if (error) {
    console.error("Error fetching order status counts:", error);
    return {};
  }

  const counts: Record<string, number> = {};
  (data || []).forEach((order) => {
    counts[order.status] = (counts[order.status] || 0) + 1;
  });

  return counts;
}

/**
 * Gets active orders count for a client (pending, confirmed, processing, packed, shipped).
 * Uses RPC to include multi-client orders.
 * @param clientId - The client's UUID
 * @returns Count of active orders
 */
export async function getClientActiveOrdersCount(
  clientId: string
): Promise<number> {
  const supabase = createClient();

  // Get all order IDs this client has access to
  const { data: orderIds, error: rpcError } = await supabase
    .rpc("get_client_order_ids", { p_client_id: clientId });

  if (rpcError || !orderIds || orderIds.length === 0) {
    if (rpcError) console.error("Error fetching client order IDs:", rpcError);
    return 0;
  }

  const { count, error } = await supabase
    .from("outbound_orders")
    .select("id", { count: "exact", head: true })
    .in("id", orderIds)
    .in("status", ["pending", "confirmed", "processing", "packed", "shipped"]);

  if (error) {
    console.error("Error fetching active orders count:", error);
    return 0;
  }

  return count || 0;
}
