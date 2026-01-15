import { createClient } from "@/lib/supabase";
import { sendInternalAlert } from "@/lib/api/notifications";

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
          name
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

  // Generate PO number
  const poNumber = `PO-${Date.now().toString(36).toUpperCase()}`;

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
