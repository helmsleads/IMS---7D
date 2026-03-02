-- Multi-client outbound orders support
-- Allows orders to contain products from multiple clients,
-- with billing split proportionally across involved clients.

-- 1. Add is_multi_client flag to outbound_orders
ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS is_multi_client boolean NOT NULL DEFAULT false;

-- 2. Index on outbound_items(product_id) for join performance
CREATE INDEX IF NOT EXISTS idx_outbound_items_product_id
  ON outbound_items (product_id);

-- 3. RPC to get order IDs where a client is involved
--    (either as primary client or via product ownership)
CREATE OR REPLACE FUNCTION get_client_order_ids(p_client_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT o.id
  FROM outbound_orders o
  WHERE o.client_id = p_client_id
  UNION
  SELECT DISTINCT oi.order_id
  FROM outbound_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE p.client_id = p_client_id;
$$;
