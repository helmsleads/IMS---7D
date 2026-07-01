-- Portal and legacy DTC API queries expect outbound_orders.updated_at.

ALTER TABLE public.outbound_orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

UPDATE public.outbound_orders
SET updated_at = COALESCE(
  delivered_date,
  shipped_date,
  confirmed_at,
  requested_at,
  created_at,
  now()
)
WHERE updated_at IS NULL;
