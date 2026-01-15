import { createClient } from "@/lib/supabase";

export interface ClientInventoryItem {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  qtyOnHand: number;
  locationName: string;
  reorderPoint: number;
  isLowStock: boolean;
}

/**
 * Fetches inventory records for a specific client with product details
 * @param clientId - The client's UUID
 * @returns Array of inventory items with product and location details
 */
export async function getClientInventory(
  clientId: string
): Promise<ClientInventoryItem[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      id,
      qty_on_hand,
      product:products!inner (
        id,
        name,
        sku,
        reorder_point,
        client_id
      ),
      location:locations (
        name
      )
    `)
    .eq("product.client_id", clientId)
    .order("qty_on_hand", { ascending: false });

  if (error) {
    console.error("Error fetching client inventory:", error);
    return [];
  }

  return (data || []).map((item) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const location = Array.isArray(item.location) ? item.location[0] : item.location;

    const qtyOnHand = item.qty_on_hand || 0;
    const reorderPoint = product?.reorder_point || 0;

    return {
      id: item.id,
      productId: product?.id || "",
      productName: product?.name || "Unknown",
      sku: product?.sku || "",
      qtyOnHand,
      locationName: location?.name || "Unassigned",
      reorderPoint,
      isLowStock: qtyOnHand <= reorderPoint,
    };
  });
}

/**
 * Fetches inventory summary stats for a client
 * @param clientId - The client's UUID
 * @returns Summary stats including total SKUs, units, and low stock count
 */
export async function getClientInventorySummary(clientId: string) {
  const inventory = await getClientInventory(clientId);

  const totalSKUs = inventory.length;
  const totalUnits = inventory.reduce((sum, item) => sum + item.qtyOnHand, 0);
  const lowStockCount = inventory.filter((item) => item.isLowStock).length;

  return {
    totalSKUs,
    totalUnits,
    lowStockCount,
  };
}

/**
 * Searches client inventory by product name or SKU
 * @param clientId - The client's UUID
 * @param query - Search query string
 * @returns Filtered inventory items matching the query
 */
export async function searchClientInventory(
  clientId: string,
  query: string
): Promise<ClientInventoryItem[]> {
  const inventory = await getClientInventory(clientId);
  const lowerQuery = query.toLowerCase();

  return inventory.filter(
    (item) =>
      item.productName.toLowerCase().includes(lowerQuery) ||
      item.sku.toLowerCase().includes(lowerQuery)
  );
}
