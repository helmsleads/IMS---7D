import { createClient } from "@/lib/supabase";

/**
 * Determine the correct billing rate code based on product container type.
 * Rate card: Cases/Bottles use standard unit rates, Barrels use barrel rates.
 */

// Cache product container types to avoid repeated lookups
const containerTypeCache = new Map<string, string>();

export async function getProductContainerType(productId: string): Promise<string> {
  if (containerTypeCache.has(productId)) {
    return containerTypeCache.get(productId)!;
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("container_type")
    .eq("id", productId)
    .single();

  const type = data?.container_type || "bottle";
  containerTypeCache.set(productId, type);
  return type;
}

function isBarrel(containerType: string): boolean {
  return containerType === "keg"; // kegs/barrels use barrel rates
}

/**
 * Prefer line-item pack size, then product master (e.g. HAPA 12 units/case).
 */
export function resolveUnitsPerCase(
  itemUnitsPerCase?: number | null,
  productUnitsPerCase?: number | null
): number | null {
  const fromItem = Number(itemUnitsPerCase);
  if (Number.isFinite(fromItem) && fromItem > 0) return fromItem;
  const fromProduct = Number(productUnitsPerCase);
  if (Number.isFinite(fromProduct) && fromProduct > 0) return fromProduct;
  return null;
}

/**
 * Convert inventory eaches to rate-card handling units (cases/bottles).
 * When units_per_case > 1, stock is stored in eaches and billed per whole case
 * (partial cases round up — e.g. 6 of 12 → 1 case, never 0.5).
 */
export function toBillableHandlingUnits(
  inventoryQty: number,
  unitsPerCase?: number | null
): number {
  const upc = Math.max(Number(unitsPerCase) || 1, 1);
  if (upc === 1) return inventoryQty;
  if (inventoryQty <= 0) return 0;
  return Math.ceil(inventoryQty / upc);
}

/**
 * Inbound receive qty may already be in cases (uom=cases) or in eaches.
 * Prefer the case count when receiving by case; otherwise convert eaches.
 * Case counts are always whole handling units.
 */
export function toBillableReceiveUnits(opts: {
  qtyInUom: number;
  inventoryQty: number;
  uom?: string | null;
  unitsPerCase?: number | null;
  productUnitsPerCase?: number | null;
}): number {
  const unitsPerCase = resolveUnitsPerCase(
    opts.unitsPerCase,
    opts.productUnitsPerCase
  );
  if (opts.uom === "cases" && unitsPerCase && unitsPerCase > 1) {
    if (opts.qtyInUom <= 0) return 0;
    return Math.ceil(opts.qtyInUom);
  }
  return toBillableHandlingUnits(opts.inventoryQty, unitsPerCase);
}

export async function getInboundRateCode(productId: string): Promise<string> {
  const type = await getProductContainerType(productId);
  return isBarrel(type) ? "RECEIVE_BARREL" : "RECEIVE_UNIT";
}

export async function getOutboundRateCode(productId: string): Promise<string> {
  const type = await getProductContainerType(productId);
  return isBarrel(type) ? "PICK_BARREL" : "PICK_UNIT";
}
