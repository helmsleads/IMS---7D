import { createClient } from "@/lib/supabase";

export interface ExpiringLot {
  lot_id: string;
  lot_number: string;
  product_id: string;
  product_sku: string;
  product_name: string;
  client_id: string;
  client_name: string;
  expiration_date: string;
  days_until_expiration: number;
  qty_on_hand: number;
}

export interface ExpirationProcessingResult {
  lots_expired: number;
  inventory_quarantined: number;
  transactions_created: number;
}

/**
 * Get lots expiring within the specified number of days
 */
export async function getExpiringLots(days: number = 7): Promise<ExpiringLot[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_expiring_lots", {
    p_days: days,
  });

  if (error) {
    throw new Error(`Failed to get expiring lots: ${error.message}`);
  }

  return data || [];
}

/**
 * Process all expired lots - updates status and quarantines inventory
 * Should be called by scheduled job or admin action
 */
export async function processExpiredLots(): Promise<ExpirationProcessingResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("process_expired_lots");

  if (error) {
    throw new Error(`Failed to process expired lots: ${error.message}`);
  }

  return data?.[0] || {
    lots_expired: 0,
    inventory_quarantined: 0,
    transactions_created: 0,
  };
}

/**
 * Create notifications for lots expiring within the specified days
 * Returns the number of notifications created
 */
export async function createExpirationNotifications(days: number = 7): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("create_lot_expiration_notifications", {
    p_days: days,
  });

  if (error) {
    throw new Error(`Failed to create expiration notifications: ${error.message}`);
  }

  return data || 0;
}

/**
 * Get summary of lot expiration status
 */
export async function getLotExpirationSummary(): Promise<{
  expiring7Days: number;
  expiring30Days: number;
  expiring90Days: number;
  expired: number;
}> {
  const supabase = createClient();

  // Get counts for different expiration windows
  const [exp7, exp30, exp90, expired] = await Promise.all([
    supabase
      .from("lots")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("expiration_date", new Date().toISOString().split("T")[0])
      .lte("expiration_date", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
    supabase
      .from("lots")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("expiration_date", new Date().toISOString().split("T")[0])
      .lte("expiration_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
    supabase
      .from("lots")
      .select("id", { count: "exact", head: true })
      .eq("status", "active")
      .gte("expiration_date", new Date().toISOString().split("T")[0])
      .lte("expiration_date", new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]),
    supabase
      .from("lots")
      .select("id", { count: "exact", head: true })
      .eq("status", "expired"),
  ]);

  return {
    expiring7Days: exp7.count || 0,
    expiring30Days: exp30.count || 0,
    expiring90Days: exp90.count || 0,
    expired: expired.count || 0,
  };
}

/**
 * Manually expire a specific lot and quarantine its inventory
 */
export async function manuallyExpireLot(lotId: string, reason?: string): Promise<{
  success: boolean;
  inventoryQuarantined: number;
}> {
  const supabase = createClient();

  // Get lot details
  const { data: lot, error: lotError } = await supabase
    .from("lots")
    .select("id, lot_number, product_id, status")
    .eq("id", lotId)
    .single();

  if (lotError || !lot) {
    throw new Error("Lot not found");
  }

  if (lot.status === "expired") {
    throw new Error("Lot is already expired");
  }

  // Update lot status
  const { error: updateError } = await supabase
    .from("lots")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", lotId);

  if (updateError) {
    throw new Error(`Failed to update lot status: ${updateError.message}`);
  }

  // Get inventory to quarantine
  const { data: inventory, error: invError } = await supabase
    .from("inventory")
    .select("id, product_id, location_id, qty_on_hand, stage")
    .eq("lot_id", lotId)
    .neq("stage", "quarantine")
    .gt("qty_on_hand", 0);

  if (invError) {
    throw new Error(`Failed to get inventory: ${invError.message}`);
  }

  let inventoryQuarantined = 0;

  // Quarantine each inventory record
  for (const inv of inventory || []) {
    // Update inventory stage
    await supabase
      .from("inventory")
      .update({ stage: "quarantine", updated_at: new Date().toISOString() })
      .eq("id", inv.id);

    // Log transaction
    await supabase.from("inventory_transactions").insert({
      inventory_id: inv.id,
      product_id: inv.product_id,
      location_id: inv.location_id,
      transaction_type: "quarantine",
      qty_before: inv.qty_on_hand,
      qty_change: 0,
      qty_after: inv.qty_on_hand,
      lot_id: lotId,
      reason: reason || `Lot ${lot.lot_number} manually expired - inventory quarantined`,
    });

    inventoryQuarantined++;
  }

  return {
    success: true,
    inventoryQuarantined,
  };
}
