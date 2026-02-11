import { createClient } from "@/lib/supabase";

export interface PortalLot {
  id: string;
  lot_number: string;
  product_id: string;
  expiration_date: string | null;
  manufacture_date: string | null;
  status: string;
  created_at: string;
  product: {
    id: string;
    sku: string;
    name: string;
  };
  qty_on_hand: number;
}

export interface PortalLotFilters {
  productId?: string;
  status?: string;
  expiringWithinDays?: number;
}

/**
 * Get lots for the current portal user's client
 */
export async function getPortalLots(
  filters?: PortalLotFilters
): Promise<PortalLot[]> {
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
    return [];
  }

  // Build query
  let query = supabase
    .from("lots")
    .select(`
      id,
      lot_number,
      product_id,
      expiration_date,
      manufacture_date,
      status,
      created_at,
      product:products (id, sku, name)
    `)
    .in("product_id", productIds)
    .order("expiration_date", { ascending: true, nullsFirst: false });

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  if (filters?.expiringWithinDays) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + filters.expiringWithinDays);
    query = query.lte("expiration_date", futureDate.toISOString().split("T")[0]);
    query = query.gte("expiration_date", new Date().toISOString().split("T")[0]);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Get quantities for each lot
  const lotsWithQty: PortalLot[] = [];
  for (const lot of data || []) {
    const { data: lotInventory } = await supabase
      .from("lot_inventory")
      .select("inventory:inventory (qty_on_hand)")
      .eq("lot_id", lot.id);

    const qtyOnHand = (lotInventory || []).reduce((sum, li) => {
      const inv = li.inventory as { qty_on_hand: number } | null;
      return sum + (inv?.qty_on_hand || 0);
    }, 0);

    lotsWithQty.push({
      ...lot,
      product: lot.product as PortalLot["product"],
      qty_on_hand: qtyOnHand,
    });
  }

  return lotsWithQty;
}

/**
 * Get expiring lots summary for portal dashboard
 */
export async function getPortalExpiringLotsSummary(): Promise<{
  expiring7Days: number;
  expiring30Days: number;
  expiring90Days: number;
  expired: number;
}> {
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
    return { expiring7Days: 0, expiring30Days: 0, expiring90Days: 0, expired: 0 };
  }

  // Get products for this client
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .eq("client_id", userData.client_id);

  const productIds = products?.map(p => p.id) || [];
  if (productIds.length === 0) {
    return { expiring7Days: 0, expiring30Days: 0, expiring90Days: 0, expired: 0 };
  }

  const today = new Date().toISOString().split("T")[0];
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in30Days = new Date();
  in30Days.setDate(in30Days.getDate() + 30);
  const in90Days = new Date();
  in90Days.setDate(in90Days.getDate() + 90);

  const { data, error } = await supabase
    .from("lots")
    .select("expiration_date, status")
    .in("product_id", productIds)
    .eq("status", "active")
    .not("expiration_date", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const summary = {
    expiring7Days: 0,
    expiring30Days: 0,
    expiring90Days: 0,
    expired: 0,
  };

  for (const lot of data || []) {
    if (!lot.expiration_date) continue;
    const expDate = lot.expiration_date;

    if (expDate < today) {
      summary.expired++;
    } else if (expDate <= in7Days.toISOString().split("T")[0]) {
      summary.expiring7Days++;
    } else if (expDate <= in30Days.toISOString().split("T")[0]) {
      summary.expiring30Days++;
    } else if (expDate <= in90Days.toISOString().split("T")[0]) {
      summary.expiring90Days++;
    }
  }

  return summary;
}

/**
 * Get lot detail with full history
 */
export async function getPortalLotDetail(lotId: string): Promise<{
  lot: PortalLot;
  transactions: Array<{
    id: string;
    transaction_type: string;
    qty_change: number;
    created_at: string;
    reference_type: string | null;
  }>;
} | null> {
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

  // Get the lot
  const { data: lot, error: lotError } = await supabase
    .from("lots")
    .select(`
      *,
      product:products (id, sku, name, client_id)
    `)
    .eq("id", lotId)
    .single();

  if (lotError) {
    if (lotError.code === "PGRST116") return null;
    throw new Error(lotError.message);
  }

  // Verify the lot belongs to the client
  const product = lot.product as { client_id: string };
  if (product.client_id !== userData.client_id) {
    throw new Error("Access denied");
  }

  // Get lot inventory quantity
  const { data: lotInventory } = await supabase
    .from("lot_inventory")
    .select("inventory:inventory (qty_on_hand)")
    .eq("lot_id", lotId);

  const qtyOnHand = (lotInventory || []).reduce((sum, li) => {
    const inv = li.inventory as { qty_on_hand: number } | null;
    return sum + (inv?.qty_on_hand || 0);
  }, 0);

  // Get transactions for this lot
  const { data: transactions } = await supabase
    .from("inventory_transactions")
    .select("id, transaction_type, qty_change, created_at, reference_type")
    .eq("lot_id", lotId)
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    lot: {
      ...lot,
      product: { id: (lot.product as { id: string }).id, sku: (lot.product as { sku: string }).sku, name: (lot.product as { name: string }).name },
      qty_on_hand: qtyOnHand,
    },
    transactions: transactions || [],
  };
}
