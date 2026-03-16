# External Integrations

**Analysis Date:** 2026-03-10

## APIs & External Services

**E-Commerce / Inventory Sync:**
- Shopify - Multi-store inventory and order management
  - SDK/Client: REST API via custom `ShopifyClient` class (`src/lib/api/shopify/client.ts`)
  - Auth: OAuth 2.0 with `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET`
  - Endpoints: `/api/integrations/shopify/auth` (initiate), `/api/integrations/shopify/callback` (redirect URI)
  - Rate Limiting: Distributed via Upstash Redis - 35 calls/second per store (Shopify allows 40/sec)
  - Features:
    - Order sync: `src/lib/api/shopify/order-sync.ts`
    - Inventory sync: `src/lib/api/shopify/inventory-sync.ts` (bulk operations via `bulk-inventory.ts`)
    - Fulfillment tracking: `src/lib/api/shopify/fulfillment-sync.ts`
    - Returns handling: `src/lib/api/shopify/returns-sync.ts`
    - Incoming/pending orders: `src/lib/api/shopify/incoming-sync.ts`
    - Event tracking: `src/lib/api/shopify/event-sync.ts`
  - Webhooks: Incoming at `/api/webhooks/shopify/[integrationId]` (ngrok for testing)
  - Cron Sync: `/api/cron/sync-shopify-inventory` (daily inventory rebalancing)

**Accounting / Financial:**
- QuickBooks Online - Expense tracking and customer/invoice sync
  - SDK/Client: REST API via `src/lib/api/quickbooks.ts`
  - Auth: OAuth 2.0 with app credentials
    - App Credentials: `QUICKBOOKS_APP_CREDENTIALS` in `system_settings` (encrypted)
    - User Credentials: `QUICKBOOKS_CREDENTIALS` in `system_settings` (encrypted)
    - Token Management: Auto-refresh with 60-second buffer
  - API URLs:
    - Sandbox: `https://sandbox-quickbooks.api.intuit.com`
    - Production: `https://quickbooks.api.intuit.com`
  - Endpoints:
    - Auth: `/api/integrations/quickbooks/auth` (start OAuth)
    - Callback: `/api/integrations/quickbooks/callback` (OAuth redirect)
    - Test: `/api/integrations/quickbooks/test` (connection verification)
    - Sync: Multiple endpoints under `/api/integrations/quickbooks/sync/`
  - Entity Mapping: `qb_entity_map` table tracks IMS↔QB relationships
  - Account Mappings: Income, expense, shipping expense, bank accounts configured in `system_settings`
  - Sync Targets:
    - Customers: IMS clients → QB customers
    - Invoices: IMS invoices → QB invoices
    - Items: Services and rate cards → QB items
    - Expenses: Shipping costs → QB purchases/expenses
    - Supply costs → QB purchases/expenses
  - Webhooks: Incoming at `/api/webhooks/quickbooks` (expense notifications)

**Shipping & Logistics:**
- FedEx - Alcohol-compliant direct shipping (primary path)
  - SDK/Client: REST API via `src/lib/api/fedex.ts`
  - Auth: OAuth 2.0 with client_credentials flow
    - Credentials: `FEDEX_CREDENTIALS` in `system_settings` (encrypted)
    - Token Caching: In-memory with 60-second buffer
  - API URLs:
    - Sandbox: `https://apis-sandbox.fedex.com`
    - Production: `https://apis.fedex.com`
  - Endpoints:
    - Create Shipment: `/api/shipping/fedex/` (POST)
    - Settings: `/api/shipping/fedex/settings` (GET/POST for credentials)
    - Test: `/api/shipping/fedex/test` (connection verification)
  - Features:
    - Alcohol detection via client `industry` field (`requiresAlcoholCompliance()`)
    - Special services: Adult signature required for alcohol
    - Label storage: `shipping-labels` Supabase Storage bucket (base64 PDF)
    - Rate retrieval: Account (discounted) and list (retail) pricing
  - Data Model:
    - `outbound_orders.fedex_shipment_id` - FedEx transaction ID
    - `outbound_orders.label_url` - Signed URL to PDF label
    - `outbound_orders.shipping_method` - 'fedex' or 'manual'

- ShipStation - Non-alcohol carrier shipping (planned, structure in place)
  - Status: Integration endpoints prepared; awaiting implementation
  - Expected endpoints: `/api/shipping/shipstation/` (similar to FedEx pattern)

**Email & Communications:**
- Resend - Transactional email service
  - SDK/Client: `resend` npm package v6.7.0
  - Auth: API key from `RESEND_API_KEY` environment variable
  - Initialization: Lazy singleton in `src/lib/email.ts`
  - From Address: `noreply@7degreesco.com`
  - Email Types:
    - Order confirmed: `src/lib/email-templates/order-confirmed.ts`
    - Order shipped: `src/lib/email-templates/order-shipped.ts`
    - Order delivered: `src/lib/email-templates/order-delivered.ts`
  - Sending Functions: `src/lib/api/email.ts`
    - `sendEmail()` - Generic HTML email
    - `sendOrderConfirmedEmail()` - Order creation notification
    - `sendOrderShippedEmail()` - Shipment tracking email
    - `sendOrderDeliveredEmail()` - Delivery confirmation

## Data Storage

**Databases:**
- PostgreSQL (Supabase managed)
  - Connection: Via Supabase SDK (`@supabase/supabase-js`)
  - URL: `NEXT_PUBLIC_SUPABASE_URL`
  - Client: Browser-safe anon key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
  - Service Client: Service role key for webhooks/cron (`SUPABASE_SERVICE_ROLE_KEY`)
  - Authentication: Supabase Auth (JWT tokens via auth context)
  - RLS: Row-level security policies on all tables (users access own data, clients via `client_users` join)

**File Storage:**
- Supabase Storage (PostgreSQL-backed object storage)
  - Shipping Labels: `shipping-labels` bucket
    - Stores PDF labels as base64 during FedEx shipment creation
    - Accessible via signed URLs in `outbound_orders.label_url`
  - Images: Profile pictures, product photos (via Next.js Image component with Supabase CDN origins allowed)

**Caching:**
- Redis (Upstash Redis REST API)
  - Rate Limiting: Distributed rate limit state
  - URL: `UPSTASH_REDIS_REST_URL`
  - Auth: `UPSTASH_REDIS_REST_TOKEN`
  - Fallback: In-memory rate limiting when Redis unavailable

- Browser Cache (Client-side):
  - LocalStorage: Dashboard layout preferences (`dashboard-layout-{type}-{ownerId}`)
  - SWR: Data fetching cache with revalidation

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (custom JWT-based)
  - Implementation:
    - Server: `src/lib/auth.ts` (server-side utilities)
    - Browser: `src/lib/supabase.ts` (session management via SSR)
    - Context: `src/lib/auth-context.tsx` (React context for user state)
    - Client Auth: `src/lib/client-auth.tsx` (separate context for portal/client users)
  - Methods:
    - Email/password sign-in and sign-up
    - Password reset workflow
    - Session persistence via cookies (Supabase SSR handles refresh)
  - Role-based access:
    - Internal users: Admin + warehouse staff
    - Client portal users: Via `client_users` table

## Monitoring & Observability

**Error Tracking:**
- None detected - Errors logged to console and Supabase only

**Logs:**
- Console logging throughout codebase (development)
- Supabase logs (via API client)
- No centralized logging service

**Debugging:**
- `TOKEN_ENCRYPTION_KEY` encryption status logged on failures
- Rate limit fallback logging when Redis unavailable
- API error responses include detailed messages from external services

## CI/CD & Deployment

**Hosting:**
- Vercel - Serverless platform for Next.js
  - Deployment: Next.js app with automatic git integration
  - API Routes: Serverless functions in `src/app/api/`
  - Cron Jobs: Scheduled via Vercel Crons
    - `/api/cron/daily-lot-expiration` (daily)
    - `/api/cron/daily-low-stock-alerts` (daily)
    - `/api/cron/daily-storage-snapshot` (daily)
    - `/api/cron/daily-velocity-reorder` (daily)
    - `/api/cron/expire-reservations` (daily)
    - `/api/cron/monthly-billing-run` (monthly)
    - `/api/cron/sync-shopify-inventory` (periodic)
  - Environment: `.env.local` variables managed via Vercel dashboard
  - Allowed Dev Origins: ngrok domains for Shopify webhook testing

**CI Pipeline:**
- None detected - Direct git push deployment to Vercel

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase API endpoint
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key (public)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role (secret, server-only)
- `RESEND_API_KEY` - Resend email service key
- `TOKEN_ENCRYPTION_KEY` - 64-char hex string for AES-256-CBC (generate: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis endpoint (optional, enables distributed rate limiting)
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis token (optional)
- `SHOPIFY_CLIENT_ID` - Shopify app client ID
- `SHOPIFY_CLIENT_SECRET` - Shopify app client secret
- `SHOPIFY_SCOPES` - Shopify OAuth scopes (comma-separated)
- `NEXT_PUBLIC_APP_URL` - Application URL (for OAuth redirects, webhook callback URLs)
- `DATABASE_URL` - PostgreSQL connection string (seed scripts only)

**Secrets location:**
- `.env.local` - Local development (git-ignored)
- Vercel Project Settings - Production environment variables
- Supabase `system_settings` table - Integration credentials (FedEx, QB) stored encrypted with `TOKEN_ENCRYPTION_KEY`

## Webhooks & Callbacks

**Incoming:**
- Shopify webhooks: `/api/webhooks/shopify/[integrationId]`
  - Events: Orders, inventory updates, fulfillments, returns
  - Verification: HMAC signature validation
  - Rate limit: 100 requests/60sec per integration

- QuickBooks webhooks: `/api/webhooks/quickbooks`
  - Events: Expense notifications, sync confirmations
  - Verification: Webhook verifier token (encrypted in `system_settings`)

**Outgoing:**
- Resend transactional emails (async)
- Shopify inventory updates (via API sync endpoints)
- QuickBooks entity sync (customers, invoices, expenses)
- FedEx shipment creation (returns label PDF URL for storage)

---

*Integration audit: 2026-03-10*
