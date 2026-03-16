-- Seed services and addons to match the 7 Degrees 2024 Rate Card
-- This replaces any existing services with the correct rate card data

-- Archive all existing services first (soft delete)
UPDATE services SET status = 'archived' WHERE status = 'active';

-- Delete existing service_addons for archived services
UPDATE service_addons SET status = 'archived'
WHERE service_id IN (SELECT id FROM services WHERE status = 'archived');

-- ============================================
-- 1. STORAGE RATES
-- ============================================
INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  'Pallet Storage',
  'pallet-storage',
  'Monthly pallet storage for cases/bottles of wine, beer, spirits & other beverages',
  'Storage rates for cases/bottles of wine, beer, spirits & other beverages are assessed per pallet. Includes secure, climate-appropriate warehouse storage with inventory tracking.',
  'Warehouse',
  '["Climate-appropriate storage", "Real-time inventory tracking", "Pallet-level visibility", "Monthly billing cycle"]'::jsonb,
  45.00,
  'per_pallet_month',
  'active',
  1
);

INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  'Barrel Storage',
  'barrel-storage',
  'Monthly barrel storage for wine, spirits & other beverages',
  'Dedicated barrel storage with proper handling and climate conditions for aging and holding inventory.',
  'Package',
  '["Dedicated barrel area", "Proper handling protocols", "Monthly billing cycle"]'::jsonb,
  100.00,
  'per_month',
  'active',
  2
);

-- ============================================
-- 2. INCOMING HANDLING
-- ============================================
INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  'Inbound Handling - Cases/Bottles',
  'inbound-handling',
  'Receiving and processing incoming cases/bottles of wine, beer, spirits & other beverages',
  'Handling rates for cases/bottles of wine, beer, spirits & other beverages are assessed per unit. First unit (case/bottle) per month is $4.50, additional units are $1.00 each.',
  'ClipboardList',
  '["Receiving & inspection", "Inventory check-in", "Putaway to storage location", "Lot tracking"]'::jsonb,
  4.50,
  'per_item',
  'active',
  3
);

-- Add addon for additional units pricing
INSERT INTO service_addons (service_id, name, slug, description, price, price_unit, status, sort_order)
VALUES (
  (SELECT id FROM services WHERE slug = 'inbound-handling' AND status = 'active'),
  'Additional Units (Cases/Bottles)',
  'inbound-additional-units',
  'Rate for each additional unit (case/bottle) after the first per month',
  1.00,
  'per_item',
  'active',
  1
);

INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  'Inbound Handling - Barrels',
  'inbound-handling-barrels',
  'Receiving and processing incoming barrels',
  'Handling rates for barrels received into the warehouse. Includes unloading, inspection, and placement.',
  'Package',
  '["Barrel receiving", "Inspection & documentation", "Placement in storage"]'::jsonb,
  100.00,
  'per_item',
  'active',
  4
);

-- ============================================
-- 3. OUTGOING HANDLING
-- ============================================
INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  'Outbound Handling - Cases/Bottles',
  'outbound-handling',
  'Picking, packing, and shipping cases/bottles of wine, beer, spirits & other beverages',
  'Handling rates for outgoing cases/bottles assessed per unit. First location per month minimum charge is $4.50, additional locations $1.00. Per unit charge of $1.00 cancels out minimum charge.',
  'Truck',
  '["Order picking", "Packing & labeling", "Shipping coordination", "BOL generation"]'::jsonb,
  4.50,
  'per_item',
  'active',
  5
);

-- Add addons for outbound pricing tiers
INSERT INTO service_addons (service_id, name, slug, description, price, price_unit, status, sort_order)
VALUES (
  (SELECT id FROM services WHERE slug = 'outbound-handling' AND status = 'active'),
  'Additional Locations (Per Month)',
  'outbound-additional-locations',
  'Minimum charge for each additional shipping location per month',
  1.00,
  'per_item',
  'active',
  1
);

INSERT INTO service_addons (service_id, name, slug, description, price, price_unit, status, sort_order)
VALUES (
  (SELECT id FROM services WHERE slug = 'outbound-handling' AND status = 'active'),
  'Per Unit Charge',
  'outbound-per-unit',
  'Per unit charge (cancels out minimum charge when volume exceeds minimum)',
  1.00,
  'per_item',
  'active',
  2
);

INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  'Outbound Handling - Barrels',
  'outbound-handling-barrels',
  'Picking and shipping barrels',
  'Handling rates for outgoing barrels. Includes retrieval from storage, preparation, and loading.',
  'Truck',
  '["Barrel retrieval", "Loading & shipping prep", "Documentation"]'::jsonb,
  50.00,
  'per_item',
  'active',
  6
);

-- ============================================
-- 4. 7DEGREES BOX RATES (Wine/Spirits 700/750ml)
-- ============================================
INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  '7Degrees Box Packaging',
  'box-packaging',
  'Repackaging of wine/spirits into branded shipping boxes (700/750ml)',
  'Rates for repackaging of wine/spirits based on 700/750ml size. Professional branded packaging for direct-to-consumer and wholesale shipments.',
  'Box',
  '["Branded 7Degrees boxes", "Professional packing", "Multiple size options", "Protective inserts"]'::jsonb,
  5.00,
  'per_item',
  'active',
  7
);

-- Box size addons
INSERT INTO service_addons (service_id, name, slug, description, price, price_unit, status, sort_order)
VALUES
  ((SELECT id FROM services WHERE slug = 'box-packaging' AND status = 'active'),
   '1 Bottle Box', '1-bottle-box', 'Single bottle shipping box (700/750ml)', 5.00, 'per_item', 'active', 1),
  ((SELECT id FROM services WHERE slug = 'box-packaging' AND status = 'active'),
   '2 Bottle Box', '2-bottle-box', 'Two bottle shipping box (700/750ml)', 6.00, 'per_item', 'active', 2),
  ((SELECT id FROM services WHERE slug = 'box-packaging' AND status = 'active'),
   '3 Bottle Box', '3-bottle-box', 'Three bottle shipping box (700/750ml)', 7.50, 'per_item', 'active', 3),
  ((SELECT id FROM services WHERE slug = 'box-packaging' AND status = 'active'),
   '4 Bottle Box', '4-bottle-box', 'Four bottle shipping box (700/750ml)', 9.50, 'per_item', 'active', 4),
  ((SELECT id FROM services WHERE slug = 'box-packaging' AND status = 'active'),
   '6 Bottle Box', '6-bottle-box', 'Six bottle shipping box (700/750ml)', 12.00, 'per_item', 'active', 5),
  ((SELECT id FROM services WHERE slug = 'box-packaging' AND status = 'active'),
   '8 Bottle Box', '8-bottle-box', 'Eight bottle shipping box (700/750ml)', 15.00, 'per_item', 'active', 6),
  ((SELECT id FROM services WHERE slug = 'box-packaging' AND status = 'active'),
   '12 Bottle Box', '12-bottle-box', 'Twelve bottle shipping box (700/750ml)', 20.00, 'per_item', 'active', 7);

-- ============================================
-- 5. 7DEGREES BOX RATES (Cans/RTDs 355ml)
-- ============================================
INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  '7Degrees Can Box Packaging',
  'can-box-packaging',
  'Repackaging of cans/RTDs into branded shipping boxes (355ml)',
  'Rates for repackaging of cans/RTDs based on 355ml size. Professional packaging for ready-to-drink products.',
  'Box',
  '["Branded 7Degrees boxes", "Can/RTD specific packaging", "Protective inserts"]'::jsonb,
  7.00,
  'per_item',
  'active',
  8
);

INSERT INTO service_addons (service_id, name, slug, description, price, price_unit, status, sort_order)
VALUES (
  (SELECT id FROM services WHERE slug = 'can-box-packaging' AND status = 'active'),
  '6 Can Box', '6-can-box', 'Six can shipping box (355ml)', 7.00, 'per_item', 'active', 1
);

-- ============================================
-- 6. FREIGHT RATES
-- ============================================
INSERT INTO services (name, slug, description, full_description, icon, features, base_price, price_unit, status, sort_order)
VALUES (
  'Freight / Shipping',
  'freight-shipping',
  'Shipping via FedEx Ground - rates vary based on destination and weight',
  'Shipping via FedEx Ground. Rates vary and are in addition to the handling and packaging rates above. 7 Degrees Co holds an alcohol shipping license for FedEx.',
  'Truck',
  '["FedEx Ground shipping", "Alcohol-licensed carrier", "Tracking included", "Rates vary by destination"]'::jsonb,
  NULL,
  'per_order',
  'active',
  9
);

-- ============================================
-- Also update default_rate_templates if table exists
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'default_rate_templates') THEN
    -- Clear existing templates
    DELETE FROM default_rate_templates;

    -- Insert rate card templates
    INSERT INTO default_rate_templates (template_name, is_default, rate_category, rate_code, rate_name, description, unit_price, price_unit, volume_tiers, minimum_charge, is_active)
    VALUES
      ('Standard', true, 'storage', 'STR-PLT', 'Pallet Storage', 'Monthly pallet storage rate', 45.00, 'per_pallet_month', '[]'::jsonb, 45.00, true),
      ('Standard', true, 'storage', 'STR-BRL', 'Barrel Storage', 'Monthly barrel storage rate', 100.00, 'per_barrel_month', '[]'::jsonb, 100.00, true),
      ('Standard', true, 'inbound', 'IN-FIRST', 'Inbound First Unit', 'First unit (case/bottle) per month', 4.50, 'per_unit', '[]'::jsonb, 4.50, true),
      ('Standard', true, 'inbound', 'IN-ADDL', 'Inbound Additional Units', 'Additional units (cases/bottles) per month', 1.00, 'per_unit', '[]'::jsonb, 0, true),
      ('Standard', true, 'inbound', 'IN-BRL', 'Inbound Barrel', 'Per barrel inbound handling', 100.00, 'per_unit', '[]'::jsonb, 100.00, true),
      ('Standard', true, 'outbound', 'OUT-FIRST', 'Outbound First Location', 'First location per month minimum charge', 4.50, 'per_location', '[]'::jsonb, 4.50, true),
      ('Standard', true, 'outbound', 'OUT-ADDL', 'Outbound Additional Locations', 'Additional locations per month', 1.00, 'per_location', '[]'::jsonb, 1.00, true),
      ('Standard', true, 'outbound', 'OUT-UNIT', 'Outbound Per Unit', 'Per unit charge (cancels minimum)', 1.00, 'per_unit', '[]'::jsonb, 0, true),
      ('Standard', true, 'outbound', 'OUT-BRL', 'Outbound Barrel', 'Per barrel outbound handling', 50.00, 'per_unit', '[]'::jsonb, 50.00, true),
      ('Standard', true, 'pack', 'BOX-1', '1 Bottle Box', 'Repackaging - 1 bottle (700/750ml)', 5.00, 'per_box', '[]'::jsonb, 0, true),
      ('Standard', true, 'pack', 'BOX-2', '2 Bottle Box', 'Repackaging - 2 bottles (700/750ml)', 6.00, 'per_box', '[]'::jsonb, 0, true),
      ('Standard', true, 'pack', 'BOX-3', '3 Bottle Box', 'Repackaging - 3 bottles (700/750ml)', 7.50, 'per_box', '[]'::jsonb, 0, true),
      ('Standard', true, 'pack', 'BOX-4', '4 Bottle Box', 'Repackaging - 4 bottles (700/750ml)', 9.50, 'per_box', '[]'::jsonb, 0, true),
      ('Standard', true, 'pack', 'BOX-6', '6 Bottle Box', 'Repackaging - 6 bottles (700/750ml)', 12.00, 'per_box', '[]'::jsonb, 0, true),
      ('Standard', true, 'pack', 'BOX-8', '8 Bottle Box', 'Repackaging - 8 bottles (700/750ml)', 15.00, 'per_box', '[]'::jsonb, 0, true),
      ('Standard', true, 'pack', 'BOX-12', '12 Bottle Box', 'Repackaging - 12 bottles (700/750ml)', 20.00, 'per_box', '[]'::jsonb, 0, true),
      ('Standard', true, 'pack', 'BOX-6CAN', '6 Can Box', 'Repackaging - 6 cans/RTDs (355ml)', 7.00, 'per_box', '[]'::jsonb, 0, true);
  END IF;
END $$;
