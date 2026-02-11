# Changelog

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
