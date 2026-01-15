import { createClient } from "@/lib/supabase";

export interface ClientArrival {
  id: string;
  orderNumber: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  expectedDate: string | null;
  receivedAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  notes: string | null;
  itemCount: number;
  totalUnitsExpected: number;
  totalUnitsReceived: number;
}

export interface ClientArrivalDetail extends ClientArrival {
  items: {
    id: string;
    productId: string;
    productName: string;
    sku: string;
    qtyExpected: number;
    qtyReceived: number;
  }[];
}

export type ArrivalStatus = "pending" | "in_transit" | "received" | "cancelled";

/**
 * Fetches inbound orders (arrivals) for a specific client
 * @param clientId - The client's UUID
 * @param status - Optional status filter (defaults to "received")
 * @returns Array of client arrivals
 */
export async function getClientArrivals(
  clientId: string,
  status?: ArrivalStatus | "all"
): Promise<ClientArrival[]> {
  const supabase = createClient();

  let query = supabase
    .from("inbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      updated_at,
      expected_date,
      received_at,
      carrier,
      tracking_number,
      notes,
      items:inbound_items (
        qty_expected,
        qty_received
      )
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  // Default to "received" if no status specified
  if (status && status !== "all") {
    query = query.eq("status", status);
  } else if (!status) {
    query = query.eq("status", "received");
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching client arrivals:", error);
    return [];
  }

  return (data || []).map((order) => {
    const items = order.items as { qty_expected: number; qty_received: number }[];
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      expectedDate: order.expected_date,
      receivedAt: order.received_at,
      carrier: order.carrier,
      trackingNumber: order.tracking_number,
      notes: order.notes,
      itemCount: items.length,
      totalUnitsExpected: items.reduce((sum, item) => sum + (item.qty_expected || 0), 0),
      totalUnitsReceived: items.reduce((sum, item) => sum + (item.qty_received || 0), 0),
    };
  });
}

/**
 * Fetches a single inbound order with full details, validating client ownership
 * @param arrivalId - The inbound order's UUID
 * @param clientId - The client's UUID (for validation)
 * @returns Arrival details or null if not found/unauthorized
 */
export async function getClientArrival(
  arrivalId: string,
  clientId: string
): Promise<ClientArrivalDetail | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      updated_at,
      expected_date,
      received_at,
      carrier,
      tracking_number,
      notes,
      client_id,
      items:inbound_items (
        id,
        qty_expected,
        qty_received,
        product:products (
          id,
          name,
          sku
        )
      )
    `)
    .eq("id", arrivalId)
    .single();

  if (error || !data) {
    console.error("Error fetching arrival:", error);
    return null;
  }

  // Validate client ownership
  if (data.client_id !== clientId) {
    console.error("Unauthorized: Arrival does not belong to client");
    return null;
  }

  // Transform the data
  const items = (data.items || []).map((item: {
    id: string;
    qty_expected: number;
    qty_received: number;
    product: { id: string; name: string; sku: string } | { id: string; name: string; sku: string }[];
  }) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      id: item.id,
      productId: product?.id || "",
      productName: product?.name || "Unknown",
      sku: product?.sku || "",
      qtyExpected: item.qty_expected || 0,
      qtyReceived: item.qty_received || 0,
    };
  });

  return {
    id: data.id,
    orderNumber: data.order_number,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    expectedDate: data.expected_date,
    receivedAt: data.received_at,
    carrier: data.carrier,
    trackingNumber: data.tracking_number,
    notes: data.notes,
    itemCount: items.length,
    totalUnitsExpected: items.reduce((sum, item) => sum + item.qtyExpected, 0),
    totalUnitsReceived: items.reduce((sum, item) => sum + item.qtyReceived, 0),
    items,
  };
}

/**
 * Gets recent arrivals count for a client (received in last 30 days)
 * @param clientId - The client's UUID
 * @returns Count of recent arrivals
 */
export async function getClientRecentArrivalsCount(
  clientId: string
): Promise<number> {
  const supabase = createClient();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { count, error } = await supabase
    .from("inbound_orders")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("status", "received")
    .gte("received_at", thirtyDaysAgo.toISOString());

  if (error) {
    console.error("Error fetching recent arrivals count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Gets pending arrivals for a client (pending or in_transit)
 * @param clientId - The client's UUID
 * @returns Array of pending arrivals
 */
export async function getClientPendingArrivals(
  clientId: string
): Promise<ClientArrival[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      updated_at,
      expected_date,
      received_at,
      carrier,
      tracking_number,
      notes,
      items:inbound_items (
        qty_expected,
        qty_received
      )
    `)
    .eq("client_id", clientId)
    .in("status", ["pending", "in_transit"])
    .order("expected_date", { ascending: true });

  if (error) {
    console.error("Error fetching pending arrivals:", error);
    return [];
  }

  return (data || []).map((order) => {
    const items = order.items as { qty_expected: number; qty_received: number }[];
    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      expectedDate: order.expected_date,
      receivedAt: order.received_at,
      carrier: order.carrier,
      trackingNumber: order.tracking_number,
      notes: order.notes,
      itemCount: items.length,
      totalUnitsExpected: items.reduce((sum, item) => sum + (item.qty_expected || 0), 0),
      totalUnitsReceived: items.reduce((sum, item) => sum + (item.qty_received || 0), 0),
    };
  });
}
