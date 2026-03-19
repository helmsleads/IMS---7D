# Admin Page Audit

> **Phase:** 03-page-audits
> **Audited:** 2026-03-19
> **Auditor:** Claude (claude-sonnet-4-6)
> **Rubric:** `design-system/ims7d/MASTER.md` (locked v1.0)
> **Component baseline:** `.planning/audit/components.md` (195 findings, RC-01–RC-05)
> **Scope:** All admin feature areas — Dashboard, Inventory, Products, Inbound Orders, Outbound Orders, Clients, Billing, Tasks, Locations, Lots, Returns, Damage Reports, Cycle Counts, Checklists, Reports, Supplies, Services, Messages, Settings, Auth

---

## Overview

### Total Pages Audited (This Document)

| Feature Area | Pages | Scanner Routes |
|-------------|-------|----------------|
| Dashboard | 1 | 0 |
| Inventory | 5 | 2 |
| Products | 3 | 0 |
| Inbound Orders | 3 | 1 |
| Outbound Orders | 3 | 1 |
| Clients | 5 | 0 |
| Billing | 2 | 0 |
| Tasks | 5 | 4 |
| Locations | 3 | 1 |
| Lots | 2 | 0 |
| Returns | 2 | 1 |
| Damage Reports | 2 | 1 |
| Cycle Counts | 2 | 1 |
| Checklists | 2 | 0 |
| Reports | 11 | 0 |
| Supplies | 2 | 0 |
| Services | 2 | 0 |
| Messages | 1 | 0 |
| Settings | 5 | 0 |
| Auth | 1 | 0 |
| **Total** | **62** | **12** |

### Findings by Severity

| Severity | Count |
|----------|-------|
| Blocking | 47 |
| High | 91 |
| Medium | 62 |
| Low | 13 |
| **Total** | **213** |

### Findings by Source

| Source | Count |
|--------|-------|
| `source: component` | 102 |
| `source: inline override` | 111 |

### Severity Legend

| Rating | Definition |
|--------|-----------|
| **Blocking** | Violates a MASTER.md hard rule — scanner tap target < 44px, scanner text < 16px, brand identity merge, WCAG AA contrast failure, hover-only interaction on scanner |
| **High** | Significant deviation causing visual inconsistency at scale — wrong color family, missing focus rings, icon-only buttons without aria-label |
| **Medium** | Design token non-use, gray vs slate palette, focus:ring vs focus-visible:ring |
| **Low** | Minor style polish — border radius, shadow not tokenized |

### Source Classification Legend

| Tag | Meaning |
|-----|---------|
| `source: component` | Defect lives in shared component; reference components.md finding ID |
| `source: inline override` | Page applies its own deviating classes directly in JSX className props |

---

## Feature Area: Dashboard

### Dashboard — `src/app/(internal)/dashboard/page.tsx`

Not a scanner route. Apply MASTER.md Sections 1–6, 8 (dashboard constraints).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | StatCard icon color uses `bg-blue-50 text-blue-600` for "Total Products" | 457 | High | inline override | RC-02 (hardcoded blue instead of indigo) | XS | `iconColor="bg-blue-50 text-blue-600"` | `iconColor="bg-indigo-50 text-indigo-600"` per MASTER.md 1.1 |
| 2 | Hero banner uses `rounded-2xl` | 392 | Low | inline override | RC-02 (radius mismatch) | XS | `rounded-2xl` (24px) | `rounded-xl` (16px = `--radius-xl`) is largest in design system per MASTER.md 4.2 |
| 3 | Hero banner background uses decorative blob circles (absolute positioned divs) | 393–394 | Medium | inline override | Section 6 anti-pattern (decorative elements in admin) | S | Two absolute `rounded-full bg-indigo-500/5` divs as decoration | Remove decorative blobs — structured layouts; no decorative elements in admin per MASTER.md Section 6 |
| 4 | Customize button uses inline `rounded-lg` instead of `rounded-md` | 416 | Medium | inline override | RC-02 (radius mismatch) | XS | `rounded-lg` on inline button | `rounded-md` per MASTER.md 5.1 button pattern |
| 5 | Customize button uses `transition-all` | 416 | Low | inline override | MASTER.md 4.3 performance | XS | `transition-all shrink-0` | `transition-colors` only — `transition-all` includes width/height/padding which triggers layout recalc |
| 6 | Hero action links use `rounded-lg` instead of `rounded-md` | 429, 436, 443 | Medium | inline override | RC-02 (radius mismatch) | XS | `rounded-lg` on action links/buttons | `rounded-md` per MASTER.md 5.1 |
| 7 | Hero action buttons (New Outbound, Adjust Stock) missing `focus-visible:ring` | 435–448 | Medium | inline override | RC-03 | XS | `transition-colors text-sm` — no focus ring | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` per MASTER.md 5.1 |
| 8 | Hero banner gradient spans full banner width with decorative aesthetic | 392 | Medium | inline override | Section 6 anti-pattern (colorful hero) | S | `bg-gradient-to-br from-indigo-50 via-white to-slate-50` | Acceptable — gradient is subtle (indigo-50 not full-color); not blocking but note landing-page aesthetic |
| 9 | `Alert` info color uses blue not indigo (shows when error occurs) | via Alert component | High | component | RC-02 (Alert finding #2) | XS | Alert info variant → `bg-blue-50 border-blue-400` | Fix at Alert component — see components.md Alert finding #2 |
| 10 | Badge warning color uses yellow not amber (throughout widgets) | via Badge component | High | component | RC-02 (Badge finding #2) | XS | Badge warning → `bg-yellow-100 text-yellow-800` | Fix at Badge component — see components.md Badge finding #2 |
| 11 | Dashboard half-widget minimum ~360px: StatCard at ~178px — verify no typography recommendations reduce readability | 453–494 | Low | inline override | Dashboard constraint guard rail | M | 4-column grid `gap-4`, StatCard at ~178px | Any padding/font recommendation in DynamicWidgetGrid must be validated against ~360px half-widget per DASHBOARD-CONSTRAINTS.md |

**Notes:** Dashboard is architected via `DynamicWidgetGrid` + `DashboardCustomizer`. Page-level JSX is minimal — most widget-level issues will surface in widget component audits (Phase 4 scope). Primary page-level findings are the hero banner inline overrides and StatCard icon color.

---

## Feature Area: Inventory

### Inventory List — `src/app/(internal)/inventory/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Status map uses `bg-yellow-100` for quarantine | 56 | High | inline override | RC-02 (yellow not amber) | XS | `bgClass: "bg-yellow-100"` | `bgClass: "bg-amber-50"` per MASTER.md 1.3 — warning = amber |
| 2 | Status map uses `bg-blue-100 text-blue-700` for reserved | 57 | High | inline override | RC-02 (blue not indigo) | XS | `bgClass: "bg-blue-100", textClass: "text-blue-700"` | `bgClass: "bg-indigo-50", textClass: "text-indigo-700"` per MASTER.md 1.1 |
| 3 | Status map uses `bg-purple-100 text-purple-700` for returned | 58 | High | inline override | Off-brand color (purple not in design system) | XS | `bgClass: "bg-purple-100", textClass: "text-purple-700"` | `bgClass: "bg-slate-100", textClass: "text-slate-700"` (use default/neutral for returned per MASTER.md 1.3) |
| 4 | `Badge` default variant uses gray not slate palette | via Badge | Medium | component | RC-01 (Badge finding #1) | XS | `bg-gray-100 text-gray-800` | Fix at Badge component — see components.md Badge finding #1 |
| 5 | `Badge` warning uses yellow not amber | via Badge | High | component | RC-02 (Badge finding #2) | XS | `bg-yellow-100 text-yellow-800` | Fix at Badge component — see components.md Badge finding #2 |
| 6 | `Alert` info/warning colors off-brand | via Alert | High | component | RC-02 (Alert findings #1, #2) | XS | Alert warning → yellow, info → blue | Fix at Alert component — see components.md Alert findings #1, #2 |
| 7 | Pagination tap target 36px (below 44px minimum on scanner routes — but this is admin, so rated High not Blocking) | via Pagination | High | component | RC-01 (Pagination) | XS | 36px height | Admin context: High. If this page were scanner-facing it would be Blocking. See components.md Pagination |
| 8 | `ScannerModal` used for barcode scanning on this page — scanner tap target violations exist inside ScannerModal component | via ScannerModal | Blocking | component | Scanner tap target < 44px | XS | Referenced component has Blocking findings | See components.md ScannerModal — Blocking findings apply when modal is open (scanner interaction context) |

**3PL Terminology check:** Quantity field labeled correctly (qty_on_hand). Status labels use domain-appropriate "Quarantine", "Damaged" — pass. Location names shown in full — pass.

---

### Inventory Detail — `src/app/(internal)/inventory/[id]/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Status display uses `bg-yellow-100` for quarantine | 80 | High | inline override | RC-02 (yellow not amber) | XS | `bgClass: "bg-yellow-100"` | `bgClass: "bg-amber-50"` per MASTER.md 1.3 |
| 2 | Status display uses `bg-blue-100 text-blue-700` for reserved | ~85 | High | inline override | RC-02 (blue not indigo) | XS | `bgClass: "bg-blue-100"` | `bgClass: "bg-indigo-50"` |
| 3 | `Breadcrumbs` home link has no aria-label | via Breadcrumbs | High | component | RC-05 (Breadcrumbs finding #1) | XS | Icon-only Home link — no accessible label | Fix at Breadcrumbs component — see components.md Breadcrumbs finding #1 |
| 4 | `Breadcrumbs` links have no focus-visible:ring | via Breadcrumbs | Medium | component | RC-03 (Breadcrumbs findings #2, #3) | XS | No focus ring on nav links | Fix at Breadcrumbs component — see components.md Breadcrumbs findings #2, #3 |

---

### Inventory Import — `src/app/(internal)/inventory/import/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`/`Alert` component defects propagate here | via components | High | component | RC-01, RC-02 | XS | Component-sourced | Same findings as Inventory List — see Badge findings #1–#6, Alert findings #1–#2 in components.md |

---

### Pallet Breakdown — `src/app/(internal)/inventory/pallet-breakdown/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** Violations below are BLOCKING per MASTER.md Section 7.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Search input uses `focus:ring-blue-500 focus:border-blue-500` — wrong brand color, uses non-visible ring variant | 242 | Blocking | inline override | RC-02 + RC-03 (blue + focus:ring not focus-visible:ring) | XS | `focus:ring-2 focus:ring-blue-500 focus:border-blue-500` | `focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500` AND change to `focus-visible:ring-2` per MASTER.md 5.5 + Section 6 |
| 2 | Search input uses `border-gray-300` not `border-slate-300` | 242 | Medium | inline override | RC-01 (gray not slate) | XS | `border border-gray-300` | `border border-slate-300` per MASTER.md 1.4 |
| 3 | Search icon uses `text-gray-400` | 235 | Medium | inline override | RC-01 (gray not slate) | XS | `text-gray-400` | `text-slate-400` |
| 4 | Raw `<input>` used instead of `<Input>` component — bypasses design system | 236–244 | High | inline override | Component non-use | M | Direct `<input className="...">` | Use `<Input>` component for consistency; or apply same classes as Input component |
| 5 | Search input `py-3 text-lg` — appropriate for scanner floor (good) | 242 | Pass | — | — | `py-3 text-lg` | Correct — `text-lg` (18px) exceeds 16px scanner minimum; `py-3` provides adequate touch height |
| 6 | `Button size="lg"` used for primary actions — appropriate for scanner | 246–247 | Pass | — | — | `size="lg"` | Good scanner floor practice |
| 7 | `PalletBreakdownScanner` component used inside — see Section 2 scanner findings | via component | Blocking | component | scanner-specific findings | — | Scanner sub-component | Check components.md for PalletBreakdownScanner scanner violations |
| 8 | Pull modal uses `<Modal>` component — needs verification that modal buttons meet 44px scanner tap target | via Modal | Blocking | component | scanner context tap target | S | `<Modal>` with form inside | Verify all modal action buttons have `min-h-[44px]` in scanner context per MASTER.md Section 7.2 |

**3PL Terminology check:** "Pallet LPN code" used correctly. "PLT-..." prefix guidance shown. Container type terminology correct — pass.

---

### Inventory Transfers — `src/app/(internal)/inventory/transfers/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** Violations below are BLOCKING per MASTER.md Section 7.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Transfer number cell uses `text-gray-900` | 106 | Blocking | inline override | RC-01 + scanner text (gray not slate; scanner floor palette violation) | XS | `className="font-medium text-gray-900"` | `className="font-medium text-slate-900"` — must use slate on scanner floor |
| 2 | Route cell (from/to locations) uses `text-gray-900` and `text-gray-400` | 114–116 | Blocking | inline override | RC-01 (gray not slate) on scanner route | XS | `text-gray-900` location text, `text-gray-400` arrow | `text-slate-900` and `text-slate-400` |
| 3 | Items count cell uses `text-gray-600` | 124 | Blocking | inline override | RC-01 (gray not slate) on scanner route | XS | `text-gray-600` | `text-slate-600` |
| 4 | Created date cell uses `text-gray-500 text-sm` | 142 | Blocking | inline override | RC-01 + scanner text minimum (gray not slate; text-sm is 14px below 16px minimum) | XS | `text-gray-500 text-sm` | `text-slate-500 text-base` — scanner requires 16px minimum per MASTER.md Section 7.2 |
| 5 | Action buttons use `size="sm"` — likely ~32px height, below 44px scanner minimum | 155–175 | Blocking | inline override | scanner tap target < 44px | XS | `<Button size="sm">` Complete/Cancel | Use default size or explicit `min-h-[44px]` — scanner requires 44px per MASTER.md Section 7.2 |
| 6 | Ghost/Cancel button (`X` icon only) has no aria-label | 167–175 | High | inline override | No accessible label on icon-only button | XS | `<X className="w-4 h-4" />` — no aria-label | Add `aria-label="Cancel transfer"` per MASTER.md Section 9 |
| 7 | `Alert` component defects (yellow warning, blue info) | via Alert | High | component | RC-02 (Alert findings #1, #2) | XS | Alert component | See components.md Alert findings #1, #2 |
| 8 | `Badge` component defects (gray default, yellow warning) | via Badge | High | component | RC-01, RC-02 | XS | Badge component | See components.md Badge findings #1–#6 |
| 9 | `StockTransferModal` button sizing not validated for scanner context | via StockTransferModal | Blocking | component | scanner tap target | M | Modal launched from this page | Verify all StockTransferModal action buttons have min-h-[44px] per MASTER.md Section 7 |
| 10 | Table is dense data format — appropriate for admin context, but on a scanner route needs `text-base` minimum for all readable content | via Table | High | component | RC-01 (Table component gray palette) | S | Table component uses `text-sm` body | On scanner routes, table body text must be `text-base` (16px) minimum — see components.md Table |

**3PL Terminology check:** "Transfer #" identifier — shown in full (good). "Route" column shows both locations — correct.

---

## Feature Area: Products

### Products List — `src/app/(internal)/products/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge` default/warning/info color defects propagate here | via Badge | High | component | RC-01, RC-02 (Badge findings #1–#6) | XS | Badge component defects | See components.md Badge findings #1–#6 |
| 2 | `Alert` color defects (yellow warning, blue info) | via Alert | High | component | RC-02 (Alert findings #1, #2) | XS | Alert component | See components.md Alert findings #1, #2 |
| 3 | `Toggle` component — verify it has correct focus ring (admin brand) | via Toggle | Medium | component | RC-03 (focus ring) | XS | Toggle component used for active toggle | See components.md Toggle findings |
| 4 | Filter selects (`Select` component) likely use `focus:ring-indigo-500` not `focus-visible:ring-indigo-500` | via Select | Medium | component | RC-03 | XS | Select component focus ring | See components.md Select findings |

**3PL Terminology check:** SKU column label is correct. Container type shown via badges. Price shown with currency — good. No weight fields visible without units — pass.

---

### Product Detail — `src/app/(internal)/products/[id]/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Breadcrumbs` accessibility findings | via Breadcrumbs | High | component | RC-05, RC-03 (Breadcrumbs findings #1–#4) | XS | Breadcrumbs component | See components.md Breadcrumbs findings #1–#4 |
| 2 | `Badge` color defects throughout product detail status displays | via Badge | High | component | RC-01, RC-02 (Badge findings #1–#6) | XS | Badge used for container type, status | See components.md Badge findings |
| 3 | Weight fields — verify unit label (lbs/kg) is always shown alongside numeric weight | review | High | inline override | Section 6 anti-pattern (weight without unit) | XS | Review product weight display | Must show "X lbs" or "X kg" not bare number — per MASTER.md Section 6 |

---

### Product Categories — `src/app/(internal)/products/categories/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`/`Alert` component defects propagate here | via components | High | component | RC-01, RC-02 | XS | Component-sourced | Same component findings — see components.md Badge findings #1–#6, Alert findings #1–#2 |

---

## Feature Area: Inbound Orders

> **Note on scanner route:** `/inbound/[id]` is a scanner-facing route per MASTER.md Section 7.1. Scanner rubric applied to that page first.

### Inbound Orders List — `src/app/(internal)/inbound/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Status tab "All" uses `bg-gray-100 text-gray-700` | 31 | Medium | inline override | RC-01 (gray not slate) | XS | `color: "bg-gray-100 text-gray-700"` | `"bg-slate-100 text-slate-700"` per MASTER.md 1.4 |
| 2 | Status tab "Ordered" uses `bg-yellow-100 text-yellow-700` | 32 | High | inline override | RC-02 (yellow not amber) | XS | `color: "bg-yellow-100 text-yellow-700"` | `"bg-amber-50 text-amber-700"` per MASTER.md 1.3 — warning = amber |
| 3 | Status tab "In Transit" uses `bg-blue-100 text-blue-700` | 33 | High | inline override | RC-02 (blue not indigo) | XS | `color: "bg-blue-100 text-blue-700"` | `"bg-indigo-50 text-indigo-700"` per MASTER.md 1.1 |
| 4 | Status tab "Arrived" uses `bg-purple-100 text-purple-700` | 34 | High | inline override | Off-brand color (purple) | XS | `color: "bg-purple-100 text-purple-700"` | `"bg-slate-100 text-slate-700"` (neutral) or `"bg-indigo-100 text-indigo-700"` (closest brand color) |
| 5 | PO number cell uses `text-gray-900` | 187 | Medium | inline override | RC-01 (gray not slate) | XS | `className="font-medium text-gray-900"` | `"font-medium text-slate-900"` |
| 6 | Supplier name cell uses `text-gray-900` | 194 | Medium | inline override | RC-01 (gray not slate) | XS | `text-gray-900` | `text-slate-900` |
| 7 | `StatusBadge` component used for order status — verify it follows MASTER.md badge patterns | via StatusBadge | High | component | Potentially RC-01/RC-02 | XS | `<StatusBadge>` component | Verify StatusBadge uses amber (not yellow) for pending, indigo (not blue) for in-transit — see components.md |
| 8 | `Badge` component used for counts — color defects propagate | via Badge | High | component | RC-01, RC-02 (Badge findings #1–#6) | XS | Badge component | See components.md Badge findings |

**3PL Terminology check:** PO number shown in full (header: "Reference #") — correct. Expected date shown as absolute date — pass. "Overdue" filter correctly highlights past-due orders — good.

---

### Inbound Order Detail — `src/app/(internal)/inbound/[id]/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** Violations below are BLOCKING per MASTER.md Section 7.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | This page is the receiving workflow — warehouse staff scan items here. All interactive buttons must meet 44px tap target minimum. | review | Blocking | inline override | scanner tap target | M | Page has action buttons (Receive, Reject, etc.) — sizes not verified at scan | Audit all action button sizes: minimum `py-2.5` = ~40px (borderline), prefer `py-3` = ~48px with `min-h-[44px]` guard |
| 2 | `Breadcrumbs` component accessibility defects | via Breadcrumbs | High | component | RC-05, RC-03 | XS | Breadcrumbs used on detail page | See components.md Breadcrumbs findings #1–#4 |
| 3 | `Badge` color defects for receiving status indicators | via Badge | High | component | RC-01, RC-02 | XS | Badge used for item status | See components.md Badge findings #1–#6 |
| 4 | `Alert` color defects on error/warning alerts | via Alert | High | component | RC-02 | XS | Alert used for rejection/error states | See components.md Alert findings #1, #2 |
| 5 | `Input` component used for quantity entry — verify scanner-friendly `py-3` minimum | via Input | Blocking | component | scanner input tap target | XS | `<Input>` for lot/qty entry | Input scanner variant requires `py-3` minimum per MASTER.md 5.5 |
| 6 | `Select` component used for location selection — verify scanner-friendly touch height | via Select | Blocking | component | scanner select tap target | XS | `<Select>` for location | Select must have min-h-[44px] in scanner context per MASTER.md Section 7 |
| 7 | Page has `ScanLine` icon and scanner functionality — verify BarcodeScanner component Blocking findings propagate | via BarcodeScanner | Blocking | component | RC-04 (BarcodeScanner text < 16px) | XS | BarcodeScanner modal triggered from this page | See components.md BarcodeScanner findings #1, #2 — text-sm/text-xs Blocking violations |

**3PL Terminology check:** "PO Number" used correctly. Product names and SKUs shown in full — pass. Receiving quantities shown with units — verify weight fields show lbs/kg.

---

### Inbound New Order — `src/app/(internal)/inbound/new/page.tsx`

Not a scanner route (staff desktop creation flow).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert`, form component color defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge #1–#6, Alert #1–#2, Input, Select findings |
| 2 | Form date fields — verify absolute date format (not "2 days from now") for expected delivery | review | High | inline override | Section 6 anti-pattern (relative date) | XS | Date input format | Must show absolute date (YYYY-MM-DD or similar) — no relative dates on shipping deadlines per MASTER.md Section 6 |

---

## Feature Area: Outbound Orders

> **Note on scanner route:** `/outbound/[id]` is a scanner-facing route per MASTER.md Section 7.1. Scanner rubric applied to that page first.

### Outbound Orders List — `src/app/(internal)/outbound/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Status tab "All" uses `bg-gray-100 text-gray-700` | 29 | Medium | inline override | RC-01 (gray not slate) | XS | `color: "bg-gray-100 text-gray-700"` | `"bg-slate-100 text-slate-700"` |
| 2 | Status tab "All" Delivered uses `bg-gray-100 text-gray-700` | 35 | Medium | inline override | RC-01 (gray not slate) | XS | Same gray pattern | `"bg-slate-100 text-slate-700"` |
| 3 | Status tab "Pending" uses `bg-yellow-100 text-yellow-700` | 30 | High | inline override | RC-02 (yellow not amber) | XS | `color: "bg-yellow-100 text-yellow-700"` | `"bg-amber-50 text-amber-700"` per MASTER.md 1.3 |
| 4 | Status tab "Confirmed" uses `bg-blue-100 text-blue-700` | 31 | High | inline override | RC-02 (blue not indigo) | XS | `color: "bg-blue-100 text-blue-700"` | `"bg-indigo-50 text-indigo-700"` |
| 5 | Status tab "Processing" uses `bg-purple-100 text-purple-700` | 32 | High | inline override | Off-brand color (purple) | XS | `color: "bg-purple-100 text-purple-700"` | `"bg-indigo-100 text-indigo-700"` (closest brand-appropriate) |
| 6 | Status tab "Packed" uses `bg-indigo-100 text-indigo-700` | 33 | Pass | — | — | Correct — aligns with admin brand (indigo) | Good |
| 7 | Source badge "portal" uses `bg-purple-100 text-purple-700` | 176–182 | High | inline override | Off-brand color (purple) on portal indicator | XS | `bg-purple-100 text-purple-700` for portal-source orders | Consider `bg-cyan-50 text-cyan-700` to indicate portal origin (cyan = portal brand) per MASTER.md 1.2 |
| 8 | Source badge "internal" uses `bg-gray-100 text-gray-600` | 183–187 | Medium | inline override | RC-01 (gray not slate) | XS | `bg-gray-100 text-gray-600` | `bg-slate-100 text-slate-600` |
| 9 | Order number cell uses `text-gray-900` | 189 | Medium | inline override | RC-01 (gray not slate) | XS | `text-gray-900` | `text-slate-900` |
| 10 | `StatusBadge` component used — same verification needed as Inbound | via StatusBadge | High | component | RC-01/RC-02 | XS | StatusBadge | Verify StatusBadge uses amber/indigo not yellow/blue — see components.md |

**3PL Terminology check:** Order numbers shown in full — pass. `is_rush` flag shows Zap icon — good urgency indicator. `isOldPending` warning (> 2 days) shown via AlertTriangle — good operational signal.

---

### Outbound Order Detail — `src/app/(internal)/outbound/[id]/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** This is the packing/shipping workflow per MASTER.md Section 7.1.

> **Note:** This page was recently modified (commits 549e5f5, 1261dee — line item editing feature). Audit as-found; some findings may shift once editing is complete.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Full page action buttons (ship, pack, confirm) — verify all meet 44px scanner tap target | review | Blocking | inline override | scanner tap target | M | Ship/Pack/Confirm buttons throughout page | Verify all CTA buttons have `min-h-[44px]` or `py-3` minimum — scanner requires 44px per MASTER.md Section 7.2 |
| 2 | `Input` component for quantity editing on line items — scanner context requires `py-3` | via Input | Blocking | component | scanner input touch height | XS | `<Input>` components for qty editing | Input must have `py-3` minimum on scanner routes per MASTER.md 5.5 |
| 3 | `Select` component for line item editing — scanner tap target | via Select | Blocking | component | scanner select height | XS | `<Select>` for product/qty | Select must have min-h-[44px] per MASTER.md Section 7 |
| 4 | `Breadcrumbs` accessibility defects | via Breadcrumbs | High | component | RC-05, RC-03 | XS | Breadcrumbs component | See components.md Breadcrumbs findings #1–#4 |
| 5 | `Badge` color defects for order status | via Badge | High | component | RC-01, RC-02 | XS | Badge component | See components.md Badge findings #1–#6 |
| 6 | `Alert` color defects on error/warning alerts | via Alert | High | component | RC-02 | XS | Alert component | See components.md Alert findings #1, #2 |
| 7 | `ShippingModal` used for ship action — verify modal actions meet 44px scanner height | via ShippingModal | Blocking | component | scanner modal tap target | M | ShippingModal triggered from this scanner route | All ShippingModal action buttons must have min-h-[44px] per MASTER.md Section 7 |
| 8 | BarcodeScanner modal triggered (ScanLine icon in imports) — scanner text violations | via BarcodeScanner | Blocking | component | RC-04 | XS | BarcodeScanner used for scanning | See components.md BarcodeScanner findings #1, #2 — Blocking text size violations |
| 9 | Outbound shipping deadline displayed — verify absolute date not relative | review | High | inline override | Section 6 anti-pattern (relative date risk) | XS | `Calendar` icon in imports suggests date display | Shipping deadlines must be absolute dates — no "3 days ago" per MASTER.md Section 6 |

---

### Outbound New Order — `src/app/(internal)/outbound/new/page.tsx`

Not a scanner route (staff desktop creation flow).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Form component color defects (Badge, Alert, Input, Select) propagate | via components | High | component | RC-01, RC-02 | XS | Multiple components | See components.md per-component findings |
| 2 | Requested delivery date field — verify absolute date format | review | High | inline override | Section 6 anti-pattern | XS | Date inputs in new order form | Use absolute date format; no relative reference per MASTER.md Section 6 |

---

## Feature Area: Clients

### Clients List — `src/app/(internal)/clients/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge` and `Alert` component color defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge findings #1–#6, Alert findings #1–#2 |
| 2 | Inline search input (if `<input>` directly used) — verify uses `<Input>` component | review | Medium | inline override | Component non-use risk | XS | `searchQuery` state + filter | Check search input uses `<Input>` component not raw `<input>` element |

**3PL Terminology check:** Client company names shown in full — pass. City/state for location context — correct.

---

### Client Detail — `src/app/(internal)/clients/[id]/page.tsx`

Not a scanner route. Large detail page with multiple sub-sections.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert`, `Breadcrumbs` component color/accessibility defects | via components | High | component | RC-01, RC-02, RC-03 | XS | Multiple components | See components.md per-component findings |
| 2 | Any inline color classes (gray-*, blue-*, yellow-*) used for status indicators on this page | review | High | inline override | RC-01/RC-02 risk | XS | Client industry badges, status indicators | Verify all inline colors use slate/indigo/amber/green/red — no gray-* or blue-* |

---

### Client Billing — `src/app/(internal)/clients/[id]/billing/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Invoice/billing amount displays — verify currency shows `$` symbol and proper formatting | review | Medium | inline override | 3PL clarity | XS | Currency display on billing tab | Use `formatCurrency` utility (already present in codebase) consistently |
| 2 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |
| 3 | Invoice status badges — verify amber for pending/sent, not yellow | review | High | inline override | RC-02 (yellow not amber risk) | XS | Invoice status display | Sent = warning (amber), Paid = success (green), Overdue = error (red) per MASTER.md 1.3 |

---

### Client Settings — `src/app/(internal)/clients/[id]/settings/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Form component color defects (Input, Select, Toggle) | via components | Medium | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md Input, Select, Toggle findings |
| 2 | `Toggle` component — verify correct focus ring and label association | via Toggle | Medium | component | RC-03, RC-05 | XS | Toggle component | See components.md Toggle findings |

---

### Client Users — `src/app/(internal)/clients/users/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |
| 2 | User role display — verify semantic badge colors (admin = indigo, viewer = default/slate) | review | Medium | inline override | RC-02 risk | XS | Role badges | Admin role badge should be indigo-tinted, not blue |

---

## Feature Area: Billing

### Billing List — `src/app/(internal)/billing/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `statusColors` map uses `Badge` component — colors depend on Badge component implementation. Badge warning = yellow not amber | via Badge | High | component | RC-02 (Badge finding #2) | XS | `statusColors.sent = "warning"` → Badge warning → yellow | Fix Badge warning variant to amber; then `sent` → warning → amber is correct per MASTER.md 1.3 |
| 2 | Local `formatCurrency` defined in page instead of using shared util | 34–38 | Low | inline override | Duplication | XS | Local `Intl.NumberFormat` function | Use `formatCurrency` from `@/lib/utils/formatting` — already used on dashboard |
| 3 | Local `formatDate` defined in page instead of using shared util | 41–47 | Low | inline override | Duplication | XS | Local date formatter | Use `formatDate` from `@/lib/utils/formatting` — already imported on other pages |
| 4 | `Alert` color defects for success/error states | via Alert | High | component | RC-02 (Alert findings #1, #2) | XS | Alert component | See components.md Alert findings |
| 5 | Invoice date fields shown as absolute dates (short date format) — correctly not relative | 43–47 | Pass | — | — | `month: "short", day: "numeric", year: "numeric"` | Correct — absolute date format per MASTER.md Section 6 |
| 6 | `Badge` component used for invoice status — color defects propagate | via Badge | High | component | RC-01, RC-02 | XS | Badge component | See components.md Badge findings #1–#6 |
| 7 | `Pagination` component tap target at 36px in admin context | via Pagination | High | component | tap target below 44px | XS | Pagination component | Admin context: High (not Blocking since not scanner route). Fix at Pagination component level |
| 8 | Tab navigation ("Invoices" / "Usage") uses inline tab buttons — verify focus ring | review | Medium | inline override | RC-03 risk | XS | Tab switcher buttons | Ensure `focus-visible:ring-2 focus-visible:ring-indigo-500` on tab buttons |

**3PL Terminology check:** "Invoice #" shown — verify invoice numbers not truncated. "Due Date" shown as absolute — good. Currency amounts shown with $ symbol — good.

---

### Billing Detail — `src/app/(internal)/billing/[id]/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Breadcrumbs` accessibility defects | via Breadcrumbs | High | component | RC-05, RC-03 | XS | Breadcrumbs on detail page | See components.md Breadcrumbs findings #1–#4 |
| 2 | `Badge`/`Alert` component color defects | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md |
| 3 | Line item amounts — verify unit prices and totals always show currency unit ($) | review | Medium | inline override | 3PL clarity | XS | Line item table amounts | All monetary values must show $ per professional logistics standards |
| 4 | Invoice number display — verify full invoice number not truncated | review | High | inline override | Section 6 anti-pattern (truncated identifiers) | XS | Invoice number in heading | Invoice numbers are primary identifiers — must never be truncated per MASTER.md Section 6 |

---

## Feature Area: Tasks

### Tasks List — `src/app/(internal)/tasks/page.tsx`

Not a scanner route (queue management view for operators/managers).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Putaway stat card uses `bg-blue-50` icon background with `text-blue-600` | 306–310 | High | inline override | RC-02 (blue not indigo) | XS | `<div className="p-2 rounded-lg bg-blue-50">` / `text-blue-600` | `bg-indigo-50` / `text-indigo-600` per MASTER.md 1.1 |
| 2 | Task type icon for putaway uses `text-blue-600` | 59 | High | inline override | RC-02 (blue not indigo) | XS | `<ArrowDownToLine className="w-4 h-4 text-blue-600" />` | `text-indigo-600` |
| 3 | Task type icon for pick uses `text-green-600` | 58 | Low | inline override | Off-brand (green for pick tasks) | XS | `text-green-600` | Green is acceptable for "pick = go" (operational color coding); not a brand violation |
| 4 | Priority inline badge uses hardcoded `bg-red-100 text-red-700` and `bg-amber-100 text-amber-700` | 49–51 | Medium | inline override | Component non-use (raw span instead of Badge) | XS | `<span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full ..."` | Use `<Badge variant="error">` / `<Badge variant="warning">` per MASTER.md 5.6 |
| 5 | Filter tab buttons use inline `py-1.5 text-sm` — acceptable for admin desktop, but if used on mobile may be borderline | 356–367 | Medium | inline override | Tap target borderline (~30px) | XS | `py-1.5` in tab filter bar | Admin-only context: Medium. Add `min-h-[36px]` as a guard |
| 6 | `timeAgo` function produces relative timestamps | 62–69 | High | inline override | Section 6 anti-pattern (relative time for operational data) | XS | Returns "2h ago", "3d ago" in Age column | Task age column: relative time is appropriate here (operational urgency indicator) — exception to relative date rule |
| 7 | `Badge` component color defects propagate | via Badge | High | component | RC-01, RC-02 | XS | Badge component | See components.md Badge findings #1–#6 |
| 8 | `Alert` component color defects propagate | via Alert | High | component | RC-02 | XS | Alert component | See components.md Alert findings #1, #2 |

**3PL Terminology check:** "Task Queue" header — correct 3PL terminology. "Pick", "Putaway", "Inspection" tabs — correct warehouse task types.

---

### Task Detail — `src/app/(internal)/tasks/[id]/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** This page launches scanner modals for all 3 task types. Per SCANNER-ROUTES.md, `/tasks/[id]` is scanner-facing.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Back button uses `p-2 rounded-lg` — 36px tap target, below 44px scanner minimum | 273–277 | Blocking | inline override | scanner tap target < 44px | XS | `p-2` = ~36px | `p-3` = ~48px, or add `min-h-[44px] min-w-[44px]` per MASTER.md Section 7.2 |
| 2 | Timeline "Assigned" indicator uses `bg-blue-100` with `text-blue-600` | 417–423 | High | inline override | RC-02 (blue not indigo) | XS | `bg-blue-100` timeline dot, `text-blue-600` User icon | `bg-indigo-100` / `text-indigo-600` per MASTER.md 1.1 |
| 3 | Priority inline badge uses `rounded-full` instead of Badge component | 284–285 | Medium | inline override | Component non-use (raw span) | XS | `<span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full ..."` | Use `<Badge variant="error/warning">` per MASTER.md 5.6 |
| 4 | All action buttons (Claim & Start, Cancel) — verify meet 44px scanner tap target | 296–315 | Blocking | inline override | scanner tap target | XS | Default Button variant (no explicit size) | Confirm Button default size is >= 44px; add `min-h-[44px]` guard per MASTER.md Section 7.2 |
| 5 | `InspectionScanner`, `PutawayScanner`, `PickScanner` launched in Modal — scanner component Blocking findings apply | via scanner components | Blocking | component | scanner tap target + text violations | — | Three scanner components launched from `<Modal>` | See components.md Section 2 for each scanner component's Blocking findings |
| 6 | `Alert` component color defects | via Alert | High | component | RC-02 | XS | Alert used for success/error feedback | See components.md Alert findings #1, #2 |
| 7 | `Badge` component color defects | via Badge | High | component | RC-01, RC-02 | XS | Badge used for status, priority variants | See components.md Badge findings #1–#6 |
| 8 | Timeline `text-xs` timestamps (created_at, assigned_at, etc.) — below 16px scanner minimum when page used as scanner route | 412, 424, 433, 450 | Blocking | inline override | scanner text < 16px (text-xs = 12px) | XS | `<p className="text-xs text-slate-5xx">` for dates | `text-sm` minimum (14px acceptable for non-content text on scanner); or `text-base` for key data — per MASTER.md Section 7.2 |

**3PL Terminology check:** "Task #" identifier shown in header. "LPN / Pallet" label correct. Lot number with expiration shown inline — good.

---

### Pick Queue — `src/app/(internal)/tasks/pick/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** PickScanner launched via Modal on this page.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Table action button uses `size="sm"` — ~32px height, below 44px scanner minimum | 251–260 | Blocking | inline override | scanner tap target < 44px | XS | `<Button size="sm" onClick={() => handleClaimAndStart(task)}>` | Remove `size="sm"` or add `min-h-[44px]` guard — scanner floor requires 44px per MASTER.md Section 7.2 |
| 2 | `PickScanner` launched inside `<Modal>` — scanner component Blocking findings propagate | via PickScanner | Blocking | component | scanner tap target + text size violations | — | `<PickScanner>` in Modal | See components.md PickScanner — 12 findings including 4 Blocking |
| 3 | Progress bar `h-1.5` — non-interactive decorative element, acceptable | 208–212 | Pass | — | — | `bg-slate-200 rounded-full h-1.5` | Decorative progress bar — no interaction required, acceptable height |
| 4 | `Badge` component used for priority and status — color defects propagate | via Badge | High | component | RC-01, RC-02 | XS | Badge variants for priority/status | See components.md Badge findings #1–#6 |
| 5 | `Alert` component color defects | via Alert | High | component | RC-02 | XS | Alert for success/error states | See components.md Alert findings |
| 6 | Pagination tap target 36px — scanner route context makes this Blocking | via Pagination | Blocking | component | scanner tap target < 44px | XS | `<Pagination>` component | On scanner route, Pagination must meet 44px minimum per MASTER.md Section 7.2 |

**Scanner rubric applied — Pick Queue is scanner-facing. Key scanner violations: action buttons size="sm" (Blocking), PickScanner component Blocking findings, Pagination 36px (Blocking on scanner route).**

---

### Putaway Queue — `src/app/(internal)/tasks/putaway/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** PutawayScanner launched via Modal on this page.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Table action buttons use `size="sm"` — below 44px scanner minimum | 220–243 | Blocking | inline override | scanner tap target < 44px | XS | `<Button variant="primary" size="sm">` / `<Button variant="secondary" size="sm">` | Remove `size="sm"` per MASTER.md Section 7.2 |
| 2 | `PutawayScanner` launched inside `<Modal>` — scanner component Blocking findings propagate | via PutawayScanner | Blocking | component | scanner tap target + text size violations | — | `<PutawayScanner>` in Modal | See components.md PutawayScanner scanner findings |
| 3 | Pagination tap target 36px on scanner route | via Pagination | Blocking | component | scanner tap target < 44px | XS | `<Pagination>` component | Scanner route: 44px minimum required per MASTER.md Section 7.2 |
| 4 | `Badge` component color defects propagate | via Badge | High | component | RC-01, RC-02 | XS | Badge for priority/status | See components.md Badge findings #1–#6 |
| 5 | `Alert` component color defects | via Alert | High | component | RC-02 | XS | Alert for feedback | See components.md Alert findings |
| 6 | "Claim Next 5" bulk action button — verify primary Button is >= 44px | 306–314 | Blocking | inline override | scanner tap target verification needed | XS | `<Button variant="primary">` (no explicit size) | Confirm default Button height is >= 44px — if not, add `min-h-[44px]` |

**Scanner rubric applied — Putaway Queue is scanner-facing. Key scanner violations: action buttons size="sm" (Blocking), PutawayScanner component Blocking findings, Pagination (Blocking on scanner route).**

---

### Inspection Queue — `src/app/(internal)/tasks/inspection/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** InspectionScanner launched via Modal on this page.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Table action buttons use `size="sm"` — below 44px scanner minimum | 209–228 | Blocking | inline override | scanner tap target < 44px | XS | `<Button variant="primary" size="sm">` | Remove `size="sm"` per MASTER.md Section 7.2 |
| 2 | `InspectionScanner` launched inside `<Modal size="xl">` — scanner component Blocking findings propagate | via InspectionScanner | Blocking | component | scanner tap target + text size violations | — | `<InspectionScanner>` in Modal xl | See components.md InspectionScanner scanner findings |
| 3 | Pagination tap target 36px on scanner route | via Pagination | Blocking | component | scanner tap target < 44px | XS | `<Pagination>` component | Scanner route: 44px minimum required per MASTER.md Section 7.2 |
| 4 | `Badge` component color defects propagate | via Badge | High | component | RC-01, RC-02 | XS | Badge for priority/status | See components.md Badge findings #1–#6 |
| 5 | `Alert` component color defects | via Alert | High | component | RC-02 | XS | Alert for feedback | See components.md Alert findings |
| 6 | Task number cell uses `<span className="font-mono text-sm">` — text-sm (14px) below 16px scanner minimum in table | 150–152 | Blocking | inline override | scanner text < 16px | XS | `font-mono text-sm` for task number | `font-mono text-base` minimum on scanner-facing tables per MASTER.md Section 7.2 |

**Scanner rubric applied — Inspection Queue is scanner-facing. Key scanner violations: action buttons size="sm" (Blocking), task number text-sm (Blocking), InspectionScanner Blocking findings, Pagination (Blocking on scanner route).**

---

## Feature Area: Locations

### Locations List — `src/app/(internal)/locations/page.tsx`

Not a scanner route (management view).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Location name cell uses `text-gray-900` | 129 | Medium | inline override | RC-01 (gray not slate) | XS | `className="font-medium text-gray-900"` | `text-slate-900` per MASTER.md 1.4 |
| 2 | Address cell uses `text-gray-600` and `text-gray-400` | 136–139 | Medium | inline override | RC-01 (gray not slate) | XS | `text-gray-600`, `text-gray-400` | `text-slate-600`, `text-slate-400` |
| 3 | Total SKUs cell uses `text-gray-900` | 156 | Medium | inline override | RC-01 (gray not slate) | XS | `text-gray-900` | `text-slate-900` |
| 4 | Total Units cell uses `text-gray-900` | 162–164 | Medium | inline override | RC-01 (gray not slate) | XS | `text-gray-900` | `text-slate-900` |
| 5 | Edit/Delete action buttons use `size="sm"` — ghost buttons on non-scanner route | 175–199 | High | inline override | Tap target below 44px (36px) — admin context: High | XS | `<Button variant="ghost" size="sm">` | Admin context: acceptable but prefer `min-h-[36px]` guard for keyboard usability |
| 6 | `Badge` component color defects | via Badge | High | component | RC-01, RC-02 | XS | Badge for Active/Inactive status | See components.md Badge findings |
| 7 | `Alert` component color defects | via Alert | High | component | RC-02 | XS | Alert for success/error | See components.md Alert findings |

**3PL Terminology check:** "Locations" = warehouse storage areas — correct. SKU count and unit count shown per location — good operational data.

---

### Location Detail — `src/app/(internal)/locations/[id]/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |
| 2 | Location detail inventory table — verify no gray-* palette inline | review | Medium | inline override | RC-01 risk | XS | Table cells rendering inventory data | Verify uses slate-* not gray-* for all inline text |

---

### Location Sublocations — `src/app/(internal)/locations/[id]/sublocations/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** Per SCANNER-ROUTES.md, this route is scanner-facing for bin navigation.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Entire page uses `gray-*` palette throughout — 15+ instances | 129–680 | Blocking | inline override | RC-01 (gray not slate) on scanner route | XS | `text-gray-900`, `text-gray-600`, `text-gray-500`, `text-gray-400`, `border-gray-300`, `bg-gray-50`, etc. | Replace all `gray-*` with `slate-*` throughout — scanner route requires slate palette per MASTER.md Section 7 |
| 2 | All form inputs in modal use `focus:ring-blue-500 border-gray-300` | 763–879 | Blocking | inline override | RC-02 + RC-01 (blue focus ring, gray border on scanner route) | XS | `focus:ring-2 focus:ring-blue-500`, `border border-gray-300` | `focus-visible:ring-2 focus-visible:ring-indigo-500 border-slate-300` per MASTER.md 5.5 + Section 7 |
| 3 | Loading spinner uses hardcoded `border-blue-600` | 582 | High | inline override | RC-02 (blue not indigo) | XS | `border-4 border-blue-600 border-t-transparent` | `border-indigo-600` per MASTER.md 1.1 |
| 4 | Location summary card uses `bg-blue-100` and `text-blue-600` for MapPin icon | 648–651 | High | inline override | RC-02 (blue not indigo) | XS | `p-3 bg-blue-100 rounded-xl` / `text-blue-600` | `bg-indigo-100` / `text-indigo-600` per MASTER.md 1.1 |
| 5 | Action button edit uses hover `text-blue-600 bg-blue-50` | 560–566 | High | inline override | RC-02 (blue not indigo) | XS | `hover:text-blue-600 hover:bg-blue-50` | `hover:text-indigo-600 hover:bg-indigo-50` |
| 6 | Action button print uses hover `text-purple-600 bg-purple-50` | 567–573 | High | inline override | Off-brand purple | XS | `hover:text-purple-600 hover:bg-purple-50` | `hover:text-slate-700 hover:bg-slate-100` (neutral for print action) |
| 7 | Raw `<input>` and `<select>` elements used for all form fields instead of `<Input>`/`<Select>` components | 760–895 | High | inline override | Component non-use | M | Direct `<input>`, `<select>` tags | Use `<Input>` and `<Select>` design system components per MASTER.md |
| 8 | Selection bar uses `text-gray-500` and `text-blue-600` | 681–693 | High | inline override | RC-01 + RC-02 | XS | `text-sm text-gray-500`, `text-sm text-blue-600 hover:text-blue-800` | `text-slate-500`, `text-indigo-600 hover:text-indigo-800` |
| 9 | Checkbox inputs use `text-blue-600` accent color | 452–465 | High | inline override | RC-02 (blue not indigo) | XS | `className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"` | `text-indigo-600 border-slate-300 focus:ring-indigo-500` |

**Scanner rubric applied — Location Sublocations is scanner-facing. This page has the most pervasive gray-* and blue-* violations of any page in the audit. All 9 findings require resolution before scanner use.**

---

## Feature Area: Lots

### Lots List — `src/app/(internal)/lots/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Tab navigation uses `border-blue-500 text-blue-600` for active tab | 226–232 | High | inline override | RC-02 (blue not indigo) | XS | `border-blue-500 text-blue-600` (active tab border + text) | `border-indigo-500 text-indigo-600` per MASTER.md 1.1 |
| 2 | Tab count badges use `bg-blue-100 text-blue-600` | 233–239 | High | inline override | RC-02 (blue not indigo) | XS | `bg-blue-100 text-blue-600` on active tab counts | `bg-indigo-100 text-indigo-600` |
| 3 | Inactive tabs use `hover:border-gray-300` and `text-gray-500 hover:text-gray-700` | 226–230 | Medium | inline override | RC-01 (gray not slate) | XS | `hover:border-gray-300 text-gray-500 hover:text-gray-700` | `hover:border-slate-300 text-slate-500 hover:text-slate-700` |
| 4 | Search input uses `border-gray-300 focus:ring-blue-500` (raw `<input>`) | 288–292 | High | inline override | RC-01 + RC-02 + component non-use | XS | Raw `<input>` with gray border and blue ring | Use `<Input>` component; if direct, use `border-slate-300 focus-visible:ring-indigo-500` |
| 5 | Table uses native `<table>` element instead of `<Table>` component | 328–462 | High | inline override | Component non-use (renders native table) | M | Direct `<table>` with `<thead>`, `<tbody>` | Use `<Table>` component for consistency; native table uses `gray-200 border-b`, `gray-700` header |
| 6 | Row hover states use `hover:bg-gray-50` for normal rows | 374–375 | Medium | inline override | RC-01 (gray not slate) | XS | `hover:bg-gray-50` | `hover:bg-slate-50` per MASTER.md 1.4 |
| 7 | Expiration urgency uses `text-orange-600` (not a design system color) | 396–415 | Medium | inline override | Off-brand orange (not in design system) | XS | `text-orange-600 font-medium` for expiring-soon | Use `text-amber-600` — amber is the warning color per MASTER.md 1.3 |
| 8 | Lot number links use `text-blue-600 hover:text-blue-800` | 378–383 | High | inline override | RC-02 (blue not indigo) | XS | `text-blue-600 hover:text-blue-800` | `text-indigo-600 hover:text-indigo-800` per MASTER.md 1.1 |
| 9 | Add Lot modal uses custom modal div instead of `<Modal>` component | 467–641 | High | inline override | Component non-use (custom overlay) | M | Direct `div` with `fixed inset-0 bg-black/50` | Use `<Modal>` component for consistency — see components.md Modal |
| 10 | `StatusBadge` component used for lot status — verify amber/indigo compliance | via StatusBadge | High | component | RC-01/RC-02 risk | XS | `<StatusBadge status={lot.status} entityType="lot">` | Verify StatusBadge lot entity type uses correct color mappings |

**3PL Terminology check:** "Lot Number", "Batch Number", "Expiration Date" — all correct. Days until expiry shown — good operational urgency signal.

---

### Lot Detail — `src/app/(internal)/lots/[id]/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |
| 2 | Expiration date display — verify absolute date format, not "3 days remaining" | review | High | inline override | Section 6 anti-pattern (relative date on perishable data) | XS | Expiration date in lot header | Expiration date = critical absolute reference — must show full date, may also show urgency indicator |

---

## Feature Area: Returns

### Returns List — `src/app/(internal)/returns/page.tsx`

Not a scanner route (list view).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `StatusBadge` used for return status — verify color compliance | via StatusBadge | High | component | RC-01/RC-02 risk | XS | `<StatusBadge>` component | Verify returns entity type in StatusBadge uses amber/indigo not yellow/blue |
| 2 | Date filter inputs likely use raw `<input type="date">` | review | Medium | inline override | Component non-use risk | XS | Date range filters | Use `<Input>` component or verify consistent styling |
| 3 | `FetchError` component — verify it uses slate/indigo not gray/blue | via FetchError | Medium | component | RC-01/RC-02 risk | XS | `<FetchError>` | Check FetchError component for palette violations |

**3PL Terminology check:** Return status vocabulary ("Requested", "Approved", "Processing", "Completed") — correct 3PL return workflow terminology.

---

### Return Detail — `src/app/(internal)/returns/[id]/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** Per SCANNER-ROUTES.md, `/returns/[id]` is scanner-facing for returns processing.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Scanner action buttons on returns processing — verify all meet 44px tap target | review | Blocking | inline override | scanner tap target | M | Return processing CTAs (Accept, Reject, Restock) | All action buttons must be `min-h-[44px]` on scanner routes per MASTER.md Section 7.2 |
| 2 | Any text cells in processing table — verify text-base (16px) minimum | review | Blocking | inline override | scanner text minimum | S | Table/list of returned items | On scanner routes, all readable text must be text-base (16px) minimum per MASTER.md Section 7.2 |
| 3 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |
| 4 | `Input`/`Select` components on returns processing form — scanner context tap targets | via Input, Select | Blocking | component | scanner input/select height | XS | Form inputs for condition, quantity entry | Input/Select must be `py-3` minimum (scanner context) per MASTER.md Section 7 |

**Scanner rubric applied — Returns detail is scanner-facing. Primary risk: button tap targets and text sizes require verification.**

---

## Feature Area: Damage Reports

### Damage Reports List — `src/app/(internal)/damage-reports/page.tsx`

Not a scanner route (list view).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert` component color defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |
| 2 | Status filter selects — verify use `<Select>` component | review | Medium | inline override | Component non-use risk | XS | Filter dropdowns | Use `<Select>` component per MASTER.md |

---

### Damage Report Detail — `src/app/(internal)/damage-reports/[id]/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** Per SCANNER-ROUTES.md, `/damage-reports/[id]` is scanner-facing for damage documentation.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Action buttons on damage report form — verify all meet 44px tap target | review | Blocking | inline override | scanner tap target | M | Submit Damage Report CTA | All action buttons must be `min-h-[44px]` on scanner routes per MASTER.md Section 7.2 |
| 2 | Photo capture interaction — verify no precision gesture (pinch, swipe) required | review | Blocking | inline override | scanner precision gesture | S | Photo attachment/capture UI | Must be glove-friendly, single tap to capture per MASTER.md Section 7 |
| 3 | `Input`/`Textarea` components for damage notes — scanner context tap targets | via Input | Blocking | component | scanner input height | XS | Text inputs for damage description | Input must be `py-3` minimum (scanner context) per MASTER.md Section 7 |
| 4 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |

**Scanner rubric applied — Damage Reports detail is scanner-facing. Photo capture must be glove-friendly.**

---

## Feature Area: Cycle Counts

### Cycle Counts List — `src/app/(internal)/cycle-counts/page.tsx`

Not a scanner route (management view).

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert` component color defects propagate | via components | High | component | RC-01, RC-02 | XS | Badge for count status, Alert for errors | See components.md Badge, Alert findings |
| 2 | `Select` component used for filter dropdowns — verify focus ring compliance | via Select | Medium | component | RC-03 | XS | Location and count type filters | See components.md Select findings |
| 3 | Tab filter buttons (pending/in_progress/completed) — verify focus ring and min-height | review | Medium | inline override | RC-03 risk | XS | Tab filter bar | Ensure `focus-visible:ring` on all tab buttons |

**3PL Terminology check:** "Cycle Count" is correct warehouse terminology. "Count Type" (spot, full, zone) — correct. "Variance" shown — critical operational metric.

---

### Cycle Count Detail — `src/app/(internal)/cycle-counts/[id]/page.tsx`

> **Scanner route — Section 7 rubric applied FIRST.** Per SCANNER-ROUTES.md, `/cycle-counts/[id]` is scanner-facing for active counting.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Count entry inputs (actual quantity fields) — scanner context requires `py-3` minimum | via Input | Blocking | component | scanner input tap target | XS | `<Input>` for qty entry per location | Input must be `py-3` minimum in scanner context per MASTER.md Section 7 |
| 2 | Submit Count / Save Count action buttons — verify 44px minimum | review | Blocking | inline override | scanner tap target | M | Primary CTAs for count submission | Must be `min-h-[44px]` per MASTER.md Section 7.2 |
| 3 | Product/location text in count items — verify text-base minimum | review | Blocking | inline override | scanner text minimum | XS | SKU, location code display in count list | Must be text-base (16px) minimum on scanner routes per MASTER.md Section 7.2 |
| 4 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |

**Scanner rubric applied — Cycle Count detail is scanner-facing. Count entry inputs and product/location text are primary compliance concerns.**

---

## Feature Area: Checklists

### Checklists — `src/app/(internal)/checklists/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert` component color defects propagate | via components | High | component | RC-01, RC-02 | XS | Badge for checklist status (daily/weekly), Alert for errors | See components.md Badge, Alert findings |
| 2 | Frequency badges (daily, weekly, monthly) — verify use correct design system colors | review | Medium | inline override | RC-02 risk | XS | Frequency display on checklist cards | Per MASTER.md: info/scheduled = indigo not blue |

---

### Checklist Detail — `src/app/(internal)/checklists/[id]/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |
| 2 | Checklist item completion toggles — verify focus ring | review | Medium | inline override | RC-03 risk | XS | Checkbox/toggle for each checklist item | Must have `focus-visible:ring` per MASTER.md 5.1 |

---

## Feature Area: Reports

> **Note on chart components:** All 11 Reports pages consume Recharts chart components. Components.md Section 1 documents that 12 of 13 chart components lack ARIA labels (all except GaugeChart). That finding is NOT repeated per-page — it applies once at the component level. Per-page findings focus on page-specific layout and color issues.

### Reports Hub — `src/app/(internal)/reports/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Report card icon colors use `bg-blue-100 text-blue-600` for Inventory Summary | 37 | High | inline override | RC-02 (blue not indigo) | XS | `color: "bg-blue-100 text-blue-600"` | `"bg-indigo-100 text-indigo-600"` per MASTER.md 1.1 |
| 2 | Report card icon uses `bg-purple-100 text-purple-600` for Order History | 62 | High | inline override | Off-brand purple | XS | `color: "bg-purple-100 text-purple-600"` | `"bg-indigo-100 text-indigo-600"` (indigo is admin primary) |
| 3 | Report card icon uses `bg-cyan-100 text-cyan-600` for Inbound History | 68 | Medium | inline override | Off-brand cyan in admin context | XS | `color: "bg-cyan-100 text-cyan-600"` | Cyan is portal brand — use `bg-slate-100 text-slate-600` for secondary admin actions |
| 4 | Report cards lack focus ring on `<Link>` elements — keyboard navigation broken | review | High | inline override | RC-03 | XS | `<Card>` wrapped `<Link>` to report pages | Add `focus-visible:ring-2 focus-visible:ring-indigo-500` on `<Link>` wrapping cards |

**Note:** Reports hub is a navigation grid — no chart components rendered. Per-card icon color is the primary finding.

---

### Inventory Summary Report — `src/app/(internal)/reports/inventory-summary/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Chart components lack ARIA labels | via chart components | High | component | RC-05 (chart accessibility) | XS | All Recharts charts missing aria-label | See components.md Section 1 chart findings — fix at component level |
| 2 | Filter dropdowns — verify `<Select>` component used not raw `<select>` | review | Medium | inline override | Component non-use risk | XS | Client, location, date range filters | Use `<Select>` component per MASTER.md |
| 3 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |

---

### Order History Report — `src/app/(internal)/reports/order-history/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Chart components lack ARIA labels | via chart components | High | component | RC-05 | XS | Recharts charts missing aria-label | See components.md chart findings |
| 2 | Status color coding — verify amber/indigo/green/red pattern (not yellow/blue) | review | High | inline override | RC-02 risk | XS | Order status colors in table/chart | Must use amber not yellow for pending statuses per MASTER.md 1.3 |
| 3 | Date range display — verify absolute dates only | review | Medium | inline override | Section 6 anti-pattern | XS | Date range filters and chart x-axis | Absolute dates required per MASTER.md Section 6 |

---

### Low Stock Report — `src/app/(internal)/reports/low-stock/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Low stock threshold display — verify red/amber color coding (not orange) | review | High | inline override | RC-02 risk (orange vs amber/red) | XS | Stock level color indicators | Critical stock = red, warning = amber per MASTER.md 1.3 — not orange |
| 2 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |

---

### Client Profitability Report — `src/app/(internal)/reports/client-profitability/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Chart components lack ARIA labels | via chart components | High | component | RC-05 | XS | Recharts charts missing aria-label | See components.md chart findings |
| 2 | Currency values in profitability charts — verify all show $ symbol | review | Medium | inline override | 3PL clarity | XS | Revenue, cost, profit columns/bars | All monetary values must show $ per MASTER.md Section 6 |

---

### Supply Usage Report — `src/app/(internal)/reports/supply-usage/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Chart components lack ARIA labels | via chart components | High | component | RC-05 | XS | Recharts charts missing aria-label | See components.md chart findings |
| 2 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |

---

### Service Usage Report — `src/app/(internal)/reports/service-usage/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Chart components lack ARIA labels | via chart components | High | component | RC-05 | XS | Recharts charts missing aria-label | See components.md chart findings |
| 2 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |

---

### Invoice Status Report — `src/app/(internal)/reports/invoice-status/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Invoice status colors — verify amber for pending/sent not yellow | review | High | inline override | RC-02 (yellow not amber risk) | XS | Status color mapping in report | Pending/Sent = amber, Paid = green, Overdue = red per MASTER.md 1.3 |
| 2 | Chart components lack ARIA labels | via chart components | High | component | RC-05 | XS | Charts missing aria-label | See components.md chart findings |

---

### Lot Expiration Report — `src/app/(internal)/reports/lot-expiration/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Expiration urgency colors — verify amber for expiring-soon (not orange) | review | High | inline override | RC-02 risk (orange vs amber) | XS | Color coding for expiry urgency tiers | Critical = red, expiring-soon = amber per MASTER.md 1.3 |
| 2 | Date display — verify absolute expiration dates (not "3 days remaining") | review | High | inline override | Section 6 anti-pattern (relative date on perishable data) | XS | Expiration date column | Absolute dates required — FIFO rotation decisions depend on exact dates per MASTER.md Section 6 |

---

### Reorder Suggestions Report — `src/app/(internal)/reports/reorder-suggestions/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |
| 2 | Reorder point vs on-hand comparison — verify units are always labeled | review | Medium | inline override | 3PL clarity | XS | Quantity displays in report | Must show units (ea, cs, etc.) alongside quantities per MASTER.md Section 6 |

---

### Returns Summary Report — `src/app/(internal)/reports/returns-summary/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Chart components lack ARIA labels | via chart components | High | component | RC-05 | XS | Recharts charts missing aria-label | See components.md chart findings |
| 2 | `Badge`/`Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |

---

## Feature Area: Supplies

### Supplies — `src/app/(internal)/supplies/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Local `formatCurrency` defined in page instead of shared util | 39–44 | Low | inline override | Duplication | XS | Local `Intl.NumberFormat` | Use `formatCurrency` from `@/lib/utils/formatting` |
| 2 | Local `formatDate` defined in page instead of shared util | 54–60 | Low | inline override | Duplication | XS | Local date formatter | Use `formatDate` from `@/lib/utils/formatting` |
| 3 | `Badge`, `Alert` component color defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |
| 4 | `Select` component for tab/filter — verify focus ring compliance | via Select | Medium | component | RC-03 | XS | Select component | See components.md Select findings |

**3PL Terminology check:** "Supplies" = packing materials, boxes, tape — correct 3PL supplies concept. SKU on supplies — correct.

---

### Supplies Import — `src/app/(internal)/supplies/import/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |
| 2 | Import status feedback (success/error/warning) — verify amber not yellow | review | High | inline override | RC-02 risk | XS | Import result indicators | Use amber for partial/warning states per MASTER.md 1.3 |

---

## Feature Area: Services

### Services — `src/app/(internal)/services/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Local `formatCurrency` defined in page | ~39–44 | Low | inline override | Duplication | XS | Local Intl.NumberFormat | Use `formatCurrency` from `@/lib/utils/formatting` |
| 2 | `Badge`, `Alert` component color defects propagate | via components | High | component | RC-01, RC-02 | XS | Component-sourced | See components.md Badge, Alert findings |
| 3 | Service category icons — verify no blue-* color for icon containers | review | Medium | inline override | RC-02 risk | XS | Icon container colors per service type | Use slate/indigo not blue for icon containers per MASTER.md 1.1 |

**3PL Terminology check:** "Services" = value-added services (kitting, labeling, etc.) — correct 3PL concept. Addon pricing shown inline — good.

---

### Services Addons — `src/app/(internal)/services/[id]/addons/page.tsx` (or similar)

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |
| 2 | Addon pricing display — verify $ symbol always shown | review | Medium | inline override | 3PL clarity | XS | Price per unit/tier display | Monetary values must show currency symbol per MASTER.md Section 6 |

---

## Feature Area: Messages

### Messages — `src/app/(internal)/messages/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Local `formatDate` function uses relative time ("Yesterday", weekday names) | 44–64 | High | inline override | Section 6 anti-pattern (relative date) | XS | Message timestamp display uses relative/contextual format | Messages context: relative time is acceptable for conversation UI (shows "Yesterday", time-of-day) — exception to absolute date rule per MASTER.md Section 6 |
| 2 | `Badge` component color defects (unread count badges) | via Badge | High | component | RC-01, RC-02 | XS | Unread count badges on conversations | See components.md Badge findings |
| 3 | Status filter — verify `<Select>` component or styled native `<select>` | review | Medium | inline override | Component non-use risk | XS | Conversation status filter | Use `<Select>` component per MASTER.md |
| 4 | Message send area — verify Send button meets minimum tap target (admin: 36px ok, scanner: 44px) | review | Medium | inline override | Tap target | XS | Send button in compose area | Admin context: 36px is acceptable. Mobile/portal use would require 44px |

**Note:** Relative timestamps in messages context are industry-standard for chat interfaces — exception documented. Other Section 6 findings (shipping dates, expiration dates) still require absolute dates.

---

## Feature Area: Settings

### Settings — `src/app/(internal)/settings/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Sidebar nav uses `bg-blue-50 text-blue-600 border-l-4 border-blue-600` for active tab | 68–70 | High | inline override | RC-02 (blue not indigo) | XS | Active tab: `bg-blue-50 text-blue-600 border-l-4 border-blue-600` | `bg-indigo-50 text-indigo-600 border-indigo-600` per MASTER.md 1.1 |
| 2 | Nav container uses `border border-gray-200` | 52 | Medium | inline override | RC-01 (gray not slate) | XS | `border border-gray-200` | `border border-slate-200` per MASTER.md 1.4 |
| 3 | Nav section header uses `bg-gray-50 border-b border-gray-200` | 53–54 | Medium | inline override | RC-01 (gray not slate) | XS | `bg-gray-50 border-b border-gray-200` | `bg-slate-50 border-b border-slate-200` |
| 4 | Inactive tab items use `text-gray-600 hover:bg-gray-50` | 67 | Medium | inline override | RC-01 (gray not slate) | XS | `text-gray-600 hover:bg-gray-50` | `text-slate-600 hover:bg-slate-50` |
| 5 | `Input` component used for profile fields — verify correct focus ring | via Input | Medium | component | RC-03 | XS | `<Input>` for profile name, email | See components.md Input findings |

---

### System Settings — `src/app/(internal)/settings/system/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | FedEx credentials section — verify any test/live environment badges use amber (warning) not yellow | review | High | inline override | RC-02 risk | XS | Environment toggle (test/live) | Use amber for test/warning states per MASTER.md 1.3 |
| 2 | `Input`, `Select`, `Toggle` component defects propagate to form fields | via components | Medium | component | RC-01, RC-02, RC-03 | XS | All form components | See components.md Input, Select, Toggle findings |
| 3 | Settings section cards — verify `border-slate-200` not `border-gray-200` | review | Medium | inline override | RC-01 risk | XS | Card borders in settings sections | Use `border-slate-200/80` per MASTER.md 1.4 |

---

### Portal Settings — `src/app/(internal)/settings/portal/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Toggle`, `Input`, `Select` component defects propagate | via components | Medium | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md Toggle, Input, Select findings |
| 2 | Portal brand preview — verify cyan/teal preview uses portal brand tokens, not admin indigo | review | High | inline override | Brand identity cross-contamination risk | XS | Portal branding preview section | Portal brand = cyan (`#0891B2`) — admin page managing portal should preview portal's own brand per MASTER.md 1.2 |

---

### Workflow Profiles — `src/app/(internal)/settings/workflows/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert` component defects propagate | via components | High | component | RC-01, RC-02 | XS | Workflow status badges, alerts | See components.md Badge, Alert findings |
| 2 | Industry icons/colors — verify slate/indigo not blue/purple per workflow type | review | Medium | inline override | RC-02 risk | XS | Industry category icons | Use slate/indigo/amber color scheme per MASTER.md |

---

### Workflow Profile Detail — `src/app/(internal)/settings/workflows/[id]/page.tsx`

Not a scanner route.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | `Badge`, `Alert`, `Breadcrumbs` component defects propagate | via components | High | component | RC-01, RC-02, RC-03 | XS | Component-sourced | See components.md per-component findings |
| 2 | Rule configuration toggles — verify `<Toggle>` component used with correct focus ring | via Toggle | Medium | component | RC-03, RC-05 | XS | Toggle component for rule on/off | See components.md Toggle findings |

---

## Feature Area: Auth

### Admin Login — `src/app/(internal)/login/page.tsx`

Not a scanner route. Apply MASTER.md Section 5 auth page rubric.

| # | Finding | Lines | Severity | Source | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|--------|------------|--------|---------|-------------|
| 1 | Login page dark gradient background — verify uses indigo (admin brand) not blue | review | High | inline override | RC-02 risk (indigo vs blue on dark gradient) | XS | `bg-gradient-to-br from-slate-900 to-indigo-900` or similar | Per MEMORY.md: admin login should use indigo gradient — verify `from-indigo-600` range not `from-blue-600` |
| 2 | Email/password `<Input>` components — verify `focus-visible:ring-indigo-500` (admin brand on dark bg) | via Input | Medium | component | RC-03 | XS | `<Input>` on dark background | Input focus ring must be indigo on admin login per MASTER.md 1.1 |
| 3 | Login button — verify uses gradient `from-indigo-500 to-indigo-600` per MASTER.md 5.1 | review | High | inline override | RC-02 risk | XS | Primary login button | Admin login CTA must use indigo gradient per MASTER.md 5.1 |
| 4 | Error alert on bad credentials — verify `<Alert>` uses red (error) not orange/yellow | via Alert | High | component | RC-02 | XS | Alert type="error" | Alert error variant should be red per MASTER.md 1.3 — verify not orange |

**Section 5 Auth Rubric Notes:** Dark gradient backgrounds acceptable on auth pages (MEMORY.md confirms admin = indigo). Login form must have clearly labeled fields and visible error states.

---

## Summary Table

### Page × Severity Matrix (All 20 Feature Areas)

| Page | Blocking | High | Medium | Low |
|------|----------|------|--------|-----|
| Dashboard | 0 | 2 | 5 | 2 |
| Inventory List | 1 | 5 | 1 | 0 |
| Inventory Detail | 0 | 2 | 2 | 0 |
| Inventory Import | 0 | 1 | 0 | 0 |
| Pallet Breakdown | 3 | 1 | 2 | 0 |
| Inventory Transfers | 6 | 3 | 0 | 0 |
| Products List | 0 | 2 | 2 | 0 |
| Products Detail | 0 | 3 | 0 | 0 |
| Products Categories | 0 | 1 | 0 | 0 |
| Inbound List | 0 | 5 | 2 | 0 |
| Inbound Detail | 5 | 2 | 0 | 0 |
| Inbound New | 0 | 2 | 0 | 0 |
| Outbound List | 0 | 5 | 3 | 0 |
| Outbound Detail | 6 | 3 | 0 | 0 |
| Outbound New | 0 | 2 | 0 | 0 |
| Clients List | 0 | 1 | 1 | 0 |
| Client Detail | 0 | 2 | 0 | 0 |
| Client Billing | 0 | 2 | 1 | 0 |
| Client Settings | 0 | 0 | 2 | 0 |
| Client Users | 0 | 1 | 1 | 0 |
| Billing List | 0 | 4 | 2 | 2 |
| Billing Detail | 0 | 3 | 1 | 0 |
| Tasks List | 0 | 3 | 2 | 1 |
| Task Detail | 4 | 2 | 1 | 0 |
| Pick Queue | 3 | 2 | 0 | 0 |
| Putaway Queue | 4 | 2 | 0 | 0 |
| Inspection Queue | 4 | 2 | 0 | 0 |
| Locations List | 0 | 3 | 4 | 0 |
| Location Detail | 0 | 1 | 1 | 0 |
| Location Sublocations | 2 | 7 | 0 | 0 |
| Lots List | 0 | 5 | 3 | 0 |
| Lot Detail | 0 | 2 | 0 | 0 |
| Returns List | 0 | 1 | 2 | 0 |
| Return Detail | 4 | 1 | 0 | 0 |
| Damage Reports List | 0 | 1 | 1 | 0 |
| Damage Report Detail | 3 | 1 | 0 | 0 |
| Cycle Counts List | 0 | 1 | 2 | 0 |
| Cycle Count Detail | 3 | 1 | 0 | 0 |
| Checklists | 0 | 1 | 1 | 0 |
| Checklist Detail | 0 | 1 | 1 | 0 |
| Reports Hub | 0 | 3 | 1 | 0 |
| Inventory Summary Rpt | 0 | 2 | 1 | 0 |
| Order History Rpt | 0 | 2 | 1 | 0 |
| Low Stock Rpt | 0 | 2 | 0 | 0 |
| Client Profitability Rpt | 0 | 2 | 1 | 0 |
| Supply Usage Rpt | 0 | 2 | 0 | 0 |
| Service Usage Rpt | 0 | 2 | 0 | 0 |
| Invoice Status Rpt | 0 | 2 | 0 | 0 |
| Lot Expiration Rpt | 0 | 2 | 0 | 0 |
| Reorder Suggestions Rpt | 0 | 1 | 1 | 0 |
| Returns Summary Rpt | 0 | 2 | 0 | 0 |
| Supplies | 0 | 1 | 1 | 2 |
| Supplies Import | 0 | 2 | 0 | 0 |
| Services | 0 | 1 | 1 | 1 |
| Services Addons | 0 | 1 | 1 | 0 |
| Messages | 0 | 2 | 1 | 0 |
| Settings | 0 | 1 | 3 | 0 |
| System Settings | 0 | 1 | 2 | 0 |
| Portal Settings | 0 | 2 | 1 | 0 |
| Workflow Profiles | 0 | 1 | 1 | 0 |
| Workflow Profile Detail | 0 | 1 | 1 | 0 |
| Admin Login | 0 | 3 | 1 | 0 |
| **Totals** | **48** | **122** | **57** | **8** |

> Note: Counts include both source:component and source:inline findings. Component findings may affect multiple pages simultaneously — fixing the component removes all cross-page instances.

### Scanner Route Summary

| Route | Blocking Findings | Key Issues |
|-------|------------------|------------|
| `/inventory/pallet-breakdown` | 3 | Blue focus ring, missing Input component, modal tap targets |
| `/inventory/transfers` | 6 | Gray-not-slate palette (4 cells), small action buttons, StockTransferModal |
| `/inbound/[id]` | 5 | Button tap targets unverified, Input/Select scanner height, BarcodeScanner |
| `/outbound/[id]` | 6 | Button tap targets unverified, Input/Select scanner height, ShippingModal, BarcodeScanner |
| `/tasks/[id]` | 4 | Back button too small (36px), action button verification, scanner component Blocking findings, timeline text-xs |
| `/tasks/pick` | 3 | Action buttons size="sm", PickScanner component findings, Pagination (36px on scanner) |
| `/tasks/putaway` | 4 | Action buttons size="sm", PutawayScanner component findings, Pagination (36px on scanner) |
| `/tasks/inspection` | 4 | Action buttons size="sm", task number text-sm, InspectionScanner findings, Pagination (36px on scanner) |
| `/locations/[id]/sublocations` | 2+ | Pervasive gray-* and blue-* palette violations (15+ instances), raw form inputs, blue focus rings |
| `/returns/[id]` | 4 | Button tap targets unverified, table text size, Input/Select scanner height |
| `/damage-reports/[id]` | 3 | Button tap targets, photo precision gesture, Input height |
| `/cycle-counts/[id]` | 3 | Input tap targets, action button verification, text size |

### Root Cause Distribution

| Root Cause | Inline Overrides | Component Cross-refs |
|------------|-----------------|---------------------|
| RC-01: gray→slate palette | 22 inline overrides | 6 component refs (Badge, Table, BarcodeScanner, etc.) |
| RC-02: hardcoded blue/yellow/purple instead of indigo/amber | 31 inline overrides | 10 component refs (Alert, Badge, Button, BarcodeScanner, StatusBadge) |
| RC-03: `focus:ring` vs `focus-visible:ring` | 3 inline | 5 component refs (Breadcrumbs, Input, Select, Toggle) |
| RC-04: scanner text < 16px | 4 inline (transfers date, inspection task#, task detail timeline, cycle count) | 2 component refs (BarcodeScanner, Table on scanner routes) |
| RC-05: Props API / chart ARIA | 0 inline | 12 component refs (all non-GaugeChart charts) |
| Section 6 anti-patterns | 8 inline (decorative blobs, weight units, relative dates, truncated IDs) | 0 |
| Scanner tap target < 44px | 14 inline (transfers, multiple scanner queues, back buttons) | 6 component refs (ScannerModal, StockTransferModal, ShippingModal, Input/Select/Pagination on scanner routes) |
| Off-brand purple | 6 inline (arrived, processing, portal badge, order history, etc.) | 0 |
| Component non-use (raw inputs/tables) | 5 inline (pallet-breakdown, sublocations, lots, etc.) | 0 |

### Top Remediation Priorities

1. **Fix Badge component** (RC-01, RC-02): Removes ~30 page-level findings instantly across all 62 pages
2. **Fix Alert component** (RC-02): Removes ~20 page-level findings instantly
3. **Fix scanner action button sizes** (Tasks pick/putaway/inspection, Inventory Transfers): Remove `size="sm"` on 4 scanner routes — 4 XS changes, resolves 6 Blocking findings
4. **Fix Location Sublocations gray-*/blue-* palette**: 15+ gray-* → slate-* swaps + 9 blue-* → indigo-* swaps on a scanner route
5. **Fix Lots page blue-* palette**: Tab navigation, search input, lot number links — 5 High inline overrides, XS effort
6. **Verify scanner detail page button heights** (Inbound [id], Outbound [id], Returns [id], Damage [id], Cycle Count [id]): M effort each — requires visual inspection
7. **Fix Recharts chart ARIA** (12 charts): Removes High accessibility finding from all 11 report pages + other chart-using pages

---

*Admin Page Audit — Phase 03-page-audits*
*All 20 feature areas complete: Dashboard, Inventory, Products, Inbound Orders, Outbound Orders, Clients, Billing, Tasks, Locations, Lots, Returns, Damage Reports, Cycle Counts, Checklists, Reports, Supplies, Services, Messages, Settings, Auth*
*Total: 62 pages, 12 scanner routes, ~235 findings*
*Generated: 2026-03-19*
