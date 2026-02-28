-- Add container_types column to supplies table
-- Allows filtering supplies by product container type (bottle, can, keg, bag_in_box, other)
-- Empty array = universal (applies to all container types)

ALTER TABLE supplies ADD COLUMN IF NOT EXISTS container_types TEXT[] DEFAULT '{}';

-- Seed box supplies (matching 7Degrees rate card)
INSERT INTO supplies (sku, name, description, category, base_price, cost, unit, is_standard, is_active, sort_order, industries, container_types)
VALUES
  ('BOX-1-BOTTLE', '1 Bottle Box', '1-bottle shipper box', 'boxes', 5.00, 2.50, 'each', true, true, 10, ARRAY['beverage'], ARRAY['bottle']),
  ('BOX-2-BOTTLE', '2 Bottle Box', '2-bottle shipper box', 'boxes', 6.00, 3.00, 'each', true, true, 20, ARRAY['beverage'], ARRAY['bottle']),
  ('BOX-3-BOTTLE', '3 Bottle Box', '3-bottle shipper box', 'boxes', 7.50, 3.75, 'each', true, true, 30, ARRAY['beverage'], ARRAY['bottle']),
  ('BOX-4-BOTTLE', '4 Bottle Box', '4-bottle shipper box', 'boxes', 9.50, 4.75, 'each', true, true, 40, ARRAY['beverage'], ARRAY['bottle']),
  ('BOX-6-BOTTLE', '6 Bottle Box', '6-bottle shipper box', 'boxes', 12.00, 6.00, 'each', true, true, 50, ARRAY['beverage'], ARRAY['bottle']),
  ('BOX-8-BOTTLE', '8 Bottle Box', '8-bottle shipper box', 'boxes', 15.00, 7.50, 'each', true, true, 60, ARRAY['beverage'], ARRAY['bottle']),
  ('BOX-12-BOTTLE', '12 Bottle Box', '12-bottle shipper box', 'boxes', 20.00, 10.00, 'each', true, true, 70, ARRAY['beverage'], ARRAY['bottle']),
  ('BOX-6-CAN', '6 Can Box', '6-can shipper box', 'boxes', 7.00, 3.50, 'each', true, true, 80, ARRAY['beverage'], ARRAY['can']),
  ('MAT-INSERT', 'Insert', 'Bottle divider insert', 'cushioning', 1.00, 0.40, 'each', true, true, 90, ARRAY['beverage'], ARRAY['bottle']),
  ('MAT-BROWN-PAPER', 'Brown Paper', 'Brown packing paper sheet', 'cushioning', 0.705, 0.30, 'each', true, true, 100, ARRAY['beverage'], ARRAY['bottle', 'can'])
ON CONFLICT (sku) DO UPDATE SET
  container_types = EXCLUDED.container_types,
  category = EXCLUDED.category,
  industries = EXCLUDED.industries;
