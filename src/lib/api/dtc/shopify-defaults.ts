/** Default settings for DTC-connected Shopify (shared 7D client_integrations).
 * Shopify store apps own age/ID — do not gate warehouse import on DTC verify.
 * auto_import_orders=true: webhooks create 7D outbound immediately.
 * dtc_verify_before_fulfill=false: do not forward Shopify webhooks to DTC for ID.
 * DTC checkout/embed still runs its own alcohol ID flow separately.
 */
export const DEFAULT_SHOPIFY_INTEGRATION_SETTINGS = {
  auto_import_orders: true,
  dtc_verify_before_fulfill: false,
  auto_sync_inventory: false,
  auto_sync_prices: false,
  sync_inventory_interval_minutes: 60,
  inventory_buffer: 0,
  default_location_id: null as string | null,
  fulfillment_notify_customer: true,
};
