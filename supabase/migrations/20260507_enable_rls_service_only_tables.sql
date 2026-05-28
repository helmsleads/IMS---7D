-- Enable RLS on tables that are only accessed via service role (webhooks, FedEx API routes).
-- With RLS on and no policies for anon/authenticated, PostgREST clients cannot read/write these rows.
-- The service role bypasses RLS and continues to work unchanged.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'webhook_events'
  ) THEN
    ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

    -- Optional explicit policy (service role bypasses RLS anyway; documents intent)
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'webhook_events'
        AND policyname = 'Service role full access webhook_events'
    ) THEN
      CREATE POLICY "Service role full access webhook_events"
        ON public.webhook_events
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = 'fedex_shipment_log'
  ) THEN
    ALTER TABLE public.fedex_shipment_log ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'fedex_shipment_log'
        AND policyname = 'Service role full access fedex_shipment_log'
    ) THEN
      CREATE POLICY "Service role full access fedex_shipment_log"
        ON public.fedex_shipment_log
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;
