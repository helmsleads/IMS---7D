# UI/UX Implementation Guide

> **Generated:** 2026-03-19
> **Source:** PRIORITIES.md — 60 action items synthesized from 524 raw findings
> **Purpose:** Sequenced implementation roadmap. Every action item has a specific file path, exact change description, and effort estimate. A developer can pick up any wave section and implement it without reading the original audit files.

---

## Summary

| Wave | Scope | Files | Total Effort | Dependencies |
|------|-------|-------|--------------|--------------|
| Wave 0 | globals.css (1 file) | 1 | S | None |
| Wave 1 | Shared UI components (`src/components/ui/`) | ~21 | XS–M each | Wave 0 recommended first |
| Wave 2 | Scanner components (`src/components/internal/`) | ~10 | XS–M each | Wave 1 complete |
| Wave 3 | Admin pages (`src/app/(internal)/`) | ~25 | XS–S each | Wave 1 complete |
| Wave 4 | Portal pages (`src/app/(portal)/`) | ~20 | XS–S each | Wave 1 complete |

**Total action items:** 60 (20 Blocking + 40 High-Value)
**Total effort estimate:** ~12–16 person-days across all waves
**Wave dependency:** Wave 1 must complete before Waves 3 and 4 begin. Waves 3 and 4 can run in parallel after Wave 1.

---

## Wave Dependency Diagram

```
Wave 0 (globals.css)
    │
    ▼
Wave 1 (Shared UI Components)
    │
    ├──────────────────┐
    ▼                  ▼
Wave 3               Wave 4
(Admin Pages)      (Portal Pages)
    │                  │
    └──────────────────┘
         ▼
    Final Verification
    (All 524 raw findings resolved)
```

**Why this order:**
- Wave 1 component fixes cascade to all pages that use those components — fixing Button, Input, Select, Modal, etc. auto-resolves dozens of raw page findings without any page-level changes.
- Wave 3 and 4 then handle only the remaining inline overrides that Wave 1 cannot reach.
- Each wave is independently mergeable as a pull request.

---

## Wave 0: Globals

**Dependency:** None. Can merge independently or as the first commit in Wave 1.
**Effect:** Disables all custom CSS keyframe animations for users with `prefers-reduced-motion: reduce` set. This one change covers 17+ animated components simultaneously.

### Wave 0 Items

| File | Change | Priority Ref | Effort |
|------|--------|--------------|--------|
| `src/app/globals.css` | Add `@media (prefers-reduced-motion: reduce)` block at end of file covering keyframes `modal-scale-up`, `modal-scale-down`, `widget-enter`, `chart-enter` plus universal `animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important` | High B-36 | S |

**Exact CSS to add (append to end of globals.css):**

```css
/* prefers-reduced-motion — covers all custom keyframe animations (CC-01) */
@media (prefers-reduced-motion: reduce) {
  @keyframes modal-scale-up { from { opacity: 1; } to { opacity: 1; } }
  @keyframes modal-scale-down { from { opacity: 1; } to { opacity: 1; } }
  @keyframes widget-enter { from { opacity: 1; } to { opacity: 1; } }
  @keyframes chart-enter { from { opacity: 1; } to { opacity: 1; } }
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Resolves:** High B-36 — 17+ animated components (modal, dashboard widgets, chart entry animations)

---

## Wave 1: Shared UI Components

**Dependency:** Wave 0 recommended but not required.
**Must complete before:** Waves 3 and 4 begin.
**Effect:** Component-layer fixes cascade to all pages using these components. Completing Wave 1 auto-resolves dozens of page-level findings across 40+ admin pages and all 29 portal pages without any page-level edits.

### Ordering Rationale

Components ordered by: (1) Blocking items first, (2) multiplier impact (most pages affected first), (3) effort level.

---

### 1.1 Button — Blocking #8

**File:** `src/components/ui/Button.tsx`
**Priority:** Blocking #8 (resolves 38 Blocking findings across all 29 portal pages)
**Effort:** M

**Changes:**
- Add `portal` variant to the variant map: `"bg-gradient-to-b from-cyan-500 to-teal-600 text-white shadow-sm hover:from-cyan-600 hover:to-teal-700 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"`
- Change `focus:ring` → `focus-visible:ring` on all existing variant focus classes (RC-03)
- Change `rounded-lg` → `rounded-md` per MASTER.md 5.1 (Polish P-41)
- Change `transition-all` → `transition-colors` (performance fix, Polish P-27)
- Add `aria-busy={loading}` to button element when loading spinner is active (Polish P-34)

**Polish items addressed:** P-27, P-34, P-41

---

### 1.2 Input — Blocking #9

**File:** `src/components/ui/Input.tsx`
**Priority:** Blocking #9 (resolves Blocking on all portal form pages)
**Effort:** M

**Changes:**
- Add `portal` variant: focus ring class `focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2`
- Change `rounded-lg` → `rounded-md` (Polish P-33)
- Change `focus:ring` → `focus-visible:ring` on admin variant (Polish P-33)
- Ensure `border-slate-300` (not gray-300) on all variants

**Polish items addressed:** P-33

---

### 1.3 Select — Blocking #10

**File:** `src/components/ui/Select.tsx`
**Priority:** Blocking #10 (resolves Blocking on all portal form pages)
**Effort:** M

**Changes:**
- Add `portal` variant: focus ring class `focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2`
- Change `rounded-lg` → `rounded-md` (Polish P-32)
- Change `focus:ring` → `focus-visible:ring` on admin variant (Polish P-32)
- Ensure `border-slate-300` on all variants

**Polish items addressed:** P-32

---

### 1.4 Textarea — Blocking #11

**File:** `src/components/ui/Textarea.tsx`
**Priority:** Blocking #11 (resolves Blocking on all portal form pages) + High B-07
**Effort:** M

**Changes:**
- Add `portal` variant: focus ring class `focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2` (Blocking #11)
- Fix admin variant: `focus:ring-blue-500` → `focus-visible:ring-indigo-500` (High B-07)
- Change `rounded-lg` → `rounded-md` (High B-07)
- Change all `gray-*` → `slate-*` throughout component (High B-07)

**High items addressed:** B-07

---

### 1.5 Toggle — Blocking #12 + High B-06

**File:** `src/components/ui/Toggle.tsx`
**Priority:** Blocking #12 + High B-06
**Effort:** M

**Changes:**
- Add `portal` variant: active state `bg-cyan-600` (Blocking #12)
- Fix admin checked state: `bg-blue-600` → `bg-indigo-600` (High B-06)
- Fix unchecked state: `bg-gray-200` → `bg-slate-200` (High B-06)
- Fix `focus:ring` → `focus-visible:ring-indigo-500` (High B-06)
- Add `variant` prop (`"admin" | "portal"`) to support dual-brand (Polish P-36)
- Add `label` prop + `labelPosition` for accessibility (Polish P-35)

**High items addressed:** B-06
**Polish items addressed:** P-35, P-36

---

### 1.6 Modal — Blocking #19 + High B-11

**File:** `src/components/ui/Modal.tsx`
**Priority:** Blocking #19 + High B-11
**Effort:** S

**Changes:**
- Add `role="dialog"` to dialog container div (Blocking #19)
- Add `aria-modal="true"` to dialog container div (Blocking #19)
- Add `aria-labelledby="modal-title"` to dialog container div (Blocking #19)
- Add `id="modal-title"` to the title element (Blocking #19)
- Add `aria-label="Close"` to close button (High B-11)
- Add `focus-visible:ring` to close button (High B-11)
- Add `aria-describedby` prop linking to body content (Polish P-40)
- Add `size="full"` variant for full-screen scanner workflows (Polish P-39)
- Change shadow inline value → `shadow-[var(--shadow-modal)]` token (Polish P-67)

**High items addressed:** B-11
**Polish items addressed:** P-39, P-40, P-67

---

### 1.7 SearchSelect — Blocking #20

**File:** `src/components/ui/SearchSelect.tsx`
**Priority:** Blocking #20 (screen reader completely broken without this)
**Effort:** M

**Changes:**
- Add `role="combobox"` to the search input element
- Add `aria-expanded={isOpen}` to the search input
- Add `aria-haspopup="listbox"` to the search input
- Add `aria-controls="searchselect-listbox"` to the search input
- Add `role="listbox"` + `id="searchselect-listbox"` to dropdown container
- Add `role="option"` + `aria-selected={isSelected}` to each option item
- Add `hint` prop for parity with Input/Select/Textarea (Polish P-37)
- Fix error state border: `border-red-500 ring-2 ring-red-500` to match Input behavior (Polish P-38)

**Polish items addressed:** P-37, P-38

---

### 1.8 Pagination — Blocking #16 + High B-08

**File:** `src/components/ui/Pagination.tsx`
**Priority:** Blocking #16 + High B-08
**Effort:** S

**Changes:**
- Upgrade button dimensions from `w-9 h-9` (36px) to `min-w-[44px] min-h-[44px]` (Blocking #16 — scanner route tap target)
- Fix active page: `bg-gray-900` → `bg-indigo-600` (High B-08)
- Add `focus-visible:ring` to all page number buttons and prev/next (High B-08)
- Change all `gray-*` → `slate-*` throughout component (High B-08)

**Note:** Blocking #16 resolves scanner instances on Pick Queue, Putaway Queue, and Inspection Queue pages.

**High items addressed:** B-08

---

### 1.9 BarcodeScanner — Blocking #7

**File:** `src/components/ui/BarcodeScanner.tsx`
**Priority:** Blocking #7 (cascades to all scanner routes using BarcodeScanner)
**Effort:** XS

**Changes:**
- Add `min-h-[44px]` to close button (currently `p-1`, below 44px tap target)
- Change instruction text: `text-sm` → `text-base`
- Change secondary instruction: `text-xs` → `text-sm`

---

### 1.10 Alert — High B-01

**File:** `src/components/ui/Alert.tsx`
**Priority:** High B-01 (Quick Win — cascades to 40+ pages)
**Effort:** XS

**Changes:**
- Fix warning variant: `bg-yellow-50 border-yellow-400 text-yellow-800` → `bg-amber-50 border-amber-400 text-amber-800`
- Fix info variant: `bg-blue-50 border-blue-400` → `bg-indigo-50 border-indigo-400 text-indigo-800`
- Add `focus-visible:ring` to close button
- Add `aria-label="Dismiss"` to close button

**Resolves:** High B-01 — 4 findings; cascades to 40+ pages using Alert

---

### 1.11 Badge — High B-02

**File:** `src/components/ui/Badge.tsx`
**Priority:** High B-02 (Quick Win — cascades to 50+ pages)
**Effort:** S

**Changes:**
- Fix warning variant: yellow → amber (`bg-amber-50 text-amber-700 border-amber-200`)
- Fix info variant: blue → indigo (`bg-indigo-50 text-indigo-700 border-indigo-200`)
- Add border pattern to all variants (currently border-less)
- Fix shade on success variant (ensure 50 bg, 700 text, 200 border)
- Fix shade on error variant (red-50, red-700, red-200)

**Resolves:** High B-02 — 6 findings; cascades to 50+ pages using Badge

---

### 1.12 Spinner — High B-03

**File:** `src/components/ui/Spinner.tsx`
**Priority:** High B-03 (Quick Win — cascades to 30+ pages)
**Effort:** XS

**Changes:**
- Fix spinner track: `border-gray-200` → `border-slate-200`
- Fix spinner active arc: `border-t-blue-600` → `border-t-indigo-600`
- Add `role="status"` to container
- Add `aria-label="Loading"` to container
- Change `animate-spin` → `motion-safe:animate-spin`

**Resolves:** High B-03 — 4 findings; cascades to 30+ pages using Spinner

---

### 1.13 StatCard — High B-04 + B-37

**File:** `src/components/ui/StatCard.tsx`
**Priority:** High B-04 + B-37 (Quick Win — every dashboard)
**Effort:** XS

**Changes:**
- Fix iconColor default: `bg-blue-50 text-blue-600` → `bg-indigo-50 text-indigo-600` (High B-04)
- Add `prefers-reduced-motion` guard to `useAnimatedNumber` hook: check `window.matchMedia('(prefers-reduced-motion: reduce)').matches` and skip animation if true (High B-37)
- Remove `group-hover:scale-105` from icon or document as intentional (Polish P-73)

**High items addressed:** B-04, B-37
**Polish items addressed:** P-73

---

### 1.14 Toast — High B-05

**File:** `src/components/ui/Toast.tsx`
**Priority:** High B-05 (Quick Win — ~30 pages with toasts)
**Effort:** S

**Changes:**
- Fix info variant: `bg-blue-50 border-blue-200 text-blue-600` → `bg-indigo-50 border-indigo-200 text-indigo-600`
- Add warning variant: `bg-amber-50 border-amber-200 text-amber-700` (currently missing)
- Add `motion-safe:` prefix to entry/exit animation classes
- Add `focus-visible:ring` to dismiss button

**Resolves:** High B-05 — 4 findings + adds missing warning variant

---

### 1.15 Breadcrumbs — High B-09

**File:** `src/components/ui/Breadcrumbs.tsx`
**Priority:** High B-09 (Quick Win — cascades to 20+ detail pages)
**Effort:** XS

**Changes:**
- Add `aria-label="Breadcrumb"` to the `<nav>` element
- Add `aria-label="Go to dashboard"` to home icon link
- Add `focus-visible:ring` to all breadcrumb links

**Resolves:** High B-09 — 4 findings; cascades to 20+ detail pages

---

### 1.16 Card — High B-10

**File:** `src/components/ui/Card.tsx`
**Priority:** High B-10
**Effort:** S

**Changes:**
- Add `role="button"` when `onClick` prop is present
- Add `tabIndex={0}` when `onClick` is present
- Add `onKeyDown` handler: trigger `onClick` on Enter or Space key
- Add `focus-visible:ring` to clickable card variant
- Change shadow: `shadow-sm` → `shadow-[var(--shadow-card)]` (Polish P-65)
- Change hover shadow: → `shadow-[var(--shadow-card-hover)]` (Polish P-65)

**Polish items addressed:** P-65

---

### 1.17 Charts (13 files) — High B-12 + B-13

**Files:** All chart files in `src/components/ui/charts/`:
- `src/components/ui/charts/DonutChart.tsx`
- `src/components/ui/charts/HorizontalBarChart.tsx`
- `src/components/ui/charts/MiniBarChart.tsx`
- `src/components/ui/charts/MiniLineChart.tsx`
- `src/components/ui/charts/MiniSparkline.tsx`
- `src/components/ui/charts/ScatterChart.tsx`
- `src/components/ui/charts/StackedBarChart.tsx`
- `src/components/ui/charts/TreemapChart.tsx`
- `src/components/ui/charts/WaterfallChart.tsx`
- `src/components/ui/charts/BulletChart.tsx`
- `src/components/ui/charts/CalendarHeatmap.tsx`
- `src/components/ui/charts/GaugeChart.tsx` (already has aria-label — verify pattern used)
- `src/components/ui/charts/ChartLegend.tsx`

**Priority:** High B-12 + B-13 (grouped as one implementation item — same pattern across all files)
**Effort:** S (all 13 files together)

**Changes per chart file (B-12):**
- Add `aria-label` prop to component interface (make required or provide sensible default)
- Wrap chart output in `<div role="img" aria-label={ariaLabel}>` container

**Changes per chart file (B-13):**
- Create or import `useReducedMotion` hook: `const prefersReducedMotion = useReducedMotion()`
- Pass `isAnimationActive={!prefersReducedMotion}` to all Recharts chart elements that accept it

**Additional chart-specific changes:**
- `src/components/ui/charts/MiniBarChart.tsx`, `MiniLineChart.tsx`, `ScatterChart.tsx`, `StackedBarChart.tsx`, `WaterfallChart.tsx`: Fix axis tick fill `"#94A3B8"` (slate-400, 2.9:1) → `"#64748B"` (slate-500, 4.6:1) (Polish P-61)
- `src/components/ui/charts/WaterfallChart.tsx`: Fix hardcoded hex `#22C55E` → `#16a34a` and `#EF4444` → `#dc2626` (Polish P-62)
- `src/components/ui/charts/ChartLegend.tsx`: Add `role="list"` + `aria-label="Chart legend"` to container (Polish P-69)
- `src/components/ui/charts/CalendarHeatmap.tsx`: Add visually-hidden data table for color-only encoding (Polish P-64)

**Polish items addressed:** P-61, P-62, P-64, P-69

---

### 1.18 Skeleton — High B-38 (partial)

**File:** `src/components/ui/Skeleton.tsx`
**Priority:** High B-38 / Quick Win #11 (12 findings in one file)
**Effort:** S

**Changes:**
- Replace all `gray-*` → `slate-*` throughout component (RC-01)
- Pattern: `gray-200` → `slate-200`, `gray-100` → `slate-100`, `gray-300` → `slate-300`

**Resolves:** 12 Medium findings in this file alone

---

### 1.19 Table — High B-38 (partial)

**File:** `src/components/ui/Table.tsx`
**Priority:** High B-38 / Quick Win #12 (16 findings in one file)
**Effort:** S

**Changes:**
- Replace all `gray-*` → `slate-*` throughout component (RC-01)
- Add `sortKey?` + `onSort?` to Column interface for sortable columns (Polish P-75)

**Resolves:** 16 Medium findings in this file alone
**Polish items addressed:** P-75

---

### 1.20 StatusBadge — High B-40

**File:** `src/components/ui/StatusBadge.tsx`
**Priority:** High B-40
**Effort:** S

**Changes:**
- Replace Tailwind class string key pattern (`variantMap["bg-green-100"]`) with direct semantic status → Badge variant mapping
- Pattern: `status === "active" → variant="success"` instead of `variantMap[statusToClass(status)]`
- Remove dot indicator `<span>` or document as intentional (Polish P-70)

**Polish items addressed:** P-70

---

### 1.21 Remaining UI Components — Polish B-38 (gray→slate sweep)

**Files (apply gray→slate throughout each):**
- `src/components/ui/ConfirmDialog.tsx` — `text-gray-600` → `text-slate-600` (Polish P-30)
- `src/components/ui/DropdownMenu.tsx` — `focus:ring-blue-500` → `focus-visible:ring-indigo-500`, gray→slate, add `triggerAriaLabel` prop, shadow → `shadow-[var(--shadow-elevated)]` (Polish P-28, P-29, P-66)
- `src/components/ui/CommandPalette.tsx` — `bg-blue-50 text-blue-900` selected item → indigo, gray→slate, `bg-black/50` → `bg-slate-900/60`, add ARIA combobox pattern (Polish P-48, P-49, P-50, P-51)
- `src/components/ui/ErrorBoundary.tsx` — "Try Again" button `bg-blue-600` → indigo gradient, `rounded-lg` → `rounded-md`, add `focus-visible:ring`, gray→slate (Polish P-52)
- `src/components/ui/FetchError.tsx` — "Try Again" `text-blue-600` → indigo, `focus-visible:ring`, gray→slate (Polish P-53)
- `src/components/ui/EmptyState.tsx` — `text-gray-400`, `text-gray-900`, `text-gray-500` → slate (Polish P-54)
- `src/components/ui/ProductImage.tsx` — gray→slate throughout

**Priority:** High B-38 (systematic gray→slate migration)
**Effort:** S (batch all remaining UI files together)

**Polish items addressed:** P-28, P-29, P-30, P-48, P-49, P-50, P-51, P-52, P-53, P-54

---

## Wave 2: Scanner Components

**Dependency:** Wave 1 complete (portal variants and tap-target patterns established).
**Effect:** Resolves all Blocking scanner safety violations. Completing Wave 2 ensures every scanner route meets the 44px tap target and 16px text minimum requirements from MASTER.md Section 7.

### Ordering Rationale

Ordered by total Blocking violation count (highest first).

---

### 2.1 PalletBreakdownScanner — Blocking #6

**File:** `src/components/internal/PalletBreakdownScanner.tsx`
**Priority:** Blocking #6 (most Blocking violations in Wave 2)
**Effort:** XS

**Blocking changes (tap target):**
- Remove `size="sm"` from "1 unit", "1 case", "All" quick buttons
- Remove `size="sm"` from "Start Over" button
- Remove `size="sm"` from "Done" button
- Add `min-h-[44px]` to error dismiss `×` button

**Blocking changes (text size):**
- Change pallet info text: `text-xs` → `text-base`

**High changes (text sizes):**
- (No additional High text violations beyond the XS change above)

**High B-38 changes (colors):**
- gray→slate throughout (Polish P-59)
- blue→indigo confirm card and focus rings (Polish P-59)

---

### 2.2 ReceivingScanner — Blocking #5

**File:** `src/components/internal/ReceivingScanner.tsx`
**Priority:** Blocking #5 + High B-18
**Effort:** XS

**Blocking changes (tap target):**
- Add `min-h-[44px]` to audio toggle raw `<button p-2>`
- Add `min-h-[44px]` to lot scan trigger button
- Add `min-h-[44px]` to reset calendar button

**High changes (text size — B-18):**
- Change SKU text: `text-sm` → `text-base`
- Change remaining qty text: `text-sm` → `text-base`
- Change lot form labels: `text-sm` → `text-base`
- Replace calendar `<input>` with `<Input>` component using `focus-visible:ring-indigo-500` (not purple)

**Polish changes:**
- Remove `dark:` mode classes (Polish B-39, Polish P-56 — not applicable, but B-39 covers ReceivingScanner)
- gray→slate throughout (Polish P-55... actually P-55 is PickingScanner; see P-56 note)
- Purple lot-tracking color: `bg-purple-50 text-purple-700` → indigo (Polish P-24)

**High items addressed:** B-18
**Polish items addressed:** P-24

---

### 2.3 PickingScanner — Blocking #1

**File:** `src/components/internal/PickingScanner.tsx`
**Priority:** Blocking #1 + High B-14
**Effort:** XS

**Blocking changes (tap target):**
- Remove `size="sm"` from audio toggle button
- Remove `size="sm"` from Pick list button

**High changes (text size — B-14):**
- Change SKU text: `text-sm` → `text-base`
- Change "picked" label: `text-sm` → `text-base`
- Change location hint badges: `text-sm` → `text-base`
- Change progress subtitle: `text-sm` → `text-base`
- Change "Complete" feedback text: `text-sm` → `text-base`

**Polish changes:**
- Remove `dark:` mode classes (Polish B-39)
- gray→slate throughout (Polish P-55)
- blue→indigo active states and spinner (Polish P-55)

**High items addressed:** B-14
**Polish items addressed:** P-55

---

### 2.4 PickScanner — Blocking #2

**File:** `src/components/internal/PickScanner.tsx`
**Priority:** Blocking #2 + High B-15
**Effort:** XS

**Blocking changes (tap target):**
- Remove `size="sm"` from audio toggle button
- Remove `size="sm"` from decrement button
- Remove `size="sm"` from increment button
- Remove `size="sm"` from "Pick All" button

**High changes (text size — B-15):**
- Change secondary product name: `text-sm` → `text-base`
- Change item count progress indicator: `text-sm` → `text-base`

**Polish changes:**
- Remove `dark:` mode classes (Polish B-39)
- gray→slate, blue→indigo throughout (Polish P-56)

**High items addressed:** B-15
**Polish items addressed:** P-56

---

### 2.5 PackScanner — Blocking #3

**File:** `src/components/internal/PackScanner.tsx`
**Priority:** Blocking #3 + High B-16
**Effort:** XS

**Blocking changes (tap target):**
- Remove `size="sm"` from audio toggle button
- Remove `size="sm"` from `-1` remove-from-carton button

**High changes (text size — B-16):**
- Change carton count text: `text-sm` → `text-base`
- Change carton item count: `text-sm` → `text-base`
- Change carton stage label: `text-sm` → `text-base`
- Change product name under SKU: `text-sm` → `text-base`

**Polish changes:**
- Remove `dark:` mode classes (Polish B-39)
- gray→slate, blue→indigo audio active state (Polish P-57)

**High items addressed:** B-16
**Polish items addressed:** P-57

---

### 2.6 ShipScanner — Blocking #4

**File:** `src/components/internal/ShipScanner.tsx`
**Priority:** Blocking #4 + High B-17
**Effort:** XS

**Blocking changes (tap target):**
- Remove `size="sm"` from audio toggle button

**High changes (text size — B-17):**
- Change order number: `text-sm` → `text-base`
- Change progress text: `text-sm` → `text-base`
- Change carton status: `text-sm` → `text-base`
- Change carrier label: `text-sm` → `text-base`
- Change tracking label: `text-sm` → `text-base`

**Polish changes:**
- Remove `dark:` mode classes (Polish B-39)
- gray→slate, blue→indigo progress bar and audio state (Polish P-58)

**High items addressed:** B-17
**Polish items addressed:** P-58

---

### 2.7 ScannerModal — Polish P-60

**File:** `src/components/internal/ScannerModal.tsx`
**Priority:** Polish (gray→slate + color corrections)
**Effort:** S

**Changes:**
- gray→slate throughout (Polish P-60)
- blue→indigo spinner and product icon (Polish P-60)

**Note:** ScannerModal sets the positive template for `min-h-[48px]` pattern — do not reduce existing tap targets.

---

### 2.8 InspectionScanner — High B-14 area (verify)

**File:** `src/components/internal/InspectionScanner.tsx`
**Priority:** High (verify exact violations in components.md InspectionScanner section)
**Effort:** XS

**Changes:**
- Fix `(window as any).webkitAudioContext` unsafe cast (Polish P-74)
- Verify tap target compliance (add `min-h-[44px]` if any buttons below 44px)
- Verify text sizes (change any `text-xs` scanner content → `text-sm` minimum; `text-sm` key data → `text-base`)

**Polish items addressed:** P-74

---

### 2.9 PutawayScanner — (verify)

**File:** `src/components/internal/PutawayScanner.tsx`
**Priority:** High (verify exact violations in components.md PutawayScanner section)
**Effort:** XS

**Changes:**
- Remove `dark:` mode classes (Polish B-39)
- Verify tap target compliance
- Verify text sizes

**Polish items addressed:** P-56 area

---

## Wave 3: Admin Pages

**Dependency:** Wave 1 complete. Many findings on admin pages are auto-resolved by Wave 1 component fixes.
**Parallel with:** Wave 4 (portal pages).

### Sub-sections

- **3a: Scanner routes** — highest priority; Blocking inline violations
- **3b: Non-scanner pages** — inline color overrides not resolved by component fixes
- **3c: Component-propagation-only pages** — verify after Wave 1; no manual inline changes required

---

### 3a: Admin Scanner Routes (Blocking inline overrides)

#### 3a-1: Inventory Transfers — Blocking #13

**File:** `src/app/(internal)/inventory/transfers/page.tsx`
**Priority:** Blocking #13 (6 Blocking inline overrides — worst single scanner page in admin)
**Effort:** XS

**Changes (all Blocking):**
- Replace gray text in transfer-type cell: `text-gray-900` → `text-slate-900` (RC-01)
- Replace gray text in location cells: `text-gray-500` → `text-slate-500` (RC-01)
- Replace gray text in date cell: `text-gray-400` → `text-slate-400` (RC-01)
- Remove `size="sm"` from all action buttons (scanner tap target)
- Change date cell text size: `text-sm` → `text-base` (RC-04, scanner route)

**Total:** 5 gray→slate text replacements + 1 button size removal + 1 text-size fix

---

#### 3a-2: Task Queues — Blocking #14 (3 scanner pages)

**Files:**
- `src/app/(internal)/tasks/pick/page.tsx`
- `src/app/(internal)/tasks/putaway/page.tsx`
- `src/app/(internal)/tasks/inspection/page.tsx`

**Priority:** Blocking #14 (same pattern on all 3 scanner pages)
**Effort:** XS (same 1-line change pattern on 3 files)

**Changes (each file):**
- Remove `size="sm"` from all action buttons in the task row

**Note:** Blocking #16 (Pagination min-h fix) auto-resolves on these pages once Wave 1 Pagination is complete.

---

#### 3a-3: Location Sublocations — Blocking #15 + High B-24

**File:** `src/app/(internal)/locations/[id]/sublocations/page.tsx`
**Priority:** Blocking #15 + High B-24 (worst scanner page in audit: 9 Blocking + 3 High inline violations)
**Effort:** S

**Blocking changes:**
- Replace all `gray-*` with `slate-*` throughout page (RC-01) — includes table cells, search input, form labels
- Replace all `blue-*` with `indigo-*` throughout page (RC-02) — includes buttons, active states, focus rings, selected states
- Replace form inputs: `focus:ring-blue-500 border-blue-300` → `focus-visible:ring-indigo-500 border-slate-300`
- Replace `<select>` in form → `<Select>` component (component non-use, needed for correct focus ring)

**High changes (B-24):**
- `bg-blue-100 text-blue-600` location summary icon → `bg-indigo-100 text-indigo-600`
- Edit hover `text-blue-600` → `text-indigo-600`
- Print hover `text-purple-600` → `text-slate-600`
- `border-blue-600` loading spinner → `border-indigo-600` (Polish P-26)

**Polish items addressed:** P-26, P-45 (raw inputs → components)

---

#### 3a-4: Task Detail — Blocking B-28 area

**File:** `src/app/(internal)/tasks/[id]/page.tsx`
**Priority:** High B-28 (3 Blocking + 2 High)
**Effort:** XS

**Changes:**
- Change back button: `p-2` → `p-3` (ensures 44px tap target on scanner route)
- Change timeline timestamps: `text-xs` → `text-sm`
- Change timeline "Assigned" indicator: `bg-blue-100 text-blue-600` → `bg-indigo-100 text-indigo-600`

---

### 3b: Non-Scanner Admin Pages with Inline Overrides

#### 3b-1: Dashboard — High B-19

**File:** `src/app/(internal)/dashboard/page.tsx`
**Priority:** High B-19
**Effort:** XS

**Changes:**
- StatCard `iconColor` prop: `bg-blue-50` → `bg-indigo-50` on all StatCard usages (note: component default auto-fixes in Wave 1, but any hardcoded `iconColor` prop values need manual update)
- Remove decorative blob/circle elements with `bg-blue-500/10` or similar (decorative, non-brand)
- Change hero buttons: `rounded-lg` → `rounded-md`
- Add `focus-visible:ring` to hero action links

---

#### 3b-2: Inbound + Outbound List Pages — High B-20

**Files:**
- `src/app/(internal)/inbound/page.tsx`
- `src/app/(internal)/outbound/page.tsx`

**Priority:** High B-20
**Effort:** XS (same pattern on both files)

**Changes (Inbound):**
- Status tab "Ordered": `border-yellow-500 text-yellow-600` → `border-amber-500 text-amber-600`
- Status tab "In Transit": `bg-blue-100 text-blue-700` → `bg-indigo-100 text-indigo-700`
- Status tab "Arrived": keep checking — verify current color; if using `bg-purple-*` → `bg-indigo-*` per decision in STATE.md

**Changes (Outbound):**
- Status tab "Pending": verify; if yellow → amber
- Source badge "portal": `bg-purple-100 text-purple-700` → `bg-cyan-50 text-cyan-700` (High B-27)
- Source badge "internal": gray → slate (High B-27)
- Verify all outbound status tab colors against MASTER.md §1.1

---

#### 3b-3: Tasks List — High B-21

**File:** `src/app/(internal)/tasks/page.tsx`
**Priority:** High B-21
**Effort:** XS

**Changes:**
- Putaway icon: `bg-blue-50 text-blue-600` → `bg-indigo-50 text-indigo-600`
- Task type icon: `text-blue-600` → `text-indigo-600`
- Priority inline `<span>` elements → replace with `<Badge>` component (component non-use fix)

---

#### 3b-4: Lots List — High B-22

**File:** `src/app/(internal)/lots/page.tsx`
**Priority:** High B-22
**Effort:** XS

**Changes:**
- Active tab: `border-blue-500 text-blue-600` → `border-indigo-500 text-indigo-600`
- Count badges: blue → indigo
- Search input: `border-gray-300 focus:ring-blue-500` → `border-slate-300 focus-visible:ring-indigo-500`
- Lot number links: `text-blue-600` → `text-indigo-600`
- Inactive tab hover: `hover:border-gray-300 text-gray-500` → `hover:border-slate-300 text-slate-500` (Polish P-06)
- Change `text-orange-600` expiry urgency → `text-amber-600` (Polish P-25)

**Polish items addressed:** P-06, P-25

---

#### 3b-5: Reports Hub — High B-23

**File:** `src/app/(internal)/reports/page.tsx`
**Priority:** High B-23
**Effort:** XS

**Changes:**
- Report card icon: `bg-blue-100 text-blue-600` → `bg-indigo-100 text-indigo-600`
- Report card icon: `bg-purple-100 text-purple-600` → `bg-indigo-100 text-indigo-600`
- Add `focus-visible:ring` to all report card links

---

#### 3b-6: Settings — High B-25

**File:** `src/app/(internal)/settings/page.tsx`
**Priority:** High B-25
**Effort:** XS

**Changes:**
- Active sidebar tab: `bg-blue-50 text-blue-600 border-blue-600` → `bg-indigo-50 text-indigo-600 border-indigo-600`
- Nav container: `border-gray-200` → `border-slate-200` (Polish P-05)
- Section header: `bg-gray-50 border-gray-200` → `bg-slate-50 border-slate-200` (Polish P-05)
- Inactive nav items: `text-gray-600 hover:bg-gray-50` → `text-slate-600 hover:bg-slate-50` (Polish P-05)

**Polish items addressed:** P-05

---

#### 3b-7: Inventory List — High B-26

**File:** `src/app/(internal)/inventory/page.tsx`
**Priority:** High B-26
**Effort:** XS

**Changes:**
- Quarantine status: `bg-yellow-100 text-yellow-700` → `bg-amber-50 text-amber-700`
- Reserved status: `bg-blue-100 text-blue-700` → `bg-indigo-50 text-indigo-700`
- Returned status: `bg-purple-100 text-purple-700` → `bg-slate-100 text-slate-700`

Also check `src/app/(internal)/inventory/[id]/page.tsx` for same status badge overrides (Polish P-16).

**Polish items addressed:** P-16

---

### 3c: Admin Pages Auto-Resolved by Wave 1

These pages had no inline overrides that require manual changes — their findings come from component-sourced classes. After Wave 1 completes, verify each page visually:

| Page | Route | Findings Source | Verify |
|------|-------|----------------|--------|
| Inbound Detail | `src/app/(internal)/inbound/[id]/page.tsx` | Badge, Breadcrumbs, Spinner | Colors correct, focus rings visible |
| Outbound Detail | `src/app/(internal)/outbound/[id]/page.tsx` | Badge, Breadcrumbs | Colors correct |
| Clients List/Detail | `src/app/(internal)/clients/` | Badge, Card, Table | Colors correct |
| Products List/Detail | `src/app/(internal)/products/` | Badge, Table, Spinner | Colors correct |
| Locations List | `src/app/(internal)/locations/page.tsx` | Badge, Table | gray→slate text after Table fix |
| Services List | `src/app/(internal)/services/page.tsx` | Badge, Table | Colors correct |
| Users List | `src/app/(internal)/users/page.tsx` | Badge, Table | Colors correct |
| Billing | `src/app/(internal)/billing/` | Badge, Table, Spinner | Colors correct |

**Additional inline items for Locations List:**
`src/app/(internal)/locations/page.tsx` — location name, address, total SKU cells: gray→slate (Polish P-04)

**Additional inline items for Pallet Breakdown:**
`src/app/(internal)/inventory/pallets/breakdown/page.tsx` — search input `border-gray-300` → `border-slate-300`, search icon `text-gray-400` → `text-slate-400`, `focus:ring-blue-500` → `focus-visible:ring-indigo-500` (Polish P-03, P-17)

---

## Wave 4: Portal Pages

**Dependency:** Wave 1 complete (portal variants on Button, Input, Select, Textarea, Toggle).
**Parallel with:** Wave 3 (admin pages).

### Sub-sections

- **4a: Inline blue/indigo bleed pages** — must fix manually regardless of Wave 1
- **4b: Auth pages** — background + raw input elements
- **4c: Component-propagation-only pages** — verify after Wave 1

---

### 4a: Portal Inline Override Pages

#### 4a-1: Billing Plan Pages — Blocking #18

**Files:**
- `src/app/(portal)/portal/plan/page.tsx`
- `src/app/(portal)/portal/plan/invoice/[id]/page.tsx`

**Priority:** Blocking #18 (blue not in portal palette)
**Effort:** XS

**Changes (plan/page.tsx):**
- Replace `bg-blue-50` → `bg-cyan-50`
- Replace `text-blue-600` → `text-cyan-600`
- Replace `border-blue-600` → `border-cyan-600`
- gray→slate throughout (Polish P-15)
- `bg-gray-100` cancelled badge → `bg-slate-100` (Polish P-09)

**Changes (plan/invoice/[id]/page.tsx):**
- Same blue → cyan substitution pattern
- `bg-gray-100` cancelled badge → `bg-slate-100` (Polish P-09)
- gray text throughout → slate (Polish P-09)

**Polish items addressed:** P-09, P-15

---

#### 4a-2: Request Shipment Confirmation — Blocking #17

**File:** `src/app/(portal)/portal/request-shipment/confirmation/page.tsx`
**Priority:** Blocking #17 (3 Blocking blue inline overrides)
**Effort:** XS

**Changes:**
- Replace `bg-blue-600` → `bg-cyan-600` (or use `<Button variant="portal">`)
- Replace `bg-blue-50` → `bg-cyan-50`
- Replace `text-blue-600` → `text-cyan-600`
- gray→slate throughout (Polish P-07)

**Polish items addressed:** P-07

---

#### 4a-3: Portal Inventory Detail — High B-30

**File:** `src/app/(portal)/portal/inventory/[id]/page.tsx`
**Priority:** High B-30 (3 Blocking inline blue violations)
**Effort:** XS

**Changes:**
- Lot tracking badge: `bg-blue-600 text-white` → `bg-cyan-600 text-white`
- Shipment button: `bg-blue-600` → `<Button variant="portal">` (or `bg-cyan-600`)
- Spinner: `border-t-blue-600` → `border-t-cyan-600`
- gray→slate throughout (Polish P-08)

**Note:** Verified as Blocking per PRIORITIES.md B-30 note.

**Polish items addressed:** P-08

---

#### 4a-4: Portal Templates — High B-34

**File:** `src/app/(portal)/portal/templates/page.tsx`
**Priority:** High B-34 (blue bleed + raw HTML elements)
**Effort:** S

**Changes:**
- CTA button `bg-blue-600` → `<Button variant="portal">` (from-cyan-500 to-teal-600)
- Icon container `bg-blue-100 text-blue-600` → `bg-cyan-100 text-cyan-600`
- Replace raw `<input>` → `<Input variant="portal">` component
- Replace raw `<textarea>` → `<Textarea variant="portal">` component
- Replace raw `<select>` → `<Select variant="portal">` component

---

#### 4a-5: Shopify Location — High B-35

**File:** `src/app/(portal)/portal/integrations/shopify/location/page.tsx`
**Priority:** High B-35 (blue bleed)
**Effort:** XS

**Changes:**
- Selected location: `border-blue-500 bg-blue-50` → `border-cyan-500 bg-cyan-50`
- Info box: `bg-blue-50` → `bg-cyan-50`
- Save button: `bg-gray-900` raw button → `<Button variant="portal">`
- `bg-blue-50` location info section → `bg-cyan-50` (Polish P-20)

**Polish items addressed:** P-20

---

#### 4a-6: Portal Orders Detail — High B-29

**File:** `src/app/(portal)/portal/orders/[id]/page.tsx`
**Priority:** High B-29
**Effort:** XS

**Changes:**
- STATUS_CONFIG "packed": `text-indigo-700 bg-indigo-100` → `text-cyan-700 bg-cyan-50`
- STATUS_CONFIG "confirmed": `text-blue-700 bg-blue-100` → `text-cyan-700 bg-cyan-50`

---

#### 4a-7: Portal Inventory History — High B-31

**File:** `src/app/(portal)/portal/inventory/history/page.tsx`
**Priority:** High B-31
**Effort:** XS

**Changes:**
- "ship" transaction: `text-blue-700 bg-blue-100` → `text-cyan-700 bg-cyan-50`
- "pack" transaction: `text-indigo-700 bg-indigo-100` → `text-cyan-700 bg-cyan-50`
- Replace raw `<select>` → `<Select variant="portal">` (Polish P-47)
- Remove `dark:` mode classes (Polish P-72)

**Polish items addressed:** P-47, P-72

---

#### 4a-8: Portal Lots Detail — High B-32

**File:** `src/app/(portal)/portal/lots/[id]/page.tsx`
**Priority:** High B-32
**Effort:** XS

**Changes:**
- "transfer" transaction: `text-indigo-600` → `text-cyan-600`
- "total shipped" value: `text-blue-600` → `text-cyan-600`
- gray→slate throughout (Polish P-10)

**Polish items addressed:** P-10

---

#### 4a-9: Portal Returns Detail — Polish P-19

**File:** `src/app/(portal)/portal/returns/[id]/page.tsx`
**Priority:** Polish P-19 (not in High tier but same pattern)
**Effort:** XS

**Changes:**
- "approved" status: `bg-blue-100 text-blue-700` → `bg-cyan-50 text-cyan-700`
- Original order icon: `bg-purple-100` → `bg-slate-100`
- Remove `dark:` mode classes (Polish P-72)

**Polish items addressed:** P-19, P-72, P-23

---

### 4b: Portal Auth Pages — High B-33

**Files:**
- `src/app/(portal)/forgot-password/page.tsx`
- `src/app/(portal)/reset-password/page.tsx`

**Priority:** High B-33 (auth brand mismatch — these pages show light slate background instead of dark gradient used by client-login)
**Effort:** XS

**Changes (both files):**
- Page background: `bg-slate-50` → dark gradient `from-slate-900 via-cyan-950 to-slate-900` (match `client-login/page.tsx` pattern)
- Replace raw `<input type="email">` → `<Input variant="portal">` component
- Replace raw `<input type="password">` → `<Input variant="portal">` component
- gray→slate throughout remaining text (Polish P-14)

**Polish items addressed:** P-14

---

### 4c: Portal Pages Auto-Resolved by Wave 1

These portal pages had findings primarily from component-sourced classes (admin indigo rendering instead of portal cyan). After Wave 1 adds portal variants, developers must update portal page usages to pass `variant="portal"` to Button, Input, Select, Textarea, Toggle where applicable:

| Page | Route | Action Required |
|------|-------|----------------|
| Dashboard | `src/app/(portal)/portal/dashboard/page.tsx` | Pass `variant="portal"` to form components; remove `bg-purple-50 text-purple-600` Active Orders icon → slate (Polish P-22) |
| Orders List | `src/app/(portal)/portal/orders/page.tsx` | Pass `variant="portal"` to filters |
| Inventory List | `src/app/(portal)/portal/inventory/page.tsx` | Pass `variant="portal"` to filters |
| Lots List | `src/app/(portal)/portal/lots/page.tsx` | Pass `variant="portal"` to filters; `text-blue-600` 90-day expiry → `text-amber-600` (Polish P-21); gray→slate (Polish P-11) |
| Returns | `src/app/(portal)/portal/returns/page.tsx` | Pass `variant="portal"` to filters |
| Settings | `src/app/(portal)/portal/settings/page.tsx` | Pass `variant="portal"` to Toggles and inputs |
| Integrations | `src/app/(portal)/portal/integrations/page.tsx` | Pass `variant="portal"` to buttons; `bg-blue-50` info section → `bg-cyan-50` (Polish P-20) |
| Shopify Products | `src/app/(portal)/portal/integrations/shopify/products/page.tsx` | Replace raw `<input>/<select>` → `<Input>/<Select>` with portal variant; gray→slate (Polish P-12, P-46) |
| Notifications | `src/app/(portal)/portal/notifications/page.tsx` | Pass `variant="portal"` to Toggles |

**Additional inline items:**
- `src/app/(portal)/portal/lots/page.tsx`: gray→slate throughout, `text-blue-600` 90-day expiry → `text-amber-600` (Polish P-21)
- `src/app/(portal)/portal/dashboard/page.tsx`: remove `bg-purple-50 text-purple-600` Active Orders icon → use slate (Polish P-22)

---

## Suggested Implementation Phases for v2.0 Milestone

This section is formatted for direct consumption by `/gsd:new-milestone` for the v2.0 implementation milestone.

### Recommended: 5 Implementation Phases

| Phase | Name | Contents | Waves | Est. Effort | PR Strategy |
|-------|------|----------|-------|-------------|-------------|
| P1 | Foundation | Wave 0 + Wave 1 components | 0, 1 | 3–4 days | Single PR; component library only |
| P2 | Scanner Safety | Wave 2 scanner components | 2 | 1–2 days | Single PR; scanner components only |
| P3 | Admin Pages | Wave 3a + 3b scanner + non-scanner admin fixes | 3a, 3b | 1–2 days | Single PR; admin pages only |
| P4 | Portal Pages | Wave 4a + 4b inline + auth page fixes | 4a, 4b | 1–2 days | Single PR; portal pages only |
| P5 | Verification | Wave 3c + 4c component-propagation verification + polish sweep | 3c, 4c | 1 day | QA PR; no new code — fixes only |

**Total estimated effort:** 7–11 person-days

### Phase Dependencies

```
P1 (Foundation) ──► P2 (Scanner) ──► P5 (Verification)
                └──► P3 (Admin)  ──┘
                └──► P4 (Portal) ──┘
```

P2, P3, and P4 all require P1 complete before beginning.
P3 and P4 can run simultaneously (different developers if available).
P5 waits for P2, P3, and P4.

### Phase Details

**Phase 1 — Foundation** (Wave 0 + Wave 1)
- Single PR: `feat(ui): component library overhaul — portal variants, ARIA, color corrections`
- Contains: globals.css prefers-reduced-motion, all 21 shared UI component updates
- Blocking items resolved: #7 (BarcodeScanner), #8–12 (portal variants), #16 (Pagination), #19 (Modal ARIA), #20 (SearchSelect ARIA)
- High items resolved: B-01 through B-13, B-36, B-37, B-38, B-40
- Quick Wins included: #1–7, #10, #11, #12, #13, #14, #15

**Phase 2 — Scanner Safety** (Wave 2)
- Single PR: `fix(scanners): resolve all Blocking tap-target and text-size violations`
- Contains: 10 scanner component updates
- Blocking items resolved: #1–6 (all scanner tap targets except BarcodeScanner which is in P1)
- High items resolved: B-14 through B-18, B-39 (dark mode removal)

**Phase 3 — Admin Pages** (Wave 3a + 3b)
- Single PR: `fix(admin): resolve inline color overrides — scanner routes and page-level fixes`
- Contains: ~10 admin page updates
- Blocking items resolved: #13 (Inventory Transfers), #14 (Task queues), #15 (Location Sublocations)
- High items resolved: B-19 through B-28 (admin inline fixes)

**Phase 4 — Portal Pages** (Wave 4a + 4b)
- Single PR: `fix(portal): resolve inline blue bleed and auth page brand fixes`
- Contains: ~12 portal page updates
- Blocking items resolved: #17 (request-shipment/confirmation), #18 (plan/billing pages)
- High items resolved: B-29 through B-35 (portal inline + auth)

**Phase 5 — Verification** (Wave 3c + 4c + polish)
- Single PR: `chore(verify): component-propagation verification + polish sweep`
- Contains: QA pass on 3c/4c pages, adding `variant="portal"` where needed, remaining polish items
- Resolves: All Polish Backlog items that are in scope for v2.0 milestone

### Effort Summary by Phase

| Phase | Blocking Items | High Items | Min Effort | Max Effort |
|-------|---------------|------------|------------|------------|
| P1 | 6 | 21 | 3 days | 4 days |
| P2 | 6 | 5 | 1 day | 2 days |
| P3 | 3 | 10 | 1 day | 2 days |
| P4 | 2 | 7 | 1 day | 2 days |
| P5 | 0 | 0 (verification) | 0.5 days | 1 day |
| **Total** | **17** | **43** | **6.5 days** | **11 days** |

Note: Blocking #8–12 (portal variants) are resolved in P1 but their page-level manifestations require P4 (`variant="portal"` prop addition on portal pages).

---

## Cross-Reference: All Blocking Items Accounted For

| Blocking # | Item | Wave | Section |
|------------|------|------|---------|
| 1 | PickingScanner tap targets | Wave 2 | 2.3 |
| 2 | PickScanner tap targets | Wave 2 | 2.4 |
| 3 | PackScanner tap targets | Wave 2 | 2.5 |
| 4 | ShipScanner tap target | Wave 2 | 2.6 |
| 5 | ReceivingScanner tap targets | Wave 2 | 2.2 |
| 6 | PalletBreakdownScanner tap targets + text | Wave 2 | 2.1 |
| 7 | BarcodeScanner tap target + text | Wave 1 | 1.9 |
| 8 | Button portal variant | Wave 1 | 1.1 |
| 9 | Input portal variant | Wave 1 | 1.2 |
| 10 | Select portal variant | Wave 1 | 1.3 |
| 11 | Textarea portal variant | Wave 1 | 1.4 |
| 12 | Toggle portal variant | Wave 1 | 1.5 |
| 13 | Inventory Transfers scanner page | Wave 3 | 3a-1 |
| 14 | Task queue action buttons (3 pages) | Wave 3 | 3a-2 |
| 15 | Location Sublocations scanner page | Wave 3 | 3a-3 |
| 16 | Pagination min-h-[44px] | Wave 1 | 1.8 |
| 17 | request-shipment/confirmation blue bleed | Wave 4 | 4a-2 |
| 18 | Billing/plan pages blue bleed | Wave 4 | 4a-1 |
| 19 | Modal role="dialog" + aria-modal | Wave 1 | 1.6 |
| 20 | SearchSelect ARIA combobox | Wave 1 | 1.7 |

**All 20 Blocking items present. ✓**

---

## Cross-Reference: All High-Value Items Accounted For

| High # | Item | Wave | Section |
|--------|------|------|---------|
| B-01 | Alert color + aria | Wave 1 | 1.10 |
| B-02 | Badge color + border | Wave 1 | 1.11 |
| B-03 | Spinner color + aria + motion | Wave 1 | 1.12 |
| B-04 | StatCard iconColor default | Wave 1 | 1.13 |
| B-05 | Toast info→indigo + warning variant | Wave 1 | 1.14 |
| B-06 | Toggle admin blue→indigo | Wave 1 | 1.5 |
| B-07 | Textarea admin focus ring + gray→slate | Wave 1 | 1.4 |
| B-08 | Pagination active state + focus rings | Wave 1 | 1.8 |
| B-09 | Breadcrumbs aria + focus rings | Wave 1 | 1.15 |
| B-10 | Card keyboard accessibility | Wave 1 | 1.16 |
| B-11 | Modal close button aria + focus | Wave 1 | 1.6 |
| B-12 | Chart aria-label + role="img" | Wave 1 | 1.17 |
| B-13 | Chart prefers-reduced-motion | Wave 1 | 1.17 |
| B-14 | PickingScanner text sizes | Wave 2 | 2.3 |
| B-15 | PickScanner text sizes | Wave 2 | 2.4 |
| B-16 | PackScanner text sizes | Wave 2 | 2.5 |
| B-17 | ShipScanner text sizes | Wave 2 | 2.6 |
| B-18 | ReceivingScanner text sizes + calendar input | Wave 2 | 2.2 |
| B-19 | Dashboard inline overrides | Wave 3 | 3b-1 |
| B-20 | Inbound/Outbound status tabs | Wave 3 | 3b-2 |
| B-21 | Tasks List icons + priority badges | Wave 3 | 3b-3 |
| B-22 | Lots List tab + search + links | Wave 3 | 3b-4 |
| B-23 | Reports Hub icon colors | Wave 3 | 3b-5 |
| B-24 | Location Sublocations non-Blocking | Wave 3 | 3a-3 |
| B-25 | Settings active sidebar tab | Wave 3 | 3b-6 |
| B-26 | Inventory List status colors | Wave 3 | 3b-7 |
| B-27 | Outbound source badges | Wave 3 | 3b-2 |
| B-28 | Task Detail tap target + timeline | Wave 3 | 3a-4 |
| B-29 | Portal orders/[id] status overrides | Wave 4 | 4a-6 |
| B-30 | Portal inventory/[id] blue bleed | Wave 4 | 4a-3 |
| B-31 | Portal inventory/history inline | Wave 4 | 4a-7 |
| B-32 | Portal lots/[id] inline | Wave 4 | 4a-8 |
| B-33 | Portal auth flow background + raw inputs | Wave 4 | 4b |
| B-34 | Portal templates blue bleed + raw inputs | Wave 4 | 4a-4 |
| B-35 | Shopify location blue bleed | Wave 4 | 4a-5 |
| B-36 | globals.css prefers-reduced-motion | Wave 0 | Wave 0 |
| B-37 | StatCard useAnimatedNumber motion guard | Wave 1 | 1.13 |
| B-38 | Systematic gray→slate in shared components | Wave 1 | 1.18–1.21 |
| B-39 | Remove dark mode from scanner components | Wave 2 | 2.1–2.6 |
| B-40 | StatusBadge variant mapping refactor | Wave 1 | 1.20 |

**All 40 High-Value items present. ✓**
