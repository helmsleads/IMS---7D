# Shopify Integration

## Overview

The Shopify integration connects client stores to the IMS warehouse system. It supports bidirectional sync for inventory, orders, fulfillment, returns, and incoming inventory (ASNs). All sync operations are logged to `integration_sync_logs` for visibility and debugging.

## Architecture

```
src/lib/api/shopify/
  client.ts                 # ShopifyClient class (REST + GraphQL, rate limiting)
  inventory-sync.ts         # IMS -> Shopify inventory + price sync
  order-sync.ts             # Shopify -> IMS order import
  fulfillment-sync.ts       # IMS -> Shopify fulfillment notifications
  returns-sync.ts           # IMS -> Shopify refund creation
  incoming-sync.ts          # IMS -> Shopify incoming inventory updates
  event-sync.ts             # Event-driven sync triggers (debounced)
  bulk-inventory.ts         # GraphQL batch inventory updates (100/batch)
  sync-logger.ts            # Non-blocking sync log writer + 30-day cleanup
  location-management.ts    # Shopify location creation/lookup
  product-mapping.ts        # SKU-based product mapping

src/app/api/integrations/shopify/
  install/route.ts          # OAuth initiation (redirect to Shopify)
  callback/route.ts         # OAuth callback (token exchange, webhook registration)
  [integrationId]/
    sync-orders/route.ts    # POST - manual order sync
    sync-inventory/route.ts # POST - manual inventory sync
    sync-logs/route.ts      # GET  - sync activity log

src/app/api/cron/
  sync-shopify-inventory/route.ts   # Cron job (hourly inventory sync)

src/app/api/webhooks/shopify/
  [integrationId]/route.ts  # Incoming webhooks (orders, inventory changes)

src/app/(portal)/portal/integrations/
  page.tsx                  # Client-facing integration management UI
```

## Sync Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
| `inventory` | outbound | event, cron, manual | Push IMS stock levels to Shopify |
| `price` | outbound | event, cron, manual | Push product prices to Shopify variants |
| `orders` | inbound | manual, webhook | Import Shopify orders as outbound requests |
| `fulfillment` | outbound | event | Notify Shopify when orders are shipped |
| `return` | outbound | event | Create Shopify refunds for processed returns |
| `incoming` | outbound | event | Update Shopify inventory for incoming ASNs |

## ShopifyClient

Located in `client.ts`. Wraps the Shopify Admin API with:

- **REST methods**: `get`, `post`, `put`, `delete`
- **GraphQL method**: `graphql<T>(query, variables)` — posts to `/admin/api/2024-01/graphql.json`
- **Proactive rate limiting**: Distributed via Upstash Redis (`checkShopifyApiRateLimit`)
- **Reactive rate limiting**: Reads `X-Shopify-Shop-Api-Call-Limit` header, pauses at 90%
- **429 handling**: Respects `Retry-After` header

## Inventory Sync Pipeline

`syncInventoryToShopify()` in `inventory-sync.ts` runs in three phases:

1. **Collect**: Query `product_mappings` + `inventory` tables, compute available quantity per product (`on_hand - reserved - buffer`)
2. **Batch update**: Send to Shopify via `batchUpdateInventory()` using GraphQL `inventorySetQuantities` mutation (100 items/batch). Falls back to individual REST `inventory_levels/set.json` calls on failure.
3. **Price sync**: If `auto_sync_prices` is enabled, update variant prices via REST `PUT /variants/{id}.json` (no GraphQL batch API for prices).

All results are logged to `integration_sync_logs` via `logSyncResult()`.

## GraphQL Bulk Operations

`bulk-inventory.ts` uses the `inventorySetQuantities` mutation:

```graphql
mutation inventorySetQuantities($input: InventorySetQuantitiesInput!) {
  inventorySetQuantities(input: $input) {
    inventoryAdjustmentGroup { reason }
    userErrors { field message }
  }
}
```

- Batches up to 100 items per call (Shopify limit)
- On `userErrors`, falls back to individual REST calls for the entire batch
- On network/GraphQL failure, also falls back to REST
- REST fallback includes 500ms delay between calls for rate limiting

## Sync Activity Logging

### Database

Table `integration_sync_logs`:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `integration_id` | UUID | FK to `client_integrations` |
| `sync_type` | TEXT | `inventory`, `orders`, `fulfillment`, `return`, `incoming`, `price` |
| `direction` | TEXT | `outbound` or `inbound` |
| `status` | TEXT | `success`, `partial`, `failed` |
| `items_processed` | INTEGER | Count of successfully processed items |
| `items_failed` | INTEGER | Count of failed items |
| `error_details` | JSONB | Array of `{ productId, error }` objects |
| `duration_ms` | INTEGER | Sync duration in milliseconds |
| `triggered_by` | TEXT | `cron`, `event`, `manual`, `webhook` |
| `metadata` | JSONB | Extra data (e.g., `{ pricesSynced: 5 }`) |
| `created_at` | TIMESTAMPTZ | Auto-set |

RLS: Clients can read their own logs via `client_users` join. Service role has full access.

### Logger

`logSyncResult()` in `sync-logger.ts` is **non-blocking** (fire-and-forget via `.then()`). Status is computed automatically:
- `items_failed === 0` -> `success`
- `items_processed === 0` -> `failed`
- Otherwise -> `partial`

`cleanupOldSyncLogs()` deletes entries older than 30 days. Called at the start of each cron run.

## Reverse Sync Detection

When Shopify inventory changes externally (e.g., manual edit in Shopify admin), the `inventory_levels/update` webhook fires. The handler in the webhook route:

1. Ignores changes at locations other than `shopify_location_id`
2. Looks up `product_mappings` by `external_inventory_item_id`
3. If mapping's `last_synced_at` is within 60 seconds, assumes it's our own sync and ignores
4. Otherwise, logs as an inbound warning (does **not** modify IMS inventory — warehouse is source of truth)

## Authentication Patterns

Three patterns depending on the caller:

| Caller | Auth Method |
|--------|-------------|
| Cron job | `Authorization: Bearer {CRON_SECRET}` header check |
| Webhook | HMAC-SHA256 signature verification against `webhook_secret` |
| Portal user | Supabase cookie auth via `createServerClient` + RLS ownership check |

## OAuth Flow

1. Client clicks "Connect Shopify" -> redirected to Shopify OAuth with scopes
2. Shopify redirects back to `/api/integrations/shopify/callback`
3. Callback verifies HMAC + nonce, exchanges code for access token
4. Token is encrypted via `encryptToken()` before storage
5. A dedicated "7 Degrees Co" location is created/found in Shopify
6. Webhooks are registered: `orders/create`, `orders/updated`, `orders/cancelled`, `inventory_levels/update`
7. Integration record saved to `client_integrations` table

## Portal UI

The integrations page (`portal/integrations/page.tsx`) shows:

- **Connection status**: Shop name, domain, connection date
- **Health metrics**: 4-column grid with last sync times and 24h success rate (green/amber/red dots)
- **Sync buttons**: "Sync Orders" and "Sync Inventory" with loading states
- **Sync settings**: Toggles for auto-sync inventory, auto-sync orders, auto-sync prices, and inventory buffer input
- **Sync activity log**: Collapsible section showing recent sync entries with type icons, status badges, item counts, duration, and relative timestamps. External inventory changes show amber warning styling.

## Settings

Stored in `client_integrations.settings` (JSONB):

| Key | Type | Description |
|-----|------|-------------|
| `auto_sync_inventory` | boolean | Enable event-driven inventory sync |
| `auto_sync_orders` | boolean | Enable automatic order import |
| `auto_sync_prices` | boolean | Push product prices to Shopify variants |
| `inventory_buffer` | number | Safety stock buffer subtracted from available qty |
| `shopify_location_id` | string | Shopify location ID for inventory operations |
| `default_location_id` | string | IMS warehouse location to sync from |
