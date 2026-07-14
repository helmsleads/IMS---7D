-- Fix storage snapshot pallet math:
-- 1. Sample / merch / raw / empty stock is still snapshotted for qty visibility,
--    but must NOT inflate STR-PLT pallet_count (qty is often ML or loose units).
-- 2. Allow p_force to rebuild a day's snapshot (delete + re-insert).

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
      -- Kegs billed as barrels, not pallets
      WHEN p.container_type = 'keg' THEN 0
      -- Non-case inventory: keep qty for visibility, zero pallets for billing
      WHEN COALESCE(p.container_type, '') IN (
        'sample', 'merchandise', 'raw_materials', 'empty_bottle'
      ) THEN 0
      ELSE GREATEST(
        1,
        CEIL(
          i.qty_on_hand::NUMERIC
          / GREATEST(COALESCE(p.units_per_case, 1), 1)
          / 60
        )
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

-- Correct any existing snapshots that incorrectly billed samples as pallets
UPDATE storage_snapshots ss
SET pallet_count = 0
FROM products p
WHERE p.id = ss.product_id
  AND COALESCE(p.container_type, '') IN (
    'sample', 'merchandise', 'raw_materials', 'empty_bottle'
  )
  AND COALESCE(ss.pallet_count, 0) <> 0;
