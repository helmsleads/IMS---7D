-- Add RLS policies for supply_usage and supply_inventory tables
-- These tables had RLS enabled but no policies, blocking all browser-client access

-- supply_usage: authenticated users can read and insert
ALTER TABLE supply_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supply_usage"
  ON supply_usage FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert supply_usage"
  ON supply_usage FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update supply_usage"
  ON supply_usage FOR UPDATE
  TO authenticated
  USING (true);

-- supply_inventory: authenticated users can read and manage
ALTER TABLE supply_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supply_inventory"
  ON supply_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert supply_inventory"
  ON supply_inventory FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update supply_inventory"
  ON supply_inventory FOR UPDATE
  TO authenticated
  USING (true);

-- supplies: ensure read access exists for authenticated users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'supplies' AND policyname = 'Authenticated users can read supplies'
  ) THEN
    CREATE POLICY "Authenticated users can read supplies"
      ON supplies FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
