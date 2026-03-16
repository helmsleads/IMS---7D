-- Add FREIGHT rate code for shipping cost billing
-- Freight is a passthrough cost (variable pricing), split proportionally across brands

INSERT INTO default_rate_templates (
  template_name, is_default, rate_category, rate_code, rate_name,
  description, unit_price, price_unit, volume_tiers, minimum_charge, is_active
)
VALUES (
  'Standard', true, 'shipping', 'FREIGHT', 'Freight / Shipping',
  'Shipping cost passthrough (variable, split by brand percentage)',
  0, 'per_order', '[]'::jsonb, 0, true
)
ON CONFLICT DO NOTHING;
