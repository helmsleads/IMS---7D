-- Global alcohol DTC restricted US states (editable in System Settings by admins).
INSERT INTO system_settings (category, setting_key, setting_value, description)
VALUES (
  'dtc',
  'alcohol_restricted_states',
  '["AL","AR","DE","HI","MS","RI","SD","UT"]'::jsonb,
  'US state codes where alcohol DTC shipping is not offered'
)
ON CONFLICT (category, setting_key) DO NOTHING;
