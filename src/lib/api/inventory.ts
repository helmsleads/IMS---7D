import { createClient } from "@/lib/supabase";
import { sendInternalAlert } from "@/lib/api/notifications";

export interface InventoryWithLocation {
  id: string;
  product_id: string;
  location_id: string;
  qty_on_hand: number;
  qty_reserved: number;
  updated_at: string;
  location: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  };
}

export interface InventoryWithDetails {
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
    reorder_point: number;
  };
  location: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  };
}

export async function getInventory(): Promise<InventoryWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getInventoryByLocation(
  locationId: string
): Promise<InventoryWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .eq("location_id", locationId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getInventoryByProduct(
  productId: string
): Promise<InventoryWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .eq("product_id", productId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getLowStockItems(): Promise<InventoryWithDetails[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `);

  if (error) {
    throw new Error(error.message);
  }

  // Filter items where qty_on_hand <= reorder_point
  const lowStockItems = (data || []).filter(
    (item) => item.qty_on_hand <= item.product.reorder_point
  );

  return lowStockItems;
}

export async function getProductInventory(
  productId: string
): Promise<InventoryWithLocation[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      *,
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .eq("product_id", productId);

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export interface StockAdjustmentParams {
  productId: string;
  locationId: string;
  qtyChange: number;
  reason: string;
  notes?: string;
}

export async function adjustStock({
  productId,
  locationId,
  qtyChange,
  reason,
  notes,
}: StockAdjustmentParams): Promise<InventoryWithDetails> {
  const supabase = createClient();

  // Call the update_inventory function
  const { error: updateError } = await supabase.rpc("update_inventory", {
    p_product_id: productId,
    p_location_id: locationId,
    p_qty_change: qtyChange,
  });

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Get the updated inventory record
  const { data: inventoryData, error: inventoryError } = await supabase
    .from("inventory")
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .single();

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  // Log to activity_log
  const { error: logError } = await supabase.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: inventoryData.id,
    action: "stock_adjustment",
    details: {
      product_id: productId,
      location_id: locationId,
      qty_change: qtyChange,
      new_qty: inventoryData.qty_on_hand,
      reason,
      notes: notes || null,
    },
  });

  if (logError) {
    console.error("Failed to log activity:", logError.message);
  }

  // Check for low stock if quantity decreased
  if (qtyChange < 0) {
    checkProductLowStock(productId, locationId).catch((err) =>
      console.error("Failed to check low stock:", err)
    );
  }

  return inventoryData;
}

/**
 * Checks for low stock items and sends an alert if any are found
 * Can be called on a schedule or after inventory updates
 */
export async function checkAndAlertLowStock(): Promise<{
  lowStockCount: number;
  alertSent: boolean;
}> {
  try {
    const lowStockItems = await getLowStockItems();

    if (lowStockItems.length === 0) {
      return { lowStockCount: 0, alertSent: false };
    }

    const alertItems = lowStockItems.map((item) => ({
      sku: item.product.sku,
      productName: item.product.name,
      currentQty: item.qty_on_hand,
      reorderPoint: item.product.reorder_point,
      locationName: item.location.name,
    }));

    const result = await sendInternalAlert("low_stock", { items: alertItems });

    return {
      lowStockCount: lowStockItems.length,
      alertSent: result.sent > 0,
    };
  } catch (error) {
    console.error("Error checking low stock:", error);
    return { lowStockCount: 0, alertSent: false };
  }
}

/**
 * Checks if a specific product is now low stock after an inventory change
 * and triggers an alert if needed
 */
export async function checkProductLowStock(
  productId: string,
  locationId: string
): Promise<void> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      qty_on_hand,
      product:products (
        sku,
        name,
        reorder_point
      ),
      location:locations (
        name
      )
    `)
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .single();

  if (error || !data) return;

  const product = Array.isArray(data.product) ? data.product[0] : data.product;
  const location = Array.isArray(data.location) ? data.location[0] : data.location;

  if (product && data.qty_on_hand <= product.reorder_point) {
    sendInternalAlert("low_stock", {
      items: [
        {
          sku: product.sku,
          productName: product.name,
          currentQty: data.qty_on_hand,
          reorderPoint: product.reorder_point,
          locationName: location?.name,
        },
      ],
    }).catch((err) => console.error("Failed to send low stock alert:", err));
  }
}
