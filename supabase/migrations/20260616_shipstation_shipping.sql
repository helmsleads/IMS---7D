-- ShipStation integration fields on outbound orders
ALTER TABLE public.outbound_orders
  ADD COLUMN IF NOT EXISTS shipstation_order_id TEXT;

CREATE INDEX IF NOT EXISTS idx_outbound_orders_shipstation_order_id
  ON public.outbound_orders (shipstation_order_id)
  WHERE shipstation_order_id IS NOT NULL;
