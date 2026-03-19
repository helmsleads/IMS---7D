# Phase 6: Shared UI Components - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Make every shared UI component brand-correct, accessible, and portal-capable. This covers: portal variants for 5 form/action components (Button, Input, Select, Textarea, Toggle), color corrections across 8 components (Alert, Badge, Spinner, StatCard, Toast, Toggle, Textarea, Pagination), ARIA and keyboard accessibility on 5 interactive components (Modal, SearchSelect, Breadcrumbs, Card, charts), gray-to-slate migration across ~19 components, dark mode class removal from 5 scanner components, StatusBadge refactor, and reduced-motion guards on StatCard and charts.

</domain>

<decisions>
## Implementation Decisions

### Portal Variant Mechanism
- **Claude's discretion** on implementation approach — either explicit `variant="portal"` prop or React context auto-detection from route. User doesn't have a preference on mechanism.
- On portal pages, `primary` always means cyan — no indigo on portal pages at all. Danger stays red.
- Portal components get **cyan focus rings** (`focus-visible:ring-cyan-500`) — fully branded experience, not just button colors.
- Portal Button: gradient `from-cyan-500 to-teal-600`, shadow `shadow-cyan-600/20`
- Portal Input/Select/Textarea: `focus-visible:ring-cyan-500`
- Portal Toggle: `bg-cyan-600` active state

### ARIA and Keyboard Accessibility
- **Full keyboard patterns**, not just attributes:
  - **Modal**: Full focus trap — Tab/Shift+Tab cycle within modal, Escape closes, focus returns to trigger on close. Plus `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, close button `aria-label="Close"` and `focus-visible:ring`.
  - **SearchSelect**: Full WAI-ARIA combobox pattern — Arrow keys navigate options, Enter selects, Escape closes dropdown, type-ahead filtering. Plus `role="combobox"`, `role="listbox"`, `role="option"`.
  - **Breadcrumbs**: `aria-label="Breadcrumb"` on nav, `aria-label="Go to dashboard"` on home icon, `focus-visible:ring` on all links.
  - **Card**: `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space) when onClick is present, `focus-visible:ring` on clickable variant.
- **Charts**: Hidden data tables — each chart includes a visually-hidden `<table>` with underlying data so screen readers can navigate actual values. Plus `aria-label` prop and `role="img"` wrapper.
- **All Recharts charts**: Respect `prefers-reduced-motion` via `isAnimationActive={!prefersReducedMotion}` using a `useReducedMotion` hook.

### Color Corrections (from audit action plan)
- Warning states: yellow → amber (`bg-amber-50 border-amber-400 text-amber-800`)
- Info states: blue → indigo (`bg-indigo-50 border-indigo-400`)
- Spinner: `border-t-blue-600` → `indigo-600`, add `role="status"` + `aria-label="Loading"` + `motion-safe:animate-spin`
- StatCard: iconColor default `bg-blue-50` → `bg-indigo-50`
- Toast: info blue → indigo, add warning variant (amber), `motion-safe:` prefix, `focus-visible` dismiss
- Toggle admin: checked `bg-blue-600` → `bg-indigo-600`
- Textarea admin: `focus-visible:ring-indigo-500`, `rounded-md`, slate palette
- Pagination: active `bg-gray-900` → `bg-indigo-600`, `focus-visible:ring` all buttons, slate palette

### Gray-to-Slate Migration
- Systematic replacement across all ~19 shared UI components: `gray-*` → `slate-*`
- Includes: Button, Table, Skeleton, Pagination, and all others still using gray-*

### Dark Mode Removal
- Remove `dark:` variant classes from 5 scanner components (outside MASTER.md light-mode-only scope)

### StatusBadge Refactor
- Replace Tailwind class string key (`variantMap["bg-green-100"]`) with direct semantic status → Badge variant mapping

### Claude's Discretion
- Portal variant mechanism (prop vs context) — pick best fit for codebase
- `useReducedMotion` hook implementation details
- Gray→slate migration order
- How to structure hidden data tables for charts
- Focus trap implementation approach for Modal (custom vs library)

</decisions>

<specifics>
## Specific Ideas

No specific design references beyond the audit action plan. The PRIORITIES.md items (Blocking #8-12, #19-20; High B-01 through B-40) define exact changes per component with file paths and effort estimates.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Button.tsx: 4 variants (primary/secondary/danger/ghost), variantStyles map pattern — portal variant fits naturally as 5th entry or via context override
- All form components (Input, Select, Textarea, Toggle) follow similar prop interface patterns
- 13 chart components in `src/components/ui/charts/` — all use Recharts
- globals.css now has complete token system including reduced-motion block (Phase 5)

### Established Patterns
- Components use `variant` prop with style maps (Button.variantStyles, Alert styles, Badge styles)
- Portal layout uses `(portal)` route group — detectable via pathname or layout wrapper
- `PortalSidebar` exists as portal-specific component — portal context is layout-level
- No existing BrandProvider or theme context

### Integration Points
- Portal pages import Button/Input/Select directly — will need to either pass variant or be wrapped in context
- 12 chart components: DonutChart, HorizontalBarChart, MiniBarChart, MiniLineChart, MiniSparkline, ScatterChart, StackedBarChart, TreemapChart, WaterfallChart, BulletChart, CalendarHeatmap, GaugeChart
- Modal used on 30+ pages across both admin and portal
- SearchSelect used on forms with dropdowns

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-shared-ui-components*
*Context gathered: 2026-03-19*
