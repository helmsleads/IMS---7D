-- Add carrier, tracking, and preferred time slot columns to inbound_orders
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS carrier VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS preferred_time_slot VARCHAR(10); -- 'am' or 'pm'
