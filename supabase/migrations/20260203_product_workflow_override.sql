-- =====================================================
-- PRODUCT-LEVEL WORKFLOW OVERRIDE
-- Allows clients to enable per-product workflow overrides
-- =====================================================

-- Add toggle to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS allow_product_workflow_override BOOLEAN DEFAULT false;

-- Add workflow override to products table
ALTER TABLE products
ADD COLUMN IF NOT EXISTS workflow_profile_id UUID REFERENCES workflow_profiles(id) ON DELETE SET NULL;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_workflow_profile
ON products(workflow_profile_id) WHERE workflow_profile_id IS NOT NULL;

-- Comment for documentation
COMMENT ON COLUMN clients.allow_product_workflow_override IS 'When enabled, products can have their own workflow profile instead of using the client default';
COMMENT ON COLUMN products.workflow_profile_id IS 'Optional workflow override - only used if client.allow_product_workflow_override is true';

-- Update existing records
UPDATE clients SET allow_product_workflow_override = false WHERE allow_product_workflow_override IS NULL;
