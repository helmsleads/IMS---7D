# Shopify Multi-Location Integration Plan

> **Purpose**: Enable Shopify store owners who use multiple warehouses to see exactly what inventory is stored at 7 Degrees Co, track incoming shipments, and have orders automatically routed to the correct fulfillment location.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State vs Target State](#current-state-vs-target-state)
3. [Requirements](#requirements)
4. [Database Changes](#database-changes)
5. [Implementation Phases](#implementation-phases)
6. [API Reference](#api-reference)
7. [Testing Strategy](#testing-strategy)
8. [Rollout Plan](#rollout-plan)

---

## Executive Summary

### Problem Statement

Shopify store owners who use multiple fulfillment providers (their own warehouse, other 3PLs, plus 7 Degrees Co) cannot currently see:
- How much inventory is stored specifically at 7 Degrees Co
- What inventory is in transit TO 7 Degrees Co
- Which orders should be fulfilled by 7 Degrees Co vs other locations

### Solution

Implement Shopify's native multi-location inventory feature to:
1. Create a dedicated "7 Degrees Co" location in each client's Shopify store
2. Sync inventory ONLY to that location (not overwriting other locations)
3. Show incoming inventory from inbound shipments
4. Only import orders assigned to our location for fulfillment

### Business Value

| Benefit | Impact |
|---------|--------|
| Client visibility | Clients see real-time stock at our warehouse |
| Accurate inventory | No more blending stock from multiple locations |
| Proper order routing | Only receive orders we should fulfill |
| Incoming tracking | Clients see inbound shipments in Shopify |
| Professional service | Industry-standard 3PL integration |

---

## Current State vs Target State

### Current State

```
┌─────────────────────────────────────────────────────────┐
│ Shopify Store                                           │
│                                                         │
│   Inventory Location: "Primary" (single location)       │
│   ┌─────────────────────────────────────────────────┐   │
│   │ Product A: 500 units (all locations combined)   │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
│   Problem: Can't tell what's at which warehouse         │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│ IMS (7 Degrees Co)                                      │
│                                                         │
│   Syncs total inventory to Shopify                      │
│   Overwrites whatever was there                         │
│   No distinction between locations                      │
└─────────────────────────────────────────────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────┐
│ Shopify Store                                           │
│                                                         │
│   Inventory Locations:                                  │
│   ┌─────────────────────────────────────────────────┐   │
│   │ Location: "Client's Warehouse"    │ 200 units   │   │
│   │ Location: "Other 3PL"             │ 150 units   │   │
│   │ Location: "7 Degrees Co" ★        │ 320 units   │   │
│   │           └─ Incoming: 500 units               │   │
│   └─────────────────────────────────────────────────┘   │
│                                                         │
│   Orders auto-assigned to location with stock           │
│   Orders for "7 Degrees Co" → sent to IMS               │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼ (only our location)
┌─────────────────────────────────────────────────────────┐
│ IMS (7 Degrees Co)                                      │
│                                                         │
│   ✓ Syncs to OUR location only                         │
│   ✓ Shows incoming inventory from inbounds             │
│   ✓ Only imports orders assigned to us                 │
│   ✓ Fulfillment updates our location only              │
└─────────────────────────────────────────────────────────┘
```

---

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Create dedicated Shopify location on integration connect | P0 |
| FR-2 | Sync inventory only to our location | P0 |
| FR-3 | Only import orders assigned to our location | P0 |
| FR-4 | Sync incoming inventory from inbounds | P1 |
| FR-5 | Update location inventory on fulfillment | P0 |
| FR-6 | Support location-specific fulfillment orders | P0 |
| FR-7 | Show location name in portal UI | P1 |
| FR-8 | Handle location deletion gracefully | P2 |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Location creation must complete within OAuth callback timeout |
| NFR-2 | Inventory sync must not affect other locations |
| NFR-3 | Backwards compatible with existing single-location integrations |
| NFR-4 | Must handle Shopify API rate limits |

### OAuth Scope Changes

Current scopes:
```
read_orders,write_orders,read_products,write_products,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_locations
```

**New scope needed:**
```
write_locations
```

Updated full scope:
```
read_orders,write_orders,read_products,write_products,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_locations,write_locations
```

---

## Database Changes

### Migration: Add Location Tracking

```sql
-- Migration: 20260203_add_shopify_location_tracking.sql

-- Add location tracking to integrations
ALTER TABLE client_integrations
  ADD COLUMN IF NOT EXISTS shopify_location_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS shopify_location_name VARCHAR(255) DEFAULT '7 Degrees Co',
  ADD COLUMN IF NOT EXISTS location_created_by_us BOOLEAN DEFAULT false;

-- Add incoming quantity tracking to product mappings
ALTER TABLE product_mappings
  ADD COLUMN IF NOT EXISTS incoming_qty INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incoming_updated_at TIMESTAMPTZ;

-- Track which inbounds have been synced to Shopify
ALTER TABLE inbound_orders
  ADD COLUMN IF NOT EXISTS shopify_incoming_synced BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS shopify_incoming_synced_at TIMESTAMPTZ;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_integrations_shopify_location
  ON client_integrations(shopify_location_id)
  WHERE platform = 'shopify';

COMMENT ON COLUMN client_integrations.shopify_location_id IS 'Shopify location ID for this 3PL warehouse';
COMMENT ON COLUMN client_integrations.location_created_by_us IS 'True if we created this location during onboarding';
COMMENT ON COLUMN product_mappings.incoming_qty IS 'Quantity in transit from pending inbounds';
```

### TypeScript Types Update

```typescript
// src/types/database.ts - additions

export interface ClientIntegration {
  // ... existing fields ...

  // Multi-location support
  shopify_location_id: string | null;
  shopify_location_name: string;
  location_created_by_us: boolean;
}

export interface ProductMapping {
  // ... existing fields ...

  // Incoming inventory tracking
  incoming_qty: number;
  incoming_updated_at: string | null;
}

export interface InboundOrder {
  // ... existing fields ...

  // Shopify sync tracking
  shopify_incoming_synced: boolean;
  shopify_incoming_synced_at: string | null;
}
```

---

## Implementation Phases

### Phase 1: Location Management (Foundation)

**Goal**: Create and manage dedicated Shopify locations for each client.

#### Task 1.1: Update OAuth Scopes

**File**: `src/app/api/integrations/shopify/auth/route.ts`

```typescript
// Update SHOPIFY_SCOPES in .env to include write_locations
// SHOPIFY_SCOPES=read_orders,write_orders,read_products,write_products,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_locations,write_locations
```

**File**: `.env.local`
```env
SHOPIFY_SCOPES=read_orders,write_orders,read_products,write_products,read_inventory,write_inventory,read_fulfillments,write_fulfillments,read_locations,write_locations
```

#### Task 1.2: Create Location on OAuth Callback

**File**: `src/lib/api/shopify/location-management.ts` (NEW)

```typescript
import { createShopifyClient } from './client'
import { decryptToken } from '@/lib/encryption'

const DEFAULT_LOCATION_NAME = '7 Degrees Co'

interface ShopifyLocation {
  id: number
  name: string
  active: boolean
  fulfills_online_orders: boolean
}

/**
 * Find or create our dedicated location in the client's Shopify store
 */
export async function ensureShopifyLocation(
  shopDomain: string,
  accessToken: string,
  locationName: string = DEFAULT_LOCATION_NAME
): Promise<{ locationId: string; createdByUs: boolean }> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  // First, check if location already exists
  const { locations } = await client.get<{ locations: ShopifyLocation[] }>(
    '/locations.json'
  )

  const existingLocation = locations.find(
    (loc) => loc.name.toLowerCase() === locationName.toLowerCase() && loc.active
  )

  if (existingLocation) {
    return {
      locationId: String(existingLocation.id),
      createdByUs: false,
    }
  }

  // Create new location
  const { location } = await client.post<{ location: ShopifyLocation }>(
    '/locations.json',
    {
      location: {
        name: locationName,
        fulfills_online_orders: true,
      },
    }
  )

  return {
    locationId: String(location.id),
    createdByUs: true,
  }
}

/**
 * Get all locations for a Shopify store
 */
export async function getShopifyLocations(
  shopDomain: string,
  accessToken: string
): Promise<ShopifyLocation[]> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  const { locations } = await client.get<{ locations: ShopifyLocation[] }>(
    '/locations.json'
  )

  return locations.filter((loc) => loc.active)
}

/**
 * Verify our location still exists and is active
 */
export async function verifyLocationExists(
  shopDomain: string,
  accessToken: string,
  locationId: string
): Promise<boolean> {
  const client = createShopifyClient({
    shopDomain,
    accessToken,
  })

  try {
    const { location } = await client.get<{ location: ShopifyLocation }>(
      `/locations/${locationId}.json`
    )
    return location.active
  } catch {
    return false
  }
}
```

#### Task 1.3: Update OAuth Callback to Create Location

**File**: `src/app/api/integrations/shopify/callback/route.ts`

Add after token exchange, before saving integration:

```typescript
import { ensureShopifyLocation } from '@/lib/api/shopify/location-management'

// ... existing code ...

// After getting shop info, before saving integration:

// Create or find our dedicated location
let locationId: string | null = null
let locationCreatedByUs = false
let locationName = '7 Degrees Co'

try {
  const locationResult = await ensureShopifyLocation(
    shop,
    tokenData.access_token,
    locationName
  )
  locationId = locationResult.locationId
  locationCreatedByUs = locationResult.createdByUs
  console.log(`Location ${locationCreatedByUs ? 'created' : 'found'}: ${locationId}`)
} catch (error) {
  console.error('Failed to create/find location:', error)
  // Continue without location - can be set up later
}

// Update the upsert to include location fields:
const { data: integration, error: dbError } = await supabase
  .from('client_integrations')
  .upsert(
    {
      // ... existing fields ...
      shopify_location_id: locationId,
      shopify_location_name: locationName,
      location_created_by_us: locationCreatedByUs,
    },
    // ...
  )
```

#### Task 1.4: Location Selection UI (Optional Override)

**File**: `src/app/(portal)/portal/settings/integrations/shopify/location/page.tsx` (NEW)

Allow clients to select a different location if they already have one set up.

```typescript
'use client'

import { useState, useEffect } from 'react'
import Card from '@/components/ui/Card'
import { useClient } from '@/lib/client-auth'

export default function ShopifyLocationSettingsPage() {
  const { client } = useClient()
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Load available locations from Shopify
  useEffect(() => {
    loadLocations()
  }, [client?.id])

  async function loadLocations() {
    const response = await fetch(`/api/integrations/shopify/locations`)
    const data = await response.json()
    setLocations(data.locations || [])
    setSelectedLocation(data.currentLocationId || '')
    setIsLoading(false)
  }

  async function handleSave() {
    setIsSaving(true)
    await fetch(`/api/integrations/shopify/locations`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId: selectedLocation }),
    })
    setIsSaving(false)
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Shopify Location Settings</h1>

      <Card>
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            Select which Shopify location represents inventory stored at our warehouse.
            Only inventory for this location will be synced.
          </p>

          {isLoading ? (
            <p>Loading locations...</p>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fulfillment Location
                </label>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg"
              >
                {isSaving ? 'Saving...' : 'Save Location'}
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
```

---

### Phase 2: Location-Specific Inventory Sync

**Goal**: Sync inventory only to our location, not affecting other locations.

#### Task 2.1: Update Inventory Sync to Use Location

**File**: `src/lib/api/shopify/inventory-sync.ts`

```typescript
// Update syncInventoryToShopify function:

export async function syncInventoryToShopify(
  integrationId: string,
  productIds?: string[]
): Promise<SyncResult> {
  const supabase = createServiceClient()

  // Get integration with location info
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (!integration?.shopify_location_id) {
    throw new Error('Shopify location not configured. Please reconnect the integration.')
  }

  const locationId = integration.shopify_location_id

  // ... rest of sync logic, using locationId ...

  // When setting inventory level:
  await client.post('/inventory_levels/set.json', {
    location_id: parseInt(locationId),
    inventory_item_id: parseInt(mapping.external_inventory_item_id),
    available: availableQty,
  })
}
```

#### Task 2.2: Sync Incoming Inventory from Inbounds

**File**: `src/lib/api/shopify/incoming-inventory-sync.ts` (NEW)

```typescript
import { createServiceClient } from '@/lib/supabase-service'
import { createShopifyClient } from './client'
import { decryptToken } from '@/lib/encryption'

/**
 * Sync incoming inventory quantities from pending inbounds to Shopify
 * This shows clients what inventory is "in transit" to our warehouse
 */
export async function syncIncomingInventory(
  integrationId: string
): Promise<{ updated: number; failed: number }> {
  const supabase = createServiceClient()

  // Get integration
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (!integration?.shopify_location_id) {
    throw new Error('Location not configured')
  }

  // Get pending inbounds for this client
  const { data: inbounds } = await supabase
    .from('inbound_orders')
    .select(`
      id,
      items:inbound_items(
        product_id,
        qty_expected,
        qty_received
      )
    `)
    .eq('client_id', integration.client_id)
    .in('status', ['pending', 'in_transit', 'receiving'])
    .eq('shopify_incoming_synced', false)

  if (!inbounds?.length) {
    return { updated: 0, failed: 0 }
  }

  // Aggregate incoming quantities by product
  const incomingByProduct = new Map<string, number>()

  for (const inbound of inbounds) {
    for (const item of inbound.items || []) {
      const pending = (item.qty_expected || 0) - (item.qty_received || 0)
      if (pending > 0) {
        const current = incomingByProduct.get(item.product_id) || 0
        incomingByProduct.set(item.product_id, current + pending)
      }
    }
  }

  // Get product mappings
  const { data: mappings } = await supabase
    .from('product_mappings')
    .select('*')
    .eq('integration_id', integrationId)
    .in('product_id', Array.from(incomingByProduct.keys()))

  const client = createShopifyClient({
    shopDomain: integration.shop_domain,
    accessToken: decryptToken(integration.access_token),
  })

  let updated = 0
  let failed = 0

  // Update incoming quantities via inventory level
  // Note: Shopify doesn't have a direct "incoming" field in REST API
  // We'll use a metafield on the product instead
  for (const mapping of mappings || []) {
    const incomingQty = incomingByProduct.get(mapping.product_id) || 0

    try {
      // Update product metafield with incoming quantity
      await client.post(
        `/products/${mapping.external_product_id}/metafields.json`,
        {
          metafield: {
            namespace: 'inventory',
            key: 'incoming_qty',
            value: String(incomingQty),
            type: 'number_integer',
          },
        }
      )

      // Also update our tracking
      await supabase
        .from('product_mappings')
        .update({
          incoming_qty: incomingQty,
          incoming_updated_at: new Date().toISOString(),
        })
        .eq('id', mapping.id)

      updated++
    } catch (error) {
      console.error(`Failed to sync incoming for product ${mapping.product_id}:`, error)
      failed++
    }
  }

  // Mark inbounds as synced
  await supabase
    .from('inbound_orders')
    .update({
      shopify_incoming_synced: true,
      shopify_incoming_synced_at: new Date().toISOString(),
    })
    .in('id', inbounds.map((i) => i.id))

  return { updated, failed }
}

/**
 * Clear incoming inventory when inbound is completed
 */
export async function clearIncomingInventory(
  inboundId: string
): Promise<void> {
  const supabase = createServiceClient()

  // Get inbound with client info
  const { data: inbound } = await supabase
    .from('inbound_orders')
    .select(`
      *,
      items:inbound_items(product_id)
    `)
    .eq('id', inboundId)
    .single()

  if (!inbound) return

  // Get integration for this client
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('client_id', inbound.client_id)
    .eq('platform', 'shopify')
    .eq('status', 'active')
    .single()

  if (!integration) return

  // Recalculate incoming for affected products
  await syncIncomingInventory(integration.id)
}
```

#### Task 2.3: Hook Incoming Sync to Inbound Events

**File**: `src/lib/api/inbound.ts`

Add calls to sync incoming inventory when inbounds change:

```typescript
import { syncIncomingInventory, clearIncomingInventory } from './shopify/incoming-inventory-sync'

// In createInboundOrder, after creating:
// Sync incoming to Shopify (async, don't block)
syncIncomingInventoryForClient(order.client_id).catch(console.error)

// In updateInboundStatus, when status becomes 'completed':
if (status === 'completed') {
  clearIncomingInventory(id).catch(console.error)
}
```

---

### Phase 3: Location-Based Order Routing

**Goal**: Only import orders that Shopify assigns to our location.

#### Task 3.1: Update Webhook Handler to Check Location

**File**: `src/app/api/webhooks/shopify/[integrationId]/route.ts`

```typescript
async function handleOrderCreate(
  payload: Record<string, unknown>,
  integration: Record<string, unknown>
): Promise<void> {
  // Check if order is assigned to our location
  const fulfillmentOrders = payload.fulfillment_orders as Array<{
    assigned_location_id: number
    status: string
  }> | undefined

  if (fulfillmentOrders && integration.shopify_location_id) {
    const ourLocationId = parseInt(integration.shopify_location_id)
    const assignedToUs = fulfillmentOrders.some(
      (fo) => fo.assigned_location_id === ourLocationId && fo.status !== 'closed'
    )

    if (!assignedToUs) {
      console.log(`Order ${payload.name} not assigned to our location, skipping`)
      return
    }
  }

  // Continue with existing import logic...
  await processShopifyOrder(payload, integration)
}
```

#### Task 3.2: Update Manual Sync to Filter by Location

**File**: `src/lib/api/shopify/order-sync.ts`

```typescript
export async function syncShopifyOrders(
  integrationId: string,
  since?: Date
): Promise<SyncResult> {
  // ... existing setup ...

  // Get fulfillment orders assigned to our location
  const params = new URLSearchParams({
    status: 'open',
    // Only get fulfillment orders for our location
    assigned_location_ids: integration.shopify_location_id,
  })

  // Fetch fulfillment orders (these are location-specific)
  const response = await fetch(
    `https://${integration.shop_domain}/admin/api/2024-01/fulfillment_orders.json?${params}`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
      },
    }
  )

  // ... process orders assigned to our location ...
}
```

#### Task 3.3: Update Fulfillment to Use Our Location

**File**: `src/lib/api/shopify/fulfillment-sync.ts`

Fulfillment already uses fulfillment_orders which are location-specific. Verify it works:

```typescript
// The existing code should work, but add location verification:

export async function syncFulfillmentToShopify(
  orderId: string,
  trackingNumber: string,
  carrier: string,
  trackingUrl?: string
): Promise<void> {
  // ... existing code ...

  // Get fulfillment orders for our location
  const fulfillmentOrdersResponse = await client.get<{ fulfillment_orders: FulfillmentOrder[] }>(
    `/orders/${order.external_order_id}/fulfillment_orders.json`
  )

  // Find fulfillment order assigned to our location
  const ourLocationId = parseInt(integration.shopify_location_id)
  const ourFulfillmentOrder = fulfillmentOrdersResponse.fulfillment_orders.find(
    (fo) =>
      fo.assigned_location_id === ourLocationId &&
      (fo.status === 'open' || fo.status === 'in_progress')
  )

  if (!ourFulfillmentOrder) {
    console.log('No fulfillment order assigned to our location')
    return
  }

  // ... rest of fulfillment logic ...
}
```

---

### Phase 4: Portal UI Updates

**Goal**: Show location information in the client portal.

#### Task 4.1: Update Integration Status Display

**File**: `src/app/(portal)/portal/settings/integrations/page.tsx`

Add location info to the connected status display:

```typescript
function ShopifyConnectedStatus({ integration, onRefresh }) {
  return (
    <div className="space-y-4">
      {/* Existing store info */}
      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
        {/* ... existing ... */}
      </div>

      {/* Location Info - NEW */}
      <div className="p-3 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-5 h-5 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900">
              Inventory Location: {integration.shopify_location_name || '7 Degrees Co'}
            </p>
            <p className="text-sm text-blue-700">
              Only inventory at this location is synced
            </p>
          </div>
        </div>
        <a
          href="/portal/settings/integrations/shopify/location"
          className="text-sm text-blue-600 hover:underline mt-2 inline-block"
        >
          Change location →
        </a>
      </div>

      {/* ... rest of existing UI ... */}
    </div>
  )
}
```

#### Task 4.2: Show Incoming Inventory in Product Mapping

**File**: `src/app/(portal)/portal/settings/integrations/shopify/products/page.tsx`

Add incoming quantity column:

```typescript
<Table
  columns={[
    { key: 'ims_sku', header: 'IMS SKU' },
    { key: 'ims_name', header: 'IMS Product' },
    { key: 'shopify_sku', header: 'Shopify SKU' },
    { key: 'available', header: 'Available' },
    { key: 'incoming', header: 'Incoming' },  // NEW
    { key: 'sync_inventory', header: 'Sync' },
  ]}
  data={mappings.map(m => ({
    // ... existing ...
    incoming: m.incoming_qty > 0 ? `+${m.incoming_qty}` : '—',
  }))}
/>
```

---

## API Reference

### New Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations/shopify/locations` | List all Shopify locations |
| PUT | `/api/integrations/shopify/locations` | Update selected location |
| POST | `/api/integrations/shopify/sync-incoming` | Manually sync incoming inventory |

### Shopify API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /locations.json` | List all locations |
| `POST /locations.json` | Create new location |
| `GET /locations/{id}.json` | Get location details |
| `POST /inventory_levels/set.json` | Set inventory at location |
| `GET /fulfillment_orders.json` | Get orders by location |
| `POST /products/{id}/metafields.json` | Store incoming qty |

---

## Testing Strategy

### Unit Tests

```typescript
// src/__tests__/shopify/location-management.test.ts

describe('Location Management', () => {
  it('should find existing location by name')
  it('should create location if not exists')
  it('should handle location creation failure gracefully')
  it('should verify location exists')
})

// src/__tests__/shopify/incoming-inventory.test.ts

describe('Incoming Inventory Sync', () => {
  it('should aggregate incoming from multiple inbounds')
  it('should clear incoming when inbound completes')
  it('should handle products with no mapping')
})

// src/__tests__/shopify/location-routing.test.ts

describe('Location-Based Order Routing', () => {
  it('should import orders assigned to our location')
  it('should skip orders assigned to other locations')
  it('should handle orders with no location assignment')
})
```

### Integration Tests

| Test Case | Steps | Expected |
|-----------|-------|----------|
| Location creation | Connect new store | Location "7 Degrees Co" created |
| Existing location | Connect store with existing location | Existing location used |
| Inventory sync | Change IMS inventory | Only our location updated |
| Incoming sync | Create inbound | Shopify shows incoming qty |
| Order routing | Create order for our location | Order imported |
| Order skip | Create order for other location | Order NOT imported |

### Manual Testing Checklist

- [ ] Connect new Shopify store - location created
- [ ] Connect store with existing "7 Degrees Co" location - uses existing
- [ ] Verify inventory only updates at our location
- [ ] Create inbound - incoming shows in Shopify
- [ ] Complete inbound - incoming clears, available increases
- [ ] Create order at our location - imports to IMS
- [ ] Create order at other location - does NOT import
- [ ] Fulfill order - only updates our location

---

## Rollout Plan

### Phase 1: Development (Week 1) - COMPLETED
- [x] Database migrations (`supabase/migrations/20260203_add_shopify_location_tracking.sql`)
- [x] Location management module (`src/lib/api/shopify/location-management.ts`)
- [x] Update OAuth callback (creates/finds location on connect)
- [x] Unit tests (`src/__tests__/shopify/location-management.test.ts` - 20 tests)
- [x] Locations API endpoint (`src/app/api/integrations/shopify/locations/route.ts`)
- [x] TypeScript types updated (`src/types/database.ts`)

### Phase 2: Inventory Sync (Week 2)
- [ ] Update inventory sync for locations
- [ ] Incoming inventory sync
- [ ] Hook into inbound events
- [ ] Integration tests

### Phase 3: Order Routing (Week 3)
- [ ] Update webhook handler
- [ ] Update manual sync
- [ ] Update fulfillment sync
- [ ] End-to-end tests

### Phase 4: UI & Polish (Week 4)
- [ ] Portal UI updates
- [ ] Location selection page
- [ ] Documentation
- [ ] Client communication

### Migration for Existing Integrations

Existing integrations will need their location set:

```typescript
// One-time migration script
async function migrateExistingIntegrations() {
  const supabase = createServiceClient()

  const { data: integrations } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('platform', 'shopify')
    .eq('status', 'active')
    .is('shopify_location_id', null)

  for (const integration of integrations || []) {
    try {
      const { locationId, createdByUs } = await ensureShopifyLocation(
        integration.shop_domain,
        decryptToken(integration.access_token)
      )

      await supabase
        .from('client_integrations')
        .update({
          shopify_location_id: locationId,
          location_created_by_us: createdByUs,
        })
        .eq('id', integration.id)

      console.log(`Migrated ${integration.shop_domain}: location ${locationId}`)
    } catch (error) {
      console.error(`Failed to migrate ${integration.shop_domain}:`, error)
    }
  }
}
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Location creation success rate | > 99% |
| Inventory sync accuracy per location | 100% |
| Order routing accuracy | 100% |
| Incoming sync latency | < 5 minutes |
| Zero inventory overwrites at other locations | 0 incidents |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Location creation fails | Can't sync inventory | Fallback to manual setup in portal |
| Client deletes our location | Sync breaks | Health check alerts, auto-recreate option |
| Shopify API changes | Integration breaks | Pin API version, monitor deprecations |
| Rate limits during migration | Slow rollout | Batch migration with delays |

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `SHOPIFY_INTEGRATION_PLAN.md` | Main integration architecture |
| `SHOPIFY_SETUP_GUIDE.md` | Setup instructions |
| `.claude/summons/integrations/shopify.md` | Quick reference |

---

*Created: 2026-02-03*
*Updated: 2026-02-03*
*Status: Phase 1 Complete - Phase 2 Ready*
*Owner: Integrations Team*
