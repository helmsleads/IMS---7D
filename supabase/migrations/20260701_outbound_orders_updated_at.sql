-- Portal and legacy DTC API queries expect outbound_orders.updated_at.
--
-- IMPORTANT: Vercel production (ims-7-d-jl3b.vercel.app) uses Supabase project
-- qqxbhgwhrgdacekrlxzq (.env.remote). Local dev may use kmcrxtfiiueuvhcsxcft (.env).
-- Run this migration on BOTH if you use both environments:
--   node scripts/run-single-migration.mjs supabase/migrations/20260701_outbound_orders_updated_at.sql

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
