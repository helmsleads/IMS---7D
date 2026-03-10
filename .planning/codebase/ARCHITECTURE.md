# Architecture

**Analysis Date:** 2025-03-10

## Pattern Overview

**Overall:** Dual-portal Next.js application with separate authentication and shells for internal warehouse staff and external client users.

**Key Characteristics:**
- Client-server architecture with Supabase as backend
- Route-based portal separation: `(internal)` and `(portal)` groups
- API layer in `src/lib/api/` with domain-specific modules (inventory, outbound, inbound, etc.)
- Component-based UI with reusable design system in `src/components/ui/`
- SWR for client-side data fetching and caching
- Row-level security (RLS) for multi-tenant data isolation

## Layers

**Presentation Layer:**
- Purpose: User-facing components and pages
- Location: `src/app/(internal)` and `src/app/(portal)` for page routes; `src/components/` for reusable UI
- Contains: Page components, layout wrappers, form components, modals, scanner interfaces
- Depends on: Hooks from `src/lib/hooks/`, API functions from `src/lib/api/`
- Used by: Browser/client directly

**API/Data Layer:**
- Purpose: Encapsulates all Supabase database operations and external integrations
- Location: `src/lib/api/` (60+ domain-specific modules)
- Contains: Query builders, mutations, transaction logic, third-party API integrations (FedEx, QuickBooks, Shopify)
- Depends on: Supabase client from `src/lib/supabase.ts`, encryption utilities
- Used by: Custom hooks (`use-api.ts`), Server API routes (`src/app/api/`)

**Authentication Layer:**
- Purpose: User identity and authorization
- Location: `src/lib/auth-context.tsx` (internal staff), `src/lib/client-auth.tsx` (portal clients)
- Contains: Auth providers, session management, role/permission checking
- Depends on: Supabase auth, local/session storage
- Used by: Layout providers, protected route components

**Backend API Routes:**
- Purpose: Server-side operations, webhooks, cron jobs, third-party integrations
- Location: `src/app/api/` organized by category: `cron/`, `integrations/`, `shipping/`, `webhooks/`, `supplies/`, `inventory/`
- Contains: Route handlers for scheduled tasks, OAuth flows, webhook receivers
- Depends on: `src/lib/supabase-server.ts`, `src/lib/api/` modules
- Used by: External services, scheduled tasks

**Type System:**
- Purpose: TypeScript contracts for database entities
- Location: `src/types/database.ts`
- Contains: Interfaces for all domain entities (Order, Product, Client, Inventory, etc.), enums for status values
- Depends on: Nothing
- Used by: Everywhere

## Data Flow

**Create Outbound Order (Portal to Warehouse):**

1. Client submits order form in `src/app/(portal)/portal/request-shipment/page.tsx`
2. Component calls `createOutboundOrder()` from `src/lib/api/outbound.ts`
3. API function:
   - Validates input via Supabase RLS
   - Creates order record in `outbound_orders` table
   - Calls `reserveOrderItems()` to lock inventory
   - Returns `OutboundOrderWithItems` interface
4. SWR hook invalidates `outbound-orders` cache via `cacheKeys.outboundOrders`
5. Warehouse staff sees new order in `src/app/(internal)/outbound/page.tsx` on next refresh
6. Staff processes order through scanner workflow (`PickingScanner`, `PackScanner`, etc.)
7. When shipped, calls `updateOutboundOrder()` with shipping details
8. System sends email notifications via `src/lib/api/email.ts`
9. Client receives shipment notification via `src/lib/api/notifications.ts`

**Inventory Adjustment:**

1. Staff scans products in `PickScanner` or `ReceivingScanner`
2. Scanner component calls `adjustStock()` from `src/lib/api/inventory.ts`
3. API creates `inventory_transactions` record for audit
4. Triggers `update_inventory` RPC to atomically update `inventory` table
5. If low-stock threshold breached, `sendInternalAlert()` fires notification
6. SWR hook batch-revalidates: inventory, low-stock, dashboard caches
7. Dashboard auto-refreshes (30-second interval) showing updated counts

**Dashboard Data Aggregation:**

1. Page loads `src/app/(internal)/dashboard/page.tsx`
2. Component calls `useDashboard()` hook which fetches via `getDashboardStats()`
3. API in `src/lib/api/dashboard.ts` runs parallel queries:
   - Count active products/clients (count: exact)
   - Sum inventory value across all locations
   - Filter low-stock items (qty_on_hand <= reorder_point)
   - Count orders by status with time filters
   - Fetch recent activity audit log
4. Results aggregate into `DashboardStats` interface
5. Widgets render stats from layout saved in Supabase (`dashboard_layouts` table)
6. Customizable via drag-drop in `DashboardCustomizer` component

**State Management:**
- Client state: React Context for auth (`AuthProvider`, `ClientProvider`)
- Page data: SWR with deduping interval (2s default, prevents duplicate requests)
- Transient UI state: React `useState()` in component
- Dashboard layouts: Three-tier persistence (Supabase DB → localStorage → preset defaults)
- Cache invalidation: Explicit via `invalidateInventory()`, `invalidateOrders()`, or blanket `invalidateAll()`

## Key Abstractions

**OutboundOrderWithItems:**
- Purpose: Represents complete order context (header + line items + metadata)
- Examples: `src/lib/api/outbound.ts` (definition), `src/app/(portal)/portal/request-shipment/page.tsx` (form), `src/app/(internal)/outbound/[id]/page.tsx` (detail view)
- Pattern: Nested join query with `client()` and `items:outbound_items` relations; items include `product` join for pricing/metadata

**InventoryWithDetails:**
- Purpose: Full inventory context for warehouse operations
- Examples: `src/lib/api/inventory.ts`, scanner components (`PickingScanner`, `ReceivingScanner`)
- Pattern: Joins inventory→product→location and optional sublocation; includes SKU, cost, reorder point for decision-making

**SWR Hook Pattern:**
- Purpose: Unified data fetching with built-in caching and revalidation
- Examples: `useProducts()`, `useInventory()`, `useOutboundOrders()` in `src/lib/hooks/use-api.ts`
- Pattern: Named cache keys, mutation triggers for invalidation, null-safe optional fetching (e.g., `useProduct(id || null)`)

**Scanner Component Pattern:**
- Purpose: Mobile-friendly barcode/manual entry interface for warehouse tasks
- Examples: `PickingScanner`, `ReceivingScanner`, `PackScanner`, `InspectionScanner` in `src/components/internal/`
- Pattern: HTML5 barcode input detection + keyboard handlers + API call to adjust inventory + local state for scanned items list

## Entry Points

**Root Layout:**
- Location: `src/app/layout.tsx`
- Triggers: All requests to the app
- Responsibilities: Global providers (SWR, Toast, Keyboard shortcuts), fonts, global CSS

**Auth Redirect Router:**
- Location: `src/app/page.tsx`
- Triggers: Request to `/`
- Responsibilities: Unauthenticated login page; on success, checks user type and redirects to `/inventory` (staff) or `/portal` (client)

**Internal Admin Shell:**
- Location: `src/app/(internal)/layout.tsx`
- Triggers: Any route in `/(internal)/*`
- Responsibilities: AuthProvider, ProtectedRoute wrapper, ensures staff auth before rendering child pages

**Internal Dashboard:**
- Location: `src/app/(internal)/dashboard/page.tsx`
- Triggers: Request to `/dashboard`
- Responsibilities: Loads customizable widget grid, fetches dashboard stats via SWR

**Portal Client Shell:**
- Location: `src/app/(portal)/layout.tsx`
- Triggers: Any route in `/(portal)/*`
- Responsibilities: ClientProvider, route-based public/protected logic, wraps in PortalShell sidebar

**Portal Dashboard:**
- Location: `src/app/(portal)/portal/dashboard/page.tsx`
- Triggers: Request to `/portal/dashboard`
- Responsibilities: Client-facing dashboard with order summaries, inventory, profitability metrics

## Error Handling

**Strategy:** Layered error recovery with user-friendly messaging.

**Patterns:**
- API Layer: Throws descriptive errors, logged to console for debugging
- Hook Layer: SWR captures errors, components check `.error` property
- Component Layer: `handleApiError()` utility converts technical errors to friendly messages
- UI Layer: Toast notifications for transient errors, inline validation messages for forms
- Database: RLS policies return permission errors; foreign key violations caught and mapped to "item in use" messages

## Cross-Cutting Concerns

**Logging:** Console-only via `console.error()` in `handleApiError()` and API functions; production error tracking not implemented (comment in `src/lib/api/notifications.ts` notes future Sentry integration)

**Validation:**
- Client-side: Form input validation in component state, pattern matching on user role
- Server-side: Supabase RLS policies enforce row-level authorization; stored procedures validate business rules (e.g., reserve quantity ≤ available quantity)

**Authentication:**
- Internal: Supabase Auth + staff role lookup in `users` table + AuthContext provides `isStaff` boolean
- Portal: Supabase Auth + client access lookup in `client_users` table + ClientContext provides multi-client switching and staff impersonation

**Notifications:**
- Email: `src/lib/api/email.ts` via Resend SDK for transactional emails (order shipped, low stock alerts)
- In-app: `src/lib/api/notifications.ts` creates notification records in database table
- Webhooks: Receiving webhooks for Shopify fulfillment sync at `src/app/api/webhooks/`

---

*Architecture analysis: 2025-03-10*
