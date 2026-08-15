-- Unmatched Shopify lines: show SKU + virtual qty without an IMS product
-- product_id becomes nullable for unmatched rows (real qty stays 0)

ALTER TABLE outbound_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE outbound_items
  ADD COLUMN IF NOT EXISTS external_sku text,
  ADD COLUMN IF NOT EXISTS external_title text,
  ADD COLUMN IF NOT EXISTS is_unmatched boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS virtual_qty integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN outbound_items.external_sku IS
  'Shopify (or other external) SKU when line is unmatched or for display';
COMMENT ON COLUMN outbound_items.external_title IS
  'Shopify (or other external) product title when unmatched';
COMMENT ON COLUMN outbound_items.is_unmatched IS
  'True when no IMS product mapping — qty_requested stays 0; virtual_qty is display-only';
COMMENT ON COLUMN outbound_items.virtual_qty IS
  'External/Shopify quantity shown for unmatched lines (not used for inventory)';

CREATE INDEX IF NOT EXISTS idx_outbound_items_unmatched
  ON outbound_items (order_id)
  WHERE is_unmatched = true;
