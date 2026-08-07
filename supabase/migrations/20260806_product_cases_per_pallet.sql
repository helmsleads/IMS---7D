-- Per-product cases-per-pallet (e.g. Casa Malka = 90) + fix inflated storage math.
-- Old formula: GREATEST(1, CEIL(cases / 60)) per inventory row → every leftover SKU = 1 pallet.
-- New formula: cases / cases_per_pallet (fractional, no 1-pallet floor).
-- Pallet count tracks qty_on_hand; it drops as stock ships out (allocation only reserves).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cases_per_pallet INTEGER NOT NULL DEFAULT 60
    CHECK (cases_per_pallet > 0);

COMMENT ON COLUMN products.cases_per_pallet IS
  'Typical cases that fit on one warehouse pallet for this SKU (default 60; e.g. 90 for dense stacking).';

-- Allow fractional pallet estimates when summing across SKUs
ALTER TABLE storage_snapshots
  ALTER COLUMN pallet_count TYPE NUMERIC USING pallet_count::NUMERIC;

DROP FUNCTION IF EXISTS take_storage_snapshot(DATE);
DROP FUNCTION IF EXISTS take_storage_snapshot(DATE, BOOLEAN);

CREATE OR REPLACE FUNCTION take_storage_snapshot(
  p_snapshot_date DATE DEFAULT CURRENT_DATE,
  p_force BOOLEAN DEFAULT FALSE
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  IF p_force THEN
    DELETE FROM storage_snapshots WHERE snapshot_date = p_snapshot_date;
  ELSIF EXISTS (SELECT 1 FROM storage_snapshots WHERE snapshot_date = p_snapshot_date LIMIT 1) THEN
    RETURN 0;
  END IF;

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
    CASE
      WHEN p.container_type = 'keg' THEN 0
      WHEN COALESCE(p.container_type, '') IN (
        'sample', 'merchandise', 'raw_materials', 'empty_bottle'
      ) THEN 0
      ELSE ROUND(
        (
          i.qty_on_hand::NUMERIC
          / GREATEST(COALESCE(p.units_per_case, 1), 1)
          / GREATEST(COALESCE(p.cases_per_pallet, 60), 1)
        )::NUMERIC,
        4
      )
    END,
    CASE
      WHEN p.container_type = 'keg' THEN i.qty_on_hand
      ELSE 0
    END,
    0,
    0,
    NOW()
  FROM inventory i
  JOIN products p ON p.id = i.product_id
  WHERE p.client_id IS NOT NULL
    AND i.qty_on_hand > 0;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION take_storage_snapshot(DATE, BOOLEAN) IS
  'Captures inventory into storage_snapshots. Pallets = cases / products.cases_per_pallet (fractional). Pass p_force=true to rebuild.';
