import { createClient } from "@/lib/supabase";
import { Supply, SupplyInventory, SupplyUsage } from "@/types/database";

export interface SupplyFilters {
  category?: string;
  active?: boolean;
}

export interface SupplyWithInventory extends Supply {
  supply_inventory: SupplyInventory[];
}

export interface SupplyInventoryWithDetails extends Omit<SupplyInventory, 'supply'> {
  supply: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  };
  location: {
    id: string;
    name: string;
  } | null;
}

export async function getSupplies(filters?: SupplyFilters): Promise<SupplyWithInventory[]> {
  const supabase = createClient();

  let query = supabase
    .from("supplies")
    .select(`
      *,
      supply_inventory (*)
    `)
    .order("sort_order")
    .order("name");

  if (filters?.category) {
    query = query.eq("category", filters.category);
  }

  if (filters?.active !== undefined) {
    query = query.eq("is_active", filters.active);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSupply(id: string): Promise<SupplyWithInventory | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supplies")
    .select(`
      *,
      supply_inventory (*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function createSupply(supply: Partial<Supply>): Promise<Supply> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supplies")
    .insert(supply)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateSupply(
  id: string,
  supply: Partial<Supply>
): Promise<Supply> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supplies")
    .update(supply)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteSupply(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("supplies")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getSupplyInventory(): Promise<SupplyInventoryWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supply_inventory")
    .select(`
      *,
      supply:supplies (id, sku, name, unit),
      location:locations (id, name)
    `)
    .order("supply_id");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function adjustSupplyInventory(
  supplyId: string,
  locationId: string | null,
  adjustment: number
): Promise<SupplyInventory> {
  const supabase = createClient();

  // Build the query for finding existing inventory
  let findQuery = supabase
    .from("supply_inventory")
    .select("*")
    .eq("supply_id", supplyId);

  if (locationId) {
    findQuery = findQuery.eq("location_id", locationId);
  } else {
    findQuery = findQuery.is("location_id", null);
  }

  const { data: existing, error: fetchError } = await findQuery.single();

  if (fetchError && fetchError.code !== "PGRST116") {
    throw new Error(fetchError.message);
  }

  if (existing) {
    // Update existing inventory
    const newQty = existing.qty_on_hand + adjustment;
    if (newQty < 0) {
      throw new Error("Adjustment would result in negative inventory");
    }

    const { data, error } = await supabase
      .from("supply_inventory")
      .update({ qty_on_hand: newQty })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  } else {
    // Create new inventory record
    if (adjustment < 0) {
      throw new Error("Cannot create inventory record with negative quantity");
    }

    const { data, error } = await supabase
      .from("supply_inventory")
      .insert({
        supply_id: supplyId,
        location_id: locationId,
        qty_on_hand: adjustment,
        reorder_point: 0,
      })
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  }
}

export interface SupplyUsageFilters {
  clientId?: string;
  supplyId?: string;
  orderId?: string;
  startDate?: string;
  endDate?: string;
  invoiced?: boolean;
}

export interface SupplyUsageWithDetails extends Omit<SupplyUsage, 'supply' | 'client'> {
  supply: {
    id: string;
    sku: string;
    name: string;
    unit: string;
  };
  client: {
    id: string;
    company_name: string;
  };
}

export async function getSupplyUsage(filters?: SupplyUsageFilters): Promise<SupplyUsageWithDetails[]> {
  const supabase = createClient();

  let query = supabase
    .from("supply_usage")
    .select(`
      *,
      supply:supplies (id, sku, name, unit),
      client:clients (id, company_name)
    `)
    .order("created_at", { ascending: false });

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  if (filters?.supplyId) {
    query = query.eq("supply_id", filters.supplyId);
  }

  if (filters?.orderId) {
    query = query.eq("order_id", filters.orderId);
  }

  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate);
  }

  if (filters?.invoiced !== undefined) {
    query = query.eq("invoiced", filters.invoiced);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function recordSupplyUsage(
  orderId: string,
  supplyId: string,
  quantity: number
): Promise<SupplyUsage> {
  const supabase = createClient();

  // Get supply details for pricing
  const { data: supply, error: supplyError } = await supabase
    .from("supplies")
    .select("base_price")
    .eq("id", supplyId)
    .single();

  if (supplyError) {
    throw new Error(supplyError.message);
  }

  // Get order for client_id
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select("client_id")
    .eq("id", orderId)
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  const unitPrice = supply.base_price || 0;
  const total = quantity * unitPrice;

  const { data, error } = await supabase
    .from("supply_usage")
    .insert({
      supply_id: supplyId,
      client_id: order.client_id,
      order_id: orderId,
      quantity,
      unit_price: unitPrice,
      total,
      billing_method: "per_use",
      invoiced: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getOrderSupplies(orderId: string): Promise<SupplyUsageWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supply_usage")
    .select(`
      *,
      supply:supplies (id, sku, name, unit),
      client:clients (id, company_name)
    `)
    .eq("order_id", orderId)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getUninvoicedSupplyUsage(clientId: string): Promise<SupplyUsageWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supply_usage")
    .select(`
      *,
      supply:supplies (id, sku, name, unit),
      client:clients (id, company_name)
    `)
    .eq("client_id", clientId)
    .eq("invoiced", false)
    .order("created_at");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get supplies available for a specific industry
 * Use this when selecting supplies for order packing based on client's industry
 */
export async function getSuppliesByIndustry(
  industry: string
): Promise<SupplyWithInventory[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("supplies")
    .select(`
      *,
      supply_inventory (*)
    `)
    .eq("is_active", true)
    .contains("industries", [industry])
    .order("sort_order")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get supplies available for a specific client based on their industry
 */
export async function getSuppliesForClient(
  clientId: string
): Promise<SupplyWithInventory[]> {
  const supabase = createClient();

  // First get the client's industry
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("industry")
    .eq("id", clientId)
    .single();

  if (clientError) {
    throw new Error(clientError.message);
  }

  const industry = client?.industry || "general_merchandise";

  // Then get supplies for that industry
  return getSuppliesByIndustry(industry);
}
