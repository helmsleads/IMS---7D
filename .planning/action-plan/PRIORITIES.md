# UI/UX Action Plan: Priorities

> **Generated:** 2026-03-19
> **Source:** Synthesis of 524 raw findings — components.md (195), admin-pages.md (213), portal-pages.md (116)
> **Methodology:** Severity-first consolidation using root cause taxonomy (RC-01–RC-05, CC-01–CC-05)

---

## Summary Header

| Tier | Items | Raw Findings Resolved | Cap |
|------|-------|-----------------------|-----|
| Blocking | 20 | 133+ raw Blocking findings | ≤20 |
| High-Value | 40 | 196+ raw High findings | ≤40 |
| Quick Wins | 15 | — (cross-references Blocking/High) | None |
| Polish Backlog | 57+ | 149 Medium + 46 Low findings | None |
| **Total** | **60 action items** | **524 raw findings accounted for** | — |

**Multiplier key:** One component fix cascades to all pages that use it. Five portal component variants (items 8–12) resolve 38 Blocking findings across all 29 portal pages simultaneously.

---

## Blocking Tier (≤20 items)

> **Cap: 20 — must resolve before production release**
> Scanner safety + portal brand identity + ARIA/keyboard accessibility hard requirements.

| # | Item (Action) | Root Cause | Files | Effort | Resolves |
|---|---------------|-----------|-------|--------|---------|
| 1 | Fix PickingScanner: remove `size="sm"` from audio toggle (raw `<button p-2>`) and Pick list button | scanner tap target | `src/components/internal/PickingScanner.tsx` | XS | 2 Blocking findings |
| 2 | Fix PickScanner: remove `size="sm"` from audio toggle, decrement, increment, and Pick All buttons (4 buttons) | scanner tap target | `src/components/internal/PickScanner.tsx` | XS | 4 Blocking findings |
| 3 | Fix PackScanner: remove `size="sm"` from audio toggle and `-1` remove-from-carton button | scanner tap target | `src/components/internal/PackScanner.tsx` | XS | 2 Blocking findings |
| 4 | Fix ShipScanner: remove `size="sm"` from audio toggle button | scanner tap target | `src/components/internal/ShipScanner.tsx` | XS | 1 Blocking finding |
| 5 | Fix ReceivingScanner: add `min-h-[44px]` to audio toggle raw `<button p-2>`, lot scan trigger, and reset calendar button | scanner tap target | `src/components/internal/ReceivingScanner.tsx` | XS | 3 Blocking findings |
| 6 | Fix PalletBreakdownScanner: remove `size="sm"` from quick buttons ("1 unit"/"1 case"/"All"), "Start Over", "Done"; add `min-h-[44px]` to error dismiss `×` button; fix `text-xs` pallet info to `text-base` | scanner tap target + RC-04 | `src/components/internal/PalletBreakdownScanner.tsx` | XS | 6 Blocking findings |
| 7 | Fix BarcodeScanner: add `min-h-[44px]` to close button (`p-1`); fix instruction text from `text-sm` to `text-base`; fix secondary instruction from `text-xs` to `text-sm` | scanner tap target + RC-04 | `src/components/ui/BarcodeScanner.tsx` | XS | 3 Blocking findings |
| 8 | Add portal variant to Button component (`from-cyan-500 to-teal-600 focus-visible:ring-cyan-500`) | CC-04 | `src/components/ui/Button.tsx` | M | 38 Blocking portal findings (all 29 portal pages) |
| 9 | Add portal variant to Input component (`focus-visible:ring-cyan-500`) | CC-04 | `src/components/ui/Input.tsx` | M | Blocking on all portal form pages |
| 10 | Add portal variant to Select component (`focus-visible:ring-cyan-500`) | CC-04 | `src/components/ui/Select.tsx` | M | Blocking on all portal form pages |
| 11 | Add portal variant to Textarea component (`focus-visible:ring-cyan-500`) | CC-04 | `src/components/ui/Textarea.tsx` | M | Blocking on all portal form pages |
| 12 | Add portal variant to Toggle component (`bg-cyan-600` active state) | CC-04 | `src/components/ui/Toggle.tsx` | M | Blocking on portal settings/integrations pages |
| 13 | Fix Inventory Transfers scanner page: gray→slate throughout (5 text cells), remove `size="sm"` action buttons, fix `text-sm` date cell to `text-base` | RC-01 + scanner tap target + RC-04 | `src/app/(internal)/inventory/transfers/page.tsx` | XS | 6 Blocking inline overrides |
| 14 | Fix Task queue action buttons: remove `size="sm"` from all action buttons on Pick Queue, Putaway Queue, and Inspection Queue pages | scanner tap target | `src/app/(internal)/tasks/pick/page.tsx`, `tasks/putaway/page.tsx`, `tasks/inspection/page.tsx` | XS | 3 Blocking inline overrides across 3 scanner pages |
| 15 | Fix Location Sublocations scanner page: replace entire gray-*/blue-* palette with slate-*/indigo-*, fix all form inputs to `focus-visible:ring-indigo-500 border-slate-300` | RC-01 + RC-02 + scanner route | `src/app/(internal)/locations/[id]/sublocations/page.tsx` | S | 9 Blocking inline overrides (worst single page in audit) |
| 16 | Fix Pagination component: upgrade `w-9 h-9` (36px) to `min-w-[44px] min-h-[44px]` for scanner route usage on Pick/Putaway/Inspection queues | scanner tap target | `src/components/ui/Pagination.tsx` | S | 3 Blocking scanner-route instances |
| 17 | Fix request-shipment/confirmation page: replace `bg-blue-600`, `bg-blue-50`, `text-blue-600` with portal cyan equivalents | inline blue bleed | `src/app/(portal)/portal/request-shipment/confirmation/page.tsx` | XS | 3 Blocking inline overrides |
| 18 | Fix billing/plan and plan/invoice/[id] pages: replace `bg-blue-50`, `text-blue-600`, `border-blue-600` with portal cyan equivalents (3 pages, same pattern) | inline blue bleed | `src/app/(portal)/portal/plan/page.tsx`, `portal/plan/invoice/[id]/page.tsx` | XS | 6 Blocking inline overrides (2 pages) |
| 19 | Add `role="dialog"` + `aria-modal="true"` + `aria-labelledby` to Modal component dialog container | component ARIA | `src/components/ui/Modal.tsx` | S | 1 High-severity ARIA gap cascades to all modal usage across 30+ pages |
| 20 | Add ARIA combobox pattern to SearchSelect: `role="combobox"` on input, `role="listbox"` on dropdown, `role="option"` on items | component ARIA | `src/components/ui/SearchSelect.tsx` | M | 3 High ARIA findings; screen reader completely broken on SearchSelect |

**Blocking tier count: 20 / 20**

---

## High-Value Tier (≤40 items)

> **Cap: 40 — resolve in v2.0 iteration**
> Significant visual inconsistencies, accessibility gaps, and component color corrections that create scale-level credibility problems.

### Component Color Corrections (8 items)

| # | Item (Action) | Root Cause | Files | Effort | Resolves |
|---|---------------|-----------|-------|--------|---------|
| B-01 | Fix Alert component: warning yellow→amber (`bg-amber-50 border-amber-400 text-amber-800`), info blue→indigo (`bg-indigo-50 border-indigo-400`), add `focus-visible:ring` + `aria-label="Dismiss"` to close button | RC-02 + RC-03 | `src/components/ui/Alert.tsx` | XS | 4 findings; cascades to 40+ pages using Alert |
| B-02 | Fix Badge component: warning yellow→amber, info blue→indigo, add border pattern to all variants, fix shade on success/error variants | RC-02 | `src/components/ui/Badge.tsx` | S | 6 findings; cascades to 50+ pages using Badge |
| B-03 | Fix Spinner component: `border-t-blue-600`→`indigo-600`, `border-gray-200`→`slate-200`, add `role="status"` + `aria-label="Loading"`, add `motion-safe:animate-spin` | RC-01 + RC-02 | `src/components/ui/Spinner.tsx` | XS | 4 findings; cascades to 30+ pages using Spinner |
| B-04 | Fix StatCard component: iconColor default `bg-blue-50 text-blue-600` → `bg-indigo-50 text-indigo-600` | RC-02 | `src/components/ui/StatCard.tsx` | XS | 1 finding; fixes every dashboard StatCard across admin and portal |
| B-05 | Fix Toast component: info blue→indigo (`bg-indigo-50 border-indigo-200 text-indigo-600`), add warning variant (amber), add `motion-safe:` prefix on animation, add `focus-visible:ring` on dismiss button | RC-02 + RC-03 | `src/components/ui/Toast.tsx` | S | 4 findings + new warning variant |
| B-06 | Fix Toggle component: checked state `bg-blue-600`→`bg-indigo-600`, unchecked `bg-gray-200`→`bg-slate-200`, fix `focus:ring`→`focus-visible:ring-indigo-500` | RC-01 + RC-02 + RC-03 | `src/components/ui/Toggle.tsx` | XS | 3 findings; all admin toggle usages |
| B-07 | Fix Textarea admin focus ring: `focus:ring-blue-500`→`focus-visible:ring-indigo-500`, `rounded-lg`→`rounded-md`, gray→slate throughout | RC-01 + RC-02 + RC-03 | `src/components/ui/Textarea.tsx` | XS | 5 findings (portal variant is separate Blocking item #11) |
| B-08 | Fix Pagination: active page `bg-gray-900`→`bg-indigo-600`, add `focus-visible:ring` to all buttons, gray→slate throughout | RC-01 + RC-03 | `src/components/ui/Pagination.tsx` | S | 9 findings; admin pagination everywhere |

### Shared Component Accessibility Fixes (5 items)

| # | Item (Action) | Root Cause | Files | Effort | Resolves |
|---|---------------|-----------|-------|--------|---------|
| B-09 | Fix Breadcrumbs: add `aria-label="Go to dashboard"` to home icon link, add `focus-visible:ring` to all links, add `aria-label="Breadcrumb"` to nav element | RC-03 + component-specific | `src/components/ui/Breadcrumbs.tsx` | XS | 4 findings; cascades to 20+ detail pages |
| B-10 | Fix Card component: add `role="button"` + `tabIndex={0}` + `onKeyDown` handler when `onClick` is present, add `focus-visible:ring` to clickable variant | RC-03 + RC-05 | `src/components/ui/Card.tsx` | S | 2 findings; all clickable Card usages |
| B-11 | Fix Modal: add `aria-label="Close"` to close button + `focus-visible:ring` on close button (separate from Blocking #19 which adds role="dialog") | RC-03 + component-specific | `src/components/ui/Modal.tsx` | XS | 2 High findings; all modal usages |
| B-12 | Add `aria-label` prop + `role="img"` wrapper to all 12 chart components missing ARIA (DonutChart, HorizontalBarChart, MiniBarChart, MiniLineChart, MiniSparkline, ScatterChart, StackedBarChart, TreemapChart, WaterfallChart, BulletChart, CalendarHeatmap, GaugeChart) | component-specific | `src/components/ui/charts/` (12 files) | S | 12–15 High findings; fixes all reports pages inaccessible charts |
| B-13 | Add `prefers-reduced-motion` guards to Recharts animations: pass `isAnimationActive={!prefersReducedMotion}` via `useReducedMotion` hook to all chart components | CC-01 | All Recharts chart files in `src/components/ui/charts/` | S | Covers 13 components with `isAnimationActive` violations |

### Scanner Component Text Sizes (5 items)

| # | Item (Action) | Root Cause | Files | Effort | Resolves |
|---|---------------|-----------|-------|--------|---------|
| B-14 | Fix PickingScanner text sizes: `text-sm`→`text-base` on SKU, "picked" label, location hint badges, progress subtitle, "Complete" feedback text | RC-04 | `src/components/internal/PickingScanner.tsx` | XS | 5 High findings |
| B-15 | Fix PickScanner text sizes: `text-sm`→`text-base` on secondary product name, item count progress indicator | RC-04 | `src/components/internal/PickScanner.tsx` | XS | 2 High findings |
| B-16 | Fix PackScanner text sizes: `text-sm`→`text-base` on carton count, carton item count, carton stage, product name under SKU | RC-04 | `src/components/internal/PackScanner.tsx` | XS | 4 High findings |
| B-17 | Fix ShipScanner text sizes: `text-sm`→`text-base` on order number, progress text, carton status, carrier/tracking labels | RC-04 | `src/components/internal/ShipScanner.tsx` | XS | 5 High findings |
| B-18 | Fix ReceivingScanner text sizes: `text-sm`→`text-base` on SKU, remaining qty, lot form labels; fix calendar input to use `<Input>` component with indigo focus ring (not purple) | RC-04 + RC-02 | `src/components/internal/ReceivingScanner.tsx` | XS | 8 High findings |

### Admin Page Inline Color Corrections (10 items)

| # | Item (Action) | Root Cause | Files | Effort | Resolves |
|---|---------------|-----------|-------|--------|---------|
| B-19 | Fix Dashboard page: StatCard iconColor `bg-blue-50`→`bg-indigo-50`, remove decorative blob circles, fix `rounded-lg`→`rounded-md` on hero buttons, add `focus-visible:ring` to hero action links | RC-02 + RC-03 | `src/app/(internal)/dashboard/page.tsx` | XS | 4 findings |
| B-20 | Fix Inbound and Outbound list pages: status tab yellow→amber, blue→indigo, purple→slate/indigo on both pages (Ordered, In Transit, Arrived for Inbound; Pending, Confirmed, Processing for Outbound) | RC-02 | `src/app/(internal)/inbound/page.tsx`, `outbound/page.tsx` | XS | 8 findings across 2 pages |
| B-21 | Fix Tasks List page: putaway icon `bg-blue-50`→`bg-indigo-50`, task type icon `text-blue-600`→`text-indigo-600`, priority inline spans → use `<Badge>` component | RC-02 + component non-use | `src/app/(internal)/tasks/page.tsx` | XS | 4 findings |
| B-22 | Fix Lots List page: active tab `border-blue-500 text-blue-600`→indigo, count badges blue→indigo, search input `border-gray-300 focus:ring-blue-500`→slate/indigo, lot number links blue→indigo | RC-02 | `src/app/(internal)/lots/page.tsx` | XS | 5 High findings |
| B-23 | Fix Reports Hub page: icon colors `bg-blue-100 text-blue-600`→indigo, `bg-purple-100`→indigo, add `focus-visible:ring` to report card links | RC-02 + RC-03 | `src/app/(internal)/reports/page.tsx` | XS | 4 findings |
| B-24 | Fix Location Sublocations non-Blocking overrides: `bg-blue-100`/`text-blue-600` location summary icon→indigo, edit hover `text-blue-600`→indigo, print hover `text-purple-600`→slate | RC-02 | `src/app/(internal)/locations/[id]/sublocations/page.tsx` | XS | 3 High findings (non-scanner violations; Blocking ones in tier above) |
| B-25 | Fix Settings page: active sidebar tab `bg-blue-50 text-blue-600 border-blue-600`→indigo equivalent (`bg-indigo-50 text-indigo-600 border-indigo-600`) | RC-02 | `src/app/(internal)/settings/page.tsx` | XS | 1 High finding |
| B-26 | Fix Inventory List status map: quarantine `bg-yellow-100`→`bg-amber-50`, reserved `bg-blue-100`→`bg-indigo-50`, returned `bg-purple-100`→`bg-slate-100` | RC-02 | `src/app/(internal)/inventory/page.tsx` | XS | 3 High findings |
| B-27 | Fix Outbound orders list: source badge "portal" `bg-purple-100`→`bg-cyan-50 text-cyan-700`, "internal" badge gray→slate; verify all outbound status tabs use correct colors | RC-02 + RC-01 | `src/app/(internal)/outbound/page.tsx` | XS | 3 findings |
| B-28 | Fix Task Detail scanner page: back button `p-2`→`p-3` for 44px tap target, timeline `text-xs` timestamps→`text-sm`, blue timeline indicator→indigo | scanner tap target + RC-02 | `src/app/(internal)/tasks/[id]/page.tsx` | XS | 3 Blocking + 2 High findings |

### Portal Page Inline Color Corrections (7 items)

| # | Item (Action) | Root Cause | Files | Effort | Resolves |
|---|---------------|-----------|-------|--------|---------|
| B-29 | Fix portal orders/[id]: STATUS_CONFIG "packed" `text-indigo-700 bg-indigo-100`→cyan; "confirmed" `text-blue-700 bg-blue-100`→cyan/teal | inline indigo + blue bleed | `src/app/(portal)/portal/orders/[id]/page.tsx` | XS | 2 findings |
| B-30 | Fix portal inventory/[id] blue bleed: `text-blue-600`, `bg-blue-600`, `border-blue-600` lot tracking badge, shipment button, spinner → cyan equivalents | inline blue bleed | `src/app/(portal)/portal/inventory/[id]/page.tsx` | XS | 3 Blocking findings |
| B-31 | Fix portal inventory/history: "ship" transaction `text-blue-700 bg-blue-100`→cyan; "pack" transaction `text-indigo-700 bg-indigo-100`→cyan | inline blue + indigo bleed | `src/app/(portal)/portal/inventory/history/page.tsx` | XS | 2 findings |
| B-32 | Fix portal lots/[id]: "transfer" transaction `text-indigo-600`→cyan; "total shipped" `text-blue-600`→cyan | inline indigo + blue bleed | `src/app/(portal)/portal/lots/[id]/page.tsx` | XS | 2 findings |
| B-33 | Fix portal auth flow dark gradient: `forgot-password` and `reset-password` pages update background from `bg-slate-50` to dark gradient `from-slate-900 via-cyan-950 to-slate-900` matching client-login; replace raw `<input>` fields with `<Input>` component | auth brand + component non-use | `src/app/(portal)/forgot-password/page.tsx`, `reset-password/page.tsx` | XS | 5 High findings across 2 pages |
| B-34 | Fix portal templates page: `bg-blue-600` CTA button → `from-cyan-500 to-teal-600` gradient; `bg-blue-100 text-blue-600` icon container → `bg-cyan-100 text-cyan-600`; raw `<input>/<textarea>/<select>` → use design system components | inline blue bleed + component non-use | `src/app/(portal)/portal/templates/page.tsx` | S | 4 findings |
| B-35 | Fix portal integrations/shopify/location: `border-blue-500 bg-blue-50` selected location → `border-cyan-500 bg-cyan-50`; `bg-blue-50` info box → `bg-cyan-50`; `bg-gray-900` save button → `<Button variant="portal">` | inline blue bleed + RC-01 | `src/app/(portal)/portal/integrations/shopify/location/page.tsx` | XS | 3 findings |

### Cross-Cutting Fixes (5 items)

| # | Item (Action) | Root Cause | Files | Effort | Resolves |
|---|---------------|-----------|-------|--------|---------|
| B-36 | Add `@media (prefers-reduced-motion: reduce)` block to globals.css covering all custom keyframes (modal-scale-up/down, widget-enter, chart-enter) | CC-01 | `src/app/globals.css` | S | Fixes 17+ animated components at once; addresses CC-01 |
| B-37 | Add `prefers-reduced-motion` guard to `useAnimatedNumber` hook in StatCard | CC-01 | `src/components/ui/StatCard.tsx` (useAnimatedNumber hook) | XS | 1 Medium finding; StatCard number animation on every dashboard |
| B-38 | Systematic gray→slate migration in shared components: Button, Table, Skeleton, Pagination, and all other shared UI files still using gray-* | CC-02 (RC-01) | `src/components/ui/` codebase-wide | S | Closes ~65 Medium findings in 19 shared components |
| B-39 | Remove dark mode classes from scanner components: PickScanner, PackScanner, ShipScanner, ReceivingScanner, PutawayScanner (dark: variants are outside MASTER.md scope) | RC-05 | `src/components/internal/PickScanner.tsx`, `PackScanner.tsx`, `ShipScanner.tsx`, `ReceivingScanner.tsx`, `PutawayScanner.tsx` | M | 5 Medium findings across 5 scanner files |
| B-40 | Refactor StatusBadge variant mapping: replace Tailwind class string key (`variantMap["bg-green-100"]`) with direct semantic status → Badge variant mapping | RC-05 | `src/components/ui/StatusBadge.tsx` | S | 1 Medium finding; improves maintainability + correctness |

**High-Value tier count: 40 / 40**

---

## Quick Wins

> **No cap — High or Blocking severity + XS or S effort + disproportionate impact (resolves 5+ raw findings OR affects 10+ pages)**

Items marked with their tier and item number for traceability.

| # | Item | Tier | Item # | Effort | Impact |
|---|------|------|--------|--------|--------|
| 1 | Fix Alert warning+info colors + close button aria-label | High | B-01 | XS | Cascades to 40+ pages using Alert |
| 2 | Fix Badge warning+info colors + border pattern | High | B-02 | S | Cascades to 50+ pages using Badge |
| 3 | Fix Spinner: blue→indigo + `role="status"` + reduced motion | High | B-03 | XS | Cascades to 30+ pages using Spinner |
| 4 | Fix Toggle admin checked state: blue→indigo | High | B-06 | XS | All admin toggle usages across 15+ pages |
| 5 | Fix StatCard iconColor default: `bg-blue-50`→`bg-indigo-50` | High | B-04 | XS | Every dashboard across admin and portal |
| 6 | Add `prefers-reduced-motion` block to globals.css | High | B-36 | S | Fixes 17 animated components at once (CC-01) |
| 7 | Fix Breadcrumbs: aria-label + focus rings | High | B-09 | XS | Cascades to 20+ detail pages using Breadcrumbs |
| 8 | Fix Inventory Transfers scanner: gray→slate + remove `size="sm"` action buttons + fix `text-sm` date cell | Blocking | 13 | XS | 6 Blocking inline violations, 1 scanner page |
| 9 | Fix Task queue action buttons: remove `size="sm"` on Pick/Putaway/Inspection queues | Blocking | 14 | XS | Resolves Blocking on 3 scanner pages simultaneously |
| 10 | Add portal variant to Button (resolves 38 portal Blocking findings) | Blocking | 8 | M | 38 Blocking findings across all 29 portal pages |
| 11 | Gray→slate migration in Skeleton component (12 findings in one file) | High | B-38 | S | 12 Medium findings, 1 file |
| 12 | Gray→slate migration in Table component (16 findings in one file) | High | B-38 | S | 16 Medium findings, 1 file |
| 13 | Fix Textarea admin focus ring + gray→slate | High | B-07 | XS | 5 findings, form fields on 20+ pages |
| 14 | Fix Toast info blue→indigo | High | B-05 | XS | Toast usage on all pages with toasts (~30 pages) |
| 15 | Fix BarcodeScanner tap targets + text sizes (scanner instruction text) | Blocking | 7 | XS | 3 Blocking findings; cascades to all scanner routes that use BarcodeScanner |

---

## Polish Backlog

> **No cap — Medium and Low severity findings not captured in Blocking or High tiers.**
> Grouped by root cause. Briefer format (item, root cause, effort).

### Group 1: RC-01 gray→slate — Page-Level Inline Overrides (Medium)

These are page-level gray-* palette uses that persist after component-level fixes (B-38) are applied.

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-01 | Inbound orders list: PO number cell `text-gray-900`→slate, supplier cell gray→slate | RC-01 | XS |
| P-02 | Outbound orders list: order number cell, source badge "internal" gray→slate | RC-01 | XS |
| P-03 | Pallet Breakdown page: search input `border-gray-300`→slate, search icon `text-gray-400`→slate | RC-01 | XS |
| P-04 | Locations List: location name, address, total SKU cells — all gray→slate | RC-01 | XS |
| P-05 | Settings page: nav container `border-gray-200`, section header `bg-gray-50 border-gray-200`, inactive items `text-gray-600 hover:bg-gray-50` → slate | RC-01 | XS |
| P-06 | Lots List: inactive tab hover `hover:border-gray-300`, `text-gray-500 hover:text-gray-700` → slate | RC-01 | XS |
| P-07 | Portal request-shipment/confirmation: `text-gray-900`, `text-gray-600`, `border-gray-200` → slate | RC-01 | XS |
| P-08 | Portal inventory/[id]: `text-gray-900`, `text-gray-500`, `bg-gray-50` throughout → slate | RC-01 | XS |
| P-09 | Portal plan/invoice/[id]: `bg-gray-100` cancelled badge, gray text throughout → slate | RC-01 | XS |
| P-10 | Portal lots/[id]: `text-gray-900`, `text-gray-500`, `bg-gray-50` throughout → slate | RC-01 | XS |
| P-11 | Portal lots/page: `text-gray-900`, `bg-gray-100`, `border-gray-200` → slate | RC-01 | XS |
| P-12 | Portal shopify/products: `text-gray-900`, `text-gray-500`, `border-gray-200` throughout → slate | RC-01 | XS |
| P-13 | Portal shopify/location: gray text throughout → slate | RC-01 | XS |
| P-14 | Portal forgot-password + reset-password: gray text throughout → slate | RC-01 | XS |
| P-15 | Portal plan page: gray text throughout → slate | RC-01 | XS |

### Group 2: RC-02 Design Token Non-Use — Page-Level Inline Overrides (Medium/High)

Color corrections that don't meet Quick Wins threshold (isolated to 1–2 pages, lower multiplier effect).

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-16 | Inventory List + Detail: `bg-yellow-100` quarantine → amber, `bg-blue-100` reserved → indigo (after B-26 which covers Inventory List; verify Detail page too) | RC-02 | XS |
| P-17 | Pallet Breakdown page: search input `focus:ring-blue-500`→indigo, `focus:ring`→`focus-visible:ring` | RC-02 + RC-03 | XS |
| P-18 | Task Detail timeline: `bg-blue-100`/`text-blue-600` "Assigned" indicator → indigo (partially covered by B-28) | RC-02 | XS |
| P-19 | Portal returns/[id]: `bg-blue-100 text-blue-700` "approved" status → cyan; `bg-purple-100` original order icon → slate | RC-02 | XS |
| P-20 | Portal integrations page: `bg-blue-50` location info section → `bg-cyan-50` | RC-02 | XS |
| P-21 | Portal lots/page: `text-blue-600` 90-day expiry warning → `text-amber-600` | RC-02 | XS |
| P-22 | Portal dashboard: `bg-purple-50 text-purple-600` Active Orders icon → remove or use slate | RC-02 | XS |
| P-23 | Portal returns/[id]: `bg-purple-100 text-purple-600` original order icon → slate neutral | RC-02 | XS |
| P-24 | ReceivingScanner purple lot-tracking color (`bg-purple-50`, `text-purple-700`) → indigo; or document purple as extended semantic color in MASTER.md | RC-02 | M |
| P-25 | Lots List: `text-orange-600` expiry urgency → `text-amber-600` per MASTER.md 1.3 | RC-02 | XS |
| P-26 | Location Sublocations: `border-blue-600` loading spinner → `border-indigo-600` | RC-02 | XS |

### Group 3: RC-03 focus:ring → focus-visible:ring (Medium)

All remaining focus ring pseudo-class violations not captured in component fixes above.

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-27 | Button component: `transition-all`→`transition-colors` (performance fix) | component-specific | XS |
| P-28 | DropdownMenu trigger: `focus:ring-blue-500`→`focus-visible:ring-indigo-500` and gray→slate throughout | RC-01 + RC-03 | XS |
| P-29 | DropdownMenu trigger: add `triggerAriaLabel` prop (accessible label for icon-only trigger) | component-specific | S |
| P-30 | ConfirmDialog: description text `text-gray-600`→`text-slate-600` | RC-01 | XS |
| P-31 | Dashboard hero action buttons: add `focus-visible:ring` (partially addressed in B-19) | RC-03 | XS |
| P-32 | Select component: `rounded-lg`→`rounded-md`, `focus:ring`→`focus-visible:ring` (admin variant; portal is Blocking #10) | RC-02 + RC-03 | XS |
| P-33 | Input component: `rounded-lg`→`rounded-md`, `focus:ring`→`focus-visible:ring` (admin variant; portal is Blocking #9) | RC-02 + RC-03 | XS |

### Group 4: RC-05 Props API Gaps (Medium)

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-34 | Button component: add `aria-busy={loading}` to button element when loading spinner active | RC-05 | XS |
| P-35 | Toggle component: add `label` prop + `labelPosition` for accessibility and convenience | RC-05 | M |
| P-36 | Toggle component: add `variant` prop (`"admin" | "portal"`) — after portal variant added in Blocking #12 | RC-05 | XS |
| P-37 | SearchSelect: add `hint` prop for parity with Input/Select/Textarea | RC-05 | S |
| P-38 | SearchSelect: fix error state border — `border-red-500 ring-2 ring-red-500` to match Input behavior | RC-05 | XS |
| P-39 | Modal: add `size="full"` variant for full-screen scanner workflows | component-specific | M |
| P-40 | Modal: add `aria-describedby` linking to body content | component-specific | XS |
| P-41 | Button component: `rounded-lg`→`rounded-md` per MASTER.md 5.1 | RC-02 | XS |

### Group 5: Component Non-Use on Pages (Medium)

Pages that bypassed design system components and used raw HTML elements.

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-42 | Pallet Breakdown page: replace raw `<input>` search with `<Input>` component | component non-use | M |
| P-43 | Lots List page: replace custom overlay modal with `<Modal>` component for Add Lot | component non-use | M |
| P-44 | Lots List page: replace native `<table>` with `<Table>` component | component non-use | M |
| P-45 | Location Sublocations page: replace raw `<input>` and `<select>` in form with `<Input>`/`<Select>` components | component non-use | M |
| P-46 | Portal shopify/products page: replace raw `<input>` and `<select>` with `<Input>`/`<Select>` components; add focus rings | component non-use | S |
| P-47 | Portal inventory/history: replace raw `<select>` with `<Select>` component (flagging CC-04 still applies until Blocking #10–12 done) | component non-use | XS |

### Group 6: CommandPalette Improvements (Medium/High)

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-48 | CommandPalette: selected item `bg-blue-50 text-blue-900`→indigo, gray palette throughout → slate | RC-01 + RC-02 | XS |
| P-49 | CommandPalette: add ARIA combobox pattern (`role="combobox"`, `role="listbox"`, `role="option"`) | component-specific | M |
| P-50 | CommandPalette: shadow `shadow-2xl`→`shadow-[var(--shadow-modal)]`, backdrop `bg-black/50`→`bg-slate-900/60` | RC-02 + RC-01 | XS |
| P-51 | CommandPalette: add `aria-label="Search commands"` to search input; hide `<kbd>` hints from screen readers with `aria-hidden="true"` | component-specific | XS |

### Group 7: Error/Utility Components (Medium/High)

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-52 | ErrorBoundary: "Try Again" button `bg-blue-600`→indigo gradient, `rounded-lg`→`rounded-md`, add `focus-visible:ring`, gray→slate throughout | RC-01 + RC-02 + RC-03 | XS |
| P-53 | FetchError: "Try Again" button `text-blue-600`→indigo, add `focus-visible:ring`, gray→slate throughout | RC-01 + RC-02 + RC-03 | XS |
| P-54 | EmptyState: all three gray instances → slate (`text-gray-400`, `text-gray-900`, `text-gray-500`) | RC-01 | XS |

### Group 8: Scanner Component Color Corrections (Medium)

Gray→slate and blue→indigo in scanner components (not Blocking since these are color/palette, not tap target/text size).

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-55 | PickingScanner: gray→slate throughout, blue→indigo throughout (spinner, active states) | RC-01 + RC-02 | S |
| P-56 | PickScanner: gray→slate, blue→indigo throughout | RC-01 + RC-02 | S |
| P-57 | PackScanner: gray→slate, blue→indigo throughout (audio active state) | RC-01 + RC-02 | S |
| P-58 | ShipScanner: gray→slate, blue→indigo throughout (progress bar, audio) | RC-01 + RC-02 | S |
| P-59 | PalletBreakdownScanner: gray→slate throughout, blue→indigo confirm card and focus rings | RC-01 + RC-02 | S |
| P-60 | ScannerModal: gray→slate throughout, blue→indigo spinner and product icon | RC-01 + RC-02 | S |

### Group 9: Chart Component Minor Fixes (Low/Medium)

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-61 | Fix axis tick `fill: "#94A3B8"` (slate-400) → `"#64748B"` (slate-500) across MiniBarChart, MiniLineChart, ScatterChart, StackedBarChart, WaterfallChart — fails WCAG AA for small text at 2.9:1 | component-specific | XS |
| P-62 | WaterfallChart: fix hardcoded hex colors `#22C55E`/`#EF4444` to exact MASTER.md tokens (`#16a34a`/`#dc2626`) | RC-02 | XS |
| P-63 | Add `aria-label` prop (data-driven, not hardcoded) to BulletChart, CalendarHeatmap, and other charts with generic labels | component-specific | S |
| P-64 | CalendarHeatmap: add `<desc>` or visually-hidden data table for color-only encoding of activity levels | component-specific | M |

### Group 10: Low Priority Polish (Low)

| # | Item | Root Cause | Effort |
|---|------|-----------|--------|
| P-65 | Card component: shadow `shadow-sm`→`shadow-[var(--shadow-card)]`, hover shadow→`shadow-[var(--shadow-card-hover)]` | RC-02 | XS |
| P-66 | DropdownMenu shadow: `ring-black ring-opacity-5`→`shadow-[var(--shadow-elevated)]` | RC-02 | XS |
| P-67 | Modal shadow: inline value → `shadow-[var(--shadow-modal)]` token | RC-02 | XS |
| P-68 | CommandPalette shadow → `shadow-[var(--shadow-modal)]` | RC-02 | XS |
| P-69 | ChartLegend: add `role="list"` / `aria-label="Chart legend"` to container | component-specific | XS |
| P-70 | StatusBadge: dot indicator `<span>` — consider if redundant with color+text; clean up if consensus is to remove | component-specific | XS |
| P-71 | Billing page: use `formatCurrency` / `formatDate` from shared utils instead of local redefinitions (also Supplies, Services pages) | duplication | XS |
| P-72 | Multiple portal pages: remove `dark:` mode classes from inventory/history, lots, returns — MASTER.md is light-mode only | RC-05 | XS |
| P-73 | StatCard icon `group-hover:scale-105` anti-pattern: remove or document as intentional visual polish | component-specific | XS |
| P-74 | InspectionScanner: fix `(window as any).webkitAudioContext` unsafe cast | component-specific | XS |
| P-75 | Table component: add `sortKey?` + `onSort?` to Column interface for sortable columns | component-specific | L |
| P-76 | Portal shopify/products: add cyan accents to page (currently no portal brand colors visible) | RC-02 | XS |

---

## Traceability — All 524 Raw Findings Accounted For

| Source File | Raw Findings | Resolved via |
|------------|-------------|-------------|
| components.md | 195 | Blocking #1–7, #8–12, #16, #19–20; High B-01 through B-40; Polish P-27 through P-76 |
| admin-pages.md | 213 | Blocking #13–16; High B-19 through B-28, B-36–B-40; Polish P-01 through P-26, P-42–P-47, P-55–P-60, P-71 |
| portal-pages.md | 116 | Blocking #8–12, #17–18; High B-29 through B-35; Polish P-07 through P-15, P-19–P-23, P-72, P-76 |
| **Total** | **524** | All findings captured in a tier |

**Note on overflow:** Items that could not fit in the 40-item High cap without displacing higher-priority items were moved to the Polish backlog. No Blocking items were downgraded. All component-level "pass" findings (correct patterns worth preserving) are documented in source audit files but not listed as action items.
