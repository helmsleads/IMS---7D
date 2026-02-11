-- Add shipping address columns to outbound_orders for Shopify integration
-- Run this in Supabase Dashboard > SQL Editor

-- Shipping address fields
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS ship_to_name TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS ship_to_company TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS ship_to_address2 TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS ship_to_country TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS ship_to_phone TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS ship_to_email TEXT;

-- External platform fields for integrations
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS external_order_id TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS external_platform TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS external_order_number TEXT;
ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES client_integrations(id);

-- Index for faster lookups by external order
CREATE INDEX IF NOT EXISTS idx_outbound_orders_external
ON outbound_orders(external_platform, external_order_id)
WHERE external_order_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN outbound_orders.external_order_id IS 'Order ID from external platform (Shopify, etc)';
COMMENT ON COLUMN outbound_orders.external_platform IS 'Source platform: shopify, tiktok, amazon, etc';
COMMENT ON COLUMN outbound_orders.integration_id IS 'Reference to client_integrations for this order';
