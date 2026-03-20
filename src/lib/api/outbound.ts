import { createClient } from "@/lib/supabase";
import { sendInternalAlert, sendPortalOrderNotification } from "@/lib/api/notifications";
import { reserveOrderItems, releaseOrderReservations, releaseReservation } from "./reservations";
import { updateInventoryWithTransaction } from "./inventory-transactions";
import { autoAssignBoxesForOrder } from "./box-usage";
import { generateShipmentInvoice } from "./invoices";
import { syncFulfillmentToShopify } from "./shopify/fulfillment-sync";

export type OrderSource = 'portal' | 'internal' | 'api';

async function fireAndForgetEmail(endpoint: string, orderId: string) {
  try {
    // Must be called from the browser so cookies/session are included
    if (typeof window === "undefined") return;
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    }).catch(() => {});
  } catch {
    // no-op
  }
}

export interface OutboundOrder {
  id: string;
  order_number: string;
  client_id: string | null;
  status: string;
  source: OrderSource;
  ship_to_name: string | null;
  ship_to_company: string | null;
  ship_to_address: string | null;
  ship_to_address2: string | null;
  ship_to_city: string | null;
  ship_to_state: string | null;
  ship_to_zip: string | null;
  ship_to_country: string | null;
  ship_to_phone: string | null;
  ship_to_email: string | null;
  notes: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  requested_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  is_rush: boolean | null;
  preferred_carrier: string | null;
  requires_repack: boolean;
  is_multi_client: boolean;
  recipient_name: string | null;
  requestor: string | null;
  created_by: string | null;
  created_at: string;
  // FedEx shipping integration
  fedex_shipment_id: string | null;
  label_url: string | null;
  shipping_method: 'manual' | 'fedex_api' | 'pickup' | null;
  // Shipping cost tracking
  shipping_cost: number | null;
  client_shipping_cost: number | null;
  // Tracking sync fields
  tracking_status?: string | null;
  tracking_status_updated_at?: string | null;
}

export interface OutboundItem {
  id: string;
  order_id: string;
  product_id: string;
  qty_requested: number;
  qty_shipped: number;
  unit_price: number;
}

export interface OutboundItemWithProduct extends OutboundItem {
  product: {
    id: string;
    sku: string;
    name: string;
    client_id?: string | null;
    container_type?: string | null;
  };
}

export interface OutboundOrderWithClient extends OutboundOrder {
  client?: {
    id: string;
    company_name: string;
    industry?: string;
  } | null;
}

export interface OutboundOrderWithItems extends OutboundOrderWithClient {
  items: OutboundItemWithProduct[];
  created_by_user?: { full_name: string | null; email: string } | null;
}

export interface CreateOutboundOrderData {
  client_id?: string | null;
  recipient_name?: string | null;
  requestor?: string | null;
  ship_to_address?: string | null;
  ship_to_address2?: string | null;
  ship_to_city?: string | null;
  ship_to_state?: string | null;
  ship_to_zip?: string | null;
  preferred_carrier?: string | null;
  notes?: string | null;
  status?: string;
  source?: OrderSource;
  requires_repack?: boolean;
  is_multi_client?: boolean;
}

export interface CreateOutboundItemData {
  product_id: string;
  qty_requested: number;
  unit_price?: number;
}

export interface UpdateOutboundOrderData {
  recipient_name?: string | null;
  requestor?: string | null;
  ship_to_address?: string | null;
  ship_to_address2?: string | null;
  ship_to_city?: string | null;
  ship_to_state?: string | null;
  ship_to_zip?: string | null;
  ship_to_country?: string | null;
  preferred_carrier?: string | null;
  carrier?: string | null;
  tracking_number?: string | null;
  notes?: string | null;
  requires_repack?: boolean;
  requested_at?: string | null;
  confirmed_at?: string | null;
  shipped_date?: string | null;
  delivered_date?: string | null;
}

export interface ClientSplit {
  clientId: string;
  fraction: number;
  itemCount: number;
}

/**
 * Compute proportional client splits from order items.
 * Used to split shared costs (supplies, boxes) across clients in multi-client orders.
 */
export function computeClientSplits(
  items: { clientId: string; qty: number }[]
): ClientSplit[] {
  const totalQty = items.reduce((sum, i) => sum + i.qty, 0);
  if (totalQty === 0) return [];

  const byClient = new Map<string, number>();
  for (const item of items) {
    byClient.set(item.clientId, (byClient.get(item.clientId) || 0) + item.qty);
  }

  return Array.from(byClient.entries()).map(([clientId, qty]) => ({
    clientId,
    fraction: qty / totalQty,
    itemCount: qty,
  }));
}

export async function updateOutboundOrder(
  id: string,
  data: UpdateOutboundOrderData
): Promise<OutboundOrder> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: updated, error } = await supabase
    .from("outbound_orders")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "outbound_order",
    entity_id: id,
    action: "updated",
    user_id: user?.id || null,
    details: data,
  });

  return updated;
}

export interface UpdateOutboundStatusFields {
  carrier?: string;
  tracking_number?: string;
  shipping_method?: 'manual' | 'fedex_api' | 'pickup';
  shipping_cost?: number;
  client_shipping_cost?: number;
}

export async function getOutboundOrders(): Promise<(OutboundOrderWithClient & { item_count: number })[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outbound_orders")
    .select(`
      *,
      client:clients (
        id,
        company_name
      ),
      items:outbound_items(count)
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

export async function getOutboundOrder(id: string): Promise<OutboundOrderWithItems | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("outbound_orders")
    .select(`
      *,
      client:clients (
        id,
        company_name,
        industry
      ),
      items:outbound_items (
        id,
        order_id,
        product_id,
        qty_requested,
        qty_shipped,
        unit_price,
        product:products (
          id,
          sku,
          name,
          client_id,
          container_type
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

  // Fetch created_by user profile if present
  let created_by_user: { full_name: string | null; email: string } | null = null;
  if (data.created_by) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", data.created_by)
      .single();
    if (profile) {
      created_by_user = profile;
    }
  }

  return { ...data, created_by_user };
}

export async function createOutboundOrder(
  order: CreateOutboundOrderData,
  items: CreateOutboundItemData[]
): Promise<OutboundOrder> {
  const supabase = createClient();

  // Generate order number
  const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;

  // Determine status and confirmation fields
  const status = order.status || "pending";
  const source = order.source || "internal";
  const { data: { user } } = await supabase.auth.getUser();
  const insertData: Record<string, unknown> = {
    order_number: orderNumber,
    client_id: order.client_id || null,
    status,
    source,
    recipient_name: order.recipient_name || null,
    requestor: order.requestor || null,
    ship_to_address: order.ship_to_address || null,
    ship_to_address2: order.ship_to_address2 || null,
    ship_to_city: order.ship_to_city || null,
    ship_to_state: order.ship_to_state || null,
    ship_to_zip: order.ship_to_zip || null,
    preferred_carrier: order.preferred_carrier || null,
    notes: order.notes || null,
    requires_repack: order.requires_repack ?? true,
    is_multi_client: order.is_multi_client ?? false,
    created_by: user?.id || null,
  };

  // If creating as confirmed, set confirmation fields
  if (status === "confirmed") {
    insertData.confirmed_at = new Date().toISOString();
    insertData.confirmed_by = user?.id || null;
    insertData.requested_at = new Date().toISOString();
  }

  // Create the order
  const { data: outboundOrder, error: orderError } = await supabase
    .from("outbound_orders")
    .insert(insertData)
    .select()
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  // Create order items
  if (items.length > 0) {
    const orderItems = items.map((item) => ({
      order_id: outboundOrder.id,
      product_id: item.product_id,
      qty_requested: item.qty_requested,
      qty_shipped: 0,
      unit_price: item.unit_price || 0,
    }));

    const { error: itemsError } = await supabase
      .from("outbound_items")
      .insert(orderItems);

    if (itemsError) {
      // Rollback order if items fail
      await supabase.from("outbound_orders").delete().eq("id", outboundOrder.id);
      throw new Error(itemsError.message);
    }
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "outbound_order",
    entity_id: outboundOrder.id,
    action: "created",
    user_id: user?.id || null,
    details: {
      order_number: orderNumber,
      client_id: order.client_id,
      item_count: items.length,
      status,
    },
  });

  // Send internal alert for new pending orders
  if (status === "pending" && order.client_id) {
    // Fetch client and product details for the alert
    const { data: clientData } = await supabase
      .from("clients")
      .select("company_name, contact_name, email")
      .eq("id", order.client_id)
      .single();

    const { data: itemsData } = await supabase
      .from("outbound_items")
      .select(`
        qty_requested,
        product:products (name, sku)
      `)
      .eq("order_id", outboundOrder.id);

    if (clientData && itemsData) {
      const alertItems = itemsData.map((item) => {
        const product = Array.isArray(item.product) ? item.product[0] : item.product;
        return {
          productName: product?.name || "Unknown",
          sku: product?.sku || "",
          qtyRequested: item.qty_requested,
        };
      });

      // Parse address from ship_to_address (format: "address, city, state zip")
      const addressParts = (order.ship_to_address || "").split(",").map(s => s.trim());

      sendInternalAlert("new_order", {
        order: {
          id: outboundOrder.id,
          orderNumber,
          createdAt: outboundOrder.created_at,
          shipToAddress: addressParts[0] || "",
          shipToCity: addressParts[1] || "",
          shipToState: addressParts[2]?.split(" ")[0] || "",
          shipToPostalCode: addressParts[2]?.split(" ")[1] || "",
          isRush: false,
          notes: order.notes,
        },
        client: {
          companyName: clientData.company_name,
          contactName: clientData.contact_name,
          email: clientData.email,
        },
        items: alertItems,
      }).catch((err) => console.error("Failed to send new order alert:", err));
    }
  }

  return outboundOrder;
}

export async function updateOutboundOrderStatus(
  id: string,
  status: string,
  additionalFields?: UpdateOutboundStatusFields & { locationId?: string }
): Promise<OutboundOrder> {
  const supabase = createClient();

  // Get current order status to determine if we need to reserve/release
  const { data: currentOrder, error: currentError } = await supabase
    .from("outbound_orders")
    .select("status")
    .eq("id", id)
    .single();

  if (currentError) {
    throw new Error(currentError.message);
  }

  const updateData: Record<string, unknown> = { status };
  const { data: { user } } = await supabase.auth.getUser();

  // Add additional fields based on status
  if (status === "confirmed") {
    updateData.confirmed_at = new Date().toISOString();
    updateData.confirmed_by = user?.id || null;

    // Reserve inventory when order is confirmed
    if (additionalFields?.locationId && currentOrder.status !== "confirmed") {
      try {
        const reservationResult = await reserveOrderItems(
          id,
          additionalFields.locationId,
          user?.id
        );
        if (!reservationResult.success) {
          console.warn("Some items could not be reserved:", reservationResult.errors);
        }
      } catch (reserveError) {
        console.error("Failed to reserve inventory:", reserveError);
        // Don't block the status update, just log the error
      }
    }

    // Auto-generate pick list after reservation
    if (additionalFields?.locationId) {
      import("./warehouse-tasks")
        .then(({ generatePickList }) =>
          generatePickList(id, additionalFields.locationId!)
        )
        .catch((err) => console.error("Failed to generate pick list:", err));
    }
  }

  if (status === "shipped") {
    updateData.shipped_date = new Date().toISOString();
    if (additionalFields?.carrier) {
      updateData.carrier = additionalFields.carrier;
      updateData.preferred_carrier = additionalFields.carrier;
    }
    if (additionalFields?.tracking_number) {
      updateData.tracking_number = additionalFields.tracking_number;
    }
    if (additionalFields?.shipping_method) {
      updateData.shipping_method = additionalFields.shipping_method;
    }
    if (additionalFields?.shipping_cost != null) {
      updateData.shipping_cost = additionalFields.shipping_cost;
    }
    if (additionalFields?.client_shipping_cost != null) {
      updateData.client_shipping_cost = additionalFields.client_shipping_cost;
    }
  }

  if (status === "delivered") {
    updateData.delivered_date = new Date().toISOString();
  }

  // Release reservations when order is cancelled
  if (status === "cancelled" && currentOrder.status === "confirmed" && additionalFields?.locationId) {
    try {
      await releaseOrderReservations(id, additionalFields.locationId, user?.id);
    } catch (releaseError) {
      console.error("Failed to release reservations:", releaseError);
    }
  }

  const { data, error } = await supabase
    .from("outbound_orders")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "outbound_order",
    entity_id: id,
    action: "status_changed",
    user_id: user?.id || null,
    details: {
      new_status: status,
      previous_status: currentOrder.status,
      ...additionalFields,
    },
  });

  // Send email notifications based on status
  if (status === "confirmed") {
    fireAndForgetEmail("/api/email/order-confirmed", id);
  } else if (status === "packed") {
    // Auto-assign boxes when order is packed based on products being shipped
    autoAssignBoxesForOrder(id).then((result) => {
      if (result.success && result.boxesAssigned.length > 0) {
        console.log(`Auto-assigned boxes for order ${id}:`, result.boxesAssigned, `Total: $${result.totalCost}`);
      } else if (result.error) {
        console.warn(`Box auto-assignment skipped for order ${id}:`, result.error);
      }
    }).catch((err) =>
      console.error("Failed to auto-assign boxes:", err)
    );
  } else if (status === "shipped") {
    fireAndForgetEmail("/api/email/order-shipped", id);
    // Record billable events for shipping
    recordOutboundUsage(id).catch((err) =>
      console.error("Failed to record outbound usage:", err)
    );
    // Generate draft invoice for this shipment
    generateShipmentInvoice(id).catch((err) =>
      console.error("Failed to generate shipment invoice:", err)
    );
    // Send internal alert for order shipped
    (async () => {
      try {
        const { data: orderDetails } = await supabase
          .from("outbound_orders")
          .select(`
            order_number,
            carrier,
            tracking_number,
            client:clients (company_name),
            items:outbound_items (qty_shipped)
          `)
          .eq("id", id)
          .single();

        if (orderDetails) {
          const client = Array.isArray(orderDetails.client) ? orderDetails.client[0] : orderDetails.client;
          const items = orderDetails.items as { qty_shipped: number }[];
          sendInternalAlert("order_shipped", {
            orderNumber: orderDetails.order_number,
            clientName: (client as { company_name: string })?.company_name || "Unknown",
            carrier: orderDetails.carrier,
            trackingNumber: orderDetails.tracking_number,
            itemCount: items.length,
            totalUnits: items.reduce((sum, i) => sum + (i.qty_shipped || 0), 0),
          }).catch((err) => console.error("Failed to send order_shipped alert:", err));
        }
      } catch (err) {
        console.error("Failed to prepare order_shipped alert:", err);
      }
    })();
    // Sync fulfillment to Shopify if this order came from Shopify
    // Only runs server-side (service role key not available in browser)
    if (additionalFields?.tracking_number && additionalFields?.carrier && typeof window === "undefined") {
      // Fetch shipped items for partial fulfillment support
      const { data: shippedItems } = await supabase
        .from("outbound_items")
        .select("product_id, qty_shipped")
        .eq("order_id", id)
        .gt("qty_shipped", 0);

      const fulfillmentItems = (shippedItems || []).map((item) => ({
        product_id: item.product_id,
        qty: item.qty_shipped,
      }));

      syncFulfillmentToShopify(
        id,
        additionalFields.tracking_number,
        additionalFields.carrier,
        undefined,
        fulfillmentItems.length > 0 ? fulfillmentItems : undefined
      ).catch((err) =>
        console.error("Failed to sync fulfillment to Shopify:", err)
      );
    }
  } else if (status === "delivered") {
    fireAndForgetEmail("/api/email/order-delivered", id);
  }

  // Send portal notification to all involved clients for status changes
  const trackingDetails = (status === "shipped" && additionalFields?.tracking_number)
    ? `Tracking: ${additionalFields.carrier || ""} ${additionalFields.tracking_number}`
    : undefined;

  if (data.is_multi_client) {
    // For multi-client orders, derive all client IDs from items and notify each
    const { data: orderItems } = await supabase
      .from("outbound_items")
      .select("product:products (client_id)")
      .eq("order_id", id);

    const clientIdsToNotify = new Set<string>();
    if (data.client_id) clientIdsToNotify.add(data.client_id);
    for (const item of (orderItems || []) as any[]) {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      if (product?.client_id) clientIdsToNotify.add(product.client_id);
    }

    for (const notifyClientId of clientIdsToNotify) {
      sendPortalOrderNotification({
        clientId: notifyClientId,
        orderNumber: data.order_number,
        status,
        details: trackingDetails,
      }).catch((err) =>
        console.error(`Failed to send portal notification to client ${notifyClientId}:`, err)
      );
    }
  } else if (data.client_id) {
    sendPortalOrderNotification({
      clientId: data.client_id,
      orderNumber: data.order_number,
      status,
      details: trackingDetails,
    }).catch((err) =>
      console.error("Failed to send portal order notification:", err)
    );
  }

  return data;
}

export async function shipOutboundItem(
  itemId: string,
  qtyShipped: number,
  locationId: string,
  performedBy?: string
): Promise<OutboundItemWithProduct> {
  const supabase = createClient();

  // Get the item first with order info
  const { data: item, error: itemError } = await supabase
    .from("outbound_items")
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

  // Get user if not provided
  if (!performedBy) {
    const { data: { user } } = await supabase.auth.getUser();
    performedBy = user?.id;
  }

  // Update the item's shipped quantity
  const { data: updatedItem, error: updateError } = await supabase
    .from("outbound_items")
    .update({ qty_shipped: qtyShipped })
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

  // Calculate the difference to remove from inventory
  const qtyDiff = qtyShipped - item.qty_shipped;

  if (qtyDiff > 0) {
    try {
      // Release reservation and deduct from inventory using transaction logging
      await releaseReservation({
        productId: item.product_id,
        locationId,
        qtyToRelease: qtyDiff,
        alsoDeduct: true, // This is a ship, so deduct from inventory
        referenceType: "outbound_order",
        referenceId: item.order_id,
        performedBy,
      });
    } catch (reserveError) {
      // If no reservation exists, fall back to direct transaction
      console.warn("No reservation found, using direct deduction:", reserveError);
      try {
        await updateInventoryWithTransaction({
          productId: item.product_id,
          locationId,
          qtyChange: -qtyDiff,
          transactionType: "ship",
          referenceType: "outbound_order",
          referenceId: item.order_id,
          performedBy,
        });
      } catch (inventoryError) {
        // Rollback the item update
        await supabase
          .from("outbound_items")
          .update({ qty_shipped: item.qty_shipped })
          .eq("id", itemId);
        throw new Error((inventoryError as Error).message);
      }
    }

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "outbound_item",
      entity_id: itemId,
      action: "shipped",
      user_id: performedBy || null,
      details: {
        product_id: item.product_id,
        qty_shipped: qtyShipped,
        qty_diff: qtyDiff,
        location_id: locationId,
      },
    });
    // Trigger immediate Shopify inventory sync for shipped product
    import("./shopify/event-sync")
      .then((mod) => mod.triggerImmediateInventorySync([item.product_id]))
      .catch((err) => console.error("Failed to trigger Shopify sync:", err));
  } else if (qtyDiff < 0) {
    // Quantity decreased (rare case - shipping less than before)
    // Add back to inventory
    try {
      await updateInventoryWithTransaction({
        productId: item.product_id,
        locationId,
        qtyChange: Math.abs(qtyDiff),
        transactionType: "adjust",
        referenceType: "outbound_order",
        referenceId: item.order_id,
        reason: "Ship quantity adjustment - reduced",
        performedBy,
      });
    } catch (inventoryError) {
      console.error("Failed to adjust inventory for reduced ship qty:", inventoryError);
    }
  }

  return updatedItem;
}

export async function deleteOutboundOrder(id: string): Promise<void> {
  const supabase = createClient();

  // Check if any items have been shipped
  const { data: items, error: itemsError } = await supabase
    .from("outbound_items")
    .select("qty_shipped")
    .eq("order_id", id);

  if (itemsError) {
    throw new Error(itemsError.message);
  }

  const hasShippedItems = items?.some((item) => item.qty_shipped > 0);
  if (hasShippedItems) {
    throw new Error("Cannot delete order with shipped items");
  }

  const { error } = await supabase
    .from("outbound_orders")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export interface OutboundUsageRecord {
  id: string;
  client_id: string;
  service_id: string | null;
  addon_id: string | null;
  usage_type: string;
  quantity: number;
  unit_price: number;
  total: number;
  reference_type: string | null;
  reference_id: string | null;
  usage_date: string;
  invoiced: boolean;
  invoice_id: string | null;
  notes: string | null;
}

export interface OutboundSupplyUsage {
  id: string;
  supply_id: string;
  quantity: number;
  unit_price: number;
  total: number;
  supply: {
    id: string;
    sku: string;
    name: string;
  };
}

export interface OutboundWithUsage extends OutboundOrderWithItems {
  usage_records: OutboundUsageRecord[];
  supply_usage: OutboundSupplyUsage[];
}

export async function recordOutboundUsage(orderId: string): Promise<void> {
  const supabase = createClient();

  // Get the order with items and product client_id for multi-client splitting
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      *,
      items:outbound_items (
        qty_shipped,
        product:products (id, sku, name, client_id, container_type)
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  // Group shipped items by owning client AND rate code (barrel vs unit)
  const clientShipped = new Map<string, { units: number; barrels: number }>();
  for (const item of (order.items || []) as any[]) {
    const qty = item.qty_shipped || 0;
    if (qty === 0) continue;
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    const ownerClientId = product?.client_id || order.client_id;
    if (!ownerClientId) continue;
    const entry = clientShipped.get(ownerClientId) || { units: 0, barrels: 0 };
    if (product?.container_type === "keg") {
      entry.barrels += qty;
    } else {
      entry.units += qty;
    }
    clientShipped.set(ownerClientId, entry);
  }

  if (clientShipped.size === 0) {
    return; // No items shipped, no usage to record
  }

  const usageDate = new Date().toISOString().split("T")[0];

  // Record billable events per client, split by unit type
  for (const [billingClientId, counts] of clientShipped) {
    if (counts.units > 0) {
      try {
        await supabase.rpc("record_billable_event", {
          p_client_id: billingClientId,
          p_rate_code: "PICK_UNIT",
          p_quantity: counts.units,
          p_reference_type: "outbound_order",
          p_reference_id: orderId,
          p_usage_date: usageDate,
          p_notes: `Order ${order.order_number} - Outgoing handling: ${counts.units} cases/bottles`,
        });
      } catch (billingError) {
        console.error(`Failed to record billable events for client ${billingClientId}:`, billingError);
      }
    }
    if (counts.barrels > 0) {
      try {
        await supabase.rpc("record_billable_event", {
          p_client_id: billingClientId,
          p_rate_code: "PICK_BARREL",
          p_quantity: counts.barrels,
          p_reference_type: "outbound_order",
          p_reference_id: orderId,
          p_usage_date: usageDate,
          p_notes: `Order ${order.order_number} - Outgoing barrel handling: ${counts.barrels} barrels`,
        });
      } catch (billingError) {
        console.error(`Failed to record barrel billable events for client ${billingClientId}:`, billingError);
      }
    }

    // Also record to legacy fulfillment service if configured
    const { data: clientService } = await supabase
      .from("client_services")
      .select(`
        id,
        service_id,
        custom_price,
        service:services (id, name, base_price, price_unit)
      `)
      .eq("client_id", billingClientId)
      .eq("is_active", true)
      .single();

    if (clientService) {
      const service = clientService.service as any;
      const unitPrice = clientService.custom_price ?? service?.base_price ?? 0;

      const { error: usageError } = await supabase
        .from("usage_records")
        .insert({
          client_id: billingClientId,
          service_id: clientService.service_id,
          usage_type: "fulfillment",
          quantity: counts.units + counts.barrels,
          unit_price: unitPrice,
          total: (counts.units + counts.barrels) * unitPrice,
          reference_type: "outbound_order",
          reference_id: orderId,
          usage_date: usageDate,
          invoiced: false,
          notes: `Order ${order.order_number} - ${counts.units + counts.barrels} items`,
        });

      if (usageError) {
        console.error("Failed to record fulfillment usage:", usageError.message);
      }
    }
  }

  // Record shipping/freight cost split proportionally by brand
  const shippingCost = order.client_shipping_cost || order.shipping_cost || 0;
  if (shippingCost > 0 && clientShipped.size > 0) {
    // Calculate total items across all brands for percentage split
    let totalItems = 0;
    for (const counts of clientShipped.values()) {
      totalItems += counts.units + counts.barrels;
    }

    if (totalItems > 0) {
      for (const [billingClientId, counts] of clientShipped) {
        const clientItems = counts.units + counts.barrels;
        const fraction = clientItems / totalItems;
        const clientFreight = Math.round(shippingCost * fraction * 100) / 100;
        if (clientFreight <= 0) continue;

        try {
          // Freight is a passthrough cost — record directly as usage
          // (not via record_billable_event which would look up a $0 rate)
          await supabase.from("usage_records").insert({
            client_id: billingClientId,
            usage_type: "FREIGHT",
            quantity: 1,
            unit_price: clientFreight,
            total: clientFreight,
            reference_type: "outbound_order",
            reference_id: orderId,
            usage_date: usageDate,
            invoiced: false,
            notes: `Order ${order.order_number} - Shipping: $${clientFreight.toFixed(2)} (${Math.round(fraction * 100)}% of $${shippingCost.toFixed(2)})`,
          });
        } catch (freightError) {
          console.error(`Failed to record freight for client ${billingClientId}:`, freightError);
        }
      }
    }
  }
}

export async function getOutboundWithUsage(id: string): Promise<OutboundWithUsage | null> {
  const supabase = createClient();

  // Get the order with items
  const order = await getOutboundOrder(id);
  if (!order) {
    return null;
  }

  // Get usage records for this order
  const { data: usageRecords, error: usageError } = await supabase
    .from("usage_records")
    .select("*")
    .eq("reference_type", "outbound_order")
    .eq("reference_id", id);

  if (usageError) {
    throw new Error(usageError.message);
  }

  // Get supply usage for this order
  const { data: supplyUsage, error: supplyError } = await supabase
    .from("supply_usage")
    .select(`
      id,
      supply_id,
      quantity,
      unit_price,
      total,
      supply:supplies (id, sku, name)
    `)
    .eq("order_id", id);

  if (supplyError) {
    throw new Error(supplyError.message);
  }

  // Transform supply_usage to handle Supabase's array return for joins
  const transformedSupplyUsage = (supplyUsage || []).map((usage: any) => ({
    ...usage,
    supply: Array.isArray(usage.supply) ? usage.supply[0] : usage.supply,
  }));

  return {
    ...order,
    usage_records: usageRecords || [],
    supply_usage: transformedSupplyUsage,
  };
}

export async function updateOutboundItem(
  itemId: string,
  data: { qty_requested?: number; unit_price?: number }
): Promise<OutboundItemWithProduct> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch current item
  const { data: item, error: itemError } = await supabase
    .from("outbound_items")
    .select("*, product:products (id, sku, name)")
    .eq("id", itemId)
    .single();

  if (itemError) throw new Error(itemError.message);

  // Validate qty_requested >= qty_shipped
  if (data.qty_requested !== undefined && data.qty_requested < item.qty_shipped) {
    throw new Error(
      `Cannot reduce quantity below shipped amount (${item.qty_shipped})`
    );
  }

  const updatePayload: Record<string, unknown> = {};
  if (data.qty_requested !== undefined) updatePayload.qty_requested = data.qty_requested;
  if (data.unit_price !== undefined) updatePayload.unit_price = data.unit_price;

  const { data: updated, error: updateError } = await supabase
    .from("outbound_items")
    .update(updatePayload)
    .eq("id", itemId)
    .select("*, product:products (id, sku, name, client_id, container_type)")
    .single();

  if (updateError) throw new Error(updateError.message);

  await supabase.from("activity_log").insert({
    entity_type: "outbound_item",
    entity_id: itemId,
    action: "updated",
    user_id: user?.id || null,
    details: {
      order_id: item.order_id,
      product_id: item.product_id,
      changes: data,
      previous: { qty_requested: item.qty_requested, unit_price: item.unit_price },
    },
  });

  return updated;
}

export async function addOutboundItem(
  orderId: string,
  data: CreateOutboundItemData
): Promise<OutboundItemWithProduct> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Check for duplicate product
  const { data: existing } = await supabase
    .from("outbound_items")
    .select("id")
    .eq("order_id", orderId)
    .eq("product_id", data.product_id)
    .maybeSingle();

  if (existing) {
    throw new Error("This product is already on the order. Edit the existing line instead.");
  }

  const { data: inserted, error } = await supabase
    .from("outbound_items")
    .insert({
      order_id: orderId,
      product_id: data.product_id,
      qty_requested: data.qty_requested,
      qty_shipped: 0,
      unit_price: data.unit_price || 0,
    })
    .select("*, product:products (id, sku, name, client_id, container_type)")
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    entity_type: "outbound_item",
    entity_id: inserted.id,
    action: "added",
    user_id: user?.id || null,
    details: {
      order_id: orderId,
      product_id: data.product_id,
      qty_requested: data.qty_requested,
    },
  });

  return inserted;
}

export async function deleteOutboundItem(itemId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch current item to check shipped qty
  const { data: item, error: itemError } = await supabase
    .from("outbound_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemError) throw new Error(itemError.message);

  if (item.qty_shipped > 0) {
    throw new Error("Cannot delete an item that has already been shipped");
  }

  const { error } = await supabase
    .from("outbound_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    entity_type: "outbound_item",
    entity_id: itemId,
    action: "deleted",
    user_id: user?.id || null,
    details: {
      order_id: item.order_id,
      product_id: item.product_id,
      qty_requested: item.qty_requested,
    },
  });
}
