-- Add created_by to outbound_orders
ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add created_by to inbound_orders
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add user_id to activity_log so every logged action records who did it
ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Index for querying activity by user
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
