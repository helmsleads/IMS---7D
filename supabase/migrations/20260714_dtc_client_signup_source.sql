-- Track whether a warehouse client was provisioned via DTC signup or a 7D invite.
-- brand_affiliation is a free-text funnel reference only.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS signup_source TEXT;

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS brand_affiliation TEXT;

COMMENT ON COLUMN clients.signup_source IS
  'Funnel source: dtc | 7d_invitation (reference only)';

COMMENT ON COLUMN clients.brand_affiliation IS
  'Brand the contact said they belong to at signup (reference only)';

-- Pending Shopify OAuth starts initiated by DTC (no portal session cookie).
CREATE TABLE IF NOT EXISTS dtc_shopify_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  shop_domain TEXT NOT NULL,
  nonce TEXT NOT NULL UNIQUE,
  return_url TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dtc_shopify_oauth_states_nonce
  ON dtc_shopify_oauth_states(nonce);

CREATE INDEX IF NOT EXISTS idx_dtc_shopify_oauth_states_expires
  ON dtc_shopify_oauth_states(expires_at);
