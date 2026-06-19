import { createServiceClient } from "@/lib/supabase-service";
import { sendOrderDeliveredEmail } from "@/lib/api/email";

const DELIVERED_STATUS_CODES = new Set(["DE", "SP"]);

export interface OutboundDeliverySyncResult {
  updated: boolean;
  orderId?: string;
  orderNumber?: string;
  skippedReason?: string;
}

function normalizeTrackingNumber(value: string): string {
  return value.trim().toUpperCase();
}

function isDeliveredStatusCode(statusCode?: string | null): boolean {
  if (!statusCode) return false;
  return DELIVERED_STATUS_CODES.has(statusCode.trim().toUpperCase());
}

async function notifyClientsDelivered(
  order: {
    id: string;
    order_number: string;
    client_id: string | null;
    is_multi_client: boolean | null;
  }
): Promise<void> {
  const supabase = createServiceClient();
  const clientIds = new Set<string>();
  if (order.client_id) clientIds.add(order.client_id);

  if (order.is_multi_client) {
    const { data: orderItems } = await supabase
      .from("outbound_items")
      .select("product:products (client_id)")
      .eq("order_id", order.id);

    for (const item of (orderItems || []) as Array<{
      product?: { client_id?: string } | Array<{ client_id?: string }>;
    }>) {
      const product = Array.isArray(item.product) ? item.product[0] : item.product;
      if (product?.client_id) clientIds.add(product.client_id);
    }
  }

  if (clientIds.size === 0) return;

  const { data: adminUser } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  const senderId = adminUser?.id;
  if (!senderId) return;

  for (const clientId of clientIds) {
    const { data: client } = await supabase
      .from("clients")
      .select("notification_preferences")
      .eq("id", clientId)
      .single();

    const prefs =
      (client?.notification_preferences as Record<string, boolean> | null) || {};
    if (prefs.order_updates === false) continue;

    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", clientId)
      .eq("subject", "Order Updates")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationId = existingConv?.id;
    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          client_id: clientId,
          subject: "Order Updates",
          status: "open",
        })
        .select("id")
        .single();

      if (convError || !newConv) continue;
      conversationId = newConv.id;
    }

    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: `Order ${order.order_number} has been delivered.`,
      is_system: true,
    });
  }
}

/**
 * Updates tracking fields and optionally marks a ShipStation-shipped outbound order delivered.
 */
export async function syncOutboundDeliveryFromTracking(params: {
  trackingNumber: string;
  statusCode?: string | null;
  statusDescription?: string | null;
  deliveredAt?: string | null;
  source: string;
  shippingMethod?: string;
}): Promise<OutboundDeliverySyncResult> {
  const trackingNumber = params.trackingNumber?.trim();
  if (!trackingNumber) {
    return { updated: false, skippedReason: "missing_tracking_number" };
  }

  const supabase = createServiceClient();
  const normalized = normalizeTrackingNumber(trackingNumber);

  let query = supabase
    .from("outbound_orders")
    .select(
      "id, order_number, status, client_id, is_multi_client, delivered_date, shipping_method, tracking_number"
    )
    .is("delivered_date", null)
    .not("tracking_number", "is", null);

  if (params.shippingMethod) {
    query = query.eq("shipping_method", params.shippingMethod);
  }

  const { data: candidates, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const order = (candidates || []).find(
    (row) =>
      row.tracking_number &&
      normalizeTrackingNumber(row.tracking_number) === normalized
  );

  if (!order) {
    return { updated: false, skippedReason: "order_not_found" };
  }

  if (order.status === "delivered") {
    return {
      updated: false,
      orderId: order.id,
      orderNumber: order.order_number,
      skippedReason: "already_delivered",
    };
  }

  const trackingStatus =
    params.statusDescription?.trim() ||
    (params.statusCode ? `Status ${params.statusCode}` : null);
  const shouldMarkDelivered = isDeliveredStatusCode(params.statusCode);

  const update: Record<string, unknown> = {
    tracking_status_updated_at: new Date().toISOString(),
  };
  if (trackingStatus) {
    update.tracking_status = trackingStatus;
  }

  if (shouldMarkDelivered) {
    update.status = "delivered";
    update.delivered_date = params.deliveredAt || new Date().toISOString();
  }

  const { data: updatedOrder, error: updateError } = await supabase
    .from("outbound_orders")
    .update(update)
    .eq("id", order.id)
    .select("id, order_number, client_id, is_multi_client")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  await supabase.from("activity_log").insert({
    entity_type: "outbound_order",
    entity_id: order.id,
    action: shouldMarkDelivered ? "status_changed" : "tracking_updated",
    user_id: null,
    details: {
      new_status: shouldMarkDelivered ? "delivered" : order.status,
      previous_status: order.status,
      tracking_number: trackingNumber,
      status_code: params.statusCode,
      status_description: params.statusDescription,
      source: params.source,
    },
  });

  if (shouldMarkDelivered && updatedOrder) {
    sendOrderDeliveredEmail(order.id).catch((err) =>
      console.error("[outbound-delivery-sync] delivered email failed:", err)
    );
    notifyClientsDelivered(updatedOrder).catch((err) =>
      console.error("[outbound-delivery-sync] portal notification failed:", err)
    );
  }

  return {
    updated: true,
    orderId: order.id,
    orderNumber: order.order_number,
  };
}
