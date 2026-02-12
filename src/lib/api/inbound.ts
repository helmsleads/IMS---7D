import { createClient } from "@/lib/supabase";
import { sendInternalAlert } from "@/lib/api/notifications";
import { createLPN, addLPNContent, LPN } from "@/lib/api/lpns";
import { updateInventoryWithTransaction } from "@/lib/api/inventory-transactions";
import { getClientInboundRules } from "@/lib/api/workflow-profiles";

export interface InboundOrder {
  id: string;
  po_number: string;
  client_id: string | null;
  supplier: string | null;
  status: string;
  expected_date: string | null;
  received_date: string | null;
  received_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface InboundItem {
  id: string;
  order_id: string;
  product_id: string;
  qty_expected: number;
  qty_received: number;
  qty_rejected?: number;
  rejection_reason?: string | null;
}

export type RejectionReason = "damaged" | "wrong_item" | "expired" | "quality_issue" | "other";

export interface InboundItemWithProduct extends InboundItem {
  product: {
    id: string;
    sku: string;
    name: string;
    lot_tracking_enabled?: boolean;
    default_expiration_days?: number | null;
  };
}

export interface InboundOrderWithItems extends InboundOrder {
  items: InboundItemWithProduct[];
  client?: {
    id: string;
    company_name: string;
  } | null;
}

export interface CreateInboundOrderData {
  supplier: string;
  client_id?: string | null;
  expected_date?: string | null;
  notes?: string | null;
}

export interface CreateInboundItemData {
  product_id: string;
  qty_expected: number;
}

export async function getInboundOrders(): Promise<(InboundOrder & { item_count: number })[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inbound_orders")
    .select(`
      *,
      items:inbound_items(count)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((order) => ({
    ...order,
    item_count: order.items?.[0]?.count || 0,
  }));
}

export async function getInboundOrder(id: string): Promise<InboundOrderWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inbound_orders")
    .select(`
      *,
      client:clients (
        id,
        company_name
      ),
      items:inbound_items (
        id,
        order_id,
        product_id,
        qty_expected,
        qty_received,
        product:products (
          id,
          sku,
          name,
          lot_tracking_enabled,
          default_expiration_days
        )
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

export async function createInboundOrder(
  order: CreateInboundOrderData,
  items: CreateInboundItemData[]
): Promise<InboundOrder> {
  const supabase = createClient();

  // Generate reference number (ASN = Advance Shipment Notice)
  const poNumber = `ASN-${Date.now().toString(36).toUpperCase()}`;

  // Create the order
  const { data: inboundOrder, error: orderError } = await supabase
    .from("inbound_orders")
    .insert({
      po_number: poNumber,
      supplier: order.supplier,
      client_id: order.client_id || null,
      status: "ordered",
      expected_date: order.expected_date || null,
      notes: order.notes || null,
    })
    .select()
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  // Create order items
  if (items.length > 0) {
    const orderItems = items.map((item) => ({
      order_id: inboundOrder.id,
      product_id: item.product_id,
      qty_expected: item.qty_expected,
      qty_received: 0,
    }));

    const { error: itemsError } = await supabase
      .from("inbound_items")
      .insert(orderItems);

    if (itemsError) {
      // Rollback order if items fail
      await supabase.from("inbound_orders").delete().eq("id", inboundOrder.id);
      throw new Error(itemsError.message);
    }
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inbound_order",
    entity_id: inboundOrder.id,
    action: "created",
    details: {
      po_number: poNumber,
      supplier: order.supplier,
      item_count: items.length,
    },
  });

  return inboundOrder;
}

export async function updateInboundOrderStatus(
  id: string,
  status: string
): Promise<InboundOrder> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = { status };

  // If marking as received, add timestamp and user
  if (status === "received") {
    const { data: { user } } = await supabase.auth.getUser();
    updateData.received_date = new Date().toISOString();
    updateData.received_by = user?.id || null;
  }

  const { data, error } = await supabase
    .from("inbound_orders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inbound_order",
    entity_id: id,
    action: "status_changed",
    details: { new_status: status },
  });

  // Send internal alert when inbound order is received
  if (status === "received") {
    // Fetch order details for alert
    const { data: orderData } = await supabase
      .from("inbound_orders")
      .select(`
        order_number,
        received_at,
        items:inbound_items (qty_received)
      `)
      .eq("id", id)
      .single();

    if (orderData) {
      const items = orderData.items as { qty_received: number }[];
      const totalUnits = items.reduce((sum, item) => sum + (item.qty_received || 0), 0);

      sendInternalAlert("inbound_arrived", {
        orderNumber: orderData.order_number,
        receivedAt: orderData.received_at || new Date().toISOString(),
        itemCount: items.length,
        totalUnits,
      }).catch((err) => console.error("Failed to send inbound arrived alert:", err));
    }
  }

  return data;
}

export async function receiveInboundItem(
  itemId: string,
  qtyReceived: number,
  locationId: string
): Promise<InboundItemWithProduct> {
  const supabase = createClient();

  // Get the item with order info for client_id
  const { data: item, error: itemError } = await supabase
    .from("inbound_items")
    .select(`
      *,
      product:products (
        id,
        sku,
        name
      ),
      order:inbound_orders (
        id,
        client_id
      )
    `)
    .eq("id", itemId)
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  // Update the item's received quantity
  const { data: updatedItem, error: updateError } = await supabase
    .from("inbound_items")
    .update({ qty_received: qtyReceived })
    .eq("id", itemId)
    .select(`
      *,
      product:products (
        id,
        sku,
        name
      )
    `)
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Calculate the difference to add to inventory
  const qtyDiff = qtyReceived - item.qty_received;

  if (qtyDiff !== 0) {
    // Update inventory
    const { error: inventoryError } = await supabase.rpc("update_inventory", {
      p_product_id: item.product_id,
      p_location_id: locationId,
      p_qty_change: qtyDiff,
    });

    if (inventoryError) {
      // Rollback the item update
      await supabase
        .from("inbound_items")
        .update({ qty_received: item.qty_received })
        .eq("id", itemId);
      throw new Error(inventoryError.message);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "inbound_item",
      entity_id: itemId,
      action: "received",
      details: {
        product_id: item.product_id,
        qty_received: qtyReceived,
        qty_diff: qtyDiff,
        location_id: locationId,
      },
    });

    // Record billable event for receiving (if client is set)
    const order = Array.isArray(item.order) ? item.order[0] : item.order;
    if (order?.client_id && qtyDiff > 0) {
      try {
        await supabase.rpc("record_billable_event", {
          p_client_id: order.client_id,
          p_rate_code: "RECEIVE_UNIT",
          p_quantity: qtyDiff,
          p_reference_type: "inbound_order",
          p_reference_id: order.id,
          p_usage_date: new Date().toISOString().split("T")[0],
          p_notes: `Received ${qtyDiff} units of ${item.product?.sku || item.product_id}`,
        });
      } catch (billingError) {
        // Log billing error but don't fail the receive operation
        console.error("Failed to record billable event:", billingError);
      }
    }

    // Trigger debounced Shopify inventory sync
    import("./shopify/event-sync")
      .then((mod) => mod.triggerInventorySync([item.product_id]))
      .catch((err) => console.error("Failed to trigger Shopify sync:", err));
  }

  return updatedItem;
}

export async function rejectInboundItem(
  itemId: string,
  qtyRejected: number,
  reason: RejectionReason,
  notes?: string
): Promise<InboundItemWithProduct> {
  const supabase = createClient();

  // Get the item first
  const { data: item, error: itemError } = await supabase
    .from("inbound_items")
    .select(`
      *,
      product:products (
        id,
        sku,
        name
      )
    `)
    .eq("id", itemId)
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  // Calculate new rejected total
  const currentRejected = item.qty_rejected || 0;
  const newRejectedTotal = currentRejected + qtyRejected;

  // Validate we're not rejecting more than expected - received
  const maxRejectible = item.qty_expected - item.qty_received - currentRejected;
  if (qtyRejected > maxRejectible) {
    throw new Error(`Cannot reject more than ${maxRejectible} units`);
  }

  // Format rejection notes
  const rejectionNote = notes
    ? `${reason}: ${notes}`
    : reason;
  const existingReason = item.rejection_reason || "";
  const newReason = existingReason
    ? `${existingReason}; ${rejectionNote} (${qtyRejected} units)`
    : `${rejectionNote} (${qtyRejected} units)`;

  // Update the item
  const { data: updatedItem, error: updateError } = await supabase
    .from("inbound_items")
    .update({
      qty_rejected: newRejectedTotal,
      rejection_reason: newReason,
    })
    .eq("id", itemId)
    .select(`
      *,
      product:products (
        id,
        sku,
        name
      )
    `)
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inbound_item",
    entity_id: itemId,
    action: "rejected",
    details: {
      product_id: item.product_id,
      qty_rejected: qtyRejected,
      reason,
      notes,
    },
  });

  return updatedItem;
}

export async function deleteInboundOrder(id: string): Promise<void> {
  const supabase = createClient();

  // Check if any items have been received
  const { data: items, error: itemsError } = await supabase
    .from("inbound_items")
    .select("qty_received")
    .eq("order_id", id);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const hasReceivedItems = items?.some((item) => item.qty_received > 0);
  if (hasReceivedItems) {
    throw new Error("Cannot delete order with received items");
  }

  const { error } = await supabase
    .from("inbound_orders")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export interface ReceiveWithLotResult extends InboundItemWithProduct {
  lot_id: string;
  lot_number: string;
}

export async function receiveWithLot(
  itemId: string,
  qtyReceived: number,
  locationId: string,
  lotNumber: string,
  expirationDate?: string | null
): Promise<ReceiveWithLotResult> {
  const supabase = createClient();

  // Get the item first
  const { data: item, error: itemError } = await supabase
    .from("inbound_items")
    .select(`
      *,
      order:inbound_orders (id, supplier, client_id),
      product:products (
        id,
        sku,
        name,
        lot_tracking_enabled,
        default_expiration_days
      )
    `)
    .eq("id", itemId)
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  const product = Array.isArray(item.product) ? item.product[0] : item.product;
  const order = Array.isArray(item.order) ? item.order[0] : item.order;

  // Calculate expiration date if not provided
  let calculatedExpiration = expirationDate;
  if (!calculatedExpiration && product?.default_expiration_days) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + product.default_expiration_days);
    calculatedExpiration = expDate.toISOString().split("T")[0];
  }

  // Create or find the lot
  const { data: existingLot } = await supabase
    .from("lots")
    .select("id")
    .eq("product_id", item.product_id)
    .eq("lot_number", lotNumber)
    .single();

  let lotId: string;

  if (existingLot) {
    lotId = existingLot.id;
  } else {
    // Create new lot
    const { data: newLot, error: lotError } = await supabase
      .from("lots")
      .insert({
        product_id: item.product_id,
        lot_number: lotNumber,
        expiration_date: calculatedExpiration || null,
        received_date: new Date().toISOString().split("T")[0],
        supplier: order?.supplier || null,
        status: "active",
      })
      .select()
      .single();

    if (lotError) {
      throw new Error(lotError.message);
    }

    lotId = newLot.id;
  }

  // Update lot inventory
  const { data: existingLotInv } = await supabase
    .from("lot_inventory")
    .select("id, qty_on_hand")
    .eq("lot_id", lotId)
    .eq("location_id", locationId)
    .single();

  if (existingLotInv) {
    // Update existing lot inventory
    const { error: lotInvError } = await supabase
      .from("lot_inventory")
      .update({ qty_on_hand: existingLotInv.qty_on_hand + qtyReceived })
      .eq("id", existingLotInv.id);

    if (lotInvError) {
      throw new Error(lotInvError.message);
    }
  } else {
    // Create new lot inventory record
    const { error: lotInvError } = await supabase
      .from("lot_inventory")
      .insert({
        lot_id: lotId,
        location_id: locationId,
        qty_on_hand: qtyReceived,
        qty_reserved: 0,
      });

    if (lotInvError) {
      throw new Error(lotInvError.message);
    }
  }

  // Update main inventory
  const { error: inventoryError } = await supabase.rpc("update_inventory", {
    p_product_id: item.product_id,
    p_location_id: locationId,
    p_qty_change: qtyReceived - item.qty_received,
  });

  if (inventoryError) {
    throw new Error(inventoryError.message);
  }

  // Update the inbound item
  const { data: updatedItem, error: updateError } = await supabase
    .from("inbound_items")
    .update({ qty_received: qtyReceived })
    .eq("id", itemId)
    .select(`
      *,
      product:products (
        id,
        sku,
        name
      )
    `)
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inbound_item",
    entity_id: itemId,
    action: "received_with_lot",
    details: {
      product_id: item.product_id,
      qty_received: qtyReceived,
      lot_id: lotId,
      lot_number: lotNumber,
      expiration_date: calculatedExpiration,
      location_id: locationId,
    },
  });

  // Record billable event for receiving (if client is set)
  const qtyDiff = qtyReceived - item.qty_received;
  if (order?.client_id && qtyDiff > 0) {
    try {
      await supabase.rpc("record_billable_event", {
        p_client_id: order.client_id,
        p_rate_code: "RECEIVE_UNIT",
        p_quantity: qtyDiff,
        p_reference_type: "inbound_order",
        p_reference_id: order.id,
        p_usage_date: new Date().toISOString().split("T")[0],
        p_notes: `Received ${qtyDiff} units of ${product?.sku || item.product_id} (Lot: ${lotNumber})`,
      });
    } catch (billingError) {
      // Log billing error but don't fail the receive operation
      console.error("Failed to record billable event:", billingError);
    }
  }

  return {
    ...updatedItem,
    lot_id: lotId,
    lot_number: lotNumber,
  };
}

export interface DamageReportResult {
  id: string;
  reference_type: string;
  reference_id: string;
  product_id: string;
  quantity: number;
  damage_type: string;
  description: string | null;
  resolution: string;
}

export async function reportReceivingDamage(
  inboundId: string,
  productId: string,
  quantity: number,
  damageType: string,
  description?: string | null
): Promise<DamageReportResult> {
  const supabase = createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();

  // Create damage report
  const { data: report, error: reportError } = await supabase
    .from("damage_reports")
    .insert({
      reference_type: "inbound_order",
      reference_id: inboundId,
      product_id: productId,
      quantity,
      damage_type: damageType,
      description: description || null,
      reported_by: user?.id || null,
      reported_at: new Date().toISOString(),
      resolution: "pending",
    })
    .select()
    .single();

  if (reportError) {
    throw new Error(reportError.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "damage_report",
    entity_id: report.id,
    action: "created",
    details: {
      reference_type: "inbound_order",
      reference_id: inboundId,
      product_id: productId,
      quantity,
      damage_type: damageType,
    },
  });

  return report;
}

/**
 * Create a new pallet LPN for receiving.
 */
export async function createPalletForReceiving(params: {
  locationId?: string;
  sublocationId?: string;
  inboundOrderId?: string;
  notes?: string;
}): Promise<LPN> {
  const pallet = await createLPN({
    containerType: "pallet",
    locationId: params.locationId,
    sublocationId: params.sublocationId,
    referenceType: params.inboundOrderId ? "inbound_order" : undefined,
    referenceId: params.inboundOrderId,
    notes: params.notes || "Created during receiving",
  });

  return pallet;
}

/**
 * Receive an inbound item directly to a pallet LPN.
 * 1. Updates inbound item qty_received
 * 2. Upserts lpn_contents for product on pallet
 * 3. Logs inventory transaction type 'receive' referencing pallet
 * 4. Updates inventory qty_on_hand
 */
export async function receiveInboundItemToPallet(params: {
  itemId: string;
  qtyReceived: number;
  locationId: string;
  palletId: string;
}): Promise<InboundItemWithProduct> {
  const supabase = createClient();

  // Get the item with order info
  const { data: item, error: itemError } = await supabase
    .from("inbound_items")
    .select(`
      *,
      product:products (id, sku, name),
      order:inbound_orders (id, client_id)
    `)
    .eq("id", params.itemId)
    .single();

  if (itemError) {
    throw new Error(itemError.message);
  }

  const qtyDiff = params.qtyReceived - item.qty_received;
  if (qtyDiff <= 0) {
    throw new Error("No additional quantity to receive");
  }

  // 1. Update the inbound item's received quantity
  const { data: updatedItem, error: updateError } = await supabase
    .from("inbound_items")
    .update({ qty_received: params.qtyReceived })
    .eq("id", params.itemId)
    .select(`
      *,
      product:products (id, sku, name)
    `)
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  // 2. Add product to pallet contents
  await addLPNContent({
    lpnId: params.palletId,
    productId: item.product_id,
    qty: qtyDiff,
  });

  // 3. Update inventory at location
  const { error: inventoryError } = await supabase.rpc("update_inventory", {
    p_product_id: item.product_id,
    p_location_id: params.locationId,
    p_qty_change: qtyDiff,
  });

  if (inventoryError) {
    // Rollback the item update
    await supabase
      .from("inbound_items")
      .update({ qty_received: item.qty_received })
      .eq("id", params.itemId);
    throw new Error(inventoryError.message);
  }

  // 4. Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inbound_item",
    entity_id: params.itemId,
    action: "received_to_pallet",
    details: {
      product_id: item.product_id,
      qty_received: params.qtyReceived,
      qty_diff: qtyDiff,
      location_id: params.locationId,
      pallet_id: params.palletId,
    },
  });

  // 5. Record billable event (if client is set)
  const order = Array.isArray(item.order) ? item.order[0] : item.order;
  if (order?.client_id && qtyDiff > 0) {
    try {
      await supabase.rpc("record_billable_event", {
        p_client_id: order.client_id,
        p_rate_code: "RECEIVE_UNIT",
        p_quantity: qtyDiff,
        p_reference_type: "inbound_order",
        p_reference_id: order.id,
        p_usage_date: new Date().toISOString().split("T")[0],
        p_notes: `Received ${qtyDiff} units of ${item.product?.sku || item.product_id} to pallet`,
      });
    } catch (billingError) {
      console.error("Failed to record billable event:", billingError);
    }
  }

  return updatedItem;
}

/**
 * Inbound workflow rules for a client/product combination.
 */
export interface InboundWorkflowRules {
  enabled: boolean;
  requiresPo: boolean;
  requiresAppointment: boolean;
  autoCreateLots: boolean;
  lotFormat: string | null;
  requiresInspection: boolean;
  requiresLotTracking: boolean;
  requiresExpirationDates: boolean;
}

/**
 * Fetch the effective inbound workflow rules for a given client and optional product.
 * Returns null if no client is set on the order.
 */
export async function getInboundWorkflowRulesForOrder(
  orderId: string
): Promise<InboundWorkflowRules | null> {
  const supabase = createClient();

  const { data: order } = await supabase
    .from("inbound_orders")
    .select("client_id")
    .eq("id", orderId)
    .single();

  if (!order?.client_id) return null;

  return getClientInboundRules(order.client_id);
}

/**
 * Generate a lot number using the workflow lot format template.
 * Supported tokens: {DATE}, {SEQ}, {YYYY}, {MM}, {DD}, {SKU}, {SUPPLIER}
 * Falls back to a default format if no template provided.
 * Auto-increments sequence by querying existing lots with the same date prefix.
 */
export async function generateLotNumber(params: {
  format: string | null;
  sku?: string;
  supplier?: string;
  sequence?: number;
}): Promise<string> {
  const supabase = createClient();
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = (now.getMonth() + 1).toString().padStart(2, "0");
  const dd = now.getDate().toString().padStart(2, "0");
  const dateStr = `${yyyy}${mm}${dd}`;

  // Auto-determine sequence if not provided
  let seq = params.sequence;
  if (!seq) {
    const prefix = params.format
      ? params.format.split("{SEQ}")[0]
          .replace("{DATE}", dateStr)
          .replace("{YYYY}", yyyy)
          .replace("{MM}", mm)
          .replace("{DD}", dd)
          .replace("{SKU}", params.sku || "")
          .replace("{SUPPLIER}", params.supplier || "")
      : `LOT-${dateStr}-`;

    const { data: existing } = await supabase
      .from("lots")
      .select("lot_number")
      .like("lot_number", `${prefix}%`)
      .order("lot_number", { ascending: false })
      .limit(1);

    if (existing && existing.length > 0) {
      // Extract the trailing number from the last lot
      const lastNum = existing[0].lot_number.replace(prefix, "");
      const parsed = parseInt(lastNum, 10);
      seq = isNaN(parsed) ? 1 : parsed + 1;
    } else {
      seq = 1;
    }
  }

  const seqStr = seq.toString().padStart(3, "0");

  if (!params.format) {
    return `LOT-${dateStr}-${seqStr}`;
  }

  return params.format
    .replace("{DATE}", dateStr)
    .replace("{YYYY}", yyyy)
    .replace("{MM}", mm)
    .replace("{DD}", dd)
    .replace("{SEQ}", seqStr)
    .replace("{SKU}", params.sku || "")
    .replace("{SUPPLIER}", params.supplier || "");
}

/**
 * Validate inbound receiving against workflow rules.
 * Throws descriptive errors if rules are violated.
 */
export function validateReceiveAgainstRules(
  rules: InboundWorkflowRules,
  params: {
    hasLotInfo: boolean;
    hasExpirationDate: boolean;
    isInspectionAcknowledged: boolean;
  }
): { warnings: string[]; requiresInspectionHold: boolean } {
  const warnings: string[] = [];
  let requiresInspectionHold = false;

  if (rules.requiresLotTracking && !params.hasLotInfo) {
    throw new Error("Lot information is required by this client's workflow rules");
  }

  if (rules.requiresExpirationDates && !params.hasExpirationDate) {
    throw new Error("Expiration date is required by this client's workflow rules");
  }

  if (rules.requiresInspection) {
    requiresInspectionHold = true;
    if (!params.isInspectionAcknowledged) {
      warnings.push("Items will be placed on inspection hold per workflow rules");
    }
  }

  return { warnings, requiresInspectionHold };
}

/**
 * Place received items on inspection hold.
 */
export async function placeOnInspectionHold(
  itemId: string,
  orderId: string,
  reason?: string
): Promise<void> {
  const supabase = createClient();

  await supabase.from("activity_log").insert({
    entity_type: "inbound_item",
    entity_id: itemId,
    action: "inspection_hold",
    details: {
      order_id: orderId,
      reason: reason || "Required by workflow rules",
    },
  });
}

/**
 * Release items from inspection hold (approve).
 */
export async function releaseFromInspectionHold(
  itemId: string,
  orderId: string,
  approvedBy?: string
): Promise<void> {
  const supabase = createClient();

  await supabase.from("activity_log").insert({
    entity_type: "inbound_item",
    entity_id: itemId,
    action: "inspection_approved",
    details: {
      order_id: orderId,
      approved_by: approvedBy,
    },
  });
}
