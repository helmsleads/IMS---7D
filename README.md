# IMS - 7 Degrees Co

Warehouse Management System for 7 Degrees Co, a 3PL provider specializing in beverage fulfillment.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), React, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Integrations:** Shopify (OAuth, webhooks, inventory sync)
- **Deployment:** Vercel

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in Supabase URL, keys, and Shopify OAuth credentials

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
src/
  app/
    (internal)/     # Warehouse staff pages (dashboard, inventory, orders, etc.)
    (portal)/       # Client portal pages (order tracking, inventory, billing)
    api/
      cron/         # Scheduled jobs (billing, inventory sync, alerts)
      integrations/ # OAuth flows (Shopify)
      webhooks/     # Incoming webhooks (Shopify order events)
  lib/
    api/            # Business logic (browser client)
      shopify/      # Shopify integration modules
    supabase.ts     # Browser Supabase client
    supabase-service.ts  # Server-side service client
  components/
    ui/             # Reusable UI components (Card, Badge, Button, Modal, etc.)
  types/            # TypeScript type definitions
```

## Shopify Integration

Full Shopify integration for 3PL clients who sell through Shopify stores.

### Capabilities

| Feature | Direction | Trigger |
|---------|-----------|---------|
| Order import | Shopify -> IMS | Webhook (`orders/create`) or manual sync |
| Order updates | Shopify -> IMS | Webhook (`orders/updated`) |
| Order cancellation | Shopify -> IMS | Webhook (`orders/cancelled`) with reservation release |
| Fulfillment sync | IMS -> Shopify | On order ship (partial or full) |
| Inventory sync | IMS -> Shopify | Hourly cron + event-driven (immediate on ship, debounced on adjust/receive) |
| Incoming inventory | IMS -> Shopify | Hourly cron (product metafield `ims_7d.incoming_qty`) |
| Returns/refunds | IMS -> Shopify | On return completion |
| Product mapping | Bidirectional | Manual or auto-map by SKU |

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/api/shopify/client.ts` | Shopify REST API client with rate limiting |
| `src/lib/api/shopify/order-sync.ts` | Import Shopify orders into IMS |
| `src/lib/api/shopify/fulfillment-sync.ts` | Push fulfillments (partial/full) to Shopify |
| `src/lib/api/shopify/inventory-sync.ts` | Push inventory levels to Shopify |
| `src/lib/api/shopify/incoming-sync.ts` | Push incoming inventory as product metafields |
| `src/lib/api/shopify/returns-sync.ts` | Push completed returns as Shopify refunds |
| `src/lib/api/shopify/event-sync.ts` | Real-time inventory sync on IMS events |
| `src/lib/api/shopify/location-management.ts` | Shopify location setup and mapping |
| `src/lib/api/integrations.ts` | Integration CRUD and settings |

### Configuration

Shopify integrations are configured per-client with these settings:

| Setting | Purpose |
|---------|---------|
| `auto_import_orders` | Auto-import new orders via webhooks |
| `auto_sync_inventory` | Enable scheduled + event-driven inventory sync |
| `default_location_id` | IMS location to use for inventory calculations |
| `shopify_location_id` | Target Shopify location for inventory updates |
| `inventory_buffer` | Safety stock buffer subtracted from available qty |
| `fulfillment_notify_customer` | Send Shopify shipping notifications |

### Environment Variables

```
SHOPIFY_CLIENT_ID=         # Shopify app client ID
SHOPIFY_CLIENT_SECRET=     # Shopify app client secret (also used for webhook HMAC)
CRON_SECRET=               # Authorization token for cron endpoints
```

## Cron Jobs

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `/api/cron/sync-shopify-inventory` | Hourly | Sync inventory + incoming qty to Shopify |
| `/api/cron/daily-storage-snapshot` | Daily | Snapshot pallet/shelf/bin counts for billing |
| `/api/cron/daily-low-stock-alerts` | Daily | Check reorder points, send alerts |
| `/api/cron/daily-lot-expiration` | Daily | Flag expiring lots (30/7/0 days) |
| `/api/cron/monthly-billing-run` | 1st of month | Generate invoices from billable events |
| `/api/cron/expire-reservations` | Daily | Release stale reservations (>48h) |

All cron endpoints require `Authorization: Bearer <CRON_SECRET>`.

## Key Concepts

- **Outbound Orders** - Pick, pack, ship workflow for client orders
- **Inbound Orders (ASN)** - Receiving workflow with lot tracking and inspection holds
- **LPNs** - License Plate Numbers for pallets and containers
- **Product Mappings** - Links IMS products to external platform variants (Shopify)
- **Reservations** - Soft-lock inventory on order confirmation, release on ship/cancel
- **Rate Cards** - Per-client billing rates for warehouse services
- **Workflow Profiles** - Per-client receiving rules (lot tracking, inspection, etc.)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.
