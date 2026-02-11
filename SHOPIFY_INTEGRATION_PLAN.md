# Shopify Integration Execution Plan

> **IMPORTANT FOR CLAUDE**: This is the authoritative reference for all Shopify integration work.
> Always read this file before making any Shopify-related changes. Update this file when
> implementation deviates from the plan or when new decisions are made.

---

## Maintenance Instructions

### When to Reference This Plan
- Before starting ANY Shopify integration work
- When debugging Shopify-related issues
- When adding new Shopify features
- During code reviews of Shopify changes

### How to Keep This Plan Updated

1. **Before Implementation**: Check if the planned approach still makes sense
2. **During Implementation**: Note any deviations in the Change Log below
3. **After Implementation**: Update the relevant section with actual file paths, code patterns, or architectural changes
4. **Status Tracking**: Update the Implementation Checklist as tasks complete

### Update Checklist
When making changes, update these sections as needed:
- [ ] **Change Log** - Add entry for significant deviations
- [ ] **Implementation Checklist** - Mark completed items
- [ ] **File Structure** - Update with actual file paths
- [ ] **Database Schema** - Reflect any migration changes
- [ ] **Code Examples** - Update if patterns changed significantly

---

## Change Log

| Date | Change | Reason | Files Affected |
|------|--------|--------|----------------|
| 2024-02-02 | Initial plan created | Planning phase | N/A |
| 2026-02-02 | Full implementation completed | Code implementation | All Shopify files |
| 2026-02-02 | Card import fixed | Card is default export not named | integrations/page.tsx |
| 2026-02-03 | Added Sprint 7: Production Hardening | Security audit revealed gaps | Plan update |
| 2026-02-03 | Product mapping UI completed | Was marked as future, now done | products/page.tsx |
| 2026-02-03 | Webhook cleanup on disconnect | Production hardening #28 | [integrationId]/route.ts |
| 2026-02-03 | Fulfillment sync hooked to ship flow | Production hardening #29 | outbound.ts |
| 2026-02-03 | Distributed rate limiting with Upstash | Production hardening #27 | rate-limit.ts, client.ts |
| 2026-02-03 | Token encryption at rest (AES-256-CBC) | Production hardening #26 | encryption.ts, all shopify files |
| 2026-02-03 | Scheduled inventory sync via Upstash QStash | Production hardening #30 | cron/sync-shopify-inventory/route.ts |
| 2026-02-03 | Integration tests with Vitest (61 tests) | Production hardening #31 | src/__tests__/shopify/*.test.ts |
| 2026-02-03 | Scheduled inventory sync via Vercel Cron | Production hardening #30 | cron/sync-shopify-inventory, vercel.json |
| 2026-02-03 | Multi-location Phase 1: Location Management | Support multi-warehouse Shopify stores | location-management.ts, callback, types, migration |

---

## Executive Summary

This plan outlines a complete Shopify integration for the IMS platform, enabling clients to:
- Connect their Shopify store via OAuth from the client portal
- Auto-import orders from Shopify into IMS
- Sync inventory levels from IMS back to Shopify
- Send fulfillment/tracking updates to Shopify when orders ship

**Estimated Scope**: 15-20 files, 4 database migrations, ~2500 lines of code

---

## Current Infrastructure Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Multi-tenant clients | ✅ Ready | `client_id` on all tables |
| Products per client | ✅ Ready | Products linked to clients |
| Order source tracking | ✅ Ready | `source` field exists (portal/internal/api) |
| Inventory transactions | ✅ Ready | Full audit trail |
| Email notifications | ✅ Ready | Resend integration |
| Webhook infrastructure | ❌ Missing | Need to create |
| OAuth flow | ❌ Missing | Need to create |
| External API clients | ❌ Missing | Need to create |

---

## Phase 1: Database Schema

### Migration 1: Client Integrations Table

```sql
-- 20240201_create_client_integrations.sql

CREATE TYPE integration_platform AS ENUM ('shopify', 'tiktok', 'amazon', 'ebay', 'woocommerce');
CREATE TYPE integration_status AS ENUM ('pending', 'active', 'paused', 'error', 'disconnected');

CREATE TABLE client_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  platform integration_platform NOT NULL,

  -- Shopify-specific
  shop_domain VARCHAR(255),           -- 'mystore.myshopify.com'
  shop_name VARCHAR(255),             -- Display name

  -- OAuth tokens (encrypted at rest via Supabase Vault or app-level)
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  scope TEXT,                         -- Granted OAuth scopes

  -- Webhook configuration
  webhook_secret TEXT,                -- For verifying incoming webhooks
  webhooks_registered BOOLEAN DEFAULT false,

  -- Sync configuration
  settings JSONB DEFAULT '{
    "auto_import_orders": true,
    "auto_sync_inventory": true,
    "sync_inventory_interval_minutes": 60,
    "inventory_buffer": 0,
    "default_location_id": null,
    "fulfillment_notify_customer": true
  }'::jsonb,

  -- Status tracking
  status integration_status DEFAULT 'pending',
  status_message TEXT,
  last_order_sync_at TIMESTAMPTZ,
  last_inventory_sync_at TIMESTAMPTZ,
  last_error_at TIMESTAMPTZ,
  last_error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES user_profiles(id),

  UNIQUE(client_id, platform, shop_domain)
);

-- RLS Policies
ALTER TABLE client_integrations ENABLE ROW LEVEL SECURITY;

-- Clients can view their own integrations
CREATE POLICY "Clients can view own integrations"
  ON client_integrations FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM client_users WHERE user_id = auth.uid()
    )
  );

-- Clients can insert/update their own integrations (owner/admin only)
CREATE POLICY "Client admins can manage integrations"
  ON client_integrations FOR ALL
  USING (
    client_id IN (
      SELECT client_id FROM client_users
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Staff can manage all integrations
CREATE POLICY "Staff can manage all integrations"
  ON client_integrations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND active = true)
  );

CREATE INDEX idx_client_integrations_client ON client_integrations(client_id);
CREATE INDEX idx_client_integrations_status ON client_integrations(status);
```

### Migration 2: Product Mappings Table

```sql
-- 20240202_create_product_mappings.sql

CREATE TABLE product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES client_integrations(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,

  -- External identifiers
  external_product_id VARCHAR(255) NOT NULL,  -- Shopify product ID
  external_variant_id VARCHAR(255),            -- Shopify variant ID
  external_sku VARCHAR(255),                   -- Shopify SKU
  external_barcode VARCHAR(255),               -- Shopify barcode
  external_inventory_item_id VARCHAR(255),     -- For inventory sync

  -- Sync settings
  sync_inventory BOOLEAN DEFAULT true,
  sync_price BOOLEAN DEFAULT false,

  -- Metadata
  external_title VARCHAR(500),
  external_image_url TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(integration_id, external_variant_id)
);

-- RLS inherits from parent integration
ALTER TABLE product_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mappings for their integrations"
  ON product_mappings FOR SELECT
  USING (
    integration_id IN (
      SELECT id FROM client_integrations WHERE client_id IN (
        SELECT client_id FROM client_users WHERE user_id = auth.uid()
      )
    )
  );

CREATE INDEX idx_product_mappings_integration ON product_mappings(integration_id);
CREATE INDEX idx_product_mappings_product ON product_mappings(product_id);
CREATE INDEX idx_product_mappings_external ON product_mappings(external_variant_id);
```

### Migration 3: Webhook Events Log

```sql
-- 20240203_create_webhook_events.sql

CREATE TYPE webhook_status AS ENUM ('received', 'processing', 'processed', 'failed', 'skipped');

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES client_integrations(id) ON DELETE SET NULL,

  -- Event identification
  platform integration_platform NOT NULL,
  event_type VARCHAR(100) NOT NULL,       -- 'orders/create', 'inventory_levels/update'
  event_id VARCHAR(255),                   -- Platform's event ID for deduplication

  -- Payload
  payload JSONB NOT NULL,
  headers JSONB,                           -- Store relevant headers

  -- Processing status
  status webhook_status DEFAULT 'received',
  error_message TEXT,
  retry_count INT DEFAULT 0,

  -- Timestamps
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  UNIQUE(platform, event_id)
);

-- No RLS needed - internal use only via service role
CREATE INDEX idx_webhook_events_status ON webhook_events(status, received_at);
CREATE INDEX idx_webhook_events_integration ON webhook_events(integration_id);
```

### Migration 4: Extend Outbound Orders

```sql
-- 20240204_extend_outbound_orders.sql

-- Add external order tracking
ALTER TABLE outbound_orders
  ADD COLUMN IF NOT EXISTS external_order_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS external_platform VARCHAR(50),
  ADD COLUMN IF NOT EXISTS external_order_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS integration_id UUID REFERENCES client_integrations(id);

-- Add source type for Shopify
-- Note: May need to recreate enum or use VARCHAR
ALTER TABLE outbound_orders
  ALTER COLUMN source TYPE VARCHAR(50);

CREATE INDEX idx_outbound_orders_external ON outbound_orders(external_platform, external_order_id);
```

### TypeScript Types Update

```typescript
// src/types/database.ts - additions

export type IntegrationPlatform = 'shopify' | 'tiktok' | 'amazon' | 'ebay' | 'woocommerce';
export type IntegrationStatus = 'pending' | 'active' | 'paused' | 'error' | 'disconnected';
export type WebhookStatus = 'received' | 'processing' | 'processed' | 'failed' | 'skipped';

export interface ClientIntegration {
  id: string;
  client_id: string;
  platform: IntegrationPlatform;
  shop_domain: string | null;
  shop_name: string | null;
  access_token: string | null;
  scope: string | null;
  webhook_secret: string | null;
  webhooks_registered: boolean;
  settings: {
    auto_import_orders: boolean;
    auto_sync_inventory: boolean;
    sync_inventory_interval_minutes: number;
    inventory_buffer: number;
    default_location_id: string | null;
    fulfillment_notify_customer: boolean;
    shopify_location_id?: string;
  };
  status: IntegrationStatus;
  status_message: string | null;
  last_order_sync_at: string | null;
  last_inventory_sync_at: string | null;
  last_error_at: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductMapping {
  id: string;
  integration_id: string;
  product_id: string;
  external_product_id: string;
  external_variant_id: string | null;
  external_sku: string | null;
  external_inventory_item_id: string | null;
  sync_inventory: boolean;
  external_title: string | null;
  last_synced_at: string | null;
  created_at: string;
  product?: Product;
}

export interface WebhookEvent {
  id: string;
  integration_id: string | null;
  platform: IntegrationPlatform;
  event_type: string;
  event_id: string | null;
  payload: Record<string, unknown>;
  status: WebhookStatus;
  error_message: string | null;
  retry_count: number;
  received_at: string;
  processed_at: string | null;
}

// Extend existing OutboundOrder
export interface OutboundOrder {
  // ... existing fields ...
  external_order_id?: string;
  external_platform?: string;
  external_order_number?: string;
  integration_id?: string;
}
```

---

## Phase 2: Shopify OAuth Flow

### Environment Variables

```env
# .env.local additions
SHOPIFY_CLIENT_ID=your_shopify_app_client_id
SHOPIFY_CLIENT_SECRET=your_shopify_app_client_secret
SHOPIFY_SCOPES=read_orders,write_orders,read_products,write_products,read_inventory,write_inventory,read_fulfillments,write_fulfillments
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
```

### OAuth Initiation (Portal Settings)

```typescript
// src/app/(portal)/portal/settings/integrations/page.tsx

'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useClient } from '@/lib/client-auth';
import { getClientIntegrations } from '@/lib/api/integrations';
import { ShopifyConnectButton } from '@/components/portal/ShopifyConnectButton';

export default function IntegrationsSettingsPage() {
  const { client } = useClient();
  const [integrations, setIntegrations] = useState<ClientIntegration[]>([]);

  // Load existing integrations
  useEffect(() => {
    if (client?.id) {
      getClientIntegrations(client.id).then(setIntegrations);
    }
  }, [client?.id]);

  const shopifyIntegration = integrations.find(i => i.platform === 'shopify');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Integrations</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShopifyLogo className="w-8 h-8" />
            <div>
              <CardTitle>Shopify</CardTitle>
              <p className="text-sm text-gray-500">
                Connect your Shopify store to automatically sync orders and inventory
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {shopifyIntegration ? (
            <ShopifyIntegrationStatus integration={shopifyIntegration} />
          ) : (
            <ShopifyConnectButton clientId={client?.id} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Connect Button Component

```typescript
// src/components/portal/ShopifyConnectButton.tsx

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface Props {
  clientId: string | undefined;
}

export function ShopifyConnectButton({ clientId }: Props) {
  const [shopDomain, setShopDomain] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const handleConnect = () => {
    if (!shopDomain || !clientId) return;

    setIsConnecting(true);

    // Clean up shop domain
    let cleanDomain = shopDomain
      .replace('https://', '')
      .replace('http://', '')
      .replace('.myshopify.com', '')
      .trim();

    // Redirect to OAuth initiation endpoint
    const state = btoa(JSON.stringify({ clientId, timestamp: Date.now() }));
    window.location.href = `/api/integrations/shopify/auth?shop=${cleanDomain}&state=${state}`;
  };

  if (!showInput) {
    return (
      <Button onClick={() => setShowInput(true)}>
        Connect Shopify Store
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">
          Shopify Store URL
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={shopDomain}
            onChange={(e) => setShopDomain(e.target.value)}
            placeholder="your-store"
            className="flex-1 px-3 py-2 border rounded-lg"
          />
          <span className="py-2 text-gray-500">.myshopify.com</span>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={handleConnect} disabled={!shopDomain || isConnecting}>
          {isConnecting ? 'Connecting...' : 'Connect'}
        </Button>
        <Button variant="secondary" onClick={() => setShowInput(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

### OAuth API Routes

```typescript
// src/app/api/integrations/shopify/auth/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_SCOPES = process.env.SHOPIFY_SCOPES!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
  }

  // Validate shop domain format
  const shopDomain = shop.includes('.myshopify.com')
    ? shop
    : `${shop}.myshopify.com`;

  if (!/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shopDomain)) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  // Generate nonce for CSRF protection
  const nonce = crypto.randomBytes(16).toString('hex');

  // Store nonce in cookie (short-lived)
  const response = NextResponse.redirect(
    `https://${shopDomain}/admin/oauth/authorize?` +
    new URLSearchParams({
      client_id: SHOPIFY_CLIENT_ID,
      scope: SHOPIFY_SCOPES,
      redirect_uri: `${APP_URL}/api/integrations/shopify/callback`,
      state: `${nonce}:${state}`,
    }).toString()
  );

  response.cookies.set('shopify_oauth_nonce', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  return response;
}
```

### OAuth Callback Handler

```typescript
// src/app/api/integrations/shopify/callback/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-service';
import crypto from 'crypto';

const SHOPIFY_CLIENT_ID = process.env.SHOPIFY_CLIENT_ID!;
const SHOPIFY_CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL!;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');
  const hmac = searchParams.get('hmac');

  // Validate required params
  if (!code || !shop || !state || !hmac) {
    return NextResponse.redirect(`${APP_URL}/portal/settings/integrations?error=missing_params`);
  }

  // Verify HMAC
  const params = new URLSearchParams(searchParams);
  params.delete('hmac');
  const sortedParams = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  const expectedHmac = crypto
    .createHmac('sha256', SHOPIFY_CLIENT_SECRET)
    .update(sortedParams)
    .digest('hex');

  if (hmac !== expectedHmac) {
    return NextResponse.redirect(`${APP_URL}/portal/settings/integrations?error=invalid_hmac`);
  }

  // Verify nonce
  const nonce = request.cookies.get('shopify_oauth_nonce')?.value;
  const [stateNonce, stateData] = state.split(':');

  if (!nonce || nonce !== stateNonce) {
    return NextResponse.redirect(`${APP_URL}/portal/settings/integrations?error=invalid_state`);
  }

  // Parse client ID from state
  let clientId: string;
  try {
    const decoded = JSON.parse(atob(stateData));
    clientId = decoded.clientId;
  } catch {
    return NextResponse.redirect(`${APP_URL}/portal/settings/integrations?error=invalid_state`);
  }

  // Exchange code for access token
  const tokenResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: SHOPIFY_CLIENT_ID,
      client_secret: SHOPIFY_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    console.error('Token exchange failed:', await tokenResponse.text());
    return NextResponse.redirect(`${APP_URL}/portal/settings/integrations?error=token_exchange_failed`);
  }

  const tokenData = await tokenResponse.json();

  // Get shop info
  const shopResponse = await fetch(`https://${shop}/admin/api/2024-01/shop.json`, {
    headers: { 'X-Shopify-Access-Token': tokenData.access_token },
  });
  const shopInfo = await shopResponse.json();

  // Generate webhook secret
  const webhookSecret = crypto.randomBytes(32).toString('hex');

  // Save integration to database
  const supabase = createServiceClient();

  const { data: integration, error } = await supabase
    .from('client_integrations')
    .upsert({
      client_id: clientId,
      platform: 'shopify',
      shop_domain: shop,
      shop_name: shopInfo.shop?.name || shop,
      access_token: tokenData.access_token, // Consider encrypting
      scope: tokenData.scope,
      webhook_secret: webhookSecret,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'client_id,platform,shop_domain',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to save integration:', error);
    return NextResponse.redirect(`${APP_URL}/portal/settings/integrations?error=save_failed`);
  }

  // Register webhooks
  await registerShopifyWebhooks(integration.id, shop, tokenData.access_token, webhookSecret);

  // Clear nonce cookie and redirect to success
  const response = NextResponse.redirect(
    `${APP_URL}/portal/settings/integrations?success=shopify_connected`
  );
  response.cookies.delete('shopify_oauth_nonce');

  return response;
}

async function registerShopifyWebhooks(
  integrationId: string,
  shop: string,
  accessToken: string,
  webhookSecret: string
) {
  const webhookTopics = [
    'orders/create',
    'orders/updated',
    'orders/cancelled',
    'orders/fulfilled',
  ];

  const webhookUrl = `${APP_URL}/api/webhooks/shopify/${integrationId}`;

  for (const topic of webhookTopics) {
    try {
      await fetch(`https://${shop}/admin/api/2024-01/webhooks.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookUrl,
            format: 'json',
          },
        }),
      });
    } catch (error) {
      console.error(`Failed to register webhook ${topic}:`, error);
    }
  }

  // Update integration to mark webhooks as registered
  const supabase = createServiceClient();
  await supabase
    .from('client_integrations')
    .update({ webhooks_registered: true })
    .eq('id', integrationId);
}
```

---

## Phase 3: Webhook Handling

### Webhook Endpoint

```typescript
// src/app/api/webhooks/shopify/[integrationId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase-service';
import { processShopifyOrder } from '@/lib/api/shopify/order-sync';

export async function POST(
  request: NextRequest,
  { params }: { params: { integrationId: string } }
) {
  const integrationId = params.integrationId;
  const headersList = headers();
  const hmac = headersList.get('X-Shopify-Hmac-Sha256');
  const topic = headersList.get('X-Shopify-Topic');
  const shopDomain = headersList.get('X-Shopify-Shop-Domain');

  const body = await request.text();

  // Get integration to verify webhook
  const supabase = createServiceClient();
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (!integration) {
    return new Response('Integration not found', { status: 404 });
  }

  // Verify HMAC signature
  const expectedHmac = crypto
    .createHmac('sha256', integration.webhook_secret)
    .update(body, 'utf8')
    .digest('base64');

  if (hmac !== expectedHmac) {
    console.warn(`Invalid webhook signature for ${integrationId}`);
    return new Response('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(body);

  // Log webhook event
  const { data: event } = await supabase
    .from('webhook_events')
    .upsert({
      integration_id: integrationId,
      platform: 'shopify',
      event_type: topic,
      event_id: `${shopDomain}-${topic}-${payload.id}`,
      payload,
      headers: {
        topic,
        shop_domain: shopDomain,
      },
      status: 'processing',
    }, {
      onConflict: 'platform,event_id',
      ignoreDuplicates: true,
    })
    .select()
    .single();

  // If duplicate (already processed), return OK
  if (!event) {
    return new Response('Already processed', { status: 200 });
  }

  // Process webhook based on topic
  try {
    switch (topic) {
      case 'orders/create':
        await handleOrderCreate(payload, integration);
        break;
      case 'orders/updated':
        await handleOrderUpdated(payload, integration);
        break;
      case 'orders/cancelled':
        await handleOrderCancelled(payload, integration);
        break;
      case 'orders/fulfilled':
        // Order was fulfilled externally - update our records
        await handleOrderFulfilled(payload, integration);
        break;
      default:
        console.log(`Unhandled webhook topic: ${topic}`);
    }

    // Mark as processed
    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', event.id);

  } catch (error) {
    console.error(`Webhook processing failed:`, error);

    await supabase
      .from('webhook_events')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        retry_count: event.retry_count + 1,
      })
      .eq('id', event.id);
  }

  // Always return 200 to prevent Shopify retries (we logged it)
  return new Response('OK', { status: 200 });
}

async function handleOrderCreate(
  payload: ShopifyOrder,
  integration: ClientIntegration
) {
  // Skip if already fulfilled
  if (payload.fulfillment_status === 'fulfilled') {
    return;
  }

  // Skip if order doesn't need fulfillment (digital products, etc.)
  if (!payload.fulfillable) {
    return;
  }

  // Skip draft orders or test orders based on settings
  if (payload.test || payload.source_name === 'draft_order') {
    return;
  }

  await processShopifyOrder(payload, integration);
}

async function handleOrderCancelled(
  payload: ShopifyOrder,
  integration: ClientIntegration
) {
  const supabase = createServiceClient();

  // Find the IMS order
  const { data: order } = await supabase
    .from('outbound_orders')
    .select('*')
    .eq('external_order_id', String(payload.id))
    .eq('external_platform', 'shopify')
    .single();

  if (!order) return;

  // Only cancel if not yet shipped
  if (['pending', 'allocated', 'picking', 'packing'].includes(order.status)) {
    await supabase
      .from('outbound_orders')
      .update({
        status: 'cancelled',
        notes: `${order.notes || ''}\n[Auto-cancelled from Shopify]`.trim(),
      })
      .eq('id', order.id);

    // Release any reserved inventory
    await releaseOrderReservations(order.id);
  }
}

async function handleOrderUpdated(
  payload: ShopifyOrder,
  integration: ClientIntegration
) {
  // Handle significant updates like address changes
  // Only if order not yet shipped
  const supabase = createServiceClient();

  const { data: order } = await supabase
    .from('outbound_orders')
    .select('*')
    .eq('external_order_id', String(payload.id))
    .eq('external_platform', 'shopify')
    .single();

  if (!order || !['pending', 'allocated'].includes(order.status)) return;

  // Update shipping address if changed
  const addr = payload.shipping_address;
  if (addr) {
    await supabase
      .from('outbound_orders')
      .update({
        ship_to_name: `${addr.first_name} ${addr.last_name}`.trim(),
        ship_to_company: addr.company || null,
        ship_to_address: addr.address1,
        ship_to_address2: addr.address2 || null,
        ship_to_city: addr.city,
        ship_to_state: addr.province_code,
        ship_to_postal_code: addr.zip,
        ship_to_country: addr.country_code,
        ship_to_phone: addr.phone || null,
      })
      .eq('id', order.id);
  }
}

async function handleOrderFulfilled(
  payload: ShopifyOrder,
  integration: ClientIntegration
) {
  // If order was fulfilled directly in Shopify (not through our system),
  // update our records to reflect that
  const supabase = createServiceClient();

  await supabase
    .from('outbound_orders')
    .update({
      status: 'shipped',
      notes: 'Fulfilled directly in Shopify',
    })
    .eq('external_order_id', String(payload.id))
    .eq('external_platform', 'shopify')
    .in('status', ['pending', 'allocated', 'picking', 'packing']);
}
```

---

## Phase 4: Order Import Logic

### Order Sync Module

```typescript
// src/lib/api/shopify/order-sync.ts

import { createServiceClient } from '@/lib/supabase-service';
import type { ClientIntegration, ProductMapping } from '@/types/database';

interface ShopifyOrder {
  id: number;
  name: string;          // "#1001"
  email: string;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  line_items: ShopifyLineItem[];
  shipping_address: ShopifyAddress;
  shipping_lines: ShopifyShippingLine[];
  note: string | null;
  tags: string;
  total_price: string;
  currency: string;
}

interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  sku: string;
  name: string;
  quantity: number;
  price: string;
  fulfillable_quantity: number;
  requires_shipping: boolean;
}

interface ShopifyAddress {
  first_name: string;
  last_name: string;
  company: string | null;
  address1: string;
  address2: string | null;
  city: string;
  province_code: string;
  zip: string;
  country_code: string;
  phone: string | null;
}

export async function processShopifyOrder(
  shopifyOrder: ShopifyOrder,
  integration: ClientIntegration
): Promise<void> {
  const supabase = createServiceClient();

  // Check if order already exists
  const { data: existing } = await supabase
    .from('outbound_orders')
    .select('id')
    .eq('external_order_id', String(shopifyOrder.id))
    .eq('external_platform', 'shopify')
    .single();

  if (existing) {
    console.log(`Order ${shopifyOrder.name} already exists, skipping`);
    return;
  }

  // Get product mappings for this integration
  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('*, product:products(*)')
    .eq('integration_id', integration.id);

  const mappingsByVariant = new Map<string, ProductMapping>(
    (mappings || []).map(m => [m.external_variant_id, m])
  );
  const mappingsBySku = new Map<string, ProductMapping>(
    (mappings || []).map(m => [m.external_sku?.toLowerCase(), m]).filter(([k]) => k)
  );

  // Transform line items
  const lineItems: Array<{
    product_id: string;
    qty_requested: number;
    unit_price: number;
    external_line_id: string;
    notes?: string;
  }> = [];

  const unmappedItems: string[] = [];

  for (const item of shopifyOrder.line_items) {
    // Skip non-shippable items
    if (!item.requires_shipping || item.fulfillable_quantity <= 0) {
      continue;
    }

    // Find mapping by variant ID first, then by SKU
    let mapping = mappingsByVariant.get(String(item.variant_id));
    if (!mapping && item.sku) {
      mapping = mappingsBySku.get(item.sku.toLowerCase());
    }

    if (!mapping) {
      unmappedItems.push(`${item.sku || 'No SKU'}: ${item.name}`);
      continue;
    }

    lineItems.push({
      product_id: mapping.product_id,
      qty_requested: item.fulfillable_quantity,
      unit_price: parseFloat(item.price),
      external_line_id: String(item.id),
    });
  }

  // If all items are unmapped, create order with warning
  if (lineItems.length === 0 && unmappedItems.length > 0) {
    console.warn(`Order ${shopifyOrder.name} has no mapped products:`, unmappedItems);
    // Could create alert or notification here
    return;
  }

  const addr = shopifyOrder.shipping_address;
  const shippingMethod = shopifyOrder.shipping_lines[0]?.title || 'Standard';

  // Determine priority based on tags or shipping method
  const isRush =
    shopifyOrder.tags?.toLowerCase().includes('rush') ||
    shippingMethod.toLowerCase().includes('express') ||
    shippingMethod.toLowerCase().includes('overnight');

  // Create the order
  const { data: order, error: orderError } = await supabase
    .from('outbound_orders')
    .insert({
      client_id: integration.client_id,
      order_number: `SH-${shopifyOrder.name.replace('#', '')}`,
      external_order_id: String(shopifyOrder.id),
      external_platform: 'shopify',
      external_order_number: shopifyOrder.name,
      integration_id: integration.id,
      source: 'shopify',
      status: 'pending',

      // Shipping info
      ship_to_name: `${addr.first_name} ${addr.last_name}`.trim(),
      ship_to_company: addr.company,
      ship_to_address: addr.address1,
      ship_to_address2: addr.address2,
      ship_to_city: addr.city,
      ship_to_state: addr.province_code,
      ship_to_postal_code: addr.zip,
      ship_to_country: addr.country_code,
      ship_to_phone: addr.phone,
      ship_to_email: shopifyOrder.email,

      // Order details
      preferred_carrier: null,
      is_rush: isRush,
      notes: [
        shopifyOrder.note,
        unmappedItems.length > 0
          ? `Warning: ${unmappedItems.length} item(s) could not be mapped`
          : null,
      ].filter(Boolean).join('\n') || null,

      requested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (orderError) {
    throw new Error(`Failed to create order: ${orderError.message}`);
  }

  // Create line items
  if (lineItems.length > 0) {
    const { error: itemsError } = await supabase
      .from('outbound_items')
      .insert(
        lineItems.map(item => ({
          order_id: order.id,
          product_id: item.product_id,
          qty_requested: item.qty_requested,
          unit_price: item.unit_price,
        }))
      );

    if (itemsError) {
      console.error('Failed to create order items:', itemsError);
      // Order was created, items failed - don't throw, but log for review
    }
  }

  // Send internal notification
  await sendNewOrderNotification(order, integration.shop_name || 'Shopify');

  console.log(`Created order ${order.order_number} from Shopify ${shopifyOrder.name}`);
}

async function sendNewOrderNotification(order: any, source: string) {
  // Use existing notification system
  const supabase = createServiceClient();

  await supabase.from('alerts').insert({
    type: 'new_order',
    severity: 'info',
    title: `New ${source} Order`,
    message: `Order ${order.order_number} received from ${source}`,
    reference_type: 'outbound_order',
    reference_id: order.id,
  });
}
```

---

## Phase 5: Fulfillment Sync (IMS → Shopify)

### Fulfillment Module

```typescript
// src/lib/api/shopify/fulfillment-sync.ts

import { createServiceClient } from '@/lib/supabase-service';
import { createShopifyClient } from './client';

export async function syncFulfillmentToShopify(
  orderId: string,
  trackingNumber: string,
  carrier: string,
  trackingUrl?: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get order with integration details
  const { data: order } = await supabase
    .from('outbound_orders')
    .select(`
      *,
      integration:client_integrations(*)
    `)
    .eq('id', orderId)
    .single();

  if (!order?.external_order_id || !order.integration) {
    console.log('Order not linked to Shopify, skipping fulfillment sync');
    return;
  }

  const integration = order.integration;
  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: integration.access_token,
  });

  try {
    // Get fulfillment orders for this order
    const fulfillmentOrdersResponse = await client.get<{ fulfillment_orders: any[] }>(
      `/orders/${order.external_order_id}/fulfillment_orders.json`
    );

    const openFulfillmentOrder = fulfillmentOrdersResponse.fulfillment_orders.find(
      fo => fo.status === 'open' || fo.status === 'in_progress'
    );

    if (!openFulfillmentOrder) {
      console.log('No open fulfillment order found in Shopify');
      return;
    }

    // Create fulfillment
    await client.post('/fulfillments.json', {
      fulfillment: {
        line_items_by_fulfillment_order: [
          {
            fulfillment_order_id: openFulfillmentOrder.id,
          },
        ],
        tracking_info: {
          number: trackingNumber,
          company: mapCarrierToShopify(carrier),
          url: trackingUrl,
        },
        notify_customer: integration.settings?.fulfillment_notify_customer ?? true,
      },
    });

    // Update integration last sync time
    await supabase
      .from('client_integrations')
      .update({
        last_order_sync_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    console.log(`Synced fulfillment to Shopify for order ${order.order_number}`);
  } catch (error) {
    console.error('Failed to sync fulfillment to Shopify:', error);

    // Log error to integration
    await supabase
      .from('client_integrations')
      .update({
        last_error_at: new Date().toISOString(),
        last_error_message: error instanceof Error ? error.message : 'Fulfillment sync failed',
      })
      .eq('id', integration.id);

    throw error;
  }
}

function mapCarrierToShopify(carrier: string): string {
  const carrierMap: Record<string, string> = {
    'UPS': 'UPS',
    'USPS': 'USPS',
    'FedEx': 'FedEx',
    'DHL': 'DHL Express',
    'DHL Express': 'DHL Express',
    'OnTrac': 'OnTrac',
    'LaserShip': 'LaserShip',
  };

  return carrierMap[carrier] || carrier;
}
```

### Hook into Existing Ship Flow

```typescript
// src/lib/api/outbound.ts - Add to existing updateOutboundOrderStatus function

import { syncFulfillmentToShopify } from './shopify/fulfillment-sync';

export async function updateOutboundOrderStatus(
  orderId: string,
  status: string,
  additionalData?: {
    tracking_number?: string;
    carrier?: string;
    tracking_url?: string;
  }
): Promise<void> {
  const supabase = createClient();

  // Existing update logic...
  const { data: order, error } = await supabase
    .from('outbound_orders')
    .update({
      status,
      ...additionalData,
      shipped_date: status === 'shipped' ? new Date().toISOString() : undefined,
    })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;

  // If order was shipped and has tracking, sync to Shopify
  if (
    status === 'shipped' &&
    order.external_platform === 'shopify' &&
    additionalData?.tracking_number
  ) {
    try {
      await syncFulfillmentToShopify(
        orderId,
        additionalData.tracking_number,
        additionalData.carrier || 'Other',
        additionalData.tracking_url
      );
    } catch (error) {
      // Log but don't fail the status update
      console.error('Failed to sync fulfillment to Shopify:', error);
    }
  }

  // Existing email notification logic...
}
```

---

## Phase 6: Inventory Sync (IMS → Shopify)

### Inventory Sync Module

```typescript
// src/lib/api/shopify/inventory-sync.ts

import { createServiceClient } from '@/lib/supabase-service';
import { createShopifyClient } from './client';

interface SyncResult {
  updated: number;
  failed: number;
  errors: Array<{ productId: string; error: string }>;
}

export async function syncInventoryToShopify(
  integrationId: string,
  productIds?: string[]
): Promise<SyncResult> {
  const supabase = createServiceClient();

  // Get integration
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single();

  if (!integration || integration.status !== 'active') {
    throw new Error('Integration not found or inactive');
  }

  // Get product mappings with inventory sync enabled
  let query = supabase
    .from('product_mappings')
    .select(`
      *,
      product:products(
        id,
        sku,
        inventory:inventory(qty_on_hand, qty_reserved)
      )
    `)
    .eq('integration_id', integrationId)
    .eq('sync_inventory', true);

  if (productIds?.length) {
    query = query.in('product_id', productIds);
  }

  const { data: mappings } = await query;

  if (!mappings?.length) {
    return { updated: 0, failed: 0, errors: [] };
  }

  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: integration.access_token,
  });

  const locationId = integration.settings?.shopify_location_id;
  if (!locationId) {
    throw new Error('Shopify location ID not configured');
  }

  const results: SyncResult = { updated: 0, failed: 0, errors: [] };
  const inventoryBuffer = integration.settings?.inventory_buffer || 0;

  for (const mapping of mappings) {
    if (!mapping.external_inventory_item_id) continue;

    try {
      // Calculate available quantity
      const inventory = mapping.product?.inventory || [];
      const totalOnHand = inventory.reduce((sum, inv) => sum + (inv.qty_on_hand || 0), 0);
      const totalReserved = inventory.reduce((sum, inv) => sum + (inv.qty_reserved || 0), 0);
      const available = Math.max(0, totalOnHand - totalReserved - inventoryBuffer);

      // Update Shopify inventory
      await client.post('/inventory_levels/set.json', {
        location_id: locationId,
        inventory_item_id: mapping.external_inventory_item_id,
        available,
      });

      // Update last synced timestamp
      await supabase
        .from('product_mappings')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', mapping.id);

      results.updated++;

      // Rate limit protection
      await sleep(250);
    } catch (error) {
      results.failed++;
      results.errors.push({
        productId: mapping.product_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Update integration sync timestamp
  await supabase
    .from('client_integrations')
    .update({ last_inventory_sync_at: new Date().toISOString() })
    .eq('id', integrationId);

  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### Scheduled Sync via Edge Function

```typescript
// supabase/functions/sync-shopify-inventory/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  // This function is called on a schedule (e.g., every hour)
  // via Supabase cron or external scheduler

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active Shopify integrations with auto-sync enabled
  const { data: integrations } = await supabase
    .from('client_integrations')
    .select('id, client_id, shop_domain, settings')
    .eq('platform', 'shopify')
    .eq('status', 'active')
    .eq('settings->auto_sync_inventory', true);

  const results = [];

  for (const integration of integrations || []) {
    try {
      // Call the inventory sync endpoint
      const response = await fetch(
        `${Deno.env.get('NEXT_PUBLIC_APP_URL')}/api/integrations/shopify/${integration.id}/sync-inventory`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('INTERNAL_API_KEY')}`,
          },
        }
      );

      results.push({
        integrationId: integration.id,
        success: response.ok,
      });
    } catch (error) {
      results.push({
        integrationId: integration.id,
        success: false,
        error: error.message,
      });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## Phase 7: Product Mapping UI

### Product Mapping Page

```typescript
// src/app/(portal)/portal/settings/integrations/shopify/products/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Table } from '@/components/ui/Table';
import { useClient } from '@/lib/client-auth';
import {
  getProductMappings,
  getShopifyProducts,
  createProductMapping,
  autoMapProductsBySku
} from '@/lib/api/integrations';

export default function ShopifyProductMappingPage() {
  const { client } = useClient();
  const [integration, setIntegration] = useState<ClientIntegration | null>(null);
  const [mappings, setMappings] = useState<ProductMapping[]>([]);
  const [shopifyProducts, setShopifyProducts] = useState<ShopifyProduct[]>([]);
  const [imsProducts, setImsProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  useEffect(() => {
    loadData();
  }, [client?.id]);

  async function loadData() {
    if (!client?.id) return;

    setIsLoading(true);

    // Load integration, mappings, and products in parallel
    const [integrationData, mappingsData, shopifyData, imsData] = await Promise.all([
      getClientShopifyIntegration(client.id),
      getProductMappings(client.id),
      fetchShopifyProducts(client.id),
      getClientProducts(client.id),
    ]);

    setIntegration(integrationData);
    setMappings(mappingsData);
    setShopifyProducts(shopifyData);
    setImsProducts(imsData);
    setIsLoading(false);
  }

  const unmappedShopifyProducts = shopifyProducts.filter(
    sp => !mappings.some(m => m.external_variant_id === String(sp.variant_id))
  );

  const handleAutoMap = async () => {
    if (!integration?.id) return;
    setIsAutoMapping(true);

    const result = await autoMapProductsBySku(integration.id);

    alert(`Auto-mapped ${result.mapped} products. ${result.skipped} could not be matched.`);
    await loadData();
    setIsAutoMapping(false);
  };

  const handleManualMap = async (shopifyVariantId: string, imsProductId: string) => {
    if (!integration?.id) return;

    await createProductMapping(integration.id, {
      external_variant_id: shopifyVariantId,
      product_id: imsProductId,
    });

    await loadData();
  };

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Shopify Product Mapping</h1>
        <div className="flex gap-2">
          <Button
            onClick={handleAutoMap}
            disabled={isAutoMapping}
            variant="secondary"
          >
            {isAutoMapping ? 'Mapping...' : 'Auto-Map by SKU'}
          </Button>
          <Button onClick={() => fetchShopifyProducts(client!.id, true)}>
            Refresh from Shopify
          </Button>
        </div>
      </div>

      {/* Existing Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Mapped Products ({mappings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table
            columns={[
              { key: 'ims_sku', header: 'IMS SKU' },
              { key: 'ims_name', header: 'IMS Product' },
              { key: 'shopify_sku', header: 'Shopify SKU' },
              { key: 'shopify_title', header: 'Shopify Product' },
              { key: 'sync_inventory', header: 'Sync Inventory' },
              { key: 'actions', header: '' },
            ]}
            data={mappings.map(m => ({
              id: m.id,
              ims_sku: m.product?.sku,
              ims_name: m.product?.name,
              shopify_sku: m.external_sku,
              shopify_title: m.external_title,
              sync_inventory: m.sync_inventory ? '✓' : '—',
              actions: (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMapping(m.id)}
                >
                  Remove
                </Button>
              ),
            }))}
            keyExtractor={(m) => m.id}
          />
        </CardContent>
      </Card>

      {/* Unmapped Shopify Products */}
      {unmappedShopifyProducts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-yellow-600">
              Unmapped Shopify Products ({unmappedShopifyProducts.length})
            </CardTitle>
            <p className="text-sm text-gray-500">
              These products exist in Shopify but aren't linked to IMS products.
              Orders containing these items will be flagged for review.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {unmappedShopifyProducts.map(product => (
                <div
                  key={product.variant_id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{product.title}</p>
                    <p className="text-sm text-gray-500">
                      SKU: {product.sku || 'No SKU'} |
                      Variant: {product.variant_title || 'Default'}
                    </p>
                  </div>
                  <select
                    className="px-3 py-2 border rounded-lg min-w-[250px]"
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleManualMap(String(product.variant_id), e.target.value);
                      }
                    }}
                  >
                    <option value="">Map to IMS product...</option>
                    {imsProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.sku} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## Phase 8: Integration Settings UI

### Integration Status Component

```typescript
// src/components/portal/ShopifyIntegrationStatus.tsx

'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  disconnectShopifyIntegration,
  syncShopifyOrdersNow,
  syncShopifyInventoryNow
} from '@/lib/api/integrations';

interface Props {
  integration: ClientIntegration;
  onUpdate: () => void;
}

export function ShopifyIntegrationStatus({ integration, onUpdate }: Props) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleSyncOrders = async () => {
    setIsSyncing(true);
    try {
      const result = await syncShopifyOrdersNow(integration.id);
      alert(`Synced ${result.imported} orders, ${result.skipped} skipped`);
      onUpdate();
    } catch (error) {
      alert('Sync failed: ' + error.message);
    }
    setIsSyncing(false);
  };

  const handleSyncInventory = async () => {
    setIsSyncing(true);
    try {
      const result = await syncShopifyInventoryNow(integration.id);
      alert(`Updated ${result.updated} products in Shopify`);
      onUpdate();
    } catch (error) {
      alert('Sync failed: ' + error.message);
    }
    setIsSyncing(false);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Shopify store?')) return;

    setIsDisconnecting(true);
    await disconnectShopifyIntegration(integration.id);
    onUpdate();
  };

  return (
    <div className="space-y-4">
      {/* Status Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <CheckIcon className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="font-medium">{integration.shop_name}</p>
            <p className="text-sm text-gray-500">{integration.shop_domain}</p>
          </div>
        </div>
        <Badge variant={integration.status === 'active' ? 'success' : 'warning'}>
          {integration.status}
        </Badge>
      </div>

      {/* Sync Status */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <p className="text-sm text-gray-500">Last Order Sync</p>
          <p className="font-medium">
            {integration.last_order_sync_at
              ? formatDistanceToNow(new Date(integration.last_order_sync_at), { addSuffix: true })
              : 'Never'}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Last Inventory Sync</p>
          <p className="font-medium">
            {integration.last_inventory_sync_at
              ? formatDistanceToNow(new Date(integration.last_inventory_sync_at), { addSuffix: true })
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Error Display */}
      {integration.last_error_message && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Last Error</p>
          <p className="text-sm text-red-600">{integration.last_error_message}</p>
          <p className="text-xs text-red-400 mt-1">
            {integration.last_error_at && formatDistanceToNow(new Date(integration.last_error_at), { addSuffix: true })}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSyncOrders} disabled={isSyncing}>
          {isSyncing ? 'Syncing...' : 'Sync Orders Now'}
        </Button>
        <Button onClick={handleSyncInventory} disabled={isSyncing} variant="secondary">
          Push Inventory to Shopify
        </Button>
        <a href={`/portal/settings/integrations/shopify/products`}>
          <Button variant="secondary">Manage Product Mapping</Button>
        </a>
      </div>

      {/* Settings */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-600">
          Advanced Settings
        </summary>
        <div className="mt-3 space-y-3 p-4 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={integration.settings?.auto_import_orders}
              onChange={(e) => updateSettings({ auto_import_orders: e.target.checked })}
            />
            <span className="text-sm">Auto-import new orders</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={integration.settings?.auto_sync_inventory}
              onChange={(e) => updateSettings({ auto_sync_inventory: e.target.checked })}
            />
            <span className="text-sm">Auto-sync inventory to Shopify</span>
          </label>
          <div>
            <label className="text-sm text-gray-600">Inventory Buffer</label>
            <input
              type="number"
              min="0"
              value={integration.settings?.inventory_buffer || 0}
              onChange={(e) => updateSettings({ inventory_buffer: parseInt(e.target.value) })}
              className="ml-2 w-20 px-2 py-1 border rounded"
            />
            <span className="text-xs text-gray-500 ml-2">
              (Units to hold back from Shopify)
            </span>
          </div>
        </div>
      </details>

      {/* Disconnect */}
      <div className="pt-4 border-t">
        <Button
          variant="destructive"
          onClick={handleDisconnect}
          disabled={isDisconnecting}
        >
          {isDisconnecting ? 'Disconnecting...' : 'Disconnect Shopify'}
        </Button>
      </div>
    </div>
  );
}
```

---

## Phase 9: Security Considerations

### 1. Token Storage

```typescript
// Option A: Supabase Vault (Recommended for production)
// Encrypt tokens before storing

import { createServiceClient } from '@/lib/supabase-service';

async function storeEncryptedToken(integrationId: string, token: string) {
  const supabase = createServiceClient();

  // Use Supabase Vault
  const { data: secret } = await supabase
    .rpc('vault.create_secret', {
      secret: token,
      name: `shopify_token_${integrationId}`,
    });

  // Store secret ID reference
  await supabase
    .from('client_integrations')
    .update({ access_token_secret_id: secret.id })
    .eq('id', integrationId);
}

// Option B: Application-level encryption
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!; // 32 bytes
const IV_LENGTH = 16;

function encryptToken(token: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

function decryptToken(encryptedToken: string): string {
  const [ivHex, encrypted] = encryptedToken.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### 2. RLS Policies Summary

| Table | Client Access | Staff Access |
|-------|---------------|--------------|
| client_integrations | Own client only (owner/admin can write) | All |
| product_mappings | Via parent integration | All |
| webhook_events | None (service role only) | All |

### 3. Webhook Security Checklist

- [x] HMAC signature verification on all webhooks
- [x] Nonce validation in OAuth flow
- [x] State parameter for CSRF protection
- [x] Shop domain validation (regex)
- [x] Idempotent webhook processing (deduplication)
- [x] Rate limiting on webhook endpoints
- [x] Service role for webhook processing (bypasses RLS)

---

## Phase 10: Testing Strategy

### 1. Unit Tests

```typescript
// __tests__/shopify/order-transform.test.ts

describe('transformShopifyOrder', () => {
  it('should transform basic order correctly', () => {
    const shopifyOrder = mockShopifyOrder({
      id: 12345,
      name: '#1001',
      line_items: [
        { variant_id: 'v1', quantity: 2, price: '19.99' }
      ],
    });

    const result = transformShopifyOrder(shopifyOrder, mockIntegration, mockMappings);

    expect(result.order_number).toBe('SH-1001');
    expect(result.external_order_id).toBe('12345');
    expect(result.line_items).toHaveLength(1);
  });

  it('should flag unmapped products', () => {
    const shopifyOrder = mockShopifyOrder({
      line_items: [
        { variant_id: 'unknown', quantity: 1 }
      ],
    });

    const result = transformShopifyOrder(shopifyOrder, mockIntegration, []);

    expect(result.notes).toContain('could not be mapped');
  });
});
```

### 2. Integration Tests

```typescript
// __tests__/shopify/webhook.integration.test.ts

describe('Shopify Webhook Handler', () => {
  it('should verify valid HMAC signature', async () => {
    const body = JSON.stringify(mockShopifyOrder());
    const hmac = generateHmac(body, TEST_WEBHOOK_SECRET);

    const response = await fetch('/api/webhooks/shopify/test-integration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Hmac-Sha256': hmac,
        'X-Shopify-Topic': 'orders/create',
      },
      body,
    });

    expect(response.status).toBe(200);
  });

  it('should reject invalid signature', async () => {
    const response = await fetch('/api/webhooks/shopify/test-integration', {
      method: 'POST',
      headers: {
        'X-Shopify-Hmac-Sha256': 'invalid',
      },
      body: '{}',
    });

    expect(response.status).toBe(401);
  });
});
```

### 3. E2E Test Scenarios

| Scenario | Steps | Expected Result |
|----------|-------|-----------------|
| OAuth Connect | 1. Click Connect 2. Enter shop 3. Authorize 4. Return | Integration created, webhooks registered |
| Order Import | 1. Create order in Shopify 2. Wait for webhook | Order appears in IMS with correct items |
| Fulfillment Sync | 1. Ship order in IMS 2. Add tracking | Shopify order shows fulfilled with tracking |
| Inventory Sync | 1. Adjust inventory in IMS 2. Trigger sync | Shopify shows updated quantity |
| Disconnect | 1. Click Disconnect 2. Confirm | Integration removed, webhooks deleted |

---

## Implementation Order

### Sprint 1: Foundation (Week 1)
1. [ ] Database migrations (all 4)
2. [ ] TypeScript types update
3. [ ] Shopify API client utility
4. [ ] Environment variables setup

### Sprint 2: OAuth Flow (Week 2)
5. [ ] OAuth initiation endpoint
6. [ ] OAuth callback handler
7. [ ] Webhook registration
8. [ ] Basic integration settings page

### Sprint 3: Order Sync (Week 3)
9. [ ] Webhook endpoint structure
10. [ ] Order create handler
11. [ ] Order transform logic
12. [ ] Order cancel handler

### Sprint 4: Product Mapping (Week 4)
13. [ ] Fetch Shopify products API
14. [ ] Product mapping CRUD
15. [ ] Auto-map by SKU
16. [ ] Product mapping UI

### Sprint 5: Fulfillment & Inventory (Week 5)
17. [ ] Fulfillment sync to Shopify
18. [ ] Hook into ship flow
19. [ ] Inventory sync module
20. [ ] Scheduled inventory sync

### Sprint 6: Polish & Testing (Week 6)
21. [x] Integration status dashboard
22. [ ] Error handling & alerts
23. [ ] Unit tests
24. [ ] E2E testing
25. [x] Documentation

### Sprint 7: Production Hardening (Week 7) 🔒
> **CRITICAL**: These items must be completed before production deployment.

26. [ ] **Token Encryption** - Encrypt access_token at rest (AES-256 or Supabase Vault)
27. [ ] **Distributed Rate Limiting** - Replace in-memory with Redis/Upstash
28. [ ] **Webhook Cleanup** - Deregister Shopify webhooks on disconnect
29. [ ] **Fulfillment Hook** - Connect fulfillment-sync.ts to ship flow
30. [ ] **Scheduled Inventory Sync** - Vercel Cron or Supabase Edge Function
31. [ ] **Error Alerting** - Notify on repeated webhook failures
32. [ ] **Token Refresh Monitoring** - Alert if tokens get revoked (though Shopify tokens don't expire)
33. [ ] **Integration Health Dashboard** - Show sync status, error rates, last sync times

---

## Implementation Status Tracker

> **Instructions**: Update this section as work progresses. Mark items with:
> - `[ ]` Not started
> - `[~]` In progress
> - `[x]` Completed
> - `[-]` Skipped/Not needed

### Database & Types
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Migration: client_integrations | [x] | Supabase MCP | Created via Supabase tools |
| Migration: product_mappings | [x] | Supabase MCP | Created via Supabase tools |
| Migration: webhook_events | [x] | Supabase MCP | Created via Supabase tools |
| Migration: extend outbound_orders | [x] | Supabase MCP | Created via Supabase tools |
| TypeScript types update | [x] | `src/types/database.ts` | Added integration types at end of file |

### OAuth Flow
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Environment variables | [x] | `.env.local` | Shopify credentials configured |
| OAuth initiation route | [x] | `src/app/api/integrations/shopify/auth/route.ts` | |
| OAuth callback route | [x] | `src/app/api/integrations/shopify/callback/route.ts` | |
| Webhook registration | [x] | In callback route | Registers webhooks after OAuth |

### Webhook Handling
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Webhook endpoint | [x] | `src/app/api/webhooks/shopify/[integrationId]/route.ts` | |
| HMAC verification | [x] | In webhook route | Uses Shopify client secret |
| orders/create handler | [x] | In webhook route | Calls order-sync |
| orders/cancelled handler | [x] | In webhook route | |
| orders/updated handler | [x] | In webhook route | |

### Order Sync
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Shopify API client | [x] | `src/lib/api/shopify/client.ts` | With rate limiting |
| Order transform logic | [x] | `src/lib/api/shopify/order-sync.ts` | |
| Product mapping lookup | [x] | `src/lib/api/shopify/order-sync.ts` | By variant ID and SKU |
| Order creation in IMS | [x] | `src/lib/api/shopify/order-sync.ts` | |

### Inventory & Fulfillment
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Inventory sync module | [x] | `src/lib/api/shopify/inventory-sync.ts` | |
| Fulfillment sync module | [x] | `src/lib/api/shopify/fulfillment-sync.ts` | |
| Hook into ship flow | [ ] | | Need to integrate with existing ship flow |
| Scheduled sync job | [ ] | | Optional: Supabase edge function |

### Portal UI
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Integration settings page | [x] | `src/app/(portal)/portal/settings/integrations/page.tsx` | |
| Connect button component | [x] | In integrations page | Inline component |
| Integration status component | [x] | In integrations page | ShopifyConnectedStatus |
| Product mapping page | [x] | `src/app/(portal)/portal/settings/integrations/shopify/products/page.tsx` | Completed 2026-02-02 |
| Product mapping CRUD | [x] | `src/lib/api/product-mappings.ts` | Full CRUD operations |
| Disconnect button | [x] | In integrations page + `src/app/api/integrations/shopify/[integrationId]/route.ts` | DELETE endpoint |

### Testing
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Unit tests - transforms | [x] | `src/__tests__/shopify/order-transform.test.ts` | 22 tests |
| Unit tests - webhooks | [x] | `src/__tests__/shopify/webhook-verification.test.ts` | 13 tests |
| Integration tests | [ ] | | |
| E2E test scenarios | [~] | | Ready for manual testing |

### Production Hardening (Sprint 7)
| Item | Status | Actual File | Notes |
|------|--------|-------------|-------|
| Token encryption | [x] | `src/lib/encryption.ts` | AES-256-CBC, backwards compatible |
| Distributed rate limiting | [x] | `src/lib/rate-limit.ts`, `src/lib/api/shopify/client.ts` | Uses Upstash Redis |
| Webhook deregistration | [x] | `src/app/api/integrations/shopify/[integrationId]/route.ts` | Deregisters all webhooks before DB delete |
| Fulfillment sync hook | [x] | `src/lib/api/outbound.ts` | Calls syncFulfillmentToShopify on ship |
| Scheduled inventory sync | [x] | `src/app/api/cron/sync-shopify-inventory/route.ts` | Upstash QStash (hourly) |
| Error alerting | [~] | Errors logged to `client_integrations.last_error_*` | Visible in portal UI |

---

## File Structure Summary

```
src/
├── app/
│   ├── api/
│   │   ├── integrations/
│   │   │   └── shopify/
│   │   │       ├── auth/route.ts
│   │   │       ├── callback/route.ts
│   │   │       ├── locations/route.ts (multi-location)
│   │   │       ├── [integrationId]/
│   │   │       │   ├── sync-orders/route.ts
│   │   │       │   ├── sync-inventory/route.ts
│   │   │       │   └── products/route.ts
│   │   └── webhooks/
│   │       └── shopify/
│   │           └── [integrationId]/route.ts
│   └── (portal)/
│       └── portal/
│           └── settings/
│               └── integrations/
│                   ├── page.tsx
│                   └── shopify/
│                       └── products/page.tsx
├── components/
│   └── portal/
│       ├── ShopifyConnectButton.tsx
│       └── ShopifyIntegrationStatus.tsx
├── lib/
│   ├── api/
│   │   ├── integrations.ts (CRUD)
│   │   └── shopify/
│   │       ├── client.ts
│   │       ├── order-sync.ts
│   │       ├── inventory-sync.ts
│   │       ├── fulfillment-sync.ts
│   │       └── location-management.ts (multi-location)
│   ├── encryption.ts (token encryption)
│   ├── rate-limit.ts (distributed rate limiting)
│   └── supabase-service.ts (service role client)
├── __tests__/
│   └── shopify/
│       ├── encryption.test.ts
│       ├── rate-limit.test.ts
│       ├── webhook-verification.test.ts
│       ├── order-transform.test.ts
│       └── location-management.test.ts (multi-location)
├── types/
│   └── database.ts (extended)
└── supabase/
    └── migrations/
        ├── 20240201_create_client_integrations.sql
        ├── 20240202_create_product_mappings.sql
        ├── 20240203_create_webhook_events.sql
        ├── 20240204_extend_outbound_orders.sql
        └── 20260203_add_shopify_location_tracking.sql (multi-location)
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| OAuth success rate | > 95% |
| Order import latency | < 30 seconds from Shopify |
| Inventory sync accuracy | 100% |
| Fulfillment sync success | > 99% |
| Webhook processing time | < 5 seconds |
| Error rate | < 1% |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Shopify API changes | High | Pin API version, monitor deprecations |
| Rate limiting | Medium | Implement backoff, batch operations |
| Token expiration | High | Shopify tokens don't expire, but monitor for revocation |
| Webhook delivery failures | Medium | Idempotent processing, retry queue |
| Product mapping drift | Medium | Regular sync, alerts for unmapped items |
| **Token breach** | **Critical** | **Encrypt at rest (Sprint 7)** |
| **Rate limit bypass at scale** | **Medium** | **Distributed rate limiter (Sprint 7)** |

---

## Production Hardening Details (Sprint 7)

### Token Encryption Implementation

```typescript
// Option 1: AES-256 encryption (recommended for simplicity)
// src/lib/encryption.ts

import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, 'hex'); // 32 bytes
const IV_LENGTH = 16;

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptToken(ciphertext: string): string {
  const [ivHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Generate key: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Distributed Rate Limiting

```typescript
// src/lib/rate-limit.ts (updated for Upstash)
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const webhookRateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '60 s'),
  analytics: true,
});

// Usage: const { success } = await webhookRateLimiter.limit(integrationId);
```

### Webhook Cleanup on Disconnect

```typescript
// In DELETE handler before removing integration:
async function deregisterWebhooks(integration: ClientIntegration): Promise<void> {
  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: decryptToken(integration.access_token),
  });

  // Get all webhooks
  const { webhooks } = await client.get<{ webhooks: { id: number }[] }>('/webhooks.json');

  // Delete each
  for (const webhook of webhooks) {
    await client.delete(\`/webhooks/\${webhook.id}.json\`);
  }
}
```

### Fulfillment Hook Location

```typescript
// In src/lib/api/outbound.ts or ShipScanner.tsx
// After order status changes to 'shipped':

if (order.external_platform === 'shopify' && trackingNumber) {
  await syncFulfillmentToShopify(order.id, trackingNumber, carrier, trackingUrl);
}
```

### Scheduled Inventory Sync (Upstash QStash)

The scheduled inventory sync runs hourly to push IMS inventory levels to Shopify.
Uses Upstash QStash for platform-agnostic scheduling (works with any hosting).

**Endpoint:** `POST /api/cron/sync-shopify-inventory`

**Setup Steps:**

1. Go to [Upstash Console](https://console.upstash.com) → QStash
2. Create a new schedule:
   - **URL:** `https://your-app-domain.com/api/cron/sync-shopify-inventory`
   - **Method:** POST
   - **Schedule:** `0 * * * *` (every hour)
   - **Headers:**
     ```
     Authorization: Bearer <your-CRON_SECRET>
     Content-Type: application/json
     ```
3. Add `CRON_SECRET` to your environment variables

**Environment Variable:**
```bash
# Generate a secure random secret
CRON_SECRET=<random-string-min-32-chars>
```

**What it does:**
- Finds all active Shopify integrations with `auto_sync_inventory: true`
- Respects `sync_inventory_interval_minutes` setting per integration
- Syncs available inventory (on_hand - reserved - buffer) to Shopify
- Logs errors to integration record for visibility in portal

---

## Next Steps

1. **Follow the Setup Guide**: `SHOPIFY_SETUP_GUIDE.md` - Step-by-step instructions for beginners
2. **Complete Steps 1-6** of the setup guide (prerequisites)
3. **Tell Claude "Ready for Step 7"** to have all code files created
4. **Follow Step 8** to test the integration

Ready to proceed with implementation upon approval.

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `SHOPIFY_SETUP_GUIDE.md` | Step-by-step setup instructions for beginners |
| `SHOPIFY_INTEGRATION_PLAN.md` | Technical architecture and implementation details (this file) |
| `SHOPIFY_MULTI_LOCATION_PLAN.md` | Multi-location inventory and order routing |
| `.claude/summons/integrations/shopify.md` | Quick reference patterns |

---

## Claude Maintenance Protocol

> **This section is for Claude Code to follow when working on Shopify integration**

### Before Starting Any Shopify Work

```
1. READ this entire plan (or at minimum: Change Log, Implementation Status, relevant Phase)
2. CHECK the Change Log for recent deviations
3. IDENTIFY which Implementation Status items are affected
4. CONFIRM approach still aligns with plan
```

### During Implementation

```
1. FOLLOW the patterns and code examples in this plan
2. USE the planned file structure (update if deviating)
3. NOTE any deviations for the Change Log
4. TEST according to the Testing Strategy section
```

### After Completing Work

```
1. UPDATE the Implementation Status Tracker:
   - Mark completed items with [x]
   - Add actual file paths
   - Add any notes about deviations

2. UPDATE the Change Log if:
   - Architecture changed from plan
   - New patterns were introduced
   - Scope was added or removed
   - File structure differs

3. UPDATE the File Structure if new files were created

4. UPDATE relevant Phase sections if implementation differs significantly
```

### Change Log Entry Format

```markdown
| YYYY-MM-DD | Brief description of change | Why it was needed | comma, separated, files |
```

### Example Workflow

```
User: "Add inventory sync to Shopify"

Claude:
1. Reads SHOPIFY_INTEGRATION_PLAN.md
2. Finds Phase 6 (Inventory Sync)
3. Checks Implementation Status - sees it's not started
4. Implements following the plan
5. Updates status tracker:
   | Inventory sync module | [x] | src/lib/api/shopify/inventory-sync.ts | |
6. If deviated, adds Change Log entry
```

---

*Last Updated: 2026-02-03*
*Plan Version: 2.0 - Added Production Hardening (Sprint 7)*
