import { createServiceClient } from "@/lib/supabase-service";
import { sendEmail } from "@/lib/api/email";
import { newOrderAlertEmail } from "@/lib/email-templates/new-order-alert";
import { lowStockAlertEmail } from "@/lib/email-templates/low-stock-alert";
import type { NotificationType } from "@/lib/api/notifications";

const NOTIFICATION_TYPES: NotificationType[] = [
  "new_order",
  "order_shipped",
  "low_stock",
  "inbound_arrived",
];

const GLOBAL_KILL_SWITCH: Partial<Record<NotificationType, { category: string; key: string }>> = {
  new_order: { category: "notifications", key: "send_order_notifications" },
  inbound_arrived: { category: "notifications", key: "send_inbound_notifications" },
  low_stock: { category: "notifications", key: "send_low_stock_alerts" },
};

export interface UserNotificationSettingsRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  settings: Record<NotificationType, boolean>;
}

async function isGloballyEnabled(type: NotificationType): Promise<boolean> {
  const switchConfig = GLOBAL_KILL_SWITCH[type];
  if (!switchConfig) return true;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("system_settings")
    .select("setting_value")
    .eq("category", switchConfig.category)
    .eq("setting_key", switchConfig.key)
    .maybeSingle();

  // Missing setting defaults to enabled (matches System Settings UI defaults)
  if (!data) return true;
  return data.setting_value !== false && data.setting_value !== "false";
}

/**
 * Gets email addresses of users who have a notification type enabled.
 * Uses service role so this works reliably from API routes / cron.
 */
export async function getNotificationRecipients(
  notificationType: NotificationType
): Promise<string[]> {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("notification_settings")
    .select(`
      user:users (
        email,
        active
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
    if (user?.email && user.active !== false) {
      emails.push(user.email);
    }
  });

  return emails;
}

/**
 * Lists all internal users with their notification preferences.
 * Missing preference rows are treated as disabled (matches send behavior).
 */
export async function listAllUserNotificationSettings(): Promise<UserNotificationSettingsRow[]> {
  const supabase = createServiceClient();

  const { data: users, error: usersError } = await supabase
    .from("users")
    .select("id, name, email, role, active")
    .order("name");

  if (usersError) {
    throw new Error(usersError.message);
  }

  const { data: settings, error: settingsError } = await supabase
    .from("notification_settings")
    .select("user_id, notification_type, email_enabled");

  if (settingsError) {
    throw new Error(settingsError.message);
  }

  const byUser = new Map<string, Record<NotificationType, boolean>>();

  (settings || []).forEach((row) => {
    const type = row.notification_type as NotificationType;
    if (!NOTIFICATION_TYPES.includes(type)) return;

    if (!byUser.has(row.user_id)) {
      byUser.set(row.user_id, {
        new_order: false,
        order_shipped: false,
        low_stock: false,
        inbound_arrived: false,
      });
    }
    byUser.get(row.user_id)![type] = !!row.email_enabled;
  });

  return (users || []).map((user) => ({
    userId: user.id,
    name: user.name || user.email,
    email: user.email,
    role: user.role,
    active: user.active !== false,
    settings: byUser.get(user.id) || {
      new_order: false,
      order_shipped: false,
      low_stock: false,
      inbound_arrived: false,
    },
  }));
}

export async function updateUserNotificationSettingAdmin(
  userId: string,
  notificationType: NotificationType,
  enabled: boolean
): Promise<void> {
  if (!NOTIFICATION_TYPES.includes(notificationType)) {
    throw new Error(`Invalid notification type: ${notificationType}`);
  }

  const supabase = createServiceClient();

  const { error } = await supabase.from("notification_settings").upsert(
    {
      user_id: userId,
      notification_type: notificationType,
      email_enabled: enabled,
    },
    { onConflict: "user_id,notification_type" }
  );

  if (error) {
    throw new Error(error.message);
  }
}

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
 * Sends an internal alert to all users with this notification enabled.
 */
export async function sendInternalAlert<T extends keyof AlertData>(
  type: T,
  data: AlertData[T]
): Promise<{ success: boolean; sent: number; errors: number; skipped?: string }> {
  if (!(await isGloballyEnabled(type))) {
    console.log(`Skipping ${type} notification — disabled in system settings`);
    return { success: true, sent: 0, errors: 0, skipped: "disabled_by_system_setting" };
  }

  const recipients = await getNotificationRecipients(type);

  if (recipients.length === 0) {
    console.log(`No recipients for ${type} notification`);
    return { success: true, sent: 0, errors: 0 };
  }

  let subject: string;
  let html: string;

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

  let sent = 0;
  let errors = 0;

  await Promise.all(
    recipients.map(async (email) => {
      const result = await sendEmail(email, subject, html);
      if (result.success) {
        sent++;
      } else {
        errors++;
        console.error(`Failed to send ${type} alert to ${email}:`, result.error);
      }
    })
  );

  return { success: errors === 0, sent, errors };
}

/**
 * Load an outbound order and email staff who opted into new_order alerts.
 */
export async function sendNewOrderAlertForOrder(
  orderId: string
): Promise<{ success: boolean; sent: number; errors: number; skipped?: string; error?: string }> {
  const supabase = createServiceClient();

  const { data: order, error: orderError } = await supabase
    .from("outbound_orders")
    .select(`
      id,
      order_number,
      created_at,
      ship_to_address,
      ship_to_city,
      ship_to_state,
      ship_to_zip,
      is_rush,
      notes,
      client:clients (
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
    return {
      success: false,
      sent: 0,
      errors: 0,
      error: orderError?.message || "Order not found",
    };
  }

  const client = Array.isArray(order.client) ? order.client[0] : order.client;
  const items = (order.items || []).map((item: {
    qty_requested: number;
    product: { name?: string; sku?: string } | { name?: string; sku?: string }[] | null;
  }) => {
    const product = Array.isArray(item.product) ? item.product[0] : item.product;
    return {
      productName: product?.name || "Unknown",
      sku: product?.sku || "",
      qtyRequested: item.qty_requested,
    };
  });

  return sendInternalAlert("new_order", {
    order: {
      id: order.id,
      orderNumber: order.order_number,
      createdAt: order.created_at,
      shipToAddress: order.ship_to_address || "",
      shipToCity: order.ship_to_city || "",
      shipToState: order.ship_to_state || "",
      shipToPostalCode: order.ship_to_zip || "",
      isRush: !!order.is_rush,
      notes: order.notes,
    },
    client: {
      companyName: client?.company_name || "Unknown",
      contactName: client?.contact_name || "",
      email: client?.email || "",
    },
    items,
  });
}
