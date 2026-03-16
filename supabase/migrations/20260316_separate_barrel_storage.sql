-- Separate barrel storage from pallet storage in snapshots and billing
-- Previously, keg/barrel products were counted as pallets. This migration:
-- 1. Adds barrel_count column to storage_snapshots
-- 2. Updates take_storage_snapshot to count barrels separately (container_type = 'keg')
-- 3. Updates calculate_storage_fees to return a separate STR-BRL row for barrels

-- ============================================
-- 1. Add barrel_count column to storage_snapshots
-- ============================================
ALTER TABLE storage_snapshots
ADD COLUMN IF NOT EXISTS barrel_count NUMERIC DEFAULT 0;

-- ============================================
-- 2. Fix take_storage_snapshot RPC
--    Kegs → barrel_count (1 barrel per unit on hand)
--    Non-kegs → pallet_count (cases / 60 per pallet)
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
    qty_on_hand, qty_reserved, pallet_count, barrel_count,
    cubic_feet, weight_lbs, created_at
  )
  SELECT
    p_snapshot_date,
    p.client_id,
    i.product_id,
    i.location_id,
    i.qty_on_hand,
    i.qty_reserved,
    -- Pallet count: only for non-barrel products
    CASE
      WHEN p.container_type = 'keg' THEN 0
      ELSE GREATEST(1, CEIL(i.qty_on_hand::NUMERIC / GREATEST(COALESCE(p.units_per_case, 1), 1) / 60))
    END,
    -- Barrel count: only for barrel/keg products (1 barrel per unit)
    CASE
      WHEN p.container_type = 'keg' THEN i.qty_on_hand
      ELSE 0
    END,
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
-- 3. Fix calculate_storage_fees RPC
--    Returns separate rows for pallet (STR-PLT) and barrel (STR-BRL) storage
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
  v_barrel_min NUMERIC := 100.00;
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
  SELECT cr.unit_price, cr.minimum_charge INTO v_barrel_rate, v_barrel_min
  FROM client_rate_cards cr
  WHERE cr.client_id = p_client_id
    AND cr.rate_code = 'STR-BRL'
    AND cr.is_active = true
  LIMIT 1;

  IF v_barrel_rate IS NULL THEN
    SELECT drt.unit_price, drt.minimum_charge INTO v_barrel_rate, v_barrel_min
    FROM default_rate_templates drt
    WHERE drt.rate_code = 'STR-BRL' AND drt.is_active = true
    LIMIT 1;
    v_barrel_rate := COALESCE(v_barrel_rate, 100.00);
    v_barrel_min := COALESCE(v_barrel_min, 100.00);
  END IF;

  -- Pallet storage: average daily pallet count across the period
  -- Only charge minimum if client actually has pallets (avg > 0)
  RETURN QUERY
  SELECT
    'STR-PLT'::TEXT AS rate_code,
    'Pallet Storage'::TEXT AS rate_name,
    COALESCE(AVG(daily_pallets), 0)::NUMERIC AS total_quantity,
    v_pallet_rate AS unit_price,
    'per_pallet_month'::TEXT AS price_unit,
    CASE
      WHEN COALESCE(AVG(daily_pallets), 0) > 0
      THEN GREATEST(COALESCE(AVG(daily_pallets), 0) * v_pallet_rate, v_pallet_min)
      ELSE 0
    END::NUMERIC AS total_amount
  FROM (
    SELECT snapshot_date, SUM(pallet_count) AS daily_pallets
    FROM storage_snapshots
    WHERE client_id = p_client_id
      AND snapshot_date >= p_period_start
      AND snapshot_date <= p_period_end
    GROUP BY snapshot_date
  ) daily;

  -- Barrel storage: average daily barrel count across the period
  -- Only charge minimum if client actually has barrels (avg > 0)
  RETURN QUERY
  SELECT
    'STR-BRL'::TEXT AS rate_code,
    'Barrel Storage'::TEXT AS rate_name,
    COALESCE(AVG(daily_barrels), 0)::NUMERIC AS total_quantity,
    v_barrel_rate AS unit_price,
    'per_barrel_month'::TEXT AS price_unit,
    CASE
      WHEN COALESCE(AVG(daily_barrels), 0) > 0
      THEN GREATEST(COALESCE(AVG(daily_barrels), 0) * v_barrel_rate, v_barrel_min)
      ELSE 0
    END::NUMERIC AS total_amount
  FROM (
    SELECT snapshot_date, SUM(barrel_count) AS daily_barrels
    FROM storage_snapshots
    WHERE client_id = p_client_id
      AND snapshot_date >= p_period_start
      AND snapshot_date <= p_period_end
    GROUP BY snapshot_date
  ) daily;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
