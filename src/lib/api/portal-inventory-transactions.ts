import { createClient } from "@/lib/supabase";

export interface PortalInventoryTransaction {
  id: string;
  product_id: string;
  transaction_type: string;
  qty_before: number;
  qty_change: number;
  qty_after: number;
  reference_type: string | null;
  reference_id: string | null;
  reason: string | null;
  created_at: string;
  product: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface PortalTransactionFilters {
  productId?: string;
  transactionType?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

/**
 * Get inventory transactions for the current portal user's client
 */
export async function getPortalInventoryTransactions(
  filters?: PortalTransactionFilters
): Promise<PortalInventoryTransaction[]> {
  const supabase = createClient();

  // Get user's client_id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.client_id) {
    throw new Error("Not associated with a client");
  }

  // Get products for this client
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id")
    .eq("client_id", userData.client_id);

  if (productsError) {
    throw new Error(productsError.message);
  }

  const productIds = products?.map(p => p.id) || [];
  if (productIds.length === 0) {
    return [];
  }

  // Build query
  let query = supabase
    .from("inventory_transactions")
    .select(`
      id,
      product_id,
      transaction_type,
      qty_before,
      qty_change,
      qty_after,
      reference_type,
      reference_id,
      reason,
      created_at,
      product:products (id, sku, name)
    `)
    .in("product_id", productIds)
    .order("created_at", { ascending: false });

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.transactionType) {
    query = query.eq("transaction_type", filters.transactionType);
  }

  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  } else {
    query = query.limit(100);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as unknown as PortalInventoryTransaction[];
}

/**
 * Get transaction summary for portal dashboard
 */
export async function getPortalTransactionSummary(
  days: number = 30
): Promise<{
  received: number;
  shipped: number;
  returned: number;
  adjusted: number;
}> {
  const supabase = createClient();

  // Get user's client_id
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("client_id")
    .eq("id", user.id)
    .single();

  if (userError || !userData?.client_id) {
    throw new Error("Not associated with a client");
  }

  // Get products for this client
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("client_id", userData.client_id);

  const productIds = products?.map(p => p.id) || [];
  if (productIds.length === 0) {
    return { received: 0, shipped: 0, returned: 0, adjusted: 0 };
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("transaction_type, qty_change")
    .in("product_id", productIds)
    .gte("created_at", startDate.toISOString());

  if (error) {
    throw new Error(error.message);
  }

  const summary = {
    received: 0,
    shipped: 0,
    returned: 0,
    adjusted: 0,
  };

  for (const tx of data || []) {
    switch (tx.transaction_type) {
      case "receive":
        summary.received += tx.qty_change;
        break;
      case "ship":
        summary.shipped += Math.abs(tx.qty_change);
        break;
      case "return_restock":
        summary.returned += tx.qty_change;
        break;
      case "adjust":
      case "cycle_count":
        summary.adjusted += tx.qty_change;
        break;
    }
  }

  return summary;
}
