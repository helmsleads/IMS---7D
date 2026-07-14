/** Default settings matching 7D portal Shopify integration. */
export const DEFAULT_SHOPIFY_INTEGRATION_SETTINGS = {
  auto_import_orders: true,
  auto_sync_inventory: false,
  auto_sync_prices: false,
  sync_inventory_interval_minutes: 60,
  inventory_buffer: 0,
  default_location_id: null as string | null,
  fulfillment_notify_customer: true,
};
