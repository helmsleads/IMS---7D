import { createClient } from "@/lib/supabase";

export interface BarcodeProduct {
  id: string;
  sku: string;
  name: string;
  barcode: string | null;
  unit_cost: number;
  unit_price: number;
  reorder_point: number;
  active: boolean;
}

/**
 * Looks up a product by barcode or SKU
 * First searches by SKU (exact match), then by barcode field
 * @param code - The scanned barcode or SKU value
 * @returns Product if found, null if not found
 */
export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  if (!code || !code.trim()) {
    return null;
  }

  const supabase = createClient();
  const trimmedCode = code.trim();

  // First, try to find by SKU (exact match)
  const { data: skuMatch, error: skuError } = await supabase
    .from("products")
    .select(`
      id,
      sku,
      name,
      barcode,
      unit_cost,
      unit_price,
      reorder_point,
      active
    `)
    .eq("sku", trimmedCode)
    .maybeSingle();

  if (skuError) {
    console.error("Error searching by SKU:", skuError);
  }

  if (skuMatch) {
    return skuMatch as BarcodeProduct;
  }

  // If not found by SKU, try to find by barcode field
  const { data: barcodeMatch, error: barcodeError } = await supabase
    .from("products")
    .select(`
      id,
      sku,
      name,
      barcode,
      unit_cost,
      unit_price,
      reorder_point,
      active
    `)
    .eq("barcode", trimmedCode)
    .maybeSingle();

  if (barcodeError) {
    console.error("Error searching by barcode:", barcodeError);
  }

  if (barcodeMatch) {
    return barcodeMatch as BarcodeProduct;
  }

  // Not found
  return null;
}

/**
 * Looks up a product and includes inventory information
 * @param code - The scanned barcode or SKU value
 * @returns Product with inventory if found, null if not found
 */
export async function lookupBarcodeWithInventory(code: string): Promise<{
  product: BarcodeProduct;
  inventory: {
    location_id: string;
    location_name: string;
    qty_on_hand: number;
    qty_reserved: number;
  }[];
} | null> {
  const product = await lookupBarcode(code);

  if (!product) {
    return null;
  }

  const supabase = createClient();

  const { data: inventoryData, error } = await supabase
    .from("inventory")
    .select(`
      location_id,
      qty_on_hand,
      qty_reserved,
      location:locations (
        name
      )
    `)
    .eq("product_id", product.id);

  if (error) {
    console.error("Error fetching inventory:", error);
    return { product, inventory: [] };
  }

  const inventory = (inventoryData || []).map((item) => {
    const location = Array.isArray(item.location) ? item.location[0] : item.location;
    return {
      location_id: item.location_id,
      location_name: (location as { name: string } | null)?.name || "",
      qty_on_hand: item.qty_on_hand || 0,
      qty_reserved: item.qty_reserved || 0,
    };
  });

  return { product, inventory };
}

/**
 * Batch lookup multiple barcodes/SKUs
 * @param codes - Array of barcode or SKU values
 * @returns Map of code to product (null if not found)
 */
export async function lookupBarcodes(codes: string[]): Promise<Map<string, BarcodeProduct | null>> {
  const results = new Map<string, BarcodeProduct | null>();

  if (!codes || codes.length === 0) {
    return results;
  }

  const supabase = createClient();
  const trimmedCodes = codes.map((c) => c.trim()).filter(Boolean);

  // Search by SKU
  const { data: skuMatches } = await supabase
    .from("products")
    .select(`
      id,
      sku,
      name,
      barcode,
      unit_cost,
      unit_price,
      reorder_point,
      active
    `)
    .in("sku", trimmedCodes);

  // Search by barcode
  const { data: barcodeMatches } = await supabase
    .from("products")
    .select(`
      id,
      sku,
      name,
      barcode,
      unit_cost,
      unit_price,
      reorder_point,
      active
    `)
    .in("barcode", trimmedCodes);

  // Build results map
  for (const code of trimmedCodes) {
    const skuMatch = skuMatches?.find((p) => p.sku === code);
    const barcodeMatch = barcodeMatches?.find((p) => p.barcode === code);
    results.set(code, (skuMatch || barcodeMatch) as BarcodeProduct | null);
  }

  return results;
}
