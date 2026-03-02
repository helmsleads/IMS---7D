-- QuickBooks Online Integration
-- Entity mapping table + invoice/client columns for QB sync

CREATE TABLE IF NOT EXISTS qb_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,         -- 'customer','invoice','item','payment','expense'
  ims_entity_id TEXT NOT NULL,
  qb_entity_id TEXT NOT NULL,
  qb_sync_token TEXT,                -- QB optimistic locking token
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced', -- 'synced','pending','error'
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, ims_entity_id),
  UNIQUE(entity_type, qb_entity_id)
);

CREATE INDEX idx_qb_entity_map_type_ims ON qb_entity_map(entity_type, ims_entity_id);
CREATE INDEX idx_qb_entity_map_status ON qb_entity_map(sync_status) WHERE sync_status != 'synced';

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_invoice_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_payment_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS qb_synced_at TIMESTAMPTZ;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS qb_customer_id TEXT;

ALTER TABLE qb_entity_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can access qb_entity_map"
  ON qb_entity_map FOR ALL TO authenticated USING (true);
