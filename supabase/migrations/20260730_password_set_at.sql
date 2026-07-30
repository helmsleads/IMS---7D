-- Track whether the portal user has completed first-time password setup
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;

-- Users who already accepted an invite (or have any accepted client access) are done
UPDATE user_profiles up
SET password_set_at = COALESCE(
  (
    SELECT MIN(cu.accepted_at)
    FROM client_users cu
    WHERE cu.user_id = up.id
      AND cu.accepted_at IS NOT NULL
  ),
  up.created_at
)
WHERE up.password_set_at IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM client_users cu
      WHERE cu.user_id = up.id AND cu.accepted_at IS NOT NULL
    )
    OR up.created_at < now() - interval '1 day'
  );

COMMENT ON COLUMN user_profiles.password_set_at IS 'Set when the user completes first-time password setup; null means they must set a password on first login';
