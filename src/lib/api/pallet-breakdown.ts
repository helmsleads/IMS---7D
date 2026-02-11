import { createClient } from "@/lib/supabase";
import { updateInventoryWithTransaction } from "@/lib/api/inventory-transactions";
import { removeLPNContent, LPNWithContents } from "@/lib/api/lpns";

export interface PalletContentItem {
  id: string;
  lpn_id: string;
  product_id: string;
  lot_id: string | null;
  qty: number;
  uom: string;
  fill_status: "full" | "empty";
  created_at: string;
  updated_at: string;
  product: {
    id: string;
    sku: string;
    name: string;
    container_type: string;
    units_per_case: number | null;
  };
  lot?: {
    id: string;
    lot_number: string;
    expiration_date: string | null;
  } | null;
}

export interface PalletForBreakdown {
  id: string;
  lpn_number: string;
  container_type: string;
  status: string;
  stage: string;
  location_id: string | null;
  sublocation_id: string | null;
  is_mixed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  contents: PalletContentItem[];
  location?: {
    id: string;
    name: string;
  } | null;
  sublocation?: {
    id: string;
    code: string;
    name: string | null;
  } | null;
}

/**
 * Fetch an LPN by code with its contents, including product details
 * for case-aware quantity display.
 */
export async function getPalletForBreakdown(
  lpnCode: string
): Promise<PalletForBreakdown | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("lpns")
    .select(`
      *,
      contents:lpn_contents (
        *,
        product:products (id, sku, name, container_type, units_per_case),
        lot:lots (id, lot_number, expiration_date)
      ),
      location:locations (id, name),
      sublocation:sublocations (id, code, name)
    `)
    .eq("lpn_number", lpnCode)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Pull items from a pallet to a destination location.
 * Reduces pallet contents, increases destination inventory, logs transaction.
 */
export async function pullFromPallet(params: {
  palletId: string;
  productId: string;
  quantity: number;
  destinationLocationId: string;
  destinationSublocationId?: string;
  lotId?: string;
  notes?: string;
  performedBy?: string;
}): Promise<PalletForBreakdown> {
  const supabase = createClient();

  // 1. Validate pallet exists and get its info
  const { data: pallet, error: palletError } = await supabase
    .from("lpns")
    .select(`
      *,
      contents:lpn_contents (
        *,
        product:products (id, sku, name, container_type, units_per_case)
      ),
      location:locations (id, name)
    `)
    .eq("id", params.palletId)
    .single();

  if (palletError) {
    throw new Error("Pallet not found");
  }

  if (pallet.status === "empty") {
    throw new Error("Pallet is already empty");
  }

  // 2. Find the content row for this product
  const contentRow = pallet.contents?.find(
    (c: PalletContentItem) =>
      c.product_id === params.productId &&
      (params.lotId ? c.lot_id === params.lotId : true)
  );

  if (!contentRow) {
    throw new Error("Product not found on this pallet");
  }

  if (contentRow.qty < params.quantity) {
    throw new Error(
      `Insufficient quantity. Available: ${contentRow.qty}, requested: ${params.quantity}`
    );
  }

  // 3. Reduce lpn_contents quantity (or delete row if 0)
  await removeLPNContent(
    params.palletId,
    params.productId,
    params.quantity,
    params.lotId
  );

  // 4. Upsert inventory at destination location
  await updateInventoryWithTransaction({
    productId: params.productId,
    locationId: params.destinationLocationId,
    qtyChange: params.quantity,
    transactionType: "transfer",
    referenceType: "lpn",
    referenceId: params.palletId,
    lotId: params.lotId,
    sublocationId: params.destinationSublocationId,
    reason: "pallet_breakdown",
    notes:
      params.notes ||
      `Pulled ${params.quantity} from pallet ${pallet.lpn_number} to destination`,
    performedBy: params.performedBy,
  });

  // 5. Check if pallet is now empty and update status
  await checkAndMarkPalletEmpty(params.palletId);

  // 6. Return updated pallet
  const updated = await getPalletForBreakdown(pallet.lpn_number);
  if (!updated) {
    throw new Error("Failed to fetch updated pallet");
  }
  return updated;
}

/**
 * After a pull, check if all lpn_contents quantities are 0.
 * If so, update LPN status to 'empty'.
 */
export async function checkAndMarkPalletEmpty(
  lpnId: string
): Promise<boolean> {
  const supabase = createClient();

  // Check remaining contents
  const { data: remaining, error } = await supabase
    .from("lpn_contents")
    .select("id, qty")
    .eq("lpn_id", lpnId);

  if (error) {
    throw new Error(error.message);
  }

  const totalQty = (remaining || []).reduce((sum, r) => sum + r.qty, 0);

  if (totalQty === 0) {
    // Mark pallet as empty
    await supabase
      .from("lpns")
      .update({
        status: "empty",
        updated_at: new Date().toISOString(),
      })
      .eq("id", lpnId);

    return true;
  }

  return false;
}

/**
 * Fetch inventory transactions related to this pallet for audit trail.
 */
export async function getPalletBreakdownHistory(
  lpnId: string
): Promise<
  Array<{
    id: string;
    product_id: string;
    location_id: string;
    transaction_type: string;
    qty_change: number;
    reason: string | null;
    notes: string | null;
    created_at: string;
    product: { id: string; sku: string; name: string };
    location: { id: string; name: string };
  }>
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory_transactions")
    .select(`
      id,
      product_id,
      location_id,
      transaction_type,
      qty_change,
      reason,
      notes,
      created_at,
      product:products (id, sku, name),
      location:locations (id, name)
    `)
    .eq("reference_type", "lpn")
    .eq("reference_id", lpnId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  // Supabase returns relations as objects when using .single() style joins
  // but may return arrays in some cases - normalize to single objects
  return (data || []).map((row: Record<string, unknown>) => ({
    ...row,
    product: Array.isArray(row.product) ? row.product[0] : row.product,
    location: Array.isArray(row.location) ? row.location[0] : row.location,
  })) as Array<{
    id: string;
    product_id: string;
    location_id: string;
    transaction_type: string;
    qty_change: number;
    reason: string | null;
    notes: string | null;
    created_at: string;
    product: { id: string; sku: string; name: string };
    location: { id: string; name: string };
  }>;
}

/**
 * Format quantity with case-aware display.
 * e.g., "72 Bottles (12 cases)" or "5 Kegs"
 */
export function formatCaseAwareQty(
  qty: number,
  containerType: string,
  unitsPerCase: number | null
): string {
  const upc = unitsPerCase || 1;

  // Label based on container type
  const unitLabel = getUnitLabel(containerType, qty);

  if (upc <= 1) {
    return `${qty} ${unitLabel}`;
  }

  const cases = Math.floor(qty / upc);
  const remainder = qty % upc;

  if (cases === 0) {
    return `${qty} ${unitLabel}`;
  }

  if (remainder === 0) {
    return `${qty} ${unitLabel} (${cases} case${cases !== 1 ? "s" : ""})`;
  }

  return `${qty} ${unitLabel} (${cases} case${cases !== 1 ? "s" : ""} + ${remainder})`;
}

/**
 * Get the display unit label for a container type.
 */
export function getUnitLabel(containerType: string, qty: number): string {
  const plural = qty !== 1;
  switch (containerType) {
    case "bottle":
      return plural ? "Bottles" : "Bottle";
    case "can":
      return plural ? "Cans" : "Can";
    case "keg":
      return plural ? "Kegs" : "Keg";
    case "bag_in_box":
      return plural ? "Bags" : "Bag";
    default:
      return plural ? "Units" : "Unit";
  }
}

/**
 * Get the container type badge color.
 */
export function getContainerTypeBadgeColor(
  containerType: string
): "default" | "success" | "warning" | "info" | "error" {
  switch (containerType) {
    case "bottle":
      return "info";
    case "can":
      return "success";
    case "keg":
      return "warning";
    case "bag_in_box":
      return "error";
    default:
      return "default";
  }
}
