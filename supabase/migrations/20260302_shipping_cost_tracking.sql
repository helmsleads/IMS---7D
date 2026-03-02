-- Add shipping cost tracking columns to outbound_orders
-- shipping_cost: actual cost 7D pays (internal only, from FedEx ACCOUNT rate)
-- client_shipping_cost: retail/list rate shown to portal clients

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS client_shipping_cost NUMERIC(10,2);

COMMENT ON COLUMN outbound_orders.shipping_cost IS 'Actual shipping cost (discounted rate 7D pays). Internal only.';
COMMENT ON COLUMN outbound_orders.client_shipping_cost IS 'Retail/list shipping cost shown to portal clients.';
