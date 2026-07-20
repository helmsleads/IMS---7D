-- Align outbound PICK_UNIT with 2026 rate card Outgoing Handling:
--   Per unit charge $1.00 (cancels location minimum charge)
-- Do NOT use inbound-style "first unit $4.50, additional $1" tiers on outbound.
-- Location minimums ($4.50 first / $1.00 additional) are cancelled when per-unit
-- charges apply, so bill flat $1.00 per case/bottle handling unit.

UPDATE default_rate_templates
SET
  unit_price = 1.00,
  price_unit = 'per_unit',
  volume_tiers = '[]'::jsonb,
  minimum_charge = 0,
  description = 'Picking/shipping cases/bottles ($1.00/unit; location minimums cancelled by per-unit charge)'
WHERE rate_code = 'PICK_UNIT';

-- Fix client cards that inherited the incorrect inbound-style outbound tiers
UPDATE client_rate_cards
SET
  unit_price = 1.00,
  volume_tiers = '[]'::jsonb,
  minimum_charge = 0,
  updated_at = NOW()
WHERE rate_code = 'PICK_UNIT'
  AND volume_tiers IS NOT NULL
  AND jsonb_typeof(volume_tiers) = 'array'
  AND jsonb_array_length(volume_tiers) > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(volume_tiers) AS tier
    WHERE (tier->>'min_qty')::numeric = 1
      AND (tier->>'max_qty') IS NOT NULL
      AND (tier->>'max_qty')::numeric = 1
      AND (tier->>'unit_price')::numeric = 4.50
  );

-- Keep catalog service copy aligned with rate card (per-unit $1 cancels location mins)
UPDATE services
SET
  base_price = 1.00,
  price_unit = 'per_item',
  full_description = 'Handling rates for outgoing cases/bottles assessed per unit (case/bottle). Per-unit charge of $1.00 cancels location minimum charges.'
WHERE slug = 'outbound-handling'
  AND status = 'active';
