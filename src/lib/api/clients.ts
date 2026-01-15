import { createClient } from "@/lib/supabase";

export interface Client {
  id: string;
  auth_id: string | null;
  company_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  active: boolean;
  created_at: string;
}

export interface ClientWithSummary extends Client {
  inventory_summary: {
    total_products: number;
    total_units: number;
    total_value: number;
  };
  order_summary: {
    pending_inbound: number;
    pending_outbound: number;
    total_orders: number;
  };
}

export interface ClientInventoryItem {
  id: string;
  product_id: string;
  location_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  updated_at: string;
  product: {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    unit_cost: number;
  };
  location: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  };
}

export interface ClientOrder {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  type: "inbound" | "outbound";
  item_count: number;
}

export async function getClients(): Promise<Client[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("company_name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getClient(id: string): Promise<ClientWithSummary | null> {
  const supabase = createClient();

  // Get client data
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  // Get inventory summary for this client
  const { data: inventoryData } = await supabase
    .from("inventory")
    .select(`
      qty_on_hand,
      product:products (
        unit_cost
      )
    `)
    .eq("client_id", id);

  const inventory = inventoryData || [];
  const totalProducts = new Set(inventory.map((i) => i.product)).size;
  const totalUnits = inventory.reduce((sum, i) => sum + (i.qty_on_hand || 0), 0);
  const totalValue = inventory.reduce(
    (sum, i) => {
      const product = Array.isArray(i.product) ? i.product[0] : i.product;
      return sum + (i.qty_on_hand || 0) * ((product as { unit_cost: number } | null)?.unit_cost || 0);
    },
    0
  );

  // Get order counts
  const { count: inboundPending } = await supabase
    .from("inbound_orders")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)
    .in("status", ["pending", "confirmed", "in_transit"]);

  const { count: outboundPending } = await supabase
    .from("outbound_orders")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id)
    .in("status", ["pending", "confirmed", "processing", "packed"]);

  const { count: totalInbound } = await supabase
    .from("inbound_orders")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id);

  const { count: totalOutbound } = await supabase
    .from("outbound_orders")
    .select("*", { count: "exact", head: true })
    .eq("client_id", id);

  return {
    ...client,
    inventory_summary: {
      total_products: totalProducts,
      total_units: totalUnits,
      total_value: totalValue,
    },
    order_summary: {
      pending_inbound: inboundPending || 0,
      pending_outbound: outboundPending || 0,
      total_orders: (totalInbound || 0) + (totalOutbound || 0),
    },
  };
}

export async function createClientRecord(
  client: Omit<Client, "id" | "auth_id" | "created_at">
): Promise<Client> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .insert(client)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateClient(
  id: string,
  client: Partial<Client>
): Promise<Client> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .update(client)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteClient(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("clients")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getClientInventory(clientId: string): Promise<ClientInventoryItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      id,
      product_id,
      location_id,
      qty_on_hand,
      qty_reserved,
      updated_at,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .eq("client_id", clientId)
    .gt("qty_on_hand", 0)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  // Transform data to handle Supabase array returns for relations
  return (data || []).map((item) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const location = Array.isArray(item.location) ? item.location[0] : item.location;
    return {
      id: item.id,
      product_id: item.product_id,
      location_id: item.location_id,
      qty_on_hand: item.qty_on_hand,
      qty_reserved: item.qty_reserved,
      updated_at: item.updated_at,
      product: product || { id: "", sku: "", name: "Unknown", category: null, unit_cost: 0 },
      location: location || { id: "", name: "Unknown", city: null, state: null },
    };
  }) as ClientInventoryItem[];
}

export async function getClientOrders(clientId: string): Promise<ClientOrder[]> {
  const supabase = createClient();

  // Get inbound orders
  const { data: inboundData, error: inboundError } = await supabase
    .from("inbound_orders")
    .select(`
      id,
      po_number,
      status,
      created_at,
      items:inbound_items(count)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (inboundError) {
    throw new Error(inboundError.message);
  }

  // Get outbound orders
  const { data: outboundData, error: outboundError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      status,
      created_at,
      items:outbound_items(count)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (outboundError) {
    throw new Error(outboundError.message);
  }

  // Combine and format orders
  const inboundOrders: ClientOrder[] = (inboundData || []).map((order) => ({
    id: order.id,
    order_number: order.po_number,
    status: order.status,
    created_at: order.created_at,
    type: "inbound" as const,
    item_count: order.items?.[0]?.count || 0,
  }));

  const outboundOrders: ClientOrder[] = (outboundData || []).map((order) => ({
    id: order.id,
    order_number: order.order_number,
    status: order.status,
    created_at: order.created_at,
    type: "outbound" as const,
    item_count: order.items?.[0]?.count || 0,
  }));

  // Combine and sort by created_at descending
  return [...inboundOrders, ...outboundOrders].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
