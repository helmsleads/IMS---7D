import { createClient } from "@/lib/supabase";

export type ClientNotificationType =
  | "order_updates"
  | "shipment_tracking"
  | "invoice_reminders"
  | "low_stock_alerts";

export interface ClientNotificationSettings {
  order_updates: boolean;
  shipment_tracking: boolean;
  invoice_reminders: boolean;
  low_stock_alerts: boolean;
}

const DEFAULT_SETTINGS: ClientNotificationSettings = {
  order_updates: true,
  shipment_tracking: true,
  invoice_reminders: true,
  low_stock_alerts: false,
};

/**
 * Gets notification settings for a client
 * Stores settings in the clients table as JSON in notification_preferences column
 */
export async function getClientNotificationSettings(
  clientId: string
): Promise<ClientNotificationSettings> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("notification_preferences")
    .eq("id", clientId)
    .single();

  if (error) {
    console.error("Error fetching client notification settings:", error);
    return DEFAULT_SETTINGS;
  }

  // Merge with defaults to handle any new notification types
  const preferences = data?.notification_preferences as Partial<ClientNotificationSettings> | null;

  return {
    ...DEFAULT_SETTINGS,
    ...preferences,
  };
}

/**
 * Updates notification settings for a client
 */
export async function updateClientNotificationSettings(
  clientId: string,
  settings: Partial<ClientNotificationSettings>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  // Get current settings first
  const currentSettings = await getClientNotificationSettings(clientId);

  // Merge with new settings
  const updatedSettings = {
    ...currentSettings,
    ...settings,
  };

  const { error } = await supabase
    .from("clients")
    .update({ notification_preferences: updatedSettings })
    .eq("id", clientId);

  if (error) {
    console.error("Error updating client notification settings:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Updates a single notification setting for a client
 */
export async function updateClientNotificationSetting(
  clientId: string,
  notificationType: ClientNotificationType,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  return updateClientNotificationSettings(clientId, {
    [notificationType]: enabled,
  });
}
