import { createClient } from "@/lib/supabase";
import {
  sendOrderConfirmedEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
} from "@/lib/api/email";
import { sendInternalAlert } from "@/lib/api/notifications";

export interface OutboundOrder {
  id: string;
  order_number: string;
  client_id: string | null;
  status: string;
  ship_to_address: string | null;
  notes: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  requested_at: string | null;
  confirmed_at: string | null;
  confirmed_by: string | null;
  created_at: string;
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
  };
}

export interface OutboundOrderWithClient extends OutboundOrder {
  client?: {
    id: string;
    company_name: string;
  } | null;
}

export interface OutboundOrderWithItems extends OutboundOrderWithClient {
  items: OutboundItemWithProduct[];
}

export interface CreateOutboundOrderData {
  client_id?: string | null;
  ship_to_address?: string | null;
  notes?: string | null;
  status?: string;
}

export interface CreateOutboundItemData {
  product_id: string;
  qty_requested: number;
  unit_price?: number;
}

export interface UpdateOutboundStatusFields {
  carrier?: string;
  tracking_number?: string;
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
        company_name
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

export async function createOutboundOrder(
  order: CreateOutboundOrderData,
  items: CreateOutboundItemData[]
): Promise<OutboundOrder> {
  const supabase = createClient();

  // Generate order number
  const orderNumber = `SO-${Date.now().toString(36).toUpperCase()}`;

  // Determine status and confirmation fields
  const status = order.status || "pending";
  const insertData: Record<string, unknown> = {
    order_number: orderNumber,
    client_id: order.client_id || null,
    status,
    ship_to_address: order.ship_to_address || null,
    notes: order.notes || null,
  };

  // If creating as confirmed, set confirmation fields
  if (status === "confirmed") {
    const { data: { user } } = await supabase.auth.getUser();
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
  additionalFields?: UpdateOutboundStatusFields
): Promise<OutboundOrder> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = { status };

  // Add additional fields based on status
  if (status === "confirmed") {
    const { data: { user } } = await supabase.auth.getUser();
    updateData.confirmed_at = new Date().toISOString();
    updateData.confirmed_by = user?.id || null;
  }

  if (status === "shipped") {
    updateData.shipped_date = new Date().toISOString();
    if (additionalFields?.carrier) {
      updateData.carrier = additionalFields.carrier;
    }
    if (additionalFields?.tracking_number) {
      updateData.tracking_number = additionalFields.tracking_number;
    }
  }

  if (status === "delivered") {
    updateData.delivered_date = new Date().toISOString();
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
    details: {
      new_status: status,
      ...additionalFields,
    },
  });

  // Send email notifications based on status
  if (status === "confirmed") {
    sendOrderConfirmedEmail(id).catch((err) =>
      console.error("Failed to send confirmation email:", err)
    );
  } else if (status === "shipped") {
    sendOrderShippedEmail(id).catch((err) =>
      console.error("Failed to send shipped email:", err)
    );
  } else if (status === "delivered") {
    sendOrderDeliveredEmail(id).catch((err) =>
      console.error("Failed to send delivered email:", err)
    );
  }

  return data;
}

export async function shipOutboundItem(
  itemId: string,
  qtyShipped: number,
  locationId: string
): Promise<OutboundItemWithProduct> {
  const supabase = createClient();

  // Get the item first
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

  if (qtyDiff !== 0) {
    // Update inventory (negative qty_change to reduce stock)
    const { error: inventoryError } = await supabase.rpc("update_inventory", {
      p_product_id: item.product_id,
      p_location_id: locationId,
      p_qty_change: -qtyDiff,
    });

    if (inventoryError) {
      // Rollback the item update
      await supabase
        .from("outbound_items")
        .update({ qty_shipped: item.qty_shipped })
        .eq("id", itemId);
      throw new Error(inventoryError.message);
    }

    // Log activity
    await supabase.from("activity_log").insert({
      entity_type: "outbound_item",
      entity_id: itemId,
      action: "shipped",
      details: {
        product_id: item.product_id,
        qty_shipped: qtyShipped,
        qty_diff: qtyDiff,
        location_id: locationId,
      },
    });
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
