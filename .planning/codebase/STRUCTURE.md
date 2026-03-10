# Codebase Structure

**Analysis Date:** 2025-03-10

## Directory Layout

```
IMS - 7D/
├── src/
│   ├── app/                           # Next.js App Router
│   │   ├── (internal)/                # Staff/warehouse portal (AuthProvider protected)
│   │   ├── (portal)/                  # Client portal (ClientProvider protected)
│   │   ├── api/                       # Server API routes (cron, webhooks, integrations)
│   │   ├── layout.tsx                 # Root layout with global providers
│   │   ├── page.tsx                   # Login page (redirect router)
│   │   └── globals.css                # Tailwind + custom styles
│   │
│   ├── components/
│   │   ├── ui/                        # Reusable design system (Button, Card, Modal, etc.)
│   │   ├── internal/                  # Warehouse staff components (scanners, forms)
│   │   ├── portal/                    # Client portal components
│   │   └── dashboard/                 # Shared dashboard widgets and customizers
│   │
│   ├── lib/
│   │   ├── api/                       # Domain-specific Supabase query modules (60+)
│   │   ├── hooks/                     # React hooks (use-api.ts, useDashboardLayout, etc.)
│   │   ├── utils/                     # Utility functions (date, formatting, error handling)
│   │   ├── dashboard/                 # Dashboard configuration and widget definitions
│   │   ├── email-templates/           # Email template generators
│   │   ├── auth-context.tsx           # Internal auth provider
│   │   ├── client-auth.tsx            # Portal auth provider + multi-client switching
│   │   ├── supabase.ts                # Browser Supabase client
│   │   ├── supabase-server.ts         # Server Supabase client
│   │   ├── supabase-service.ts        # Service role client for cron/webhook operations
│   │   ├── swr-config.tsx             # SWR provider wrapper
│   │   ├── keyboard-shortcuts.tsx     # Global command palette
│   │   ├── mobile-menu-context.tsx    # Mobile sidebar state
│   │   ├── encryption.ts              # Token encryption for credentials
│   │   └── rate-limit.ts              # Upstash Redis rate limiting
│   │
│   └── types/
│       └── database.ts                # TypeScript interfaces for all database entities
│
├── scripts/
│   └── seed.ts                        # Database seeding script
│
├── tsconfig.json                      # TypeScript config (path alias: @/*)
├── next.config.ts                     # Next.js config
├── package.json                       # Dependencies + scripts
└── .gitignore                         # Git exclusions

```

## Directory Purposes

**`src/app/(internal)/`:**
- Purpose: Staff warehouse management interface
- Contains: Page components organized by feature (inbound, outbound, inventory, products, clients, dashboard, etc.)
- Key features: Order management, inventory operations, reports, settings, tasks/scanners
- Auth: Protected by `AuthProvider` and `ProtectedRoute` in layout

**`src/app/(portal)/`:**
- Purpose: Client self-service portal
- Contains: Order tracking, inventory visibility, arrivals scheduling, billing, integrations
- Key features: Request shipment, view inventory, schedule dock arrivals, profitability reports
- Auth: Protected by `ClientProvider` with public login/password reset pages

**`src/app/api/`:**
- Purpose: Server-side operations not tied to page rendering
- Contains: Cron jobs (daily tasks), webhook receivers (Shopify), OAuth flows (QuickBooks, FedEx), integration handlers
- Subdirectories:
  - `cron/`: Scheduled tasks (lot expiration, low-stock alerts, billing runs, inventory sync)
  - `integrations/`: Third-party auth and data sync (QuickBooks, Shopify)
  - `shipping/`: FedEx label generation and settings
  - `webhooks/`: Inbound webhook handlers (Shopify fulfillment)
  - `supplies/`: Supply inventory operations
  - `inventory/`: Inventory adjustment endpoints

**`src/components/ui/`:**
- Purpose: Reusable, unstyled-but-tailored design system components
- Contains: Button, Card, Input, Select, Modal, Table, Badge, Spinner, Skeleton, Toast, Breadcrumbs, etc.
- Pattern: All components use Tailwind CSS with consistent color/spacing tokens
- Key files:
  - `Button.tsx`: Primary/secondary/tertiary variants with size options
  - `Modal.tsx`: Frosted glass backdrop with heavy shadow
  - `Table.tsx`: Sortable, paginated table with checkbox selection
  - `SearchSelect.tsx`: Autocomplete dropdown (used for product/client selection)

**`src/components/internal/`:**
- Purpose: Warehouse-specific components for staff users
- Contains: Scanners (QR/barcode), forms (product, client, location), modals (stock adjustment, transfers, shipping)
- Key files:
  - `Sidebar.tsx`: Dark gradient sidebar with indigo active states (264px normal, 72px collapsed)
  - `PickingScanner.tsx`, `ReceivingScanner.tsx`, `PackScanner.tsx`: Barcode scanning interfaces
  - `ProductForm.tsx`, `ClientForm.tsx`: Full CRUD forms with validation
  - `ShippingModal.tsx`: Dual-mode (FedEx API or manual carrier entry)
  - `ProtectedRoute.tsx`: Redirects unauthenticated users to login

**`src/components/portal/`:**
- Purpose: Client-facing portal components
- Contains: Client-specific UI and layouts
- Key files:
  - `PortalShell.tsx`: Top-level wrapper (sidebar + header layout)
  - `PortalSidebar.tsx`: Pill-style cyan navigation with client switcher
  - `PortalHeader.tsx`: Mobile-only header with menu toggle
  - `ClientProtectedRoute.tsx`: Client auth validation
  - `ScheduleArrivalForm.tsx`: Dock appointment scheduling
  - `DockCalendar.tsx`: Visual calendar for arrival scheduling

**`src/components/dashboard/`:**
- Purpose: Configurable dashboard widgets for both portals
- Contains: Widget grid renderer, customizer UI, widget previews
- Key files:
  - `admin/`: Admin dashboard widgets (sales summary, inventory status, AR aging, etc.)
  - `portal/`: Client dashboard widgets (orders, inventory, profitability)
  - `DynamicWidgetGrid.tsx`: Renders widgets from layout config
  - `DashboardCustomizer.tsx`: Drag-drop editor for widget positioning
  - `WidgetPreview.tsx`: Live preview during customization

**`src/lib/api/`:**
- Purpose: Domain-specific API modules wrapping Supabase operations
- Pattern: Each file exports typed interfaces + query/mutation functions
- Examples:
  - `inventory.ts`: `getInventory()`, `adjustStock()`, `getLowStockItems()`
  - `outbound.ts`: `createOutboundOrder()`, `updateOutboundOrder()`, `shipOrder()`
  - `inbound.ts`: `getInboundOrders()`, `confirmReceipt()`, `createInspectionTask()`
  - `products.ts`: `getProducts()`, `createProduct()`, `updateProduct()`
  - `dashboard.ts`: `getDashboardStats()` with parallel queries
  - `fedex.ts`: FedEx OAuth token management and shipment creation
  - `quickbooks.ts`: QuickBooks OAuth and sync operations
  - `notifications.ts`: Email + in-app notification creation
- Organization: Alphabetical by domain (60+ files)

**`src/lib/hooks/`:**
- Purpose: Custom React hooks for data fetching and UI behavior
- Key files:
  - `use-api.ts`: SWR hooks for all major entities (products, inventory, orders, etc.)
  - `useDashboardLayout.ts`: Three-tier persistence for dashboard customization
  - `useAnimatedNumber.ts`: Animated number counter for stat cards
  - `useAsyncData.ts`: Generic async data loading
  - `useMediaQuery.ts`: Responsive breakpoint detection

**`src/lib/utils/`:**
- Purpose: Shared utility functions
- Key files:
  - `error-handler.ts`: `handleApiError()` and `tryCatch()` for standardized error handling
  - `date-utils.ts`: Date formatting and manipulation
  - `formatting.ts`: Currency, phone, zip code formatting
  - `export.ts`: CSV/XLSX export builders
  - `spreadsheet-parser.ts`: Parse uploaded spreadsheets
  - `status.ts`: Status label/color utilities

**`src/lib/dashboard/`:**
- Purpose: Dashboard configuration and widget definitions
- Files:
  - `admin-widgets.ts`: Registry of admin dashboard widgets (15 total)
  - `portal-widgets.ts`: Registry of client portal widgets (9 total)
  - `recommended-presets.ts`: Default layouts for new users
  - `types.ts`: `Widget`, `WidgetConfig`, `DashboardLayout` interfaces

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML/global providers
- `src/app/page.tsx`: Login redirect router (checks user type on success)
- `src/app/(internal)/layout.tsx`: Staff auth wrapper
- `src/app/(internal)/dashboard/page.tsx`: Staff dashboard entry point
- `src/app/(portal)/layout.tsx`: Client auth wrapper with portal routing logic
- `src/app/(portal)/portal/dashboard/page.tsx`: Client dashboard entry point

**Authentication:**
- `src/lib/auth-context.tsx`: Staff auth provider (Supabase Auth + users table lookup)
- `src/lib/client-auth.tsx`: Client auth provider (multi-client support, staff impersonation)
- `src/lib/supabase.ts`: Browser client initialization
- `src/lib/supabase-server.ts`: Server-side client initialization
- `src/lib/supabase-service.ts`: Service role client for cron/admin operations

**Core Logic:**
- `src/lib/api/outbound.ts`: Order creation, shipping, fulfillment
- `src/lib/api/inventory.ts`: Stock adjustments, transfers, low-stock tracking
- `src/lib/api/inbound.ts`: Receiving workflow, inspection, putaway
- `src/lib/api/dashboard.ts`: Dashboard stats aggregation (81KB file, complex queries)
- `src/lib/api/fedex.ts`: FedEx OAuth and shipment label generation
- `src/lib/api/quickbooks.ts`: QuickBooks sync (customers, invoices, expenses)

**Type Definitions:**
- `src/types/database.ts`: All TypeScript interfaces matching Supabase schema

**Data Fetching:**
- `src/lib/hooks/use-api.ts`: Central SWR hook registry (350+ lines)

## Naming Conventions

**Files:**
- Domain API modules: Plural snake_case (`products.ts`, `outbound_orders.ts`) → exported as singular/action verbs (`getProduct()`, `createOutboundOrder()`)
- Components: PascalCase matching export name (`ProductForm.tsx`, `PickingScanner.tsx`)
- Utilities: camelCase with descriptive names (`error-handler.ts`, `date-utils.ts`)
- Pages: `page.tsx` for route index, `[param]` for dynamic routes
- Layouts: `layout.tsx` at any folder level

**Directories:**
- Feature folders: Lowercase with hyphens (`inbound`, `outbound`, `cycle-counts`)
- Component categories: Lowercase (`ui`, `internal`, `portal`, `dashboard`)
- API modules: Lowercase with hyphens matching domain (`brand-aliases`, `dock-appointments`)

**Functions:**
- Async data fetchers: `get*()` or `fetch*()` prefix (e.g., `getInventory()`, `fetchDashboardStats()`)
- Mutations: `create*()`, `update*()`, `delete*()`, `upsert*()` (e.g., `createProduct()`, `updateStock()`)
- Hooks: `use*()` prefix (e.g., `useInventory()`, `useDashboardLayout()`)
- Utilities: `handle*()`, `is*()`, `format*()` (e.g., `handleApiError()`, `formatCurrency()`)

**Variables:**
- State: camelCase (e.g., `isLoading`, `selectedClient`, `scanResult`)
- Constants: UPPER_SNAKE_CASE (e.g., `SELECTED_CLIENT_KEY`, `DEFAULT_PAGE_SIZE`)
- CSS classes: Tailwind utilities only (no custom class names in components)

## Where to Add New Code

**New Feature (e.g., New Business Entity):**
1. **Database schema first**: Define table in Supabase, set up RLS policies
2. **API module**: Create `src/lib/api/[feature].ts` with interfaces and CRUD functions
3. **Type definitions**: Add interfaces to `src/types/database.ts`
4. **Custom hooks**: Add fetch/mutation hooks to `src/lib/hooks/use-api.ts` if data fetching involved
5. **Pages**:
   - List page: `src/app/(internal)/[feature]/page.tsx`
   - Detail page: `src/app/(internal)/[feature]/[id]/page.tsx`
   - Edit/create: Modal or dedicated page at `src/app/(internal)/[feature]/new/page.tsx`
6. **Components**: Create feature-specific forms/modals in `src/components/internal/`
7. **Tests**: Add test files alongside implementation (e.g., `src/lib/api/[feature].test.ts`)

**New Warehouse Scanner Task:**
- Primary code: Create component in `src/components/internal/[TaskName]Scanner.tsx`
- API integration: Add mutation function to relevant `src/lib/api/[domain].ts`
- Page: Add route at `src/app/(internal)/tasks/[taskType]/page.tsx`
- Pattern: Follow `PickingScanner` or `ReceivingScanner` pattern (HTML5 barcode input + keyboard event handler + state for items + API call)

**New Component/Widget:**
- Implementation: `src/components/[category]/[ComponentName].tsx`
- If dashboard widget: Also register in `src/lib/dashboard/admin-widgets.ts` or `portal-widgets.ts`

**Utilities:**
- Shared helpers: `src/lib/utils/[purpose].ts` (e.g., `formatting.ts`, `date-utils.ts`)
- Error handling: Extend `src/lib/utils/error-handler.ts`
- Formatting: Add to `src/lib/utils/formatting.ts`

**UI Components:**
- New form field type: `src/components/ui/[FieldName].tsx`
- Follow pattern: Unstyled HTML + Tailwind classes, accept `className` prop for override
- Export in `src/components/ui/index.ts` if barrel file exists

## Special Directories

**`src/app/api/cron/`:**
- Purpose: Scheduled background tasks
- Generated: No (hardcoded routes)
- Committed: Yes
- Pattern: Each route returns `Response({ message: 'success' })` for cron verification
- Tasks: lot expiration, low-stock alerts, storage snapshots, billing runs

**`src/app/api/integrations/`:**
- Purpose: Third-party OAuth flows and webhook handlers
- Generated: No
- Committed: Yes
- Services: QuickBooks, Shopify
- Pattern: OAuth routes at `/auth`, callbacks at `/callback`, sync operations at `/sync/*`, settings at `/settings`

**`src/lib/email-templates/`:**
- Purpose: Email template generators (functions returning HTML)
- Generated: No
- Committed: Yes
- Pattern: Each file exports a function accepting data object, returns HTML string
- Used by: `src/lib/api/email.ts` which sends via Resend SDK

**`src/lib/dashboard/`:**
- Purpose: Widget registry and layout configuration
- Generated: No
- Committed: Yes
- Files: `admin-widgets.ts` (15 widgets), `portal-widgets.ts` (9 widgets), `recommended-presets.ts` (default layouts)
- Pattern: Widget objects include `id`, `component`, `defaultSize`, `metadata`

**`.next/`:**
- Purpose: Build output directory
- Generated: Yes (by `next build`)
- Committed: No (in .gitignore)

**`node_modules/`:**
- Purpose: Installed dependencies
- Generated: Yes (by npm install)
- Committed: No (in .gitignore)

---

*Structure analysis: 2025-03-10*
