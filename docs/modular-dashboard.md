# Modular Dashboard System

## Overview

The dashboard system allows users to choose which widgets to show, resize them (half or full width), and drag-to-reorder. Both the admin and portal dashboards are fully customizable. Layouts are persisted per-user in Supabase (`dashboard_layouts` table) with localStorage as a fast cache. New users start with a curated recommended preset instead of seeing every widget.

## Architecture

```
src/lib/dashboard/
  types.ts                  # WidgetConfig, WidgetLayoutItem, DashboardLayout
  admin-widgets.ts          # Admin widget registry entries (39 widgets)
  portal-widgets.ts         # Portal widget registry entries (12 widgets)
  recommended-presets.ts    # Curated starter layouts for new users

src/lib/api/
  dashboard-layouts.ts      # Supabase CRUD for per-user layout persistence

src/lib/hooks/
  useDashboardLayout.ts     # Layout state, localStorage cache + Supabase sync, CRUD ops
  useMediaQuery.ts          # Breakpoint detection (DnD vs arrows)

src/components/dashboard/
  DashboardCustomizer.tsx   # Inline customizer panel (drag/arrows, toggle, resize)
  DynamicWidgetGrid.tsx     # Renders enabled widgets in user-defined order
  WidgetSizeSelector.tsx    # Half/Full toggle buttons

  admin/                    # Standalone admin widget components + barrel index
  portal/                   # Standalone portal widget components + barrel index
```

## Key Concepts

### Widget Config (Registry)

Static metadata for each widget. Lives in `admin-widgets.ts` / `portal-widgets.ts`.

```ts
interface WidgetConfig {
  id: string;           // unique key, e.g. "recent-activity"
  title: string;        // display name
  description: string;  // shown in customizer tooltip
  category: "core" | "operational" | "analytics" | "communication";
  defaultEnabled: boolean;
  defaultOrder: number;
  defaultSize: "half" | "full";
}
```

### Widget Layout Item (User State)

Per-user layout saved in localStorage.

```ts
interface WidgetLayoutItem {
  id: string;
  enabled: boolean;
  order: number;
  size: "half" | "full";
}
```

### Adding a New Widget

1. **Create the component** in `src/components/dashboard/admin/MyWidget.tsx` (or `portal/`).
   - Accept data as props + optional `loading` boolean.
   - Wrap content in `<Card>`.
   - No data fetching inside the widget — data comes from the dashboard page.

2. **Register it** in `admin-widgets.ts` (or `portal-widgets.ts`):
   ```ts
   {
     id: "my-widget",
     title: "My Widget",
     description: "What this widget shows",
     category: "analytics",
     defaultEnabled: true,
     defaultOrder: 14,  // next available
     defaultSize: "half",
   }
   ```

3. **Add to component map** in `admin/index.ts` (or `portal/index.ts`):
   ```ts
   import MyWidget from "./MyWidget";
   // ...
   export const ADMIN_WIDGET_COMPONENTS = {
     // ...existing
     "my-widget": MyWidget,
   };
   ```

4. **Wire up props** in the dashboard page's `widgetProps` map:
   ```ts
   const widgetProps = {
     // ...existing
     "my-widget": { myData, loading },
   };
   ```

That's it. The widget will automatically appear in the customizer panel for new users (with `defaultEnabled`), and for existing users it will append at the end (disabled) until they enable it.

### Layout Persistence

Layouts use a three-tier strategy: **Supabase** (source of truth) > **localStorage** (fast cache) > **Recommended preset** (fallback).

#### Supabase Table: `dashboard_layouts`

```sql
CREATE TABLE dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'client')),
  owner_id UUID NOT NULL,
  dashboard_type TEXT NOT NULL CHECK (dashboard_type IN ('admin', 'portal')),
  layout JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_id, dashboard_type)
);
```

- `owner_type = 'user'` + `owner_id = auth user UUID` for admin staff
- `owner_type = 'client'` + `owner_id = client UUID` for portal clients
- RLS: users can only read/write their own rows; clients access via `client_users` join or `clients.auth_id`

#### localStorage Cache

- Key: `dashboard-layout-{type}-{ownerId}` (per-user, e.g. `dashboard-layout-admin-abc123`)
- Format: `{ version: 1, widgets: WidgetLayoutItem[] }`
- Written synchronously on every mutation for instant feedback

#### Load Sequence

1. On mount: try localStorage cache (keyed to current user) for instant render
2. If no cache, show recommended preset
3. Async-fetch from Supabase; if found, update state + localStorage
4. If no Supabase row exists, user keeps seeing the recommended preset

#### Save Sequence

1. Every mutation (toggle/move/resize/reorder) writes to localStorage immediately
2. Supabase save is debounced (1 second) to avoid excessive writes

#### Reset

- `resetToDefaults` deletes the Supabase row, clears localStorage, reverts to recommended preset

#### API Functions (`src/lib/api/dashboard-layouts.ts`)

| Function | Description |
|----------|-------------|
| `loadDashboardLayout(ownerType, ownerId, dashboardType)` | SELECT from Supabase, returns `DashboardLayout \| null` |
| `saveDashboardLayout(ownerType, ownerId, dashboardType, layout)` | UPSERT into Supabase |
| `deleteDashboardLayout(ownerType, ownerId, dashboardType)` | DELETE from Supabase (for reset) |

### Recommended Presets

New users see a curated starting selection instead of all registry defaults. Defined in `src/lib/dashboard/recommended-presets.ts`.

**Admin preset (15 widgets enabled):**

| Order | Widget | Size |
|-------|--------|------|
| 0 | attention-required | full |
| 1 | orders-summary | half |
| 2 | inventory-overview | half |
| 3 | low-stock-alerts | half |
| 4 | orders-to-ship | half |
| 5 | expected-arrivals | half |
| 6 | order-velocity | half |
| 7 | fulfillment-funnel | half |
| 8 | on-time-shipment | half |
| 9 | inbound-outbound-flow | full |
| 10 | recent-activity | full |
| 11 | outstanding-invoices | half |
| 12 | pending-returns | half |
| 13 | unread-messages | half |
| 14 | quick-actions | half |

**Portal preset (9 widgets enabled):**

| Order | Widget | Size |
|-------|--------|------|
| 0 | profitability | half |
| 1 | unread-messages | half |
| 2 | active-orders | half |
| 3 | open-returns | half |
| 4 | inventory-value-over-time | full |
| 5 | order-fulfillment-speed | half |
| 6 | spending-breakdown | half |
| 7 | recent-orders | full |
| 8 | quick-actions | half |

`generateRecommendedLayout(type, registry)` merges the preset with the full registry — preset widgets are enabled at their specified order/size, remaining widgets are appended as disabled.

### Hook Signature

```ts
useDashboardLayout(
  dashboardType: "admin" | "portal",
  registry: WidgetConfig[],
  ownerId?: string,           // auth user ID (admin) or client ID (portal)
  ownerType?: "user" | "client"
)
```

When `ownerId` is omitted (loading state or unauthenticated), the hook falls back to localStorage-only behavior with no Supabase sync.

#### Merge Logic

On load, saved layout (from either Supabase or localStorage) is merged with the current registry:
  - Removed widgets are pruned
  - New widgets are appended (disabled, at the end)
  - Corrupted/missing data falls back to recommended preset

### Customizer UX

| Feature | Desktop (768px+) | Mobile (<768px) |
|---------|------------------|-----------------|
| Reorder | Drag-and-drop (@dnd-kit) | Up/Down arrow buttons |
| Resize | Half/Full toggle | Half/Full toggle |
| Toggle | Switch component | Switch component |
| Keyboard | Space to grab, arrows to move | Native |

### Widget Grid

- CSS Grid: `grid-cols-1 lg:grid-cols-2`
- `size: "full"` → `lg:col-span-2`
- `size: "half"` → default `col-span-1`
- Stagger animations via inline `animationDelay` (50ms * index)
- Empty state shows quick-add buttons for common widgets

## Admin Widgets (39)

See `src/lib/dashboard/admin-widgets.ts` for the full registry. Key widgets include:

| ID | Title | Category | Default Size |
|----|-------|----------|-------------|
| recent-activity | Recent Activity | operational | half |
| quick-actions | Quick Actions | core | half |
| attention-required | Attention Required | operational | half |
| low-stock-alerts | Low Stock Alerts | operational | half |
| expected-arrivals | Expected Arrivals | operational | half |
| orders-to-ship | Orders to Ship | operational | half |
| orders-summary | Orders Summary | core | half |
| inventory-overview | Inventory Overview | core | half |
| pending-returns | Pending Returns | communication | half |
| unread-messages | Unread Messages | communication | half |
| expiring-lots | Expiring Lots | analytics | half |
| inventory-aging | Inventory Aging | analytics | half |
| order-velocity | Order Velocity | analytics | half |
| outstanding-invoices | Outstanding Invoices | analytics | half |
| fulfillment-funnel | Fulfillment Funnel | operational | half |
| inbound-outbound-flow | Inbound vs Outbound | analytics | full |
| on-time-shipment | On-Time Shipment Rate | operational | half |
| daily-throughput | Daily Throughput | operational | half |
| order-cycle-time | Order Cycle Time | operational | half |
| abc-analysis | ABC Analysis | analytics | half |
| inventory-turnover | Inventory Turnover | analytics | half |
| stock-level-heatmap | Stock Level Heatmap | operational | full |
| ...and 17 more | | | |

## Portal Widgets (12)

See `src/lib/dashboard/portal-widgets.ts` for the full registry.

| ID | Title | Category | Default Size |
|----|-------|----------|-------------|
| unread-messages | Unread Messages | communication | half |
| open-returns | Open Returns | communication | half |
| profitability | This Month's Profitability | analytics | half |
| recent-orders | Recent Orders | operational | half |
| recent-arrivals | Recent Arrivals | operational | half |
| active-orders | Active Orders | operational | half |
| quick-actions | Quick Actions | core | half |
| inventory-value-over-time | Inventory Value Over Time | analytics | half |
| order-fulfillment-speed | Order Fulfillment Speed | operational | half |
| spending-breakdown | Spending Breakdown | analytics | half |
| product-performance | Product Performance | analytics | half |
| stock-projection | Stock Projection | operational | half |

## Dependencies

- `@dnd-kit/core` — drag-and-drop engine
- `@dnd-kit/sortable` — sortable list preset
- `@dnd-kit/utilities` — CSS transform helpers
- `recharts` — charting (pre-existing)
