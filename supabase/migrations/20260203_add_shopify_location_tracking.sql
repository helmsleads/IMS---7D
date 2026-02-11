-- Migration: Add Shopify Multi-Location Tracking
-- Purpose: Enable multi-location inventory sync for Shopify integrations
-- See: SHOPIFY_MULTI_LOCATION_PLAN.md for full documentation

-- =============================================================================
-- 1. Add location tracking to client_integrations
-- =============================================================================

-- Shopify location ID for this 3PL warehouse
ALTER TABLE client_integrations
  ADD COLUMN IF NOT EXISTS shopify_location_id VARCHAR(255);

-- The name of our location in Shopify (default: "7 Degrees Co")
ALTER TABLE client_integrations
  ADD COLUMN IF NOT EXISTS shopify_location_name VARCHAR(255) DEFAULT '7 Degrees Co';

-- True if we created this location during onboarding (vs using existing)
ALTER TABLE client_integrations
  ADD COLUMN IF NOT EXISTS location_created_by_us BOOLEAN DEFAULT false;

-- Comments for documentation
COMMENT ON COLUMN client_integrations.shopify_location_id IS
  'Shopify location ID for this 3PL warehouse - inventory syncs only to this location';

COMMENT ON COLUMN client_integrations.shopify_location_name IS
  'Display name of our location in the client''s Shopify store';

COMMENT ON COLUMN client_integrations.location_created_by_us IS
  'True if we created this location during OAuth flow, false if it pre-existed';


-- =============================================================================
-- 2. Add incoming quantity tracking to product_mappings
-- =============================================================================

-- Quantity in transit from pending inbounds (not yet received)
ALTER TABLE product_mappings
  ADD COLUMN IF NOT EXISTS incoming_qty INTEGER DEFAULT 0;

-- When the incoming qty was last updated
ALTER TABLE product_mappings
  ADD COLUMN IF NOT EXISTS incoming_updated_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN product_mappings.incoming_qty IS
  'Quantity in transit from pending inbounds - synced to Shopify as metafield';

COMMENT ON COLUMN product_mappings.incoming_updated_at IS
  'Timestamp of last incoming quantity sync to Shopify';


-- =============================================================================
-- 3. Add Shopify sync tracking to inbound_orders
-- =============================================================================

-- Whether this inbound's quantities have been synced to Shopify as "incoming"
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS shopify_incoming_synced BOOLEAN DEFAULT false;

-- When the incoming sync happened
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS shopify_incoming_synced_at TIMESTAMPTZ;

-- Comments
COMMENT ON COLUMN inbound_orders.shopify_incoming_synced IS
  'True if this inbound''s expected quantities have been synced to Shopify';

COMMENT ON COLUMN inbound_orders.shopify_incoming_synced_at IS
  'Timestamp of last sync to Shopify for this inbound';


-- =============================================================================
-- 4. Create indexes for efficient lookups
-- =============================================================================

-- Index for finding integrations by Shopify location
CREATE INDEX IF NOT EXISTS idx_integrations_shopify_location
  ON client_integrations(shopify_location_id)
  WHERE platform = 'shopify' AND shopify_location_id IS NOT NULL;

-- Index for finding inbounds that need Shopify sync
CREATE INDEX IF NOT EXISTS idx_inbound_shopify_sync_pending
  ON inbound_orders(client_id, status)
  WHERE shopify_incoming_synced = false
    AND status IN ('ordered', 'in_transit', 'arrived');

-- Index for finding product mappings with incoming inventory
CREATE INDEX IF NOT EXISTS idx_product_mappings_incoming
  ON product_mappings(integration_id, incoming_qty)
  WHERE incoming_qty > 0;


-- =============================================================================
-- 5. Migration Notes
-- =============================================================================

/*
After running this migration, existing Shopify integrations will have:
- shopify_location_id = NULL (needs to be set via migration script or re-auth)
- shopify_location_name = '7 Degrees Co' (default)
- location_created_by_us = false

To migrate existing integrations, run the migration script that:
1. Fetches each active integration
2. Calls ensureShopifyLocation() to find/create location
3. Updates the integration with location details

See: SHOPIFY_MULTI_LOCATION_PLAN.md > Migration for Existing Integrations
*/
