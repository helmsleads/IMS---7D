-- Cross-login support between 7D and DTC platforms
-- Adds dtc_enabled flag to clients and dtc_user_id to user_profiles

ALTER TABLE clients ADD COLUMN IF NOT EXISTS dtc_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS dtc_user_id UUID;

COMMENT ON COLUMN clients.dtc_enabled IS 'Whether this client has DTC commerce access approved by a 7D admin';
COMMENT ON COLUMN user_profiles.dtc_user_id IS 'Corresponding DTC platform user ID for cross-login';
