import { createClient } from "@/lib/supabase";
import { sendInternalAlert } from "@/lib/api/notifications";
import { InventoryStatus } from "@/types/database";

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
  sublocation_id: string | null;
  qty_on_hand: number;
  qty_reserved: number;
  updated_at: string;
  status: InventoryStatus;
  product: {
    id: string;
    sku: string;
    name: string;
    category: string | null;
    unit_cost: number;
    reorder_point: number;
    container_type: string | null;
    units_per_case: number | null;
    client_id: string | null;
  };
  location: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
  };
  sublocation: {
    id: string;
    code: string;
    name: string | null;
    zone: string | null;
  } | null;
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
        reorder_point,
        container_type,
        units_per_case,
        client_id
      ),
      location:locations (
        id,
        name,
        city,
        state
      ),
      sublocation:sublocations (
        id,
        code,
        name,
        zone
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
        reorder_point,
        container_type,
        units_per_case,
        client_id
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
        reorder_point,
        container_type,
        units_per_case,
        client_id
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
        reorder_point,
        container_type,
        units_per_case,
        client_id
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
        reorder_point,
        container_type,
        units_per_case,
        client_id
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

  // Trigger debounced Shopify inventory sync
  import("./shopify/event-sync")
    .then((mod) => mod.triggerInventorySync([productId]))
    .catch((err) => console.error("Failed to trigger Shopify sync:", err));

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

export async function updateInventoryStatus(
  id: string,
  status: InventoryStatus,
  notes: string | null,
  userId?: string | null
): Promise<InventoryWithDetails> {
  const supabase = createClient();

  // Get old status for logging
  const { data: oldData } = await supabase
    .from("inventory")
    .select("status")
    .eq("id", id)
    .single();

  const oldStatus = oldData?.status || "available";

  const { data, error } = await supabase
    .from("inventory")
    .update({
      status,
      status_notes: notes,
      status_changed_at: new Date().toISOString(),
      status_changed_by: userId || null,
    })
    .eq("id", id)
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point,
        container_type,
        units_per_case,
        client_id
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Log status change to activity_log
  await supabase.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: id,
    action: "status_change",
    performed_by: userId || null,
    details: {
      old_status: oldStatus,
      new_status: status,
      notes: notes || null,
      product_id: data.product_id,
      location_id: data.location_id,
    },
  });

  return data;
}

export async function getInventoryByStatus(
  status: InventoryStatus
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
        reorder_point,
        container_type,
        units_per_case,
        client_id
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .eq("status", status)
    .order("status_changed_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getDamagedInventory(): Promise<InventoryWithDetails[]> {
  return getInventoryByStatus("damaged");
}

export async function getQuarantinedInventory(): Promise<InventoryWithDetails[]> {
  return getInventoryByStatus("quarantine");
}

export async function getInventoryBySublocation(
  sublocationId: string
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
        reorder_point,
        container_type,
        units_per_case,
        client_id
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .eq("sublocation_id", sublocationId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function moveToSublocation(
  inventoryId: string,
  sublocationId: string | null
): Promise<InventoryWithDetails> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .update({ sublocation_id: sublocationId })
    .eq("id", inventoryId)
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point,
        container_type,
        units_per_case,
        client_id
      ),
      location:locations (
        id,
        name,
        city,
        state
      )
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export interface MoveInventoryParams {
  sourceInventoryId: string;
  targetSublocationId: string | null;
  quantity: number;
  notes?: string;
}

/**
 * Moves a quantity of inventory from one sublocation to another within the same location.
 * If moving all units, simply updates the sublocation_id.
 * If moving partial units, reduces source and creates/updates target inventory record.
 */
export interface InventoryStatusHistory {
  id: string;
  action: string;
  details: {
    old_status?: InventoryStatus;
    new_status?: InventoryStatus;
    notes?: string;
    [key: string]: unknown;
  };
  created_at: string;
  user?: {
    id: string;
    name: string;
  } | null;
}

export async function getInventoryById(id: string): Promise<InventoryWithDetails | null> {
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
        reorder_point,
        barcode,
        image_url
      ),
      location:locations (
        id,
        name,
        city,
        state,
        location_type
      ),
      sublocation:sublocations (
        id,
        code,
        name,
        zone
      )
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

export async function getInventoryStatusHistory(
  inventoryId: string
): Promise<InventoryStatusHistory[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("activity_log")
    .select(`
      id,
      action,
      details,
      created_at,
      performed_by
    `)
    .eq("entity_type", "inventory")
    .eq("entity_id", inventoryId)
    .in("action", ["status_change", "stock_adjustment", "sublocation_move"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  // Fetch user names for entries that have performed_by
  const userIds = [...new Set((data || []).map(d => d.performed_by).filter(Boolean))];

  let userMap = new Map<string, { id: string; name: string }>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);

    if (users) {
      users.forEach(u => userMap.set(u.id, u));
    }
  }

  return (data || []).map(entry => ({
    id: entry.id,
    action: entry.action,
    details: entry.details || {},
    created_at: entry.created_at,
    user: entry.performed_by ? userMap.get(entry.performed_by) || null : null,
  }));
}

export async function moveInventoryToSublocation({
  sourceInventoryId,
  targetSublocationId,
  quantity,
  notes,
}: MoveInventoryParams): Promise<{ success: boolean; message: string }> {
  const supabase = createClient();

  // Get source inventory details
  const { data: sourceInventory, error: sourceError } = await supabase
    .from("inventory")
    .select("*")
    .eq("id", sourceInventoryId)
    .single();

  if (sourceError || !sourceInventory) {
    throw new Error("Source inventory not found");
  }

  if (quantity <= 0) {
    throw new Error("Quantity must be greater than 0");
  }

  if (quantity > sourceInventory.qty_on_hand) {
    throw new Error(`Cannot move ${quantity} units. Only ${sourceInventory.qty_on_hand} available.`);
  }

  // If same sublocation, no move needed
  if (sourceInventory.sublocation_id === targetSublocationId) {
    throw new Error("Source and target sublocation are the same");
  }

  // If moving all units, just update the sublocation
  if (quantity === sourceInventory.qty_on_hand) {
    const { error: updateError } = await supabase
      .from("inventory")
      .update({ sublocation_id: targetSublocationId })
      .eq("id", sourceInventoryId);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Log the move
    await supabase.from("activity_log").insert({
      entity_type: "inventory",
      entity_id: sourceInventoryId,
      action: "sublocation_move",
      details: {
        product_id: sourceInventory.product_id,
        location_id: sourceInventory.location_id,
        from_sublocation_id: sourceInventory.sublocation_id,
        to_sublocation_id: targetSublocationId,
        quantity,
        notes: notes || null,
      },
    });

    return { success: true, message: `Moved ${quantity} units to new sublocation` };
  }

  // Partial move - need to split the inventory
  // 1. Reduce source inventory
  const { error: reduceError } = await supabase
    .from("inventory")
    .update({ qty_on_hand: sourceInventory.qty_on_hand - quantity })
    .eq("id", sourceInventoryId);

  if (reduceError) {
    throw new Error(reduceError.message);
  }

  // 2. Check if target inventory record exists (same product, location, sublocation)
  const { data: existingTarget } = await supabase
    .from("inventory")
    .select("*")
    .eq("product_id", sourceInventory.product_id)
    .eq("location_id", sourceInventory.location_id)
    .eq("sublocation_id", targetSublocationId)
    .maybeSingle();

  if (existingTarget) {
    // Update existing target inventory
    const { error: targetUpdateError } = await supabase
      .from("inventory")
      .update({ qty_on_hand: existingTarget.qty_on_hand + quantity })
      .eq("id", existingTarget.id);

    if (targetUpdateError) {
      // Rollback source
      await supabase
        .from("inventory")
        .update({ qty_on_hand: sourceInventory.qty_on_hand })
        .eq("id", sourceInventoryId);
      throw new Error(targetUpdateError.message);
    }
  } else {
    // Create new inventory record at target sublocation
    const { error: createError } = await supabase.from("inventory").insert({
      product_id: sourceInventory.product_id,
      location_id: sourceInventory.location_id,
      sublocation_id: targetSublocationId,
      qty_on_hand: quantity,
      qty_reserved: 0,
      status: sourceInventory.status || "available",
    });

    if (createError) {
      // Rollback source
      await supabase
        .from("inventory")
        .update({ qty_on_hand: sourceInventory.qty_on_hand })
        .eq("id", sourceInventoryId);
      throw new Error(createError.message);
    }
  }

  // Log the move
  await supabase.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: sourceInventoryId,
    action: "sublocation_move",
    details: {
      product_id: sourceInventory.product_id,
      location_id: sourceInventory.location_id,
      from_sublocation_id: sourceInventory.sublocation_id,
      to_sublocation_id: targetSublocationId,
      quantity,
      notes: notes || null,
    },
  });

  return { success: true, message: `Moved ${quantity} units to new sublocation` };
}

export interface SuggestedPutAway {
  suggestedLocationId: string | null;
  suggestedLocationName: string | null;
  suggestedSublocationId: string | null;
  suggestedSublocationCode: string | null;
  reason: string;
}

/**
 * Gets suggested location and sublocation for put-away based on:
 * 1. Where the product already exists in inventory
 * 2. Available sublocation capacity
 */
export async function getSuggestedPutAway(
  productId: string,
  locationId: string,
  quantity: number
): Promise<SuggestedPutAway> {
  const supabase = createClient();

  // First, check if product already exists in a sublocation at this location
  const { data: existingInventory } = await supabase
    .from("inventory")
    .select(`
      sublocation_id,
      qty_on_hand,
      sublocation:sublocations (
        id,
        code,
        name,
        capacity,
        is_active
      )
    `)
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .not("sublocation_id", "is", null)
    .order("qty_on_hand", { ascending: false });

  // If product exists in a sublocation, suggest that sublocation
  if (existingInventory && existingInventory.length > 0) {
    const bestMatch = existingInventory[0];
    const sublocation = Array.isArray(bestMatch.sublocation)
      ? bestMatch.sublocation[0]
      : bestMatch.sublocation;

    if (sublocation && sublocation.is_active) {
      return {
        suggestedLocationId: locationId,
        suggestedLocationName: null,
        suggestedSublocationId: sublocation.id,
        suggestedSublocationCode: sublocation.code,
        reason: "Same product already stored here",
      };
    }
  }

  // Otherwise, find a sublocation with available capacity
  const { data: sublocations } = await supabase
    .from("sublocations")
    .select(`
      id,
      code,
      name,
      capacity,
      is_pickable
    `)
    .eq("location_id", locationId)
    .eq("is_active", true)
    .not("capacity", "is", null)
    .order("zone")
    .order("aisle")
    .order("rack");

  if (sublocations && sublocations.length > 0) {
    // Get current inventory counts for each sublocation
    const { data: sublocationInventory } = await supabase
      .from("inventory")
      .select("sublocation_id, qty_on_hand")
      .eq("location_id", locationId)
      .not("sublocation_id", "is", null);

    // Calculate used capacity per sublocation
    const usedCapacity = new Map<string, number>();
    (sublocationInventory || []).forEach((inv) => {
      const current = usedCapacity.get(inv.sublocation_id) || 0;
      usedCapacity.set(inv.sublocation_id, current + inv.qty_on_hand);
    });

    // Find sublocation with enough capacity
    for (const sub of sublocations) {
      const used = usedCapacity.get(sub.id) || 0;
      const available = (sub.capacity || 0) - used;
      if (available >= quantity) {
        return {
          suggestedLocationId: locationId,
          suggestedLocationName: null,
          suggestedSublocationId: sub.id,
          suggestedSublocationCode: sub.code,
          reason: `${available} capacity available`,
        };
      }
    }

    // If no sublocation has enough capacity, suggest the one with most available space
    let bestSub = sublocations[0];
    let bestAvailable = (bestSub.capacity || 0) - (usedCapacity.get(bestSub.id) || 0);

    for (const sub of sublocations) {
      const available = (sub.capacity || 0) - (usedCapacity.get(sub.id) || 0);
      if (available > bestAvailable) {
        bestSub = sub;
        bestAvailable = available;
      }
    }

    return {
      suggestedLocationId: locationId,
      suggestedLocationName: null,
      suggestedSublocationId: bestSub.id,
      suggestedSublocationCode: bestSub.code,
      reason: bestAvailable > 0 ? `${bestAvailable} capacity available` : "Best available option",
    };
  }

  // No sublocations available
  return {
    suggestedLocationId: locationId,
    suggestedLocationName: null,
    suggestedSublocationId: null,
    suggestedSublocationCode: null,
    reason: "No sublocations configured",
  };
}

/**
 * Confirms put-away by assigning sublocation to inventory
 */
export async function confirmPutAway(
  productId: string,
  locationId: string,
  sublocationId: string
): Promise<InventoryWithDetails> {
  const supabase = createClient();

  // Find the inventory record
  const { data: inventory, error: findError } = await supabase
    .from("inventory")
    .select("id")
    .eq("product_id", productId)
    .eq("location_id", locationId)
    .is("sublocation_id", null)
    .single();

  if (findError || !inventory) {
    throw new Error("Inventory record not found for put-away");
  }

  // Update with sublocation
  const { data, error } = await supabase
    .from("inventory")
    .update({ sublocation_id: sublocationId })
    .eq("id", inventory.id)
    .select(`
      *,
      product:products (
        id,
        sku,
        name,
        category,
        unit_cost,
        reorder_point,
        container_type,
        units_per_case,
        client_id
      ),
      location:locations (
        id,
        name,
        city,
        state
      ),
      sublocation:sublocations (
        id,
        code,
        name,
        zone
      )
    `)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: inventory.id,
    action: "put_away",
    details: {
      product_id: productId,
      location_id: locationId,
      sublocation_id: sublocationId,
    },
  });

  return data;
}

/**
 * Delete an inventory record
 * Only allows deletion if qty_on_hand is 0 or if force is true
 */
export async function deleteInventory(
  inventoryId: string,
  force: boolean = false
): Promise<void> {
  const supabase = createClient();

  // First check the inventory record
  const { data: inventory, error: fetchError } = await supabase
    .from("inventory")
    .select("id, qty_on_hand, qty_reserved, product_id, location_id")
    .eq("id", inventoryId)
    .single();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!inventory) {
    throw new Error("Inventory record not found");
  }

  // Check if there's stock remaining (unless forcing deletion)
  if (!force && inventory.qty_on_hand > 0) {
    throw new Error(
      `Cannot delete inventory with ${inventory.qty_on_hand} units on hand. Set quantity to 0 first or use force delete.`
    );
  }

  // Check if there's reserved stock
  if (inventory.qty_reserved > 0) {
    throw new Error(
      `Cannot delete inventory with ${inventory.qty_reserved} reserved units. Release reservations first.`
    );
  }

  // Log activity before deletion
  await supabase.from("activity_log").insert({
    entity_type: "inventory",
    entity_id: inventoryId,
    action: "deleted",
    details: {
      product_id: inventory.product_id,
      location_id: inventory.location_id,
      qty_on_hand: inventory.qty_on_hand,
      forced: force,
    },
  });

  // Delete the inventory record
  const { error: deleteError } = await supabase
    .from("inventory")
    .delete()
    .eq("id", inventoryId);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}
