-- Add units_per_case to inbound_items so each line item can specify
-- how many units per case (overriding the product default)
ALTER TABLE inbound_items
  ADD COLUMN IF NOT EXISTS units_per_case integer DEFAULT NULL;
