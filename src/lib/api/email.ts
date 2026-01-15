import { getResend } from "@/lib/email";
import { createClient } from "@/lib/supabase";
import { orderConfirmedEmail } from "@/lib/email-templates/order-confirmed";
import { orderShippedEmail } from "@/lib/email-templates/order-shipped";
import { orderDeliveredEmail } from "@/lib/email-templates/order-delivered";

interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<SendEmailResult> {
  try {
    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: "7 Degrees Co <noreply@7degreesco.com>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Failed to send email:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * Sends order confirmation email to client
 */
export async function sendOrderConfirmedEmail(
  orderId: string
): Promise<SendEmailResult> {
  const supabase = createClient();

  // Fetch order with client and items
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      created_at,
      ship_to_address,
      ship_to_address2,
      ship_to_city,
      ship_to_state,
      ship_to_postal_code,
      ship_to_country,
      is_rush,
      notes,
      client:clients (
        id,
        company_name,
        contact_name,
        email
      ),
      items:outbound_items (
        qty_requested,
        product:products (
          name,
          sku
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("Error fetching order for email:", orderError);
    return { success: false, error: "Order not found" };
  }

  const client = Array.isArray(order.client) ? order.client[0] : order.client;
  if (!client?.email) {
    return { success: false, error: "Client email not found" };
  }

  const items = (order.items || []).map((item: {
    qty_requested: number;
    product: { name: string; sku: string } | { name: string; sku: string }[];
  }) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      productName: product?.name || "Unknown",
      sku: product?.sku || "",
      qtyRequested: item.qty_requested,
    };
  });

  const { subject, html } = orderConfirmedEmail({
    order: {
      orderNumber: order.order_number,
      createdAt: order.created_at,
      shipToAddress: order.ship_to_address,
      shipToAddress2: order.ship_to_address2,
      shipToCity: order.ship_to_city,
      shipToState: order.ship_to_state,
      shipToPostalCode: order.ship_to_postal_code,
      shipToCountry: order.ship_to_country,
      isRush: order.is_rush || false,
      notes: order.notes,
    },
    client: {
      companyName: client.company_name,
      contactName: client.contact_name,
    },
    items,
  });

  return sendEmail(client.email, subject, html);
}

/**
 * Sends order shipped email to client
 */
export async function sendOrderShippedEmail(
  orderId: string
): Promise<SendEmailResult> {
  const supabase = createClient();

  // Fetch order with client and items
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      shipped_at,
      preferred_carrier,
      tracking_number,
      ship_to_address,
      ship_to_address2,
      ship_to_city,
      ship_to_state,
      ship_to_postal_code,
      ship_to_country,
      client:clients (
        id,
        company_name,
        contact_name,
        email
      ),
      items:outbound_items (
        qty_picked,
        product:products (
          name,
          sku
        )
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("Error fetching order for email:", orderError);
    return { success: false, error: "Order not found" };
  }

  const client = Array.isArray(order.client) ? order.client[0] : order.client;
  if (!client?.email) {
    return { success: false, error: "Client email not found" };
  }

  if (!order.tracking_number || !order.preferred_carrier) {
    return { success: false, error: "Missing tracking information" };
  }

  const items = (order.items || []).map((item: {
    qty_picked: number;
    product: { name: string; sku: string } | { name: string; sku: string }[];
  }) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      productName: product?.name || "Unknown",
      sku: product?.sku || "",
      qtyShipped: item.qty_picked || 0,
    };
  });

  const { subject, html } = orderShippedEmail({
    order: {
      orderNumber: order.order_number,
      shippedAt: order.shipped_at || new Date().toISOString(),
      carrier: order.preferred_carrier,
      trackingNumber: order.tracking_number,
      shipToAddress: order.ship_to_address,
      shipToAddress2: order.ship_to_address2,
      shipToCity: order.ship_to_city,
      shipToState: order.ship_to_state,
      shipToPostalCode: order.ship_to_postal_code,
      shipToCountry: order.ship_to_country,
    },
    client: {
      companyName: client.company_name,
      contactName: client.contact_name,
    },
    items,
  });

  return sendEmail(client.email, subject, html);
}

/**
 * Sends order delivered email to client
 */
export async function sendOrderDeliveredEmail(
  orderId: string
): Promise<SendEmailResult> {
  const supabase = createClient();

  // Fetch order with client
  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      delivered_at,
      client:clients (
        id,
        company_name,
        contact_name,
        email
      )
    `)
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    console.error("Error fetching order for email:", orderError);
    return { success: false, error: "Order not found" };
  }

  const client = Array.isArray(order.client) ? order.client[0] : order.client;
  if (!client?.email) {
    return { success: false, error: "Client email not found" };
  }

  const { subject, html } = orderDeliveredEmail({
    order: {
      orderNumber: order.order_number,
      deliveredAt: order.delivered_at || new Date().toISOString(),
    },
    client: {
      companyName: client.company_name,
      contactName: client.contact_name,
    },
  });

  return sendEmail(client.email, subject, html);
}
