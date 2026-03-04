-- Add velocity-based reorder point fields to products
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 7,
  ADD COLUMN IF NOT EXISTS velocity_reorder_enabled BOOLEAN DEFAULT false;

-- Seed velocity settings into system_settings
INSERT INTO system_settings (category, setting_key, setting_value, description)
VALUES
  ('inventory', 'velocity_window_days', '30', 'Number of days to look back when calculating shipping velocity'),
  ('inventory', 'default_lead_time_days', '7', 'Default supplier lead time in days for velocity-based reorder calculation'),
  ('inventory', 'safety_stock_multiplier', '1.5', 'Multiplier applied to velocity-based reorder point for safety stock buffer'),
  ('inventory', 'days_of_stock_alert_threshold', '14', 'Days of stock remaining that triggers an alert')
ON CONFLICT (category, setting_key) DO NOTHING;
