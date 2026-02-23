import { createClient } from "@/lib/supabase";

export interface InventoryTransaction {
  id: string;
  inventory_id: string | null;
  product_id: string;
  location_id: string;
  sublocation_id: string | null;
  transaction_type: TransactionType;
  qty_before: number;
  qty_change: number;
  qty_after: number;
  reserved_before: number;
  reserved_change: number;
  reserved_after: number;
  reference_type: ReferenceType | null;
  reference_id: string | null;
  lot_id: string | null;
  reason: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export type TransactionType =
  | "receive"
  | "putaway"
  | "pick"
  | "pack"
  | "ship"
  | "adjust"
  | "transfer"
  | "return_restock"
  | "damage_writeoff"
  | "cycle_count"
  | "reserve"
  | "release"
  | "expire"
  | "quarantine";

export type ReferenceType =
  | "inbound_order"
  | "outbound_order"
  | "return"
  | "damage_report"
  | "cycle_count"
  | "stock_transfer"
  | "manual"
  | "lpn"
  | "warehouse_task";

export interface TransactionFilters {
  productId?: string;
  locationId?: string;
  transactionType?: TransactionType;
  referenceType?: ReferenceType;
  referenceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface TransactionWithDetails extends InventoryTransaction {
  product: {
    id: string;
    sku: string;
    name: string;
  };
  location: {
    id: string;
    name: string;
  };
  lot?: {
    id: string;
    lot_number: string;
  } | null;
}

/**
 * Get inventory transactions with optional filtering
 */
export async function getInventoryTransactions(
  filters?: TransactionFilters
): Promise<TransactionWithDetails[]> {
  const supabase = createClient();

  let query = supabase
    .from("inventory_transactions")
    .select(`
      *,
      product:products (id, sku, name),
      location:locations (id, name),
      lot:lots (id, lot_number)
    `)
    .order("created_at", { ascending: false });

  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }

  if (filters?.locationId) {
    query = query.eq("location_id", filters.locationId);
  }

  if (filters?.transactionType) {
    query = query.eq("transaction_type", filters.transactionType);
  }

  if (filters?.referenceType) {
    query = query.eq("reference_type", filters.referenceType);
  }

  if (filters?.referenceId) {
    query = query.eq("reference_id", filters.referenceId);
  }

  if (filters?.startDate) {
    query = query.gte("created_at", filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte("created_at", filters.endDate);
  }

  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  if (filters?.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get transaction history for a specific product using RPC
 */
export async function getProductHistory(
  productId: string,
  locationId?: string,
  limit: number = 50
): Promise<InventoryTransaction[]> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("get_inventory_history", {
    p_product_id: productId,
    p_location_id: locationId || null,
    p_limit: limit,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get transactions by reference (e.g., all transactions for an order)
 */
export async function getTransactionsByReference(
  referenceType: ReferenceType,
  referenceId: string
): Promise<TransactionWithDetails[]> {
  return getInventoryTransactions({
    referenceType,
    referenceId,
  });
}

/**
 * Get recent transactions for dashboard
 */
export async function getRecentTransactions(
  limit: number = 20
): Promise<TransactionWithDetails[]> {
  return getInventoryTransactions({ limit });
}

/**
 * Get transaction summary stats
 */
export async function getTransactionStats(
  startDate: string,
  endDate: string
): Promise<{
  totalReceived: number;
  totalShipped: number;
  totalAdjusted: number;
  totalReturns: number;
}> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("transaction_type, qty_change")
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  if (error) {
    throw new Error(error.message);
  }

  const stats = {
    totalReceived: 0,
    totalShipped: 0,
    totalAdjusted: 0,
    totalReturns: 0,
  };

  for (const tx of data || []) {
    switch (tx.transaction_type) {
      case "receive":
        stats.totalReceived += tx.qty_change;
        break;
      case "ship":
        stats.totalShipped += Math.abs(tx.qty_change);
        break;
      case "adjust":
      case "cycle_count":
        stats.totalAdjusted += tx.qty_change;
        break;
      case "return_restock":
        stats.totalReturns += tx.qty_change;
        break;
    }
  }

  return stats;
}

/**
 * Update inventory with transaction logging (wrapper for RPC)
 */
export async function updateInventoryWithTransaction(params: {
  productId: string;
  locationId: string;
  qtyChange: number;
  transactionType: TransactionType;
  referenceType?: ReferenceType;
  referenceId?: string;
  lotId?: string;
  sublocationId?: string;
  reason?: string;
  notes?: string;
  performedBy?: string;
  fillStatus?: "full" | "empty";
}): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("update_inventory_with_transaction", {
    p_product_id: params.productId,
    p_location_id: params.locationId,
    p_qty_change: params.qtyChange,
    p_transaction_type: params.transactionType,
    p_reference_type: params.referenceType || null,
    p_reference_id: params.referenceId || null,
    p_lot_id: params.lotId || null,
    p_sublocation_id: params.sublocationId || null,
    p_reason: params.reason || null,
    p_notes: params.notes || null,
    p_performed_by: params.performedBy || null,
    p_fill_status: params.fillStatus || "full",
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
