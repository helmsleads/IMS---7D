# Changelog

## [2.4.0] - 2026-02-23

### Overview

Warehouse workflow automation adding a centralized task queue for inspection, putaway, and pick list operations. Replaces manual discovery-based work with directed task assignment, barcode-verified scanning, and FEFO-optimized pick allocation. Tasks auto-generate from existing receive/confirm flows and propagate through the pipeline (receive → inspect → putaway, confirm → pick).

---

### New Features

#### Central Task Queue (`warehouse_tasks` table)
Unified task management for all warehouse operations with lifecycle tracking, priority ordering, and user assignment.

- **Task types:** inspection, putaway, pick
- **Lifecycle:** pending → assigned → in_progress → completed/failed/cancelled
- **Priority:** 1-10 scale (perishable products auto-elevated to 8)
- **Auto-numbering:** Sequential task numbers via `generate_task_number` RPC (INS-YYYYMMDD-0001, PUT-..., PCK-...)
- **Polymorphic orders:** Links to both inbound and outbound orders via `order_id` + `order_type`

**Files:** `supabase/migrations/20260223_create_warehouse_tasks.sql`, `src/lib/api/warehouse-tasks.ts`

#### Inspection Workflow
Automated inspection task creation when clients have `requiresInspection` enabled in their workflow profile. Inventory is quarantined until inspection passes.

- **Auto-creation:** Tasks generated in `receiveInboundItem()`, `receiveWithLot()`, and `receiveInboundItemToPallet()` when client rules require inspection
- **Quarantine enforcement:** Inventory set to `status: 'quarantine'` until inspection completes
- **Configurable criteria:** Stored in `workflow_profiles.inspection_criteria` JSONB — per-criterion pass/fail with required flag
- **Result handling:** Pass → releases quarantine + auto-creates putaway task; Fail → creates damage report via `reportReceivingDamage()`
- **InspectionScanner component:** Barcode verification, dynamic checklist, per-criterion notes, audio feedback

**Files:** `src/components/internal/InspectionScanner.tsx` (new), `src/lib/api/inbound.ts` (modified), `src/app/(internal)/tasks/inspection/page.tsx` (new)

#### Putaway Task Queue
Directed putaway with suggested destinations and task-driven scanner mode.

- **Auto-creation:** Tasks generated after receiving (when inspection not required) or after inspection passes
- **Suggested destinations:** Pre-populated via `getSuggestedPutAway()` based on existing inventory locations
- **Priority elevation:** Perishable products (food/pharma) auto-assigned priority 8
- **Enhanced PutawayScanner:** Optional `taskId` prop enables task-driven mode — auto-loads product/LPN info, pre-displays suggested destination, "Next Task" button for batch putaway
- **Bulk claim:** "Claim Next 5" button for batch putaway runs

**Files:** `src/components/internal/PutawayScanner.tsx` (modified), `src/app/(internal)/tasks/putaway/page.tsx` (new)

#### Pick List Generation (FEFO)
Automatic pick list creation with First Expired, First Out allocation across lot and non-lot inventory.

- **Auto-generation:** Pick lists created when outbound order status changes to `confirmed` (after reservation succeeds)
- **FEFO allocation:** Allocates from earliest-expiring lots first, then falls back to non-lot inventory ordered by creation date
- **Multi-location splitting:** Automatically splits picks across multiple sublocations when single location has insufficient stock
- **Pick list items:** `pick_list_items` table tracks per-line allocation, pick progress, and short picks
- **Enhanced PickScanner:** Optional `taskId` prop loads pick list items (pre-ordered by sequence), shows exact location + lot number, "Short" button for short-pick reporting
- **Short pick handling:** Records short quantity without deducting inventory, logs activity
- **Auto-completion:** Task auto-completes when all pick items are picked or accounted for

**Files:** `src/components/internal/PickScanner.tsx` (modified), `src/app/(internal)/tasks/pick/page.tsx` (new)

#### Unified Task Dashboard (`/tasks`)
Central task management interface with filtering and real-time status.

- **Tab filters:** All | Inspection | Putaway | Pick
- **Status filters:** Active | Completed
- **My Tasks toggle:** Filter to current user's assigned tasks
- **Stat cards:** Pending counts per task type + total in-progress
- **Sortable table:** Task number, type icon, product, client, quantity, priority badge, status badge, age

**Files:** `src/app/(internal)/tasks/page.tsx` (new), `src/app/(internal)/tasks/layout.tsx` (new)

#### Task Detail Page (`/tasks/[id]`)
Renders differently per task type with integrated scanner launch.

- **Product info card:** Name, SKU, quantity requested
- **Locations card:** Source and destination with sublocation detail
- **Pick list table:** (pick tasks only) All allocated items with location, lot, qty, progress
- **Timeline:** Created → Assigned → Started → Completed with timestamps
- **Scanner integration:** "Claim & Start" / "Continue" button opens appropriate scanner (InspectionScanner / PutawayScanner / PickScanner) in modal

**Files:** `src/app/(internal)/tasks/[id]/page.tsx` (new)

#### Sidebar Navigation
Tasks nav group with sub-navigation and live badge count.

- **Navigation:** Tasks group in Operations section with children: All Tasks, Inspection, Putaway, Pick Lists
- **Badge count:** Polls pending task count every 60 seconds
- **Icons:** ClipboardCheck, ShieldCheck, ArrowDownToLine, ListChecks

**Files:** `src/components/internal/Sidebar.tsx` (modified)

#### Order Detail Integration
Task status visibility on inbound and outbound detail pages.

- **Inbound detail:** Shows task status badges (amber "Inspection Pending", blue "Putaway Pending") on received items, linked to task detail
- **Outbound detail:** Pick list section with progress (X of Y items picked, Z short), "Open Pick Scanner" button for task-driven picking

**Files:** `src/app/(internal)/inbound/[id]/page.tsx` (modified), `src/app/(internal)/outbound/[id]/page.tsx` (modified)

---

### Database Migration

**Tables created:**
- `warehouse_tasks` — Central task queue with FKs to products, clients, locations, LPNs, lots; indexes on `(task_type, status)`, `(assigned_to)`, `(order_id, order_type)`, `(priority DESC, created_at ASC)`
- `inspection_results` — Completed inspection records with JSONB results array and overall pass/fail/partial
- `pick_list_items` — Allocated pick lines with FEFO ordering, sequence numbers, and per-line status tracking

**RPCs created:**
- `generate_task_number(p_prefix)` — Returns `{PREFIX}-{YYYYMMDD}-{SEQ}` with 4-digit zero-padded sequence

**Columns added:**
- `workflow_profiles.inspection_criteria` JSONB (default `'[]'`)

**RLS policies:** Authenticated users can SELECT, INSERT, UPDATE on all three tables.

**Migration file:** `supabase/migrations/20260223_create_warehouse_tasks.sql` (requires manual application)

---

### Types Added

| Type | Description |
|------|-------------|
| `WarehouseTaskType` | `'inspection' \| 'putaway' \| 'pick'` |
| `WarehouseTaskStatus` | `'pending' \| 'assigned' \| 'in_progress' \| 'completed' \| 'failed' \| 'cancelled'` |
| `InspectionOverallResult` | `'pass' \| 'fail' \| 'partial'` |
| `PickListItemStatus` | `'pending' \| 'in_progress' \| 'picked' \| 'short' \| 'skipped'` |
| `WarehouseTask` | Full task interface (all columns) |
| `InspectionResultRecord` | Inspection result with JSONB results array |
| `PickListItem` | Pick line with allocation, pick, and short quantities |
| `InspectionCriterion` | Checklist item definition (id, label, type, required) |

Extended unions: `ReferenceType` += `'warehouse_task'`, `WorkflowStage` += `'inspection'`

**File:** `src/types/database.ts`

---

### Files Changed

**Created (10):**
1. `supabase/migrations/20260223_create_warehouse_tasks.sql` — Database migration
2. `src/lib/api/warehouse-tasks.ts` — Core task API: CRUD, lifecycle, queue queries, inspection, putaway, FEFO pick allocation (~910 lines)
3. `src/components/internal/InspectionScanner.tsx` — Scan-to-inspect with dynamic checklist
4. `src/app/(internal)/tasks/page.tsx` — Unified task dashboard
5. `src/app/(internal)/tasks/layout.tsx` — Layout wrapper
6. `src/app/(internal)/tasks/[id]/page.tsx` — Task detail page
7. `src/app/(internal)/tasks/inspection/page.tsx` — Inspection queue
8. `src/app/(internal)/tasks/putaway/page.tsx` — Putaway queue
9. `src/app/(internal)/tasks/pick/page.tsx` — Pick list queue

**Modified (10):**
1. `src/types/database.ts` — +86 lines: task types, interfaces, extended unions
2. `src/lib/api/inbound.ts` — +166 lines: auto-create inspection/putaway tasks in 3 receive functions + enhanced `placeOnInspectionHold`
3. `src/lib/api/outbound.ts` — +9 lines: auto-generate pick list on order confirmation
4. `src/lib/api/inventory-transactions.ts` — Added `'warehouse_task'` to local `ReferenceType`
5. `src/lib/api/scan-events.ts` — Added `'inspection'` to local `WorkflowStage`
6. `src/components/internal/PutawayScanner.tsx` — +119 lines: optional `taskId` prop, task-driven mode, "Next Task" button
7. `src/components/internal/PickScanner.tsx` — +151 lines: optional `taskId` prop, pick-list-items mode, short-pick handling
8. `src/components/internal/Sidebar.tsx` — +41 lines: Tasks nav group with children + badge count polling
9. `src/app/(internal)/inbound/[id]/page.tsx` — +41 lines: task status badges on received items
10. `src/app/(internal)/outbound/[id]/page.tsx` — +101 lines: pick list section, progress, task-driven scanner modal

---

### Workflow Diagram

```
Inbound Receive
    │
    ├── Client requires inspection?
    │   ├── YES → Create inspection task (INS-...) + quarantine inventory
    │   │           │
    │   │           ├── Pass → Release quarantine + create putaway task (PUT-...)
    │   │           └── Fail → Create damage report
    │   │
    │   └── NO → Create putaway task (PUT-...) directly
    │
    └── Putaway task → PutawayScanner confirms destination

Outbound Confirm
    │
    └── Reserve inventory → Generate pick list (PCK-...)
        │
        └── FEFO allocation → pick_list_items with sequence numbers
            │
            └── PickScanner → pick/short each item → auto-complete task
```

---

## [2.3.0] - 2026-02-13

### Overview

Shopify integration enhancements adding sync activity logging, manual inventory sync, health metrics, price sync, GraphQL bulk operations, and reverse sync detection. All sync operations now log to a centralized activity feed visible to clients, replacing server-console-only error visibility.

---

### New Features

#### Sync Activity Log (Foundation)
Centralized logging for all Shopify sync operations. Every sync (inventory, orders, fulfillment, returns, incoming, price) now records its result to `integration_sync_logs` with status, item counts, duration, error details, and trigger source.

- **Database table:** `integration_sync_logs` with indexes on `(integration_id, created_at)` and RLS policies for client access via `client_users` join
- **Non-blocking logger:** `logSyncResult()` fires and forgets so sync performance is unaffected
- **Auto-cleanup:** `cleanupOldSyncLogs()` deletes entries older than 30 days, runs during cron
- **API endpoint:** `GET /api/integrations/shopify/[id]/sync-logs` with `limit`, `offset`, `type` params
- **UI:** Collapsible "Recent Sync Activity" section in integration hub with sync type icons, status badges (green/amber/red), relative timestamps, trigger labels, and "Show more" pagination

**Files:** `src/lib/api/shopify/sync-logger.ts` (new), `src/app/api/integrations/shopify/[integrationId]/sync-logs/route.ts` (new)

#### Sync Inventory Now
Manual inventory sync button alongside the existing "Sync Orders" button. Uses the same auth pattern and rate limiting.

- **API endpoint:** `POST /api/integrations/shopify/[id]/sync-inventory` — calls `syncInventoryToShopify()` with `triggeredBy: 'manual'`
- **UI:** Cyan/teal gradient button matching portal brand; shows sync results in alert

**Files:** `src/app/api/integrations/shopify/[integrationId]/sync-inventory/route.ts` (new)

#### Sync Health Metrics
Replaced the static 2-column "Last Order/Inventory Sync" grid with a 4-column health overview computed client-side from sync logs:

| Metric | Description |
|--------|-------------|
| Last Order Sync | Most recent successful order sync timestamp with health dot |
| Last Inventory Sync | Most recent successful inventory sync timestamp with health dot |
| 24h Success Rate | Percentage of successful syncs in the last 24 hours |
| 24h Syncs | Count of successful/total syncs in the last 24 hours |

Health dot colors: green (<2h since last success), amber (2-6h), red (>6h or no data).

#### Price Sync
Optionally syncs IMS product `base_price` to Shopify variant prices during inventory sync.

- **Setting:** `auto_sync_prices` on `IntegrationSettings` — global toggle
- **Per-mapping:** Only syncs price when `mapping.sync_price` is also true
- **Logic:** After inventory update, calls `PUT /variants/{id}.json` with `price: String(base_price)`
- **Logging:** Price syncs logged separately as `sync_type: 'price'`
- **UI:** Third toggle "Auto-sync prices to Shopify" in Sync Settings

**Files:** `src/types/database.ts` (modified), `src/lib/api/shopify/inventory-sync.ts` (modified)

#### GraphQL Bulk Operations
Replaces per-product REST API calls with Shopify's `inventorySetQuantities` GraphQL mutation for up to 100x fewer API calls on large catalogs.

- **GraphQL client:** New `graphql<T>(query, variables?)` method on `ShopifyClient` — posts to `/admin/api/2024-01/graphql.json`, validates GraphQL-level errors
- **Batch updater:** `batchUpdateInventory()` batches up to 100 items per GraphQL call with automatic REST fallback if GraphQL fails
- **Refactored sync:** Inventory sync now collects all updates first, batch-sends via GraphQL, then does individual price syncs (no GraphQL API for prices)

**Files:** `src/lib/api/shopify/client.ts` (modified), `src/lib/api/shopify/bulk-inventory.ts` (new), `src/lib/api/shopify/inventory-sync.ts` (modified)

#### Reverse Sync Detection
Detects when inventory is changed directly in Shopify (outside IMS) and surfaces it as an amber warning in the activity log. Does NOT auto-adjust IMS inventory — the warehouse is the source of truth for physical goods.

- **Webhook:** Registers `inventory_levels/update` topic during OAuth callback
- **Handler logic:**
  1. Ignores changes at locations other than our `shopify_location_id`
  2. Looks up `product_mappings` by `external_inventory_item_id`
  3. If `last_synced_at` is within 60 seconds, assumes it's our own sync and ignores
  4. Otherwise logs as `direction: 'inbound'`, `triggered_by: 'webhook'` with warning metadata
- **UI:** Entries with inbound inventory direction render with amber background and "Inventory changed externally in Shopify" label

**Files:** `src/app/api/integrations/shopify/callback/route.ts` (modified), `src/app/api/webhooks/shopify/[integrationId]/route.ts` (modified)

---

### Logging Added to Existing Sync Functions

All existing sync functions now log their results via `logSyncResult()`:

| File | Function | Sync Type | Direction | Trigger |
|------|----------|-----------|-----------|---------|
| `inventory-sync.ts` | `syncInventoryToShopify` | inventory | outbound | event/cron/manual |
| `order-sync.ts` | `syncShopifyOrders` | orders | inbound | manual/webhook |
| `fulfillment-sync.ts` | `syncFulfillmentToShopify` | fulfillment | outbound | event |
| `returns-sync.ts` | `syncReturnToShopify` | return | outbound | event |
| `incoming-sync.ts` | `syncIncomingToShopify` | incoming | outbound | cron |
| `event-sync.ts` | Both trigger functions | (via inventory-sync) | outbound | event |
| Cron route | POST handler | (via inventory-sync) | outbound | cron |
| Webhook route | Order create handler | orders | inbound | webhook |

---

### Files Changed

**Created (4):**
1. `src/lib/api/shopify/sync-logger.ts` — Non-blocking sync logging utility + 30-day cleanup
2. `src/lib/api/shopify/bulk-inventory.ts` — GraphQL `inventorySetQuantities` batcher with REST fallback
3. `src/app/api/integrations/shopify/[integrationId]/sync-inventory/route.ts` — Manual inventory sync endpoint
4. `src/app/api/integrations/shopify/[integrationId]/sync-logs/route.ts` — Sync logs query endpoint

**Modified (11):**
1. `src/types/database.ts` — Added `IntegrationSyncLog`, `SyncType`, `SyncDirection`, `SyncStatus`, `SyncTrigger` types; added `auto_sync_prices` to `IntegrationSettings`
2. `src/lib/api/shopify/inventory-sync.ts` — `triggeredBy` param, logging, price sync, GraphQL batching refactor
3. `src/lib/api/shopify/order-sync.ts` — `triggeredBy` param + logging
4. `src/lib/api/shopify/fulfillment-sync.ts` — Success/failure logging
5. `src/lib/api/shopify/returns-sync.ts` — Success/failure logging
6. `src/lib/api/shopify/incoming-sync.ts` — Logging with error tracking
7. `src/lib/api/shopify/event-sync.ts` — Passes `triggeredBy: 'event'` to inventory sync
8. `src/lib/api/shopify/client.ts` — Added `graphql()` method for GraphQL API
9. `src/app/api/cron/sync-shopify-inventory/route.ts` — Passes `triggeredBy: 'cron'`, runs log cleanup
10. `src/app/api/webhooks/shopify/[integrationId]/route.ts` — `inventory_levels/update` handler, order webhook logging
11. `src/app/api/integrations/shopify/callback/route.ts` — Registers `inventory_levels/update` webhook
12. `src/app/(portal)/portal/integrations/page.tsx` — Sync inventory button, health metrics, activity log, price toggle

**Database Migration:**
- `integration_sync_logs` — Sync activity log table with indexes and RLS policies

---

## [2.2.0] - 2026-02-12

### Overview

Per-user dashboard layout persistence. Dashboard layouts are now stored per-user in Supabase instead of shared browser localStorage. New users see a curated recommended preset instead of every widget enabled.

---

### New Features

#### Per-User Dashboard Layouts
Dashboard customizations (enabled widgets, order, sizes) now persist to Supabase per user/client. Each admin staff member and portal client gets their own independent layout that follows them across devices.

- **Supabase table:** `dashboard_layouts` with RLS policies scoping access to own rows
- **Three-tier persistence:** Supabase (source of truth) > localStorage (fast cache) > recommended preset (fallback)
- **Debounced saves:** Mutations write to localStorage immediately, then debounce Supabase writes (1s)
- **Reset:** "Reset to Defaults" deletes the Supabase row and reverts to recommended preset

#### Recommended Default Presets
New users see a curated starting dashboard instead of all widgets enabled:
- **Admin preset:** 15 widgets (attention-required, orders-summary, inventory-overview, fulfillment-funnel, on-time-shipment, inbound-outbound-flow, etc.)
- **Portal preset:** 9 widgets (profitability, unread-messages, active-orders, inventory-value-over-time, order-fulfillment-speed, spending-breakdown, etc.)

Remaining registry widgets are appended as disabled and available in the customizer.

---

### Files Changed

**Created (2):**
1. `src/lib/dashboard/recommended-presets.ts` — Curated starter layouts and `generateRecommendedLayout()` function
2. `src/lib/api/dashboard-layouts.ts` — Supabase CRUD: `loadDashboardLayout`, `saveDashboardLayout`, `deleteDashboardLayout`

**Modified (3):**
1. `src/lib/hooks/useDashboardLayout.ts` — Added Supabase sync, per-user localStorage keys, debounced saves, recommended preset fallback
2. `src/app/(internal)/dashboard/page.tsx` — Pass `userId` and `"user"` to `useDashboardLayout`
3. `src/app/(portal)/portal/dashboard/page.tsx` — Pass `client.id` and `"client"` to `useDashboardLayout`

**Database Migration:**
- `create_dashboard_layouts_table` — Creates `dashboard_layouts` table with RLS policies

---

## [2.1.0] - 2026-02-12

### Overview

Critical Shopify integration fixes and missing features for 3PL operations. Fixes bugs that could cause overselling and ghost reservations, adds partial fulfillment, returns sync, incoming inventory visibility, and real-time event-driven inventory updates.

---

### Bug Fixes

| ID | Bug | File | Impact | Fix |
|----|-----|------|--------|-----|
| BF-1 | Inventory sync sums ALL IMS locations | `shopify/inventory-sync.ts` | Overselling when inventory is spread across multiple warehouses | Filters by `default_location_id` when set; preserves sum-all fallback |
| BF-2 | Cancellation webhook never releases reserved inventory | `webhooks/shopify/[integrationId]/route.ts` | Ghost reservations block stock indefinitely after Shopify cancellations | After status update, fetches order items, calls `release_reservation` RPC for each (`qty_requested - qty_shipped`) |
| BF-3 | Wrong column name `qty_ordered` (should be `qty_requested`) | `reservations.ts` | All reserve/release operations for outbound orders fail silently | Replaced 4 occurrences of `qty_ordered` with `qty_requested` |
| BF-4 | Settings UI checkboxes are cosmetic only | `integrations/page.tsx` | Toggling auto-import/auto-sync settings doesn't persist | Added controlled state, `onChange` handler calling `updateIntegrationSettings()`, disabled state while saving |

---

### New Features

#### Partial Fulfillment Sync (MF-1)
Ships a subset of items to Shopify instead of all-or-nothing. When order status changes to `shipped`, queries `outbound_items` for items with `qty_shipped > 0` and maps them to Shopify fulfillment order line items via `product_mappings`.

**Files:** `shopify/fulfillment-sync.ts`, `outbound.ts`

#### Returns Sync to Shopify (MF-2)
Completed returns automatically create Shopify refunds. Maps IMS product IDs to Shopify line items via variant ID lookups, calls `refunds/calculate.json` then `refunds.json`. Disposition `restock` maps to Shopify `restock_type: 'return'`, all others to `'no_restock'`.

**Files:** `shopify/returns-sync.ts` (new), `returns.ts` (trigger)

#### Incoming Inventory Sync (MF-3)
Pushes expected inbound quantities to Shopify as product metafields (`ims_7d.incoming_qty`). Queries open inbound orders (status: ordered/in_transit/arrived), calculates remaining per product (`qty_expected - qty_received`), and updates `product_mappings.incoming_qty`. Runs automatically after the regular inventory cron sync.

**Files:** `shopify/incoming-sync.ts` (new), `cron/sync-shopify-inventory/route.ts`

#### Event-Driven Inventory Sync (MF-4)
Real-time Shopify inventory updates triggered by IMS operations instead of waiting for the hourly cron. Two modes:
- **Immediate** (no debounce) — triggered on `shipOutboundItem()` to prevent overselling
- **Debounced** (5s window) — triggered on `adjustStock()` and `receiveInboundItem()` to batch rapid changes

Both look up `product_mappings` to find active integrations with `auto_sync_inventory` enabled.

**Files:** `shopify/event-sync.ts` (new), `inventory.ts`, `outbound.ts`, `inbound.ts`

---

### Files Changed

**Modified (11):**
1. `src/lib/api/reservations.ts` — BF-3
2. `src/lib/api/shopify/inventory-sync.ts` — BF-1
3. `src/app/(portal)/portal/settings/integrations/page.tsx` — BF-4
4. `src/app/api/webhooks/shopify/[integrationId]/route.ts` — BF-2
5. `src/lib/api/shopify/fulfillment-sync.ts` — MF-1
6. `src/lib/api/outbound.ts` — MF-1 caller, MF-4 trigger
7. `src/lib/api/returns.ts` — MF-2 trigger
8. `src/app/api/cron/sync-shopify-inventory/route.ts` — MF-3
9. `src/lib/api/shopify/index.ts` — barrel exports
10. `src/lib/api/inventory.ts` — MF-4 trigger
11. `src/lib/api/inbound.ts` — MF-4 trigger

**Created (3):**
1. `src/lib/api/shopify/returns-sync.ts` — MF-2
2. `src/lib/api/shopify/incoming-sync.ts` — MF-3
3. `src/lib/api/shopify/event-sync.ts` — MF-4

---

## [2.0.0] - 2026-02-11

### Overview

Major release adding operational workflows, automation engine, and comprehensive UI enhancements across the entire IMS platform. Includes 11 critical/high/medium bug fixes discovered through code review.

---

### Phase 1: Revenue & Compliance Cron Jobs

Automated background tasks that run on schedule via Next.js API routes (`/api/cron/*`).

| Cron Job | Schedule | What It Does |
|----------|----------|-------------|
| `daily-storage-snapshot` | Daily | Snapshots per-client pallet/shelf/bin counts for billing |
| `daily-low-stock-alerts` | Daily | Checks inventory against reorder points, sends email alerts |
| `daily-lot-expiration` | Daily | Flags lots expiring within 30/7/0 days, notifies clients |
| `monthly-billing-run` | 1st of month | Generates invoices from billable events + storage snapshots |
| `expire-reservations` | Daily | Releases reservations older than 48 hours back to available stock |
| `sync-shopify-inventory` | Daily | Syncs inventory levels to connected Shopify stores |

**Files:** `src/app/api/cron/` (6 route handlers), `src/lib/api/billing-automation.ts`, `src/lib/api/reservations.ts`, `src/lib/api/lot-expiration.ts`

---

### Phase 2: Operational Visibility

New pages and enhanced views for complete warehouse visibility.

#### Internal Pages (New)
- **Inventory Detail** (`/inventory/[id]`) — Product inventory across all locations with transaction history, type/date filters
- **Location Detail** (`/locations/[id]`) — Location info with sublocation management (zones, aisles, racks, shelves, bins)
- **Lot Management** (`/lots`, `/lots/[id]`) — Full lot lifecycle: create, track expiration, view contents
- **Damage Reports** (`/damage-reports`, `/damage-reports/[id]`) — Report, photograph, and resolve damage with inventory impact
- **Returns** (`/returns`, `/returns/[id]`) — Process returns with inspection, disposition, and restocking
- **Cycle Counts** (`/cycle-counts`, `/cycle-counts/[id]`) — Plan, execute, and reconcile inventory counts
- **Messages** (`/messages`) — Internal messaging with portal client conversations
- **Billing** (`/billing`, `/billing/[id]`) — Invoice management and billing overview
- **Client Billing** (`/clients/[id]/billing`) — Per-client billing settings, rates, payment terms
- **Client Settings** (`/clients/[id]/settings`) — Client-specific configuration
- **Client Users** (`/clients/users`) — Manage portal user accounts per client
- **Services** (`/services`, `/services/tiers`) — Service catalog with tiered pricing and add-ons
- **Supplies** (`/supplies`) — Track warehouse supply inventory and usage
- **Product Categories** (`/products/categories`) — Organize products by category
- **Reports** — Client profitability, lot expiration, returns summary, service usage, supply usage, reorder suggestions

#### Portal Pages (New)
- **Inventory Detail** (`/portal/inventory/[id]`) — Client's product inventory details
- **Inventory History** (`/portal/inventory/history`) — Transaction history for client's products
- **Lot Tracking** (`/portal/lots`, `/portal/lots/[id]`) — View lot details and expiration
- **Returns** (`/portal/returns`, `/portal/returns/[id]`) — Submit and track return requests
- **Messages** (`/portal/messages`) — Two-way messaging with warehouse team
- **Profitability** (`/portal/profitability`) — Revenue vs warehouse costs analysis
- **Services** (`/portal/services`) — View subscribed services and usage
- **Plan & Billing** (`/portal/plan`) — Current plan, invoices, payment history
- **Settings** (`/portal/settings`) — Account preferences and notification settings
- **Order Templates** (`/portal/templates`) — Save and reuse frequent order configurations
- **Integrations** (`/portal/settings/integrations`) — Shopify connection management

#### Enhanced Existing Pages
- **Dashboard** — Added revenue chart, billing summary, inventory health metrics, recent activity feed
- **Sidebar** — Collapsible sub-navigation with smart active-path highlighting
- **Portal Nav** — Expanded navigation matching new portal features

**Files:** 40+ new page files, enhanced `Sidebar.tsx`, `PortalNav.tsx`, `dashboard/page.tsx`

---

### Phase 3: Automation Engine

Workflow rules and automated notifications that reduce manual work.

#### Workflow Profiles (`/settings/workflows`)
Per-client inbound receiving rules:
- **Require Inspection** — Places received items on inspection hold before putaway
- **Auto-Create Lots** — Automatically generates lot numbers during receiving
- **Require Lot Tracking** — Enforces lot number entry for all received items
- **Require Expiration Dates** — Mandates expiration dates on lot-tracked items

Workflow profiles are assigned per-client and enforced during the receiving process. The receiving scanner and inbound detail page both validate against the active workflow rules.

#### Automated Notifications
- **Portal order notifications** — Clients automatically receive in-app messages when their order status changes (confirmed, picking, packed, shipped, delivered)
- **Internal shipped alerts** — Warehouse team gets email alerts when orders ship, including item count and tracking info
- **Notification preferences** — Clients can opt out of order update notifications via portal settings

#### Lot Number Generation
- Auto-incrementing sequence numbers backed by database queries
- Format: `LOT-YYYYMMDD-NNN` with configurable templates

**Files:** `src/lib/api/workflow-profiles.ts`, `src/lib/api/notifications.ts` (extended), `src/lib/api/inbound.ts` (extended), `src/app/(internal)/settings/workflows/`

---

### Phase 4: UI Enhancements

Targeted improvements to critical operational workflows.

#### 1. Inventory Transaction History
- Full transaction log on inventory detail page
- Filter by transaction type (receive, ship, transfer, adjust, etc.) and date range
- Before/after quantity snapshots with color-coded change indicators
- Reference linking to source orders, pallets, and lots

#### 2. Returns Processing Enhancement
- Location-aware restocking: select destination location per return item
- Inventory impact preview in Complete modal (green for restocked, red for disposed)
- Calls `receiveReturnItem()` to properly update inventory and log billing events
- Per-item error tracking: if one item fails, shows which succeeded and which failed

#### 3. Damage Report Resolution Enhancement
- Location selector for write-off source and restock destination
- Inventory impact preview showing quantity changes (deductions and additions)
- Re-resolve guard prevents double-processing resolved reports
- Proper `return_restock` transaction type for restocked items

#### 4. Order Confirmation Enhancement
- Confirmation modal shows per-item inventory availability
- Displays: quantity requested, total available, reserved, effective available
- Status badges: green (sufficient), yellow (tight), red (shortage)
- Warning banner when any items have insufficient stock
- Smart button label: "Confirm Anyway" vs "Confirm Order"

**Files:** `src/app/(internal)/inventory/[id]/page.tsx`, `src/app/(internal)/returns/[id]/page.tsx`, `src/app/(internal)/damage-reports/[id]/page.tsx`, `src/app/(internal)/outbound/[id]/page.tsx`

---

### Bug Fixes

#### Critical
| Bug | File | Impact |
|-----|------|--------|
| `qty_damaged` column doesn't exist — should be `quantity` | `damage-reports.ts` | ALL damage report inventory adjustments (write-off AND restock) were silently no-op. `undefined > 0` evaluates to `false`, skipping every adjustment. |
| `"system"` fallback is not a valid UUID | `notifications.ts` | Would crash the messages insert when no admin user found, since `sender_id` is a UUID column. Replaced with early return + `.maybeSingle()`. |

#### High
| Bug | File | Fix |
|-----|------|-----|
| `handleStatusUpdate` swallowed errors | `outbound/[id]/page.tsx` | Now returns `Promise<boolean>`, sets error state, modal only closes on success |
| `resolved_by` never populated | `damage-reports.ts` | Added `resolved_by: performedBy` to update data |
| `generateLotNumber` always used sequence 1 | `inbound.ts` | Made async, queries DB for last matching lot to auto-increment |
| Returns completion had no retry protection | `returns/[id]/page.tsx` | Tracks `processedIds`, stops on first failure with descriptive error |

#### Medium
| Bug | File | Fix |
|-----|------|-----|
| `.single()` errors on no rows | `notifications.ts` | Changed to `.maybeSingle()` for conversation lookup |
| Wrong transaction type for restocks | `damage-reports.ts` | `"adjust"` changed to `"return_restock"` |
| No re-resolve guard | `damage-reports/[id]/page.tsx` | Added `report.resolution !== "pending"` check |
| End-date off-by-one | `inventory/[id]/page.tsx` | Appends `T23:59:59.999Z` to end date |
| Modal size/badge inconsistency | `inbound/[id]/page.tsx` | Uses `isLotTrackingRequired()` consistently |

---

### Also Included

#### Shopify Integration
- OAuth flow for connecting Shopify stores
- Order sync (Shopify orders become outbound orders)
- Fulfillment sync (shipped orders update Shopify)
- Inventory level sync (daily cron)
- Webhook handling for real-time order updates
- Multi-location support with location mapping
- Product mapping between IMS and Shopify catalogs
- 81 tests covering encryption, webhooks, order transforms, rate limiting, location management

#### Pallet Breakdown Workflow
- Receive inbound items directly to pallets
- Case-aware quantity display (e.g., "72 Bottles (12 cases)")
- Pull items from pallets to shelf/rack/bin locations
- Scanner-driven mobile breakdown flow
- Auto-detect empty pallets

#### Data Import
- Spreadsheet import for inventory (parse, preview, apply)
- Spreadsheet import for supplies
- Client creation during import
- Duplicate SKU detection

#### Database Migrations
- `20260203_workflow_builder.sql` — Workflow profiles, rules, and client assignments
- `20260203_product_workflow_override.sql` — Per-product workflow rule overrides
- `20260203_add_shopify_order_columns.sql` — Shopify order tracking fields
- `20260203_add_shopify_location_tracking.sql` — Shopify location mapping
- `20260210_brand_aliases.sql` — Brand alias resolution for product matching

---

### Known Issues (Pre-existing, Not Introduced)
- Billing page uses `hint` prop not defined on `InputProps` interface (TypeScript error in `clients/[id]/billing/page.tsx`)

### Technical Notes
- Build: Next.js 16.1.1 with App Router
- Backend: Supabase (PostgreSQL + Auth + Storage)
- Tests: 81 passing (Vitest)
- All 196 files in commit `14a2c0e`
