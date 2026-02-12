import { createClient } from "@/lib/supabase";

export interface ReservationResult {
  transactionId: string;
  success: boolean;
}

export interface AvailabilityCheck {
  productId: string;
  locationId: string;
  qtyOnHand: number;
  qtyReserved: number;
  qtyAvailable: number;
  canFulfill: boolean;
  shortfall: number;
}

/**
 * Reserve inventory for a confirmed order
 */
export async function reserveInventory(params: {
  productId: string;
  locationId: string;
  qtyToReserve: number;
  referenceType?: string;
  referenceId?: string;
  performedBy?: string;
}): Promise<ReservationResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("reserve_inventory", {
    p_product_id: params.productId,
    p_location_id: params.locationId,
    p_qty_to_reserve: params.qtyToReserve,
    p_reference_type: params.referenceType || "outbound_order",
    p_reference_id: params.referenceId || null,
    p_performed_by: params.performedBy || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    transactionId: data,
    success: true,
  };
}

/**
 * Release reservation (on ship or cancel)
 */
export async function releaseReservation(params: {
  productId: string;
  locationId: string;
  qtyToRelease: number;
  alsoDeduct: boolean; // true when shipping, false when cancelling
  referenceType?: string;
  referenceId?: string;
  performedBy?: string;
}): Promise<ReservationResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("release_reservation", {
    p_product_id: params.productId,
    p_location_id: params.locationId,
    p_qty_to_release: params.qtyToRelease,
    p_also_deduct: params.alsoDeduct,
    p_reference_type: params.referenceType || "outbound_order",
    p_reference_id: params.referenceId || null,
    p_performed_by: params.performedBy || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    transactionId: data,
    success: true,
  };
}

/**
 * Check availability for multiple products
 */
export async function checkAvailability(
  items: Array<{
    productId: string;
    locationId: string;
    qtyRequested: number;
  }>
): Promise<AvailabilityCheck[]> {
  const supabase = createClient();

  const results: AvailabilityCheck[] = [];

  for (const item of items) {
    const { data, error } = await supabase
      .from("inventory")
      .select("qty_on_hand, qty_reserved")
      .eq("product_id", item.productId)
      .eq("location_id", item.locationId)
      .eq("stage", "available")
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(error.message);
    }

    const qtyOnHand = data?.qty_on_hand || 0;
    const qtyReserved = data?.qty_reserved || 0;
    const qtyAvailable = qtyOnHand - qtyReserved;
    const shortfall = Math.max(0, item.qtyRequested - qtyAvailable);

    results.push({
      productId: item.productId,
      locationId: item.locationId,
      qtyOnHand,
      qtyReserved,
      qtyAvailable,
      canFulfill: qtyAvailable >= item.qtyRequested,
      shortfall,
    });
  }

  return results;
}

/**
 * Reserve inventory for all items in an order
 */
export async function reserveOrderItems(
  orderId: string,
  locationId: string,
  performedBy?: string
): Promise<{
  success: boolean;
  reservations: ReservationResult[];
  errors: string[];
}> {
  const supabase = createClient();

  // Get order items
  const { data: items, error: itemsError } = await supabase
    .from("outbound_items")
    .select("id, product_id, qty_requested")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const reservations: ReservationResult[] = [];
  const errors: string[] = [];

  for (const item of items || []) {
    try {
      const result = await reserveInventory({
        productId: item.product_id,
        locationId,
        qtyToReserve: item.qty_requested,
        referenceType: "outbound_order",
        referenceId: orderId,
        performedBy,
      });
      reservations.push(result);
    } catch (err) {
      errors.push(`Product ${item.product_id}: ${(err as Error).message}`);
    }
  }

  return {
    success: errors.length === 0,
    reservations,
    errors,
  };
}

/**
 * Release all reservations for an order (on cancel)
 */
export async function releaseOrderReservations(
  orderId: string,
  locationId: string,
  performedBy?: string
): Promise<{
  success: boolean;
  releases: ReservationResult[];
  errors: string[];
}> {
  const supabase = createClient();

  // Get order items with their reserved quantities
  const { data: items, error: itemsError } = await supabase
    .from("outbound_items")
    .select("id, product_id, qty_requested, qty_shipped")
    .eq("order_id", orderId);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const releases: ReservationResult[] = [];
  const errors: string[] = [];

  for (const item of items || []) {
    // Only release what's still reserved (ordered - shipped)
    const qtyToRelease = item.qty_requested - (item.qty_shipped || 0);
    if (qtyToRelease <= 0) continue;

    try {
      const result = await releaseReservation({
        productId: item.product_id,
        locationId,
        qtyToRelease,
        alsoDeduct: false, // Don't deduct on cancel
        referenceType: "outbound_order",
        referenceId: orderId,
        performedBy,
      });
      releases.push(result);
    } catch (err) {
      errors.push(`Product ${item.product_id}: ${(err as Error).message}`);
    }
  }

  return {
    success: errors.length === 0,
    releases,
    errors,
  };
}

/**
 * Get all active reservations
 */
export async function getActiveReservations(): Promise<
  Array<{
    productId: string;
    productSku: string;
    productName: string;
    locationId: string;
    locationName: string;
    qtyReserved: number;
  }>
> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory")
    .select(`
      product_id,
      qty_reserved,
      products (sku, name),
      locations (id, name)
    `)
    .gt("qty_reserved", 0);

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((inv) => ({
    productId: inv.product_id,
    productSku: (inv.products as { sku: string; name: string })?.sku || "",
    productName: (inv.products as { sku: string; name: string })?.name || "",
    locationId: (inv.locations as { id: string; name: string })?.id || "",
    locationName: (inv.locations as { id: string; name: string })?.name || "",
    qtyReserved: inv.qty_reserved,
  }));
}
