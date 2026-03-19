# Admin Page Audit

> **Phase:** 03-page-audits
> **Audited:** 2026-03-19
> **Auditor:** Claude (claude-sonnet-4-6)
> **Rubric:** `design-system/ims7d/MASTER.md` (locked v1.0)
> **Component baseline:** `.planning/audit/components.md` (195 findings, RC-01–RC-05)
> **Scope:** First 7 feature areas — Dashboard, Inventory, Products, Inbound Orders, Outbound Orders, Clients, Billing

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
| **Total** | **22** | **4** |

### Findings by Severity

| Severity | Count |
|----------|-------|
| Blocking | 19 |
| High | 31 |
| Medium | 28 |
| Low | 7 |
| **Total** | **85** |

### Findings by Source

| Source | Count |
|--------|-------|
| `source: component` | 48 |
| `source: inline override` | 37 |

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
| 3 | Weight fields — verify unit label (lbs/kg) is always shown alongside numeric weight | review at render | High | inline override | Section 6 anti-pattern (weight without unit) | XS | Review product weight display | Must show "X lbs" or "X kg" not bare number — per MASTER.md Section 6 |

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

## Summary Table

### Page × Severity Matrix (First 7 Feature Areas)

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
| **Totals** | **21** | **51** | **25** | **4** |

> Note: Counts include both source:component and source:inline findings. Component findings may affect multiple pages simultaneously — fixing the component removes all cross-page instances.

### Root Cause Distribution

| Root Cause | Occurrences (inline) | Component Cross-refs |
|------------|---------------------|---------------------|
| RC-01: gray→slate palette | 14 inline overrides | 5 component refs (Badge, Table, BarcodeScanner) |
| RC-02: hardcoded blue/yellow/purple instead of indigo/amber | 18 inline overrides | 8 component refs (Alert, Badge, BarcodeScanner, Button) |
| RC-03: `focus:ring` vs `focus-visible:ring` | 2 inline | 4 component refs (Breadcrumbs, Input, Select) |
| RC-04: scanner text < 16px | 1 inline (transfers date cell) | 2 component refs (BarcodeScanner, Table on scanner routes) |
| Section 6 anti-patterns | 5 inline (purple colors, decorative blobs, weight unit risk, relative date risk) | 0 |
| Scanner tap target < 44px | 6 inline (transfers action buttons + scanner detail pages) | 4 component refs (ScannerModal, StockTransferModal, Input/Select on scanner routes) |
| Off-brand purple color | 4 inline (returns, arrived, processing, source badge) | 0 |

### Top Remediation Priorities

1. **Fix Badge component** (RC-01, RC-02): Removes ~20 page-level findings instantly
2. **Fix Alert component** (RC-02): Removes ~15 page-level findings instantly
3. **Fix scanner route inline gray→slate** (Inventory Transfers: 4 Blocking findings): 4 XS changes
4. **Fix scanner action button size** (Inventory Transfers: 1 Blocking finding): XS change
5. **Fix pallet-breakdown search input** (Blocking: blue focus ring): XS change
6. **Audit scanner detail page buttons** (Inbound [id], Outbound [id]): M effort each — requires visual inspection

---

*Admin Page Audit — Phase 03-page-audits*
*First 7 feature areas complete: Dashboard, Inventory, Products, Inbound Orders, Outbound Orders, Clients, Billing*
*Generated: 2026-03-19*
