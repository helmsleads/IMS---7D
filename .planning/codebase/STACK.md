# Technology Stack

**Analysis Date:** 2026-03-10

## Languages

**Primary:**
- TypeScript 5 - All source code, strict mode enabled
- React 19.2.3 - UI framework with JSX/TSX

**Secondary:**
- JavaScript - Configuration files, scripts
- SQL - Database queries via Supabase

## Runtime

**Environment:**
- Node.js - Server runtime for Next.js, version specified via `.nvmrc` (not enforced in package.json)
- Vercel Serverless (deployment target for API routes and cron jobs)

**Package Manager:**
- npm - Version specified by `package-lock.json`
- Lockfile: Present and committed

## Frameworks

**Core:**
- Next.js 16.1.1 - Full-stack framework (App Router, API routes, middleware)
  - App Router for page routing (`src/app/` directory structure)
  - API routes in `src/app/api/` for backend endpoints and webhooks
  - Middleware in `src/middleware.ts` for authentication/session handling
  - Image optimization via `next/image` with custom remote patterns
  - Environment variables loaded from `.env.local` and `.env`

**UI Components:**
- React 19.2.3 - Component framework
  - No component library dependency; custom UI components in `src/components/`
  - Uses `lucide-react` v0.562.0 for icons
  - Tailwind CSS v4 for styling (via `@tailwindcss/postcss` v4)
  - `clsx` v2.1.1 for conditional class names

**Data Visualization:**
- Recharts 3.7.0 - Charts and graphs for dashboard widgets

**Testing:**
- Vitest 4.0.18 - Test runner
  - Config: `vitest.config.ts`
  - Environment: Node.js (not jsdom)
  - Test patterns: `**/*.test.ts`, `**/*.test.tsx`
  - Coverage: Supports text, JSON, HTML reports
- Testing Library (React) 16.3.2 - Component testing utilities

**Build/Dev:**
- Tailwind CSS 4 - Utility-first CSS framework
- tsx 4.21.0 - TypeScript executor for scripts (seed.ts, etc.)
- PostCSS 4 - CSS processing (via Tailwind)
- Vitest 4.0.18 - Test runner/bundler for tests

## Key Dependencies

**Critical:**

- `@supabase/ssr` v0.8.0 - Browser SSR client for session management
  - Replaces deprecated `@supabase/auth-helpers-nextjs`
  - Uses browser-safe client in `src/lib/supabase.ts`

- `@supabase/supabase-js` v2.90.1 - Supabase JavaScript SDK
  - Direct database access via REST/PostgREST
  - Realtime subscriptions
  - Storage access (for shipping labels, images)
  - Service role key usage in `src/lib/supabase-service.ts` (server-side only)

- `swr` v2.3.8 - Data fetching library
  - Client-side data fetching with caching/revalidation
  - Used throughout UI pages for API integration

**Infrastructure & Integration:**

- `@upstash/ratelimit` v2.0.8 - Distributed rate limiting
  - Uses Upstash Redis for cross-instance rate limiting
  - Fallback to in-memory for local development
  - Implemented in `src/lib/rate-limit.ts`

- `@upstash/redis` v1.36.2 - Redis REST client
  - Enables distributed rate limiting across Vercel serverless instances
  - Required for production deployments with concurrent requests

- `resend` v6.7.0 - Email service SDK
  - Transactional email via Resend platform
  - Initialized in `src/lib/email.ts` with API key from `RESEND_API_KEY`
  - Email templates in `src/lib/email-templates/`

**Data Processing:**

- `papaparse` v5.5.3 - CSV parsing
  - Client-side CSV import/parsing
  - Used in inventory/supplies import flows

- `xlsx` v0.18.5 - Excel file handling
  - Export to Excel, read Excel files
  - Spreadsheet import/export features

- `html5-qrcode` v2.3.8 - QR code scanning
  - Browser-based QR code scanning
  - Warehouse scanning workflows (receiving, picking, packing, pallet breakdown)

**UI/DX:**

- `@dnd-kit/*` v6-10 - Drag-and-drop library
  - `@dnd-kit/core` v6.3.1 - Core library
  - `@dnd-kit/sortable` v10.0.0 - Sortable functionality
  - `@dnd-kit/utilities` v3.2.2 - Helper utilities
  - Used for dashboard layout customization

- `lucide-react` v0.562.0 - Icon library
  - SVG-based React icon components
  - Consistent icon set across UI

**Node.js Utilities:**

- `pg` v8.18.0 - PostgreSQL client
  - Used in seed scripts (`scripts/seed.ts`)
  - Direct database seeding and setup

- `dotenv` v17.2.3 - Environment variable loading
  - Dev dependency for loading `.env.local` in scripts

## Configuration

**Environment:**
- Variables loaded from:
  - `.env.local` - Local development/deployment secrets (not committed)
  - `.env` - Shared configuration (if present)
- Required env vars for operation:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key (safe for browser)
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role (server-only)
  - `RESEND_API_KEY` - Resend email service API key
  - `TOKEN_ENCRYPTION_KEY` - 64-char hex string for token encryption (AES-256-CBC)
  - `UPSTASH_REDIS_REST_URL` - Upstash Redis REST endpoint (optional, fallback to in-memory)
  - `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis authentication token (optional)
  - `SHOPIFY_CLIENT_ID` - Shopify app client ID
  - `SHOPIFY_CLIENT_SECRET` - Shopify app client secret
  - `DATABASE_URL` - PostgreSQL connection string (for seed scripts, pg client)
  - `NEXT_PUBLIC_APP_URL` - Application URL (for OAuth redirects, webhooks)

**Build:**
- `tsconfig.json` - Strict TypeScript configuration
  - Target: ES2017
  - Module: esnext
  - Path aliases: `@/*` → `./src/*`
  - Strict mode enabled

- `next.config.ts` - Next.js configuration
  - Image remote patterns: Supabase CDN, Unsplash, placeholders
  - ngrok dev origins allowed (for Shopify webhook testing)

- `vitest.config.ts` - Vitest test runner configuration
  - Environment: node (not jsdom)
  - Coverage reporters: text, json, html
  - Alias resolution for `@/` imports

## Platform Requirements

**Development:**
- Node.js 18+ (for TypeScript, tsx, build tools)
- npm 9+ (package manager)
- TypeScript 5 (type checking)
- Vercel CLI (optional, for local emulation)

**Production:**
- Vercel (hosting, serverless functions for API routes and cron jobs)
- Supabase (PostgreSQL database, auth, storage, realtime)
- Upstash (distributed Redis for rate limiting)
- Resend (transactional email)
- Shopify (e-commerce integration)
- FedEx (shipping API integration)
- QuickBooks Online (accounting sync)

---

*Stack analysis: 2026-03-10*
