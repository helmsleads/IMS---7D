import { createClient } from "@/lib/supabase";
import { sendEmail } from "@/lib/api/email";
import { newOrderAlertEmail } from "@/lib/email-templates/new-order-alert";
import { lowStockAlertEmail } from "@/lib/email-templates/low-stock-alert";

export type NotificationType =
  | "new_order"
  | "order_shipped"
  | "low_stock"
  | "inbound_arrived";

/**
 * Gets email addresses of users who have a notification type enabled
 * @param notificationType - The type of notification
 * @returns Array of email addresses
 */
export async function getNotificationRecipients(
  notificationType: NotificationType
): Promise<string[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notification_settings")
    .select(`
      user:users (
        email
      )
    `)
    .eq("notification_type", notificationType)
    .eq("email_enabled", true);

  if (error) {
    console.error("Error fetching notification recipients:", error);
    return [];
  }

  const emails: string[] = [];

  (data || []).forEach((setting) => {
    const user = Array.isArray(setting.user) ? setting.user[0] : setting.user;
    if (user?.email) {
      emails.push(user.email);
    }
  });

  return emails;
}

/**
 * Gets notification settings for a user
 * @param userId - The user's UUID
 * @returns Object with notification type as key and enabled status as value
 */
export async function getUserNotificationSettings(
  userId: string
): Promise<Record<NotificationType, boolean>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("notification_settings")
    .select("notification_type, email_enabled")
    .eq("user_id", userId);

  if (error) {
    console.error("Error fetching user notification settings:", error);
    return {
      new_order: true,
      order_shipped: true,
      low_stock: true,
      inbound_arrived: true,
    };
  }

  // Default all to true, then override with user's settings
  const settings: Record<NotificationType, boolean> = {
    new_order: true,
    order_shipped: true,
    low_stock: true,
    inbound_arrived: true,
  };

  (data || []).forEach((setting) => {
    const type = setting.notification_type as NotificationType;
    if (type in settings) {
      settings[type] = setting.email_enabled;
    }
  });

  return settings;
}

/**
 * Updates a notification setting for a user
 * @param userId - The user's UUID
 * @param notificationType - The type of notification
 * @param enabled - Whether to enable or disable
 */
export async function updateNotificationSetting(
  userId: string,
  notificationType: NotificationType,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("notification_settings")
    .upsert(
      {
        user_id: userId,
        notification_type: notificationType,
        email_enabled: enabled,
      },
      {
        onConflict: "user_id,notification_type",
      }
    );

  if (error) {
    console.error("Error updating notification setting:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

// Type definitions for alert data
interface NewOrderAlertData {
  order: {
    id: string;
    orderNumber: string;
    createdAt: string;
    shipToAddress: string;
    shipToCity: string;
    shipToState: string;
    shipToPostalCode: string;
    isRush: boolean;
    notes?: string | null;
  };
  client: {
    companyName: string;
    contactName: string;
    email: string;
  };
  items: {
    productName: string;
    sku: string;
    qtyRequested: number;
  }[];
}

interface LowStockAlertData {
  items: {
    sku: string;
    productName: string;
    currentQty: number;
    reorderPoint: number;
    locationName?: string;
  }[];
}

interface InboundArrivedAlertData {
  orderNumber: string;
  receivedAt: string;
  itemCount: number;
  totalUnits: number;
}

interface OrderShippedAlertData {
  orderNumber: string;
  clientName: string;
  carrier: string | null;
  trackingNumber: string | null;
  itemCount: number;
  totalUnits: number;
}

type AlertData = {
  new_order: NewOrderAlertData;
  order_shipped: OrderShippedAlertData;
  low_stock: LowStockAlertData;
  inbound_arrived: InboundArrivedAlertData;
};

/**
 * Sends an internal alert to all users with this notification enabled
 * @param type - The notification type
 * @param data - The data for generating the email
 */
export async function sendInternalAlert<T extends keyof AlertData>(
  type: T,
  data: AlertData[T]
): Promise<{ success: boolean; sent: number; errors: number }> {
  const recipients = await getNotificationRecipients(type);

  if (recipients.length === 0) {
    console.log(`No recipients for ${type} notification`);
    return { success: true, sent: 0, errors: 0 };
  }

  let subject: string;
  let html: string;

  // Generate email based on type
  switch (type) {
    case "new_order": {
      const alertData = data as NewOrderAlertData;
      const email = newOrderAlertEmail(alertData);
      subject = email.subject;
      html = email.html;
      break;
    }
    case "low_stock": {
      const alertData = data as LowStockAlertData;
      const email = lowStockAlertEmail(alertData);
      subject = email.subject;
      html = email.html;
      break;
    }
    case "order_shipped": {
      const alertData = data as OrderShippedAlertData;
      subject = `Order ${alertData.orderNumber} shipped to ${alertData.clientName}`;
      html = `
        <h2>Order Shipped</h2>
        <p>Order <strong>${alertData.orderNumber}</strong> for <strong>${alertData.clientName}</strong> has been shipped.</p>
        <ul>
          <li>Items: ${alertData.itemCount}</li>
          <li>Total Units: ${alertData.totalUnits.toLocaleString()}</li>
          ${alertData.carrier ? `<li>Carrier: ${alertData.carrier}</li>` : ""}
          ${alertData.trackingNumber ? `<li>Tracking: ${alertData.trackingNumber}</li>` : ""}
        </ul>
        <p><a href="https://7degrees.co/outbound">View in System</a></p>
      `;
      break;
    }
    case "inbound_arrived": {
      const alertData = data as InboundArrivedAlertData;
      subject = `Inbound shipment ${alertData.orderNumber} received`;
      html = `
        <h2>Inbound Shipment Received</h2>
        <p>Order <strong>${alertData.orderNumber}</strong> has been received.</p>
        <ul>
          <li>Received: ${new Date(alertData.receivedAt).toLocaleString()}</li>
          <li>Items: ${alertData.itemCount}</li>
          <li>Total Units: ${alertData.totalUnits.toLocaleString()}</li>
        </ul>
        <p><a href="https://7degrees.co/inbound">View in System</a></p>
      `;
      break;
    }
    default:
      console.error(`Unknown notification type: ${type}`);
      return { success: false, sent: 0, errors: 0 };
  }

  // Send to all recipients
  let sent = 0;
  let errors = 0;

  const sendPromises = recipients.map(async (email) => {
    const result = await sendEmail(email, subject, html);
    if (result.success) {
      sent++;
    } else {
      errors++;
      console.error(`Failed to send ${type} alert to ${email}:`, result.error);
    }
  });

  await Promise.all(sendPromises);

  return { success: errors === 0, sent, errors };
}

/**
 * Send an automated order status notification to a client via the messaging system.
 * Creates or finds an "Order Updates" conversation and posts a status message.
 * Respects the client's notification_preferences.
 */
export async function sendPortalOrderNotification(params: {
  clientId: string;
  orderNumber: string;
  status: string;
  details?: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    // Check client notification preferences
    const { data: client } = await supabase
      .from("clients")
      .select("notification_preferences")
      .eq("id", params.clientId)
      .single();

    const prefs = (client?.notification_preferences as Record<string, boolean> | null) || {};
    if (prefs.order_updates === false) {
      return { success: true }; // Client opted out
    }

    // Find or create an "Order Updates" conversation for this client
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id")
      .eq("client_id", params.clientId)
      .eq("subject", "Order Updates")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .insert({
          client_id: params.clientId,
          subject: "Order Updates",
          status: "open",
        })
        .select()
        .single();

      if (convError) {
        return { success: false, error: convError.message };
      }
      conversationId = newConv.id;
    }

    // Build status message
    const statusLabels: Record<string, string> = {
      confirmed: "confirmed and queued for fulfillment",
      picking: "being picked from the warehouse",
      packed: "packed and ready for shipment",
      shipped: "shipped",
      delivered: "delivered",
      cancelled: "cancelled",
    };

    const statusText = statusLabels[params.status] || params.status;
    let message = `Order ${params.orderNumber} has been ${statusText}.`;
    if (params.details) {
      message += ` ${params.details}`;
    }

    // Get system user (first admin user) for sender_id
    const { data: adminUser } = await supabase
      .from("users")
      .select("id")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (!adminUser?.id) {
      console.warn("No admin user found for portal notification sender");
      return { success: false, error: "No admin user found to send notification" };
    }

    const senderId = adminUser.id;

    // Insert message
    const { error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        content: message,
        sender_type: "user" as const,
        sender_id: senderId,
      });

    if (msgError) {
      return { success: false, error: msgError.message };
    }

    // Update conversation last_message_at
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conversationId);

    return { success: true };
  } catch (err) {
    console.error("Failed to send portal order notification:", err);
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
