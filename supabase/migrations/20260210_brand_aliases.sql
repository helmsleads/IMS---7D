-- Brand aliases: map brand strings from spreadsheet imports to client IDs
-- so future imports auto-match previously corrected brand mappings.

CREATE TABLE IF NOT EXISTS brand_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alias VARCHAR(255) NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alias)
);

CREATE INDEX IF NOT EXISTS idx_brand_aliases_alias ON brand_aliases(alias);

ALTER TABLE brand_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read brand_aliases"
ON brand_aliases FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert brand_aliases"
ON brand_aliases FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update brand_aliases"
ON brand_aliases FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated delete brand_aliases"
ON brand_aliases FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow service role all brand_aliases"
ON brand_aliases FOR ALL TO service_role USING (true);
