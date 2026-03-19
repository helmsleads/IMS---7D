-- FedEx tracking status fields on outbound_orders

ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS tracking_status TEXT,
  ADD COLUMN IF NOT EXISTS tracking_status_updated_at TIMESTAMPTZ;

