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
 * Fetches orders for a specific client with optional status filter
 * @param clientId - The client's UUID
 * @param status - Optional status to filter by
 * @returns Array of client orders
 */
export async function getClientOrders(
  clientId: string,
  status?: OrderStatus
): Promise<ClientOrder[]> {
  const supabase = createClient();

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
      ship_to_postal_code,
      ship_to_country,
      notes,
      is_rush,
      preferred_carrier,
      tracking_number,
      items:outbound_items (
        qty_requested
      )
    `)
    .eq("client_id", clientId)
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
      shipToPostalCode: order.ship_to_postal_code,
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
 * Fetches a single order with full details, validating client ownership
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
      ship_to_postal_code,
      ship_to_country,
      notes,
      is_rush,
      preferred_carrier,
      tracking_number,
      client_id,
      items:outbound_items (
        id,
        qty_requested,
        qty_picked,
        status,
        product:products (
          id,
          name,
          sku
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (error || !data) {
    console.error("Error fetching order:", error);
    return null;
  }

  // Validate client ownership
  if (data.client_id !== clientId) {
    console.error("Unauthorized: Order does not belong to client");
    return null;
  }

  // Transform the data
  const items = (data.items || []).map((item: {
    id: string;
    qty_requested: number;
    qty_picked: number;
    status: string;
    product: { id: string; name: string; sku: string } | { id: string; name: string; sku: string }[];
  }) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      id: item.id,
      productId: product?.id || "",
      productName: product?.name || "Unknown",
      sku: product?.sku || "",
      qtyRequested: item.qty_requested,
      qtyPicked: item.qty_picked || 0,
      status: item.status,
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
    shipToPostalCode: data.ship_to_postal_code,
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
 * Gets order status counts for a client (for dashboard/filters)
 * @param clientId - The client's UUID
 * @returns Object with status counts
 */
export async function getClientOrderStatusCounts(
  clientId: string
): Promise<Record<string, number>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outbound_orders")
    .select("status")
    .eq("client_id", clientId);

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
 * Gets active orders count for a client (pending, confirmed, processing, packed, shipped)
 * @param clientId - The client's UUID
 * @returns Count of active orders
 */
export async function getClientActiveOrdersCount(
  clientId: string
): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("outbound_orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .in("status", ["pending", "confirmed", "processing", "packed", "shipped"]);

  if (error) {
    console.error("Error fetching active orders count:", error);
    return 0;
  }

  return count || 0;
}
