-- RLS policies for damage_reports
-- This matches the pattern used in other migrations (e.g. supply_usage),
-- fixing "new row violates row-level security policy" errors for browser-client calls.

ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- DEMO NOTE:
  -- Some actions/tests may be executed without an authenticated session (anon).
  -- Add anon policies to prevent "new row violates row-level security policy".

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Authenticated users can read damage_reports'
  ) THEN
    CREATE POLICY "Authenticated users can read damage_reports"
      ON damage_reports FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Anon users can read damage_reports'
  ) THEN
    CREATE POLICY "Anon users can read damage_reports"
      ON damage_reports FOR SELECT
      TO anon
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Authenticated users can insert damage_reports'
  ) THEN
    CREATE POLICY "Authenticated users can insert damage_reports"
      ON damage_reports FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Anon users can insert damage_reports'
  ) THEN
    CREATE POLICY "Anon users can insert damage_reports"
      ON damage_reports FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Authenticated users can update damage_reports'
  ) THEN
    CREATE POLICY "Authenticated users can update damage_reports"
      ON damage_reports FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Anon users can update damage_reports'
  ) THEN
    CREATE POLICY "Anon users can update damage_reports"
      ON damage_reports FOR UPDATE
      TO anon
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Authenticated users can delete damage_reports'
  ) THEN
    CREATE POLICY "Authenticated users can delete damage_reports"
      ON damage_reports FOR DELETE
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'damage_reports'
      AND policyname = 'Anon users can delete damage_reports'
  ) THEN
    CREATE POLICY "Anon users can delete damage_reports"
      ON damage_reports FOR DELETE
      TO anon
      USING (true);
  END IF;
END $$;

