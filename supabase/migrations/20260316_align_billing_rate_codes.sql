-- Align billing rate codes with actual app usage and implement tiered pricing
-- Rate codes fired by the app:
--   Inbound:  RECEIVE_UNIT (from inbound.ts)
--   Outbound: PICK_UNIT (from outbound.ts)
--   Returns:  RETURN_PROCESS (from returns.ts)
--   Boxes:    BOX_1_BOTTLE, BOX_2_BOTTLE, ..., BOX_12_BOTTLE, BOX_6_CAN (from box-usage.ts)
--   Materials: BROWN_PAPER, INSERT (from box-usage.ts)
--   Storage:  STR-PLT, STR-BRL (calculated via calculate_storage_fees RPC)

-- ============================================
-- 1. Fix default_rate_templates to use actual rate codes
-- ============================================
DELETE FROM default_rate_templates;

INSERT INTO default_rate_templates (template_name, is_default, rate_category, rate_code, rate_name, description, unit_price, price_unit, volume_tiers, minimum_charge, is_active)
VALUES
  -- Storage (used by calculate_storage_fees)
  ('Standard', true, 'storage', 'STR-PLT', 'Pallet Storage', 'Monthly pallet storage rate ($45/pallet/month)', 45.00, 'per_pallet_month', '[]'::jsonb, 45.00, true),
  ('Standard', true, 'storage', 'STR-BRL', 'Barrel Storage', 'Monthly barrel storage rate ($100/barrel/month)', 100.00, 'per_barrel_month', '[]'::jsonb, 100.00, true),

  -- Inbound handling (fired as RECEIVE_UNIT)
  -- Volume tiers: first unit $4.50, additional $1.00
  ('Standard', true, 'inbound', 'RECEIVE_UNIT', 'Inbound Handling', 'Receiving cases/bottles ($4.50 first unit, $1.00 additional per month)',
   1.00, 'per_unit',
   '[{"min_qty": 1, "max_qty": 1, "unit_price": 4.50}, {"min_qty": 2, "max_qty": null, "unit_price": 1.00}]'::jsonb,
   4.50, true),

  -- Inbound barrel handling
  ('Standard', true, 'inbound', 'RECEIVE_BARREL', 'Inbound Barrel Handling', 'Receiving barrels ($100/barrel)', 100.00, 'per_unit', '[]'::jsonb, 100.00, true),

  -- Outbound handling (fired as PICK_UNIT)
  -- Volume tiers: first location $4.50 min, additional locations $1.00 min, per unit $1.00
  ('Standard', true, 'outbound', 'PICK_UNIT', 'Outbound Handling', 'Picking/shipping cases/bottles ($4.50 first location, $1.00/unit)',
   1.00, 'per_unit',
   '[{"min_qty": 1, "max_qty": 1, "unit_price": 4.50}, {"min_qty": 2, "max_qty": null, "unit_price": 1.00}]'::jsonb,
   4.50, true),

  -- Outbound barrel handling
  ('Standard', true, 'outbound', 'PICK_BARREL', 'Outbound Barrel Handling', 'Shipping barrels ($50/barrel)', 50.00, 'per_unit', '[]'::jsonb, 50.00, true),

  -- Returns
  ('Standard', true, 'return', 'RETURN_PROCESS', 'Return Processing', 'Processing returned items', 1.00, 'per_unit', '[]'::jsonb, 0, true),

  -- Box packaging (fired as BOX_* codes from box-usage.ts)
  ('Standard', true, 'pack', 'BOX_1_BOTTLE', '1 Bottle Box', 'Repackaging - 1 bottle (700/750ml)', 5.00, 'per_box', '[]'::jsonb, 0, true),
  ('Standard', true, 'pack', 'BOX_2_BOTTLE', '2 Bottle Box', 'Repackaging - 2 bottles (700/750ml)', 6.00, 'per_box', '[]'::jsonb, 0, true),
  ('Standard', true, 'pack', 'BOX_3_BOTTLE', '3 Bottle Box', 'Repackaging - 3 bottles (700/750ml)', 7.50, 'per_box', '[]'::jsonb, 0, true),
  ('Standard', true, 'pack', 'BOX_4_BOTTLE', '4 Bottle Box', 'Repackaging - 4 bottles (700/750ml)', 9.50, 'per_box', '[]'::jsonb, 0, true),
  ('Standard', true, 'pack', 'BOX_6_BOTTLE', '6 Bottle Box', 'Repackaging - 6 bottles (700/750ml)', 12.00, 'per_box', '[]'::jsonb, 0, true),
  ('Standard', true, 'pack', 'BOX_8_BOTTLE', '8 Bottle Box', 'Repackaging - 8 bottles (700/750ml)', 15.00, 'per_box', '[]'::jsonb, 0, true),
  ('Standard', true, 'pack', 'BOX_12_BOTTLE', '12 Bottle Box', 'Repackaging - 12 bottles (700/750ml)', 20.00, 'per_box', '[]'::jsonb, 0, true),
  ('Standard', true, 'pack', 'BOX_6_CAN', '6 Can Box', 'Repackaging - 6 cans/RTDs (355ml)', 7.00, 'per_box', '[]'::jsonb, 0, true),

  -- Packing materials
  ('Standard', true, 'supply', 'BROWN_PAPER', 'Brown Paper', 'Packing paper per sheet', 0.705, 'per_unit', '[]'::jsonb, 0, true),
  ('Standard', true, 'supply', 'INSERT', 'Insert', 'Box insert', 1.00, 'per_unit', '[]'::jsonb, 0, true);

-- ============================================
-- 2. Create/Replace record_billable_event RPC
--    Supports volume_tiers for first-unit/additional pricing
-- ============================================
CREATE OR REPLACE FUNCTION record_billable_event(
  p_client_id UUID,
  p_rate_code TEXT,
  p_quantity NUMERIC,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_usage_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_rate RECORD;
  v_unit_price NUMERIC;
  v_total NUMERIC;
  v_usage_id UUID;
  v_period_start DATE;
  v_period_qty NUMERIC;
  v_tier RECORD;
  v_remaining NUMERIC;
  v_tier_qty NUMERIC;
BEGIN
  -- Look up the client's rate card for this code
  SELECT * INTO v_rate
  FROM client_rate_cards
  WHERE client_id = p_client_id
    AND rate_code = p_rate_code
    AND is_active = true
  LIMIT 1;

  -- If no client-specific rate, fall back to default template
  IF v_rate IS NULL THEN
    SELECT unit_price, volume_tiers, minimum_charge
    INTO v_rate
    FROM default_rate_templates
    WHERE rate_code = p_rate_code
      AND is_active = true
      AND is_default = true
    LIMIT 1;
  END IF;

  -- If still no rate found, use 0 (log it but don't fail)
  IF v_rate IS NULL THEN
    v_unit_price := 0;
    v_total := 0;
  ELSE
    -- Check if volume_tiers exist and are non-empty
    IF v_rate.volume_tiers IS NOT NULL
       AND jsonb_array_length(v_rate.volume_tiers) > 0 THEN

      -- Calculate period start (first of current month)
      v_period_start := date_trunc('month', p_usage_date)::date;

      -- Get total quantity already billed this period for this rate code
      SELECT COALESCE(SUM(quantity), 0) INTO v_period_qty
      FROM usage_records
      WHERE client_id = p_client_id
        AND usage_type = p_rate_code
        AND usage_date >= v_period_start
        AND usage_date <= (v_period_start + INTERVAL '1 month - 1 day')::date;

      -- Apply tiered pricing
      v_total := 0;
      v_remaining := p_quantity;

      FOR v_tier IN
        SELECT
          (tier->>'min_qty')::numeric AS min_qty,
          (tier->>'max_qty')::numeric AS max_qty,
          (tier->>'unit_price')::numeric AS tier_price
        FROM jsonb_array_elements(v_rate.volume_tiers) AS tier
        ORDER BY (tier->>'min_qty')::numeric
      LOOP
        -- How many units fall in this tier considering previous usage
        IF v_tier.max_qty IS NULL THEN
          -- Unlimited tier: all remaining goes here
          IF v_period_qty + (p_quantity - v_remaining) < v_tier.min_qty THEN
            -- Haven't reached this tier start yet
            -- Units before this tier at previous tier price already counted
            v_tier_qty := GREATEST(0, v_remaining - GREATEST(0, v_tier.min_qty - v_period_qty - (p_quantity - v_remaining)));
          ELSE
            v_tier_qty := v_remaining;
          END IF;
          v_total := v_total + (v_tier_qty * v_tier.tier_price);
          v_remaining := v_remaining - v_tier_qty;
        ELSE
          -- Bounded tier
          DECLARE
            v_tier_capacity NUMERIC;
            v_already_in_tier NUMERIC;
            v_available NUMERIC;
          BEGIN
            v_tier_capacity := v_tier.max_qty - v_tier.min_qty + 1;
            v_already_in_tier := GREATEST(0, LEAST(v_period_qty, v_tier.max_qty) - v_tier.min_qty + 1);
            v_available := GREATEST(0, v_tier_capacity - v_already_in_tier);
            v_tier_qty := LEAST(v_remaining, v_available);
            IF v_tier_qty > 0 THEN
              v_total := v_total + (v_tier_qty * v_tier.tier_price);
              v_remaining := v_remaining - v_tier_qty;
            END IF;
          END;
        END IF;

        EXIT WHEN v_remaining <= 0;
      END LOOP;

      -- If any remaining (shouldn't happen with null max_qty), use base price
      IF v_remaining > 0 THEN
        v_total := v_total + (v_remaining * v_rate.unit_price);
      END IF;

      -- Calculate effective unit price for the record
      v_unit_price := CASE WHEN p_quantity > 0 THEN v_total / p_quantity ELSE 0 END;

    ELSE
      -- No tiers: simple flat rate
      v_unit_price := v_rate.unit_price;
      v_total := p_quantity * v_unit_price;
    END IF;

    -- Apply minimum charge if total is less
    IF v_rate.minimum_charge IS NOT NULL AND v_rate.minimum_charge > 0 THEN
      -- Only apply minimum on first usage of this code in the period
      IF v_period_qty IS NULL OR v_period_qty = 0 THEN
        IF v_total < v_rate.minimum_charge THEN
          v_total := v_rate.minimum_charge;
          v_unit_price := CASE WHEN p_quantity > 0 THEN v_total / p_quantity ELSE v_rate.minimum_charge END;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Insert usage record
  INSERT INTO usage_records (
    client_id, usage_type, quantity, unit_price, total,
    reference_type, reference_id, usage_date, notes,
    invoiced, created_at, updated_at
  ) VALUES (
    p_client_id, p_rate_code, p_quantity, v_unit_price, v_total,
    p_reference_type, p_reference_id, p_usage_date, p_notes,
    false, NOW(), NOW()
  )
  RETURNING id INTO v_usage_id;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 3. Create/Replace calculate_storage_fees RPC
--    Uses storage_snapshots + client rate cards
-- ============================================
CREATE OR REPLACE FUNCTION calculate_storage_fees(
  p_client_id UUID,
  p_period_start DATE,
  p_period_end DATE
) RETURNS TABLE(
  rate_code TEXT,
  rate_name TEXT,
  total_quantity NUMERIC,
  unit_price NUMERIC,
  price_unit TEXT,
  total_amount NUMERIC
) AS $$
DECLARE
  v_pallet_rate NUMERIC := 45.00;
  v_barrel_rate NUMERIC := 100.00;
  v_pallet_min NUMERIC := 45.00;
BEGIN
  -- Get client-specific pallet rate or use default
  SELECT cr.unit_price, cr.minimum_charge INTO v_pallet_rate, v_pallet_min
  FROM client_rate_cards cr
  WHERE cr.client_id = p_client_id
    AND cr.rate_code = 'STR-PLT'
    AND cr.is_active = true
  LIMIT 1;

  IF v_pallet_rate IS NULL THEN
    SELECT drt.unit_price, drt.minimum_charge INTO v_pallet_rate, v_pallet_min
    FROM default_rate_templates drt
    WHERE drt.rate_code = 'STR-PLT' AND drt.is_active = true
    LIMIT 1;
    v_pallet_rate := COALESCE(v_pallet_rate, 45.00);
    v_pallet_min := COALESCE(v_pallet_min, 45.00);
  END IF;

  -- Get client-specific barrel rate or use default
  SELECT cr.unit_price INTO v_barrel_rate
  FROM client_rate_cards cr
  WHERE cr.client_id = p_client_id
    AND cr.rate_code = 'STR-BRL'
    AND cr.is_active = true
  LIMIT 1;

  IF v_barrel_rate IS NULL THEN
    SELECT drt.unit_price INTO v_barrel_rate
    FROM default_rate_templates drt
    WHERE drt.rate_code = 'STR-BRL' AND drt.is_active = true
    LIMIT 1;
    v_barrel_rate := COALESCE(v_barrel_rate, 100.00);
  END IF;

  -- Calculate average pallet count from snapshots in the period
  RETURN QUERY
  SELECT
    'STR-PLT'::TEXT AS rate_code,
    'Pallet Storage'::TEXT AS rate_name,
    COALESCE(AVG(daily_pallets), 0)::NUMERIC AS total_quantity,
    v_pallet_rate AS unit_price,
    'per_pallet_month'::TEXT AS price_unit,
    GREATEST(COALESCE(AVG(daily_pallets), 0) * v_pallet_rate, v_pallet_min)::NUMERIC AS total_amount
  FROM (
    SELECT snapshot_date, SUM(pallet_count) AS daily_pallets
    FROM storage_snapshots
    WHERE client_id = p_client_id
      AND snapshot_date >= p_period_start
      AND snapshot_date <= p_period_end
    GROUP BY snapshot_date
  ) daily;

  -- Note: barrel storage would need a separate product type flag
  -- For now barrels are tracked as pallets; can be extended later

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 4. Create/Replace take_storage_snapshot RPC
--    Snapshots current inventory by client
-- ============================================
CREATE OR REPLACE FUNCTION take_storage_snapshot(
  p_snapshot_date DATE DEFAULT CURRENT_DATE
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Don't re-snapshot the same date
  IF EXISTS (SELECT 1 FROM storage_snapshots WHERE snapshot_date = p_snapshot_date LIMIT 1) THEN
    RETURN 0;
  END IF;

  -- Create snapshots from current inventory grouped by client/product/location
  INSERT INTO storage_snapshots (
    snapshot_date, client_id, product_id, location_id,
    qty_on_hand, qty_reserved, pallet_count,
    cubic_feet, weight_lbs, created_at
  )
  SELECT
    p_snapshot_date,
    p.client_id,
    i.product_id,
    i.location_id,
    i.qty_on_hand,
    i.qty_reserved,
    -- Estimate pallet count: qty_on_hand / units_per_case / cases_per_pallet (default 60 cases per pallet)
    GREATEST(1, CEIL(i.qty_on_hand::NUMERIC / GREATEST(COALESCE(p.units_per_case, 1), 1) / 60)),
    0, -- cubic_feet (not tracked yet)
    0, -- weight_lbs (not tracked yet)
    NOW()
  FROM inventory i
  JOIN products p ON p.id = i.product_id
  WHERE p.client_id IS NOT NULL
    AND i.qty_on_hand > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. Create/Replace copy_default_rates_to_client RPC
-- ============================================
CREATE OR REPLACE FUNCTION copy_default_rates_to_client(
  p_client_id UUID,
  p_template_name TEXT DEFAULT 'Standard'
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Delete existing rates for this client
  DELETE FROM client_rate_cards WHERE client_id = p_client_id;

  -- Copy from template
  INSERT INTO client_rate_cards (
    client_id, rate_category, rate_code, rate_name, description,
    unit_price, price_unit, volume_tiers, minimum_charge,
    is_active, created_at, updated_at
  )
  SELECT
    p_client_id,
    rate_category, rate_code, rate_name, description,
    unit_price, price_unit, volume_tiers, minimum_charge,
    true, NOW(), NOW()
  FROM default_rate_templates
  WHERE template_name = p_template_name
    AND is_active = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 6. Create/Replace generate_billing_run_number RPC
-- ============================================
CREATE OR REPLACE FUNCTION generate_billing_run_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_seq INTEGER;
  v_run_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');
  v_month := TO_CHAR(NOW(), 'MM');

  SELECT COALESCE(MAX(
    CASE
      WHEN run_number ~ ('^BR-' || v_year || v_month || '-\d+$')
      THEN SUBSTRING(run_number FROM '\d+$')::INTEGER
      ELSE 0
    END
  ), 0) + 1 INTO v_seq
  FROM billing_runs;

  v_run_number := 'BR-' || v_year || v_month || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN v_run_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
