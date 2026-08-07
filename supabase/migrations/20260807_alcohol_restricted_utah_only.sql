-- Alcohol DTC: only Utah remains blocked (hard ban). All other US states allowed,
-- including NY. Nationwide sales are booked as home-state (NY) seller-of-record.
UPDATE system_settings
SET
  setting_value = '["UT"]'::jsonb,
  description = 'US state codes where alcohol DTC shipping is not offered. Utah only (hard ban). All other states allowed; seller-of-record = NY home-state sale.',
  updated_at = now()
WHERE category = 'dtc'
  AND setting_key = 'alcohol_restricted_states';

INSERT INTO system_settings (category, setting_key, setting_value, description)
SELECT
  'dtc',
  'alcohol_restricted_states',
  '["UT"]'::jsonb,
  'US state codes where alcohol DTC shipping is not offered. Utah only (hard ban). All other states allowed; seller-of-record = NY home-state sale.'
WHERE NOT EXISTS (
  SELECT 1 FROM system_settings
  WHERE category = 'dtc' AND setting_key = 'alcohol_restricted_states'
);
