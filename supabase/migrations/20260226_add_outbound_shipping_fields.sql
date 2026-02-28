-- Add recipient_name and requestor columns to outbound_orders
ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS requestor text;
