DROP FUNCTION IF EXISTS record_billable_event(UUID, TEXT, NUMERIC, TEXT, TEXT, DATE, TEXT);
DROP FUNCTION IF EXISTS record_billable_event(UUID, TEXT, NUMERIC, TEXT, UUID, DATE, TEXT);

CREATE OR REPLACE FUNCTION record_billable_event(
  p_client_id UUID,
  p_rate_code TEXT,
  p_quantity NUMERIC,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
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
  SELECT * INTO v_rate FROM client_rate_cards
  WHERE client_id = p_client_id AND rate_code = p_rate_code AND is_active = true LIMIT 1;

  IF v_rate IS NULL THEN
    SELECT unit_price, volume_tiers, minimum_charge INTO v_rate
    FROM default_rate_templates
    WHERE rate_code = p_rate_code AND is_active = true AND is_default = true LIMIT 1;
  END IF;

  IF v_rate IS NULL THEN
    v_unit_price := 0;
    v_total := 0;
  ELSE
    IF v_rate.volume_tiers IS NOT NULL AND jsonb_array_length(v_rate.volume_tiers) > 0 THEN
      v_period_start := date_trunc('month', p_usage_date)::date;
      SELECT COALESCE(SUM(quantity), 0) INTO v_period_qty
      FROM usage_records WHERE client_id = p_client_id AND usage_type = p_rate_code
        AND usage_date >= v_period_start
        AND usage_date <= (v_period_start + INTERVAL '1 month - 1 day')::date;

      v_total := 0;
      v_remaining := p_quantity;

      FOR v_tier IN
        SELECT (tier->>'min_qty')::numeric AS min_qty, (tier->>'max_qty')::numeric AS max_qty, (tier->>'unit_price')::numeric AS tier_price
        FROM jsonb_array_elements(v_rate.volume_tiers) AS tier ORDER BY (tier->>'min_qty')::numeric
      LOOP
        IF v_tier.max_qty IS NULL THEN
          IF v_period_qty + (p_quantity - v_remaining) < v_tier.min_qty THEN
            v_tier_qty := GREATEST(0, v_remaining - GREATEST(0, v_tier.min_qty - v_period_qty - (p_quantity - v_remaining)));
          ELSE
            v_tier_qty := v_remaining;
          END IF;
          v_total := v_total + (v_tier_qty * v_tier.tier_price);
          v_remaining := v_remaining - v_tier_qty;
        ELSE
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

      IF v_remaining > 0 THEN
        v_total := v_total + (v_remaining * v_rate.unit_price);
      END IF;
      v_unit_price := CASE WHEN p_quantity > 0 THEN v_total / p_quantity ELSE 0 END;
    ELSE
      v_unit_price := v_rate.unit_price;
      v_total := p_quantity * v_unit_price;
    END IF;

    IF v_rate.minimum_charge IS NOT NULL AND v_rate.minimum_charge > 0 THEN
      IF v_period_qty IS NULL OR v_period_qty = 0 THEN
        IF v_total < v_rate.minimum_charge THEN
          v_total := v_rate.minimum_charge;
          v_unit_price := CASE WHEN p_quantity > 0 THEN v_total / p_quantity ELSE v_rate.minimum_charge END;
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO usage_records (client_id, usage_type, quantity, unit_price, total, reference_type, reference_id, usage_date, notes, invoiced, created_at, updated_at)
  VALUES (p_client_id, p_rate_code, p_quantity, v_unit_price, v_total, p_reference_type, p_reference_id, p_usage_date, p_notes, false, NOW(), NOW())
  RETURNING id INTO v_usage_id;

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
