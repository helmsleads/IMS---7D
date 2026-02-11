-- =====================================================
-- WORKFLOW BUILDER MIGRATION
-- Extends workflow_profiles with toggleable settings
-- and adds supporting tables for custom fields,
-- automations, notifications, and documents
-- =====================================================

-- =====================================================
-- 1. EXTEND workflow_profiles TABLE
-- =====================================================

-- UI Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS icon VARCHAR(50),
ADD COLUMN IF NOT EXISTS color VARCHAR(7),
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Compliance & Tracking (additional fields)
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS restricted_states TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS track_serial_numbers BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quality_inspection_required BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS quarantine_days INTEGER DEFAULT 0;

-- Inbound Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS inbound_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inbound_requires_po BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inbound_requires_appointment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inbound_auto_create_lots BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inbound_lot_format VARCHAR(100),
ADD COLUMN IF NOT EXISTS inbound_require_inspection BOOLEAN DEFAULT false;

-- Outbound Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS outbound_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS outbound_requires_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS outbound_auto_allocate BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS outbound_pick_strategy VARCHAR(20) DEFAULT 'FIFO',
ADD COLUMN IF NOT EXISTS outbound_allow_partial_shipment BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS outbound_allow_backorder BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS outbound_packing_slip_template VARCHAR(50);

-- Inventory Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS inventory_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inventory_allow_negative BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS inventory_cycle_count_frequency INTEGER,
ADD COLUMN IF NOT EXISTS inventory_reorder_alerts BOOLEAN DEFAULT false;

-- Shipping Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS shipping_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shipping_allowed_carriers TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS shipping_default_service VARCHAR(50),
ADD COLUMN IF NOT EXISTS shipping_requires_signature BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS shipping_insurance_threshold DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS shipping_hazmat_enabled BOOLEAN DEFAULT false;

-- Returns Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS returns_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS returns_allowed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS returns_window_days INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS returns_requires_rma BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS returns_auto_restock BOOLEAN DEFAULT false;

-- Billing Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS billing_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS billing_model VARCHAR(20) DEFAULT 'per_order',
ADD COLUMN IF NOT EXISTS billing_storage_rate DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS billing_pick_rate DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS billing_pack_rate DECIMAL(10,4),
ADD COLUMN IF NOT EXISTS billing_minimum_monthly DECIMAL(10,2);

-- Integration Settings
ALTER TABLE workflow_profiles
ADD COLUMN IF NOT EXISTS integration_auto_import_orders BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS integration_auto_sync_inventory BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS integration_auto_fulfill BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS integration_hold_for_review BOOLEAN DEFAULT false;

-- Add check constraint for pick strategy
ALTER TABLE workflow_profiles
DROP CONSTRAINT IF EXISTS workflow_profiles_pick_strategy_check;

ALTER TABLE workflow_profiles
ADD CONSTRAINT workflow_profiles_pick_strategy_check
CHECK (outbound_pick_strategy IN ('FEFO', 'FIFO', 'LIFO'));

-- Add check constraint for billing model
ALTER TABLE workflow_profiles
DROP CONSTRAINT IF EXISTS workflow_profiles_billing_model_check;

ALTER TABLE workflow_profiles
ADD CONSTRAINT workflow_profiles_billing_model_check
CHECK (billing_model IN ('per_order', 'per_unit', 'monthly', 'custom'));

-- =====================================================
-- 2. WORKFLOW CUSTOM FIELDS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID NOT NULL REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL,
  field_label VARCHAR(200) NOT NULL,
  field_type VARCHAR(20) NOT NULL,
  field_options JSONB, -- for select/multiselect: [{value, label}]
  applies_to VARCHAR(20) NOT NULL,
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,
  validation_regex VARCHAR(500),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workflow_custom_fields_type_check
    CHECK (field_type IN ('text', 'textarea', 'number', 'decimal', 'date', 'datetime',
                          'select', 'multiselect', 'boolean', 'file', 'image',
                          'url', 'email', 'phone', 'barcode')),
  CONSTRAINT workflow_custom_fields_applies_to_check
    CHECK (applies_to IN ('product', 'inbound', 'outbound', 'inventory', 'lot'))
);

-- Indexes for custom fields
CREATE INDEX IF NOT EXISTS idx_workflow_custom_fields_profile
ON workflow_custom_fields(workflow_profile_id);

CREATE INDEX IF NOT EXISTS idx_workflow_custom_fields_applies_to
ON workflow_custom_fields(applies_to) WHERE is_active = true;

-- =====================================================
-- 3. WORKFLOW AUTOMATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID NOT NULL REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(50) NOT NULL,
  trigger_conditions JSONB DEFAULT '{}',
  action_type VARCHAR(50) NOT NULL,
  action_config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workflow_automations_trigger_check
    CHECK (trigger_type IN ('inbound_received', 'inbound_arrived', 'outbound_created',
                            'outbound_confirmed', 'outbound_shipped', 'outbound_delivered',
                            'inventory_low', 'inventory_expired', 'return_requested',
                            'return_received')),
  CONSTRAINT workflow_automations_action_check
    CHECK (action_type IN ('send_email', 'send_sms', 'create_task', 'update_status',
                           'webhook', 'generate_document', 'add_tag'))
);

-- Indexes for automations
CREATE INDEX IF NOT EXISTS idx_workflow_automations_profile
ON workflow_automations(workflow_profile_id);

CREATE INDEX IF NOT EXISTS idx_workflow_automations_trigger
ON workflow_automations(trigger_type) WHERE is_active = true;

-- =====================================================
-- 4. WORKFLOW NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID NOT NULL REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  notify_client_email BOOLEAN DEFAULT false,
  notify_client_sms BOOLEAN DEFAULT false,
  notify_staff_email BOOLEAN DEFAULT false,
  webhook_url TEXT,
  email_template_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one notification config per event per workflow
  CONSTRAINT workflow_notifications_unique
    UNIQUE (workflow_profile_id, event_type)
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_workflow_notifications_profile
ON workflow_notifications(workflow_profile_id);

CREATE INDEX IF NOT EXISTS idx_workflow_notifications_event
ON workflow_notifications(event_type) WHERE is_active = true;

-- =====================================================
-- 5. WORKFLOW DOCUMENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_profile_id UUID NOT NULL REFERENCES workflow_profiles(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  template_name VARCHAR(200) NOT NULL,
  template_content TEXT, -- HTML template with variables
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workflow_documents_type_check
    CHECK (document_type IN ('packing_slip', 'shipping_label', 'invoice',
                             'pick_list', 'receiving_report', 'return_label'))
);

-- Indexes for documents
CREATE INDEX IF NOT EXISTS idx_workflow_documents_profile
ON workflow_documents(workflow_profile_id);

CREATE INDEX IF NOT EXISTS idx_workflow_documents_type
ON workflow_documents(document_type);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE workflow_custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_documents ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to read workflow custom fields
CREATE POLICY "Allow authenticated read workflow_custom_fields"
ON workflow_custom_fields FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to manage workflow custom fields
CREATE POLICY "Allow authenticated manage workflow_custom_fields"
ON workflow_custom_fields FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to read workflow automations
CREATE POLICY "Allow authenticated read workflow_automations"
ON workflow_automations FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to manage workflow automations
CREATE POLICY "Allow authenticated manage workflow_automations"
ON workflow_automations FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to read workflow notifications
CREATE POLICY "Allow authenticated read workflow_notifications"
ON workflow_notifications FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to manage workflow notifications
CREATE POLICY "Allow authenticated manage workflow_notifications"
ON workflow_notifications FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Policy: Allow authenticated users to read workflow documents
CREATE POLICY "Allow authenticated read workflow_documents"
ON workflow_documents FOR SELECT
TO authenticated
USING (true);

-- Policy: Allow authenticated users to manage workflow documents
CREATE POLICY "Allow authenticated manage workflow_documents"
ON workflow_documents FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- =====================================================
-- 7. UPDATE EXISTING WORKFLOW PROFILES
-- Set defaults for existing records
-- =====================================================

UPDATE workflow_profiles
SET
  sort_order = COALESCE(sort_order, 0),
  restricted_states = COALESCE(restricted_states, '{}'),
  track_serial_numbers = COALESCE(track_serial_numbers, false),
  quality_inspection_required = COALESCE(quality_inspection_required, false),
  quarantine_days = COALESCE(quarantine_days, 0),
  inbound_enabled = COALESCE(inbound_enabled, false),
  inbound_requires_po = COALESCE(inbound_requires_po, false),
  inbound_requires_appointment = COALESCE(inbound_requires_appointment, false),
  inbound_auto_create_lots = COALESCE(inbound_auto_create_lots, false),
  inbound_require_inspection = COALESCE(inbound_require_inspection, false),
  outbound_enabled = COALESCE(outbound_enabled, false),
  outbound_requires_approval = COALESCE(outbound_requires_approval, false),
  outbound_auto_allocate = COALESCE(outbound_auto_allocate, false),
  outbound_pick_strategy = COALESCE(outbound_pick_strategy, 'FIFO'),
  outbound_allow_partial_shipment = COALESCE(outbound_allow_partial_shipment, false),
  outbound_allow_backorder = COALESCE(outbound_allow_backorder, false),
  inventory_enabled = COALESCE(inventory_enabled, false),
  inventory_allow_negative = COALESCE(inventory_allow_negative, false),
  inventory_reorder_alerts = COALESCE(inventory_reorder_alerts, false),
  shipping_enabled = COALESCE(shipping_enabled, false),
  shipping_allowed_carriers = COALESCE(shipping_allowed_carriers, '{}'),
  shipping_requires_signature = COALESCE(shipping_requires_signature, false),
  shipping_hazmat_enabled = COALESCE(shipping_hazmat_enabled, false),
  returns_enabled = COALESCE(returns_enabled, false),
  returns_allowed = COALESCE(returns_allowed, false),
  returns_window_days = COALESCE(returns_window_days, 30),
  returns_requires_rma = COALESCE(returns_requires_rma, false),
  returns_auto_restock = COALESCE(returns_auto_restock, false),
  billing_enabled = COALESCE(billing_enabled, false),
  billing_model = COALESCE(billing_model, 'per_order'),
  integration_auto_import_orders = COALESCE(integration_auto_import_orders, false),
  integration_auto_sync_inventory = COALESCE(integration_auto_sync_inventory, false),
  integration_auto_fulfill = COALESCE(integration_auto_fulfill, false),
  integration_hold_for_review = COALESCE(integration_hold_for_review, false)
WHERE true;

-- =====================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE workflow_custom_fields IS 'Custom fields that can be added to products, orders, and lots per workflow';
COMMENT ON TABLE workflow_automations IS 'Automation rules triggered by workflow events';
COMMENT ON TABLE workflow_notifications IS 'Notification settings per event type per workflow';
COMMENT ON TABLE workflow_documents IS 'Document templates (packing slips, labels, etc.) per workflow';

COMMENT ON COLUMN workflow_profiles.inbound_enabled IS 'Master toggle for all inbound rules';
COMMENT ON COLUMN workflow_profiles.outbound_enabled IS 'Master toggle for all outbound rules';
COMMENT ON COLUMN workflow_profiles.inventory_enabled IS 'Master toggle for all inventory rules';
COMMENT ON COLUMN workflow_profiles.shipping_enabled IS 'Master toggle for all shipping rules';
COMMENT ON COLUMN workflow_profiles.returns_enabled IS 'Master toggle for all returns rules';
COMMENT ON COLUMN workflow_profiles.billing_enabled IS 'Master toggle for all billing rules';
COMMENT ON COLUMN workflow_profiles.outbound_pick_strategy IS 'FEFO=First Expired First Out, FIFO=First In First Out, LIFO=Last In First Out';
