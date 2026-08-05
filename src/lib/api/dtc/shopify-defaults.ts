/** Default settings for DTC-connected Shopify (shared 7D client_integrations).
 * auto_import_orders=false: do not create 7D outbound until DTC verifies age/ID and pushes.
 */
export const DEFAULT_SHOPIFY_INTEGRATION_SETTINGS = {
  auto_import_orders: false,
  dtc_verify_before_fulfill: true,
  auto_sync_inventory: false,
  auto_sync_prices: false,
  sync_inventory_interval_minutes: 60,
  inventory_buffer: 0,
  default_location_id: null as string | null,
  fulfillment_notify_customer: true,
};
