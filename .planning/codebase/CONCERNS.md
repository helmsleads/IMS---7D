# Codebase Concerns

**Analysis Date:** 2026-03-10

## Fire-and-Forget Async Operations

**Background Tasks Not Awaited:**
- Issue: Multiple API functions use `.catch()` on fire-and-forget operations without awaiting them or verifying completion
- Files: `src/lib/api/inbound.ts`, `src/lib/api/outbound.ts`, `src/lib/api/inventory.ts`, `src/lib/api/dock-appointments.ts`
- Examples:
  - `inbound.ts:372`: Shopify sync triggered with `.catch()` only
  - `inbound.ts:397`, `410`: Warehouse task creation fires without awaiting
  - `outbound.ts:526`, `541`, `549`: Email sends and invoices generated without confirmation
  - `inventory.ts:317`, `325`: Low stock alerts and Shopify sync fire without verification
- Impact:
  - Tasks may fail silently (errors only logged to console, not propagated to caller)
  - No retry mechanism if the operation fails
  - User sees "success" while background work incomplete
  - Database state may be inconsistent if async task fails
  - Difficult to debug when features don't work because background tasks silently failed
- Fix approach:
  - Audit each fire-and-forget usage to determine if it should be awaited or properly queued
  - Implement proper async task queue (e.g., Bull, RabbitMQ, or Supabase pg_cron for cron tasks)
  - At minimum, catch and log all errors with severity level, not just console.error
  - For critical operations (email, billing), await and throw on error rather than swallowing

## Large Component Files

**UI Logic Complexity:**
- Issue: Multiple page components exceed 2500+ lines, mixing data fetching, state management, and rendering
- Files:
  - `src/app/(internal)/outbound/[id]/page.tsx`: 3551 lines
  - `src/app/(internal)/clients/[id]/page.tsx`: 2799 lines
  - `src/app/(internal)/settings/system/page.tsx`: 2526 lines
  - `src/app/(internal)/inbound/[id]/page.tsx`: 2169 lines
- Impact:
  - Hard to test individual features
  - Difficult to maintain and refactor
  - Performance issues from re-rendering large trees
  - Cognitive load on developers
  - Higher chance of bugs due to complex state interactions
- Fix approach:
  - Break into smaller components (extract modals, tabs, sections into separate files)
  - Extract state management into custom hooks
  - Move data fetching to async server components or API routes
  - Extract complex form logic into separate component files
  - Aim for components under 600 lines

## Unhandled Promise Rejections

**Async Functions Without Full Error Paths:**
- Issue: Dynamic imports and async calls occasionally don't handle all error paths properly
- Files: `src/lib/api/inbound.ts` (lines 386-412)
- Example: `createWarehouseTask()` called inside `.then()` but rejection only partially handled
- Impact: Unhandled rejections may cause app crashes in production
- Fix approach: Use `try/catch` for all async/await patterns; avoid chained `.then/.catch` where possible

## Type Safety Issues

**`any` Type Assignments:**
- Issue: Explicit `any` types used to bypass type checking, reducing safety
- Files:
  - `src/lib/api/clients.ts:110`: `let client: any = null`
  - `src/lib/api/dashboard.ts:169`: `item.product as unknown as { unit_cost: number; container_type?: string | null } | null`
- Impact: Loss of type safety when accessing properties; errors only caught at runtime
- Fix approach:
  - Define proper interfaces for complex nested objects
  - Use type guards instead of `as unknown as` casts
  - Enable `noImplicitAny` stricter TypeScript checking
  - Replace `any` with `Record<string, unknown>` at minimum

## Missing Error Handling in Critical Flows

**Inventory Updates Without Rollback:**
- Issue: RPC calls to `update_inventory` and `update_inventory_with_transaction` can fail mid-flow without transaction rollback
- Files: `src/lib/api/inbound.ts:320`, `src/lib/api/inventory.ts:251`, `src/lib/api/transfers.ts:209-228`
- Impact:
  - If RPC fails after some operations succeed, inconsistent inventory state
  - No automatic compensation logic
  - User may not know if operation actually succeeded
- Fix approach:
  - Wrap RPC calls in Supabase transactions where available
  - Implement application-level rollback logic for complex multi-step operations
  - Add validation checks after critical updates
  - Log all inventory changes for audit trail and recovery

## No Test Coverage

**Untested Areas:**
- What's not tested:
  - API layer functions (all `src/lib/api/*.ts` files)
  - Complex business logic (inventory calculations, billing, reservations)
  - RLS policy enforcement
  - Integration with external services (FedEx, Shopify, QuickBooks)
  - Error handling paths
  - Edge cases in calculations
- Files: `src/__tests__/` exists only for webhook verification; no coverage of core logic
- Risk:
  - Regressions go undetected until production
  - Difficult to refactor with confidence
  - Complex business rules (like reservation logic) not validated
  - Performance issues not caught early
  - Security vulnerabilities in auth/RLS not verified
- Priority: **High** — Business logic should have >80% coverage

## Security Considerations

**Token Caching Without Expiration Check:**
- Risk: FedEx OAuth token cached in memory with 60s buffer, but no validation of actual expiration
- Files: `src/lib/api/fedex.ts:116-149`
- Current mitigation: `cachedToken` uses `expiresAt` timestamp
- Recommendations:
  - Add fallback to re-fetch if token validation fails on API call
  - Log token refresh events for audit
  - Consider storing encrypted token in Supabase instead of memory (survives server restarts)
  - Add metrics/alerts if token refresh fails repeatedly

**Credentials Stored in Database:**
- Risk: FedEx and other API credentials stored in `system_settings` table
- Files: `src/lib/api/fedex.ts:60-84`, `src/lib/api/encryption.ts`
- Current mitigation: Encrypted with `encryptToken()`
- Recommendations:
  - Verify encryption key rotation policy
  - Add audit logging for credential access
  - Consider using AWS Secrets Manager or HashiCorp Vault instead of database
  - Implement credential expiration/rotation reminders

## Incomplete TODO Items

**Blocking Features:**
- `src/app/(internal)/damage-reports/page.tsx`: `// TODO: Upload photos to storage and get URLs` — Damage photo feature not implemented
- `src/app/(internal)/outbound/[id]/page.tsx:` Multiple TODOs:
  - `// TODO: Implement actual notification system (email, webhook, etc.)`
  - `// TODO: Implement actual print functionality` (appears twice)
- `src/app/(internal)/reports/low-stock/page.tsx`: `// TODO: Implement actual email/notification sending via API`
- `src/app/(internal)/lots/[id]/page.tsx`: `// TODO: Open adjust inventory modal`
- Impact: Features partially stubbed or only partially functional
- Fix approach:
  - Complete photo upload for damage reports
  - Implement print functionality for orders
  - Complete email/notification system
  - Prioritize by user impact

## Performance Bottlenecks

**Dashboard Statistics Query Parallelization:**
- Issue: Multiple parallel Promise.all() calls in dashboard functions fetch data redundantly
- Files: `src/lib/api/dashboard.ts` (multiple locations: lines 88, 242, 451, 785, etc.)
- Problem: Each dashboard stat computation runs 10-15 parallel queries; repeated calls fetch same data
- Cause: No caching between requests; each page load runs full computation
- Improvement path:
  - Implement SWR or TanStack Query for client-side caching
  - Add Supabase realtime subscriptions for live updates instead of polling
  - Denormalize frequently-accessed stats into a `dashboard_cache` table updated by pg_cron
  - Add indexes on commonly filtered fields (status, created_at, client_id)

**Large Result Sets Without Pagination:**
- Issue: Some queries return all rows without pagination/limiting
- Files: `src/lib/api/inventory.ts` (inventory queries), `src/lib/api/dashboard.ts` (activity log)
- Impact: Memory usage grows with data; slow to display thousands of rows
- Fix approach: Implement cursor-based pagination or limit results to last 1000 rows with offset

## Fragile Areas

**Shopify Sync Logic:**
- Files: `src/lib/api/shopify/` (multiple sync modules)
- Why fragile:
  - Multiple sync modules (order, inventory, fulfillment, returns, event) with overlapping responsibilities
  - Fire-and-forget pattern means sync failures aren't reported
  - No idempotency guarantee if sync retries
  - Difficult to debug state mismatches between IMS and Shopify
- Safe modification:
  - Always wrap Shopify API calls in transaction-like logic
  - Add sync logs to track what succeeded/failed
  - Implement webhook signature verification for incoming webhooks
  - Test coverage: Every sync operation should have corresponding test

**Client Workflow Profile Fallback Logic:**
- Files: `src/lib/api/clients.ts:82-102`
- Why fragile:
  - Custom error handling tries to detect missing foreign key relationship
  - Falls back to alternate query if relationship missing
  - Will fail if error message wording changes in Supabase
- Safe modification:
  - Verify migration has been applied before attempting select
  - Use explicit error codes instead of message matching

## Scaling Limits

**In-Memory Token Cache (FedEx):**
- Current capacity: Single token cached per server instance
- Limit: Breaks in multi-instance deployments (each instance caches its own token, wastes API calls)
- Scaling path:
  - Move token cache to Redis with TTL
  - Or store short-lived token in Supabase with automatic cleanup

**Dashboard Computation:**
- Current capacity: Real-time queries compute stats on each request
- Limit: Each dashboard load triggers 10-15+ queries; slows down at scale
- Scaling path:
  - Pre-compute and cache stats in `dashboard_cache` table
  - Use pg_cron to refresh every 5-15 minutes
  - Implement incremental updates on data changes

## Dependencies at Risk

**Supabase RLS Policies Complex:**
- Risk: Row-level security policies allow data access; if policy logic broken, data leaks/restricted
- Files: Database schema (Supabase migrations)
- Impact: Incorrect policies could expose client data to other clients
- Migration plan:
  - Document RLS policies for each table
  - Add automated tests for RLS (Supabase test client)
  - Review policies during security audits
  - Implement granular client isolation tests

## Test Coverage Gaps

**Untested RLS Enforcement:**
- What's not tested: Row-level security policies at database layer
- Files: All queries that rely on RLS (nearly all API functions)
- Risk:
  - Client A could query Client B's data if policy broken
  - Data leaks undetected until audit
  - Refactoring Supabase schema accidentally breaks isolation
- Priority: **Critical** — Add RLS validation tests

**Untested Integration Flows:**
- What's not tested:
  - End-to-end inbound order → inventory → outbound order flow
  - Billing calculations and invoice generation
  - Reservation logic (reserve → release → cancel paths)
  - Shopify webhook receipt → IMS sync → inventory update
  - FedEx shipment creation → label storage → order update
- Files: Multiple modules working together
- Risk: Integration bugs slip to production; features like reservations behave unexpectedly
- Priority: **High** — Add integration tests for critical flows

**Untested Error Recovery:**
- What's not tested: How system recovers from transient errors (network timeout, 5xx response)
- Risk: User sees "success" but operation incomplete; no retry logic
- Priority: **Medium** — Add resilience tests

---

*Concerns audit: 2026-03-10*
