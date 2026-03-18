# Component Library Audit

> **Phase:** 02-component-library-audit
> **Audited:** 2026-03-18
> **Auditor:** Claude (claude-sonnet-4-6)
> **Rubric:** `design-system/ims7d/MASTER.md` (locked v1.0)
> **Scope:** 37 components total — 27 shared UI (`src/components/ui/`) + 10 scanner (`src/components/internal/`)

---

## Overview

### Root-Cause Taxonomy

These five root causes explain virtually all component findings. Page audits (Phase 3) should classify each finding as "source: component defect" with one of these IDs.

| Root Cause ID | Description | Affected Component Count |
|---------------|-------------|--------------------------|
| RC-01 | Gray palette instead of slate palette — `gray-*` used where `slate-*` is mandated | 19 |
| RC-02 | Hardcoded Tailwind color classes where CSS custom properties exist | 8 |
| RC-03 | `focus:ring` instead of `focus-visible:ring` (shows ring on mouse click) | 6 |
| RC-04 | Scanner body text below 16px minimum (`text-sm` / `text-xs` on scanner routes) | 1 (BarcodeScanner) |
| RC-05 | Props API inconsistency across components | 5 |

---

### Severity Rating Guide

| Rating | Definition |
|--------|-----------|
| **Blocking** | Violates a MASTER.md hard rule that cannot be shipped — brand identity merge, scanner tap target < 44px, scanner text < 16px, contrast failure (WCAG AA), hover-only interaction |
| **High** | Significant design deviation causing visual inconsistency at scale — wrong color family (blue vs indigo), missing focus rings on interactive elements, SVG charts with no accessibility title/desc |
| **Medium** | Design token non-use, gray vs slate palette (semantically wrong), props API inconsistency, missing variants, `focus:ring` vs `focus-visible:ring` |
| **Low** | Minor style polish — border radius off by one step, shadow not tokenized, missing className passthrough on non-interactive wrappers |

---

### Summary

**Total components audited: 37** (27 shared UI + 10 scanner)

**Total findings by severity (all sections):**

| Severity | Section 1 (Shared UI) | Section 2 (Scanner) | Total |
|----------|-----------------------|---------------------|-------|
| Blocking | 3 | 22 | **25** |
| High | 34 | 57 | **91** |
| Medium | 52 | 18 | **70** |
| Low | 9 | 0 | **9** |
| **Total** | **98** | **97** | **195** |

**Top root causes by finding count (all sections):**

| Root Cause | Total Findings | Primary Fix |
|------------|---------------|-------------|
| RC-01: gray→slate palette | ~65 | Codebase-wide find-and-replace in `src/components/` |
| RC-02: Hardcoded blue/token non-use | ~48 | Replace `blue-*` with `indigo-*` / CSS var |
| scanner-specific: tap targets below 44px | 22 | Remove `size="sm"` on scanner routes; add `min-h-[44px]` |
| RC-04: Scanner text below 16px | 35 | Replace `text-sm`/`text-xs` with `text-base`/`text-sm` on scanner routes |
| RC-03: `focus:ring` vs `focus-visible:ring` | 7 | Pseudo-class swap (6 components) |
| RC-05: Props API gaps / dark mode | ~12 | Portal variants, label props, remove dark mode classes |

**Section 2 scanner findings note:** Scanner components have a higher density of Blocking findings because the warehouse floor rubric (MASTER.md Section 7) elevates tap target < 44px and text < 16px to Blocking severity. In non-scanner admin context, many of these would be Medium/High.

---

## Section 1: Shared UI Components (27)

---

### Alert

**File:** `src/components/ui/Alert.tsx` (84 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Warning uses `yellow` not `amber` | 10, 17 | High | RC-02 | XS | `bg-yellow-50 border-yellow-400 text-yellow-800`, `text-yellow-500` | `bg-amber-50 border-amber-400 text-amber-800` / `text-amber-500` per MASTER.md 1.3 |
| 2 | Info uses `blue` not `indigo` | 11, 18 | High | RC-02 | XS | `bg-blue-50 border-blue-400 text-blue-800`, `text-blue-500` | `bg-indigo-50 border-indigo-400 text-indigo-800` / `text-indigo-500` per MASTER.md 1.1 |
| 3 | Close button has no focus ring | 65 | High | RC-03 | XS | `hover:opacity-70 transition-opacity` — no focus state | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded` |
| 4 | Close button SVG icon has no `aria-label` | 63–65 | High | component-specific | XS | `<button onClick={onClose} className="...">` — no accessible label | Add `aria-label="Dismiss"` to close button |
| 5 | Shadow not tokenized | 56 | Low | RC-02 | XS | `rounded-md` — no shadow | Not urgent; alert has no shadow currently |
| 6 | Missing `warning` variant with correct amber semantic | 10 | Medium | RC-02 | XS | `warning` uses yellow (consumer SaaS) | `amber` aligns with MASTER.md semantic — `--color-warning: #d97706` |

**Accessibility:** Close button has no `aria-label` (finding #4) and no focus ring (finding #3). SVG icons are inline but purely decorative within an already-labelled container — pass. Alert text contrast passes WCAG AA: `text-yellow-800` (#92400E) on `bg-yellow-50` (#FFFBEB) = 8.5:1 — pass.

**Variants:** Complete for use cases. Warning color wrong (yellow → amber). No icon-less "inline" variant, but not required by MASTER.md.

**Props API:** Consistent with component convention. Uses `onClose` (not `onDismiss`) — matches Modal pattern.

---

### Badge

**File:** `src/components/ui/Badge.tsx` (41 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Default variant uses `gray` palette | 11 | Medium | RC-01 | XS | `bg-gray-100 text-gray-800` | `bg-slate-100 text-slate-700` per MASTER.md 1.4 |
| 2 | Warning variant uses `yellow` not `amber` | 13 | High | RC-02 | XS | `bg-yellow-100 text-yellow-800` | `bg-amber-50 text-amber-700 border border-amber-100` per MASTER.md 5.6 |
| 3 | Info variant uses `blue` not `indigo` | 15 | High | RC-02 | XS | `bg-blue-100 text-blue-800` | `bg-indigo-50 text-indigo-700 border border-indigo-100` per MASTER.md 1.1 |
| 4 | All variants missing `border` pattern | 10–15 | Medium | RC-02 | S | No border on any variant | MASTER.md 5.6 shows `border border-green-100` on success, `border border-amber-100` on warning, etc. |
| 5 | Success variant shade too dark | 12 | Medium | RC-02 | XS | `bg-green-100 text-green-800` | `bg-green-50 text-green-700` per MASTER.md 5.6 |
| 6 | Error variant shade too dark | 14 | Medium | RC-02 | XS | `bg-red-100 text-red-800` | `bg-red-50 text-red-700 border border-red-100` per MASTER.md 5.6 |
| 7 | `rounded-full` on `sm` size is correct for badges/chips | 31 | Pass | — | — | `rounded-full` | Correct per MASTER.md 4.2 — pills appropriate for status chips |

**Accessibility:** No interactive elements — no focus ring needed. `aria-hidden` not set but badge text is always descriptive. Pass.

**Variants:** 5 variants present (default, success, warning, error, info). Missing `portal` brand variant (cyan). All existing colors need correction per MASTER.md 5.6.

**Props API:** Has `className` passthrough (contradicts old MEMORY.md note — code confirms it IS present at line 7). Consistent `variant`/`size` pattern. No `aria-label` prop but badge content is text — acceptable.

---

### BarcodeScanner

**File:** `src/components/ui/BarcodeScanner.tsx` (479 lines)

_Note: Also a scanner component — cross-referenced in Section 2 for scanner floor rubric. All findings below apply to scanner route context._

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Instructions text `text-sm` on scanner route | 375 | Blocking | RC-04 | XS | `text-sm text-gray-600` ("Position barcode within the frame") | `text-base text-slate-600` — scanner floor minimum is 16px |
| 2 | Secondary instructions `text-xs` on scanner route | 378–380 | Blocking | RC-04 | XS | `text-xs text-gray-400` ("Hold steady for best results") | `text-sm text-slate-500` minimum (secondary text can be 14px) |
| 3 | Status/idle text uses gray palette | 256–263, 268–284, 387–393 | Medium | RC-01 | S | `bg-gray-100`, `text-gray-600`, `text-gray-900`, `text-gray-500`, `text-gray-400` throughout states | Replace all `gray-*` with `slate-*` equivalents |
| 4 | Loading spinner uses `border-blue-600` | 258 | High | RC-02 | XS | `border-blue-600 border-t-transparent` | `border-indigo-600 border-t-transparent` per MASTER.md 1.1 |
| 5 | Permission prompt uses `bg-blue-100`/`text-blue-600` for camera icon container | 270–271 | High | RC-02 | XS | `bg-blue-100 … text-blue-600` | `bg-indigo-50 … text-indigo-600` per MASTER.md 1.1 |
| 6 | Modal header uses `border-gray-200` and `text-gray-900` | 436 | Medium | RC-01 | XS | `border-gray-200`, `text-gray-900` | `border-slate-200`, `text-slate-900` |
| 7 | Modal close button uses `hover:bg-gray-100` and `text-gray-400` | 440 | Medium | RC-01 | XS | `text-gray-400 hover:bg-gray-100` | `text-slate-400 hover:bg-slate-100` |
| 8 | Modal footer uses `bg-gray-50` | 467 | Medium | RC-01 | XS | `bg-gray-50` | `bg-slate-50` |
| 9 | Modal footer uses `border-gray-200` | 467 | Medium | RC-01 | XS | `border-gray-200` | `border-slate-200` |
| 10 | Torch button has `aria-label` but no focus ring | 357–370 | High | RC-03 | XS | No `focus-visible:ring` on torch button | Add `focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50` |
| 11 | `BarcodeScannerModal` close button uses `hover:bg-gray-100` | 440 | Medium | RC-01 | XS | `hover:bg-gray-100` | `hover:bg-slate-100` |

**Accessibility:** Torch button has `aria-label` — pass. Modal close button has `aria-label="Close"` — pass. But torch button lacks focus ring (finding #10). Instructions text violates scanner floor 16px minimum (Blocking #1, #2). Scanner container has no ARIA live region for scan-success feedback — this is a medium gap (scan result announced via parent component, not here).

**Variants:** Single-purpose scanner. No variant completeness gap.

**Props API:** `onScan`, `onError`, `isActive`, `className` — clean API. No issues.

---

### Breadcrumbs

**File:** `src/components/ui/Breadcrumbs.tsx` (45 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Home link has no `aria-label` | 19–24 | High | component-specific | XS | `<Link href={homeHref} className="..."><Home className="w-4 h-4" /></Link>` — icon-only link | Add `aria-label="Go to dashboard"` per MASTER.md Section 9 |
| 2 | No `focus-visible:ring` on Home link | 20–22 | Medium | RC-03 | XS | `text-slate-400 hover:text-slate-600 transition-colors` — no focus indicator | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded` |
| 3 | No `focus-visible:ring` on breadcrumb links | 33–37 | Medium | RC-03 | XS | `text-slate-500 hover:text-slate-700 transition-colors` — no focus indicator | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded` |
| 4 | Missing `aria-label="Breadcrumb"` on `<nav>` | 18 | Medium | component-specific | XS | `<nav className="flex items-center...">` | Add `aria-label="Breadcrumb"` to `<nav>` for screen reader context |

**Accessibility:** Icon-only home link has no accessible label (finding #1 — High). No focus rings on links (findings #2, #3). Nav element should have `aria-label="Breadcrumb"` (finding #4). Colors pass WCAG AA: `text-slate-500` (#64748B) on white = 4.6:1 — borderline pass. `text-slate-900` on white = 17.4:1 — pass.

**Variants:** No variants needed. Component is simple and focused.

**Props API:** Clean `items` + `homeHref` props. No `className` passthrough on the nav wrapper — Low gap.

---

### Button

**File:** `src/components/ui/Button.tsx` (75 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | `rounded-lg` used instead of `rounded-md` | 41 | Medium | RC-02 | XS | `rounded-lg` (12px = `--radius-lg`) | `rounded-md` (8px = `--radius-md`) per MASTER.md 5.1 button pattern |
| 2 | Missing portal variant (cyan gradient) | 4 | Medium | RC-05 | M | `variant` options: primary/secondary/danger/ghost only | Add `portal` variant: `from-cyan-500 to-teal-600 focus-visible:ring-cyan-500` per MASTER.md 5.1 |
| 3 | Loading spinner SVG has no `aria-label` | 51–71 | Medium | component-specific | XS | Spinner SVG has no accessible label when loading | Add `aria-hidden="true"` on the SVG; Button already shows loading state via `disabled` + visual spinner — acceptable, but add `aria-busy={loading}` to button |
| 4 | `transition-all` used (performance concern) | 42 | Low | component-specific | XS | `transition-all duration-150` | MASTER.md 4.3 says never transition `width`/`height`/`padding` (which `transition-all` includes) — use `transition-colors` for hover, `transition-shadow` separately |

**Accessibility:** `focus-visible:ring-2 focus-visible:ring-offset-2` — correct pattern, pass. Disabled state uses `disabled:opacity-50 disabled:cursor-not-allowed` — pass. Loading state should use `aria-busy` (finding #3 — Medium).

**Variants:** Missing `portal` variant (finding #2). Scanner floor CTA pattern (full-width `py-4 text-lg`) not a variant but a usage pattern — acceptable.

**Props API:** Extends `ButtonHTMLAttributes` — all HTML button props passthrough. `variant`, `size`, `loading` props — consistent with design system conventions.

---

### Card

**File:** `src/components/ui/Card.tsx` (62 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Shadow uses `shadow-sm` not `var(--shadow-card)` | 43 | Low | RC-02 | XS | `shadow-sm` | `shadow-[var(--shadow-card)]` per MASTER.md 4.1 |
| 2 | Hover shadow uses `hover:shadow-md` not `var(--shadow-card-hover)` | 43 | Low | RC-02 | XS | `hover:shadow-md` | `hover:shadow-[var(--shadow-card-hover)]` per MASTER.md 4.1 |
| 3 | Clickable card has no keyboard handler | 43–44 | High | RC-05 | S | `onClick` on a `<div>` — no `role="button"`, no `tabIndex`, no `onKeyDown` | Add `role="button"` + `tabIndex={0}` + `onKeyDown={(e) => e.key === 'Enter' && onClick?.()}` when `onClick` is present |
| 4 | Clickable card has no focus ring | 43 | Medium | RC-03 | XS | No `focus-visible:ring` when card is clickable | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` to clickable card variant |

**Accessibility:** Clickable card is a `<div>` with `onClick` — no keyboard accessibility (finding #3 — High). MASTER.md 5.2 shows `active:scale-[0.99]` for clickable cards — currently uses `hover:shadow-md` only, which is acceptable, but keyboard interaction is missing.

**Variants:** `accent` prop (indigo/amber/red/green/cyan) — good coverage. `padding` variants — good. No loading/skeleton variant, but SkeletonCard in Skeleton.tsx covers that.

**Props API:** Clean. `className` passthrough present. `onClick`, `accent`, `padding`, `title`, `subtitle`, `actions` — well-structured.

---

### charts/ (14 files)

#### charts/BulletChart

**File:** `src/components/ui/charts/BulletChart.tsx` (107 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | SVG has `role="img"` and `aria-label` but no `<title>` element | 26–29 | High | component-specific | XS | `role="img" aria-label="Bullet chart"` — generic label, no data description | Add `<title>Bullet chart</title>` inside SVG; ideally caller passes an `aria-label` prop for meaningful description |
| 2 | `aria-label` is hardcoded "Bullet chart" — not data-driven | 29 | Medium | component-specific | S | Fixed string with no data context | Add `aria-label` prop to `BulletChartProps` with fallback to "Bullet chart" |
| 3 | No `prefers-reduced-motion` guard on `animate-chart-enter` | 23 | High | component-specific | XS | `className="animate-chart-enter..."` | Add `motion-safe:animate-chart-enter` or check in globals.css — see cross-cutting section |
| 4 | No `className` passthrough | 11–12 | Low | RC-05 | XS | Props: `data` only | Add `className?: string` prop for consumer layout control |

**Accessibility:** Has `role="img"` + `aria-label` — partial pass. Label is hardcoded (finding #2). No `<title>` element inside SVG for additional screen reader support (finding #1). SVG text elements use `fill="#64748B"` (slate-500) — passes contrast on white background (4.6:1 — borderline AA pass).

**Variants:** Single-purpose chart. No variants needed.

**Props API:** `data` only — minimal but sufficient for the chart's use case.

---

#### charts/CalendarHeatmap

**File:** `src/components/ui/charts/CalendarHeatmap.tsx` (131 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | `role="img" aria-label="Calendar heatmap"` — generic, not data-driven | 99 | Medium | component-specific | S | Fixed string | Add `aria-label` prop to allow meaningful description |
| 2 | No `<title>` element inside SVG | 99 | High | component-specific | XS | SVG has no `<title>` child | Add `<title>Calendar activity heatmap</title>` or caller-provided title |
| 3 | Color-only encoding for activity levels | 15–28 | High | component-specific | M | 4 color levels with no text alternative | Add `<desc>` element or a visually-hidden data table for screen readers |
| 4 | Cell `<title>` provides tooltip text — good partial pass | 125 | Pass | — | — | Each `<rect>` has `<title>date: count</title>` | This is correct and good — retain |
| 5 | `animate-chart-enter` not guarded for `prefers-reduced-motion` | 98 | High | component-specific | XS | `className="animate-chart-enter overflow-x-auto"` | Use `motion-safe:` prefix or globals.css media query |

**Accessibility:** Color-only status encoding (finding #3 — High). Individual cell tooltip via `<title>` — good. Generic SVG label (finding #2 — High). No keyboard navigation of cells.

**Variants:** Single-purpose. `days` prop controls time range — adequate.

**Props API:** `data` + `days` — clean minimal API. No `className` passthrough — Low gap.

---

#### charts/ChartLegend

**File:** `src/components/ui/charts/ChartLegend.tsx` (38 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Color dots use `style={{ backgroundColor }}` — not accessible as sole indicator | 27–28 | Medium | component-specific | S | Color swatch only, no pattern/shape distinction | For accessibility, pair each dot with the text label — current design does this. Color alone would fail but text pairing passes. |
| 2 | No `aria-label` or role on legend container | 17 | Low | component-specific | XS | Plain `<div>` | Add `role="list"` / `aria-label="Chart legend"` or `<dl>` semantic structure |
| 3 | No `className` passthrough | 9 | Low | RC-05 | XS | No `className` prop | Add for consumer layout flexibility |

**Accessibility:** Color + text pairing — pass for WCAG 1.4.1. Semantic structure could be improved (finding #2 — Low). Overall accessibility is reasonable.

**Variants:** `horizontal`/`vertical` layout — adequate.

**Props API:** `items` + `layout` — clean. No `className` passthrough.

---

#### charts/DonutChart

**File:** `src/components/ui/charts/DonutChart.tsx` (63 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on Recharts container | 29–50 | High | component-specific | S | Raw `<div>` wrapping Recharts — no `role="img"`, no `aria-label` | Add wrapper `<div role="img" aria-label="..." aria-describedby="...">` or use `aria-label` prop |
| 2 | Color data passed by caller — no validation | 6 | Medium | component-specific | Low | `color: string` in data — relies on caller passing correct brand colors | Document color convention; add `aria-label` prop for meaningful description |
| 3 | `animate-chart-enter` not guarded for `prefers-reduced-motion` | 29 | High | component-specific | XS | `className="relative animate-chart-enter"` | Use `motion-safe:animate-chart-enter` |
| 4 | Recharts animation `isAnimationActive={true}` not disabled for reduced motion | 41–43 | High | component-specific | S | Always animates | Add `useReducedMotion()` hook and pass `isAnimationActive={!prefersReducedMotion}` |

**Accessibility:** No ARIA on the chart container (finding #1 — High). Color-only donut segments with no text alternative outside of centerLabel (finding #2 — Medium). Associated ChartLegend component (separate) fills some gap but the chart itself is inaccessible in isolation.

**Variants:** `centerLabel`/`centerValue` props — good for donut with center text. `size` prop — good.

**Props API:** `data`, `centerLabel`, `centerValue`, `size` — clean. No `className` passthrough.

---

#### charts/GaugeChart

**File:** `src/components/ui/charts/GaugeChart.tsx` (97 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | `aria-label` is data-driven (good!) | 48 | Pass | — | — | `aria-label={\`Gauge: ${clampedValue}%\`}` | Correct pattern — retain |
| 2 | `role="img"` present | 48 | Pass | — | — | `role="img"` | Correct |
| 3 | `animate-chart-enter` not guarded for `prefers-reduced-motion` | 47 | High | component-specific | XS | `className="animate-chart-enter flex justify-center"` | Use `motion-safe:animate-chart-enter` |
| 4 | SVG text uses inline `fill` values | 76, 89 | Low | RC-02 | XS | `fill="#0F172A"` (slate-900), `fill="#64748B"` (slate-500) | Values match MASTER.md tokens but should reference CSS vars via `currentColor` or documented comment |
| 5 | No `<title>` element in SVG (aria-label on outer div, not SVG) | 48–96 | Medium | component-specific | XS | `aria-label` is on the SVG element which has `role="img"` — this is actually correct | Pass — SVG with `role="img"` + `aria-label` is the correct ARIA pattern per WCAG |

**Accessibility:** SVG has `role="img"` + data-driven `aria-label` — best accessibility pattern in the chart directory. Pass. Animation not guarded (finding #3).

**Variants:** Single-purpose gauge with `value`, `label`, `color` — adequate.

**Props API:** `value`, `label`, `color` — minimal and sufficient.

---

#### charts/HorizontalBarChart

**File:** `src/components/ui/charts/HorizontalBarChart.tsx` (80 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on chart container | 52 | High | component-specific | S | `<div className="animate-chart-enter" style={{ height }}>` — no role/label | Add `<div role="img" aria-label={...}>` wrapper; add `aria-label` prop |
| 2 | `animate-chart-enter` not guarded | 52 | High | component-specific | XS | `className="animate-chart-enter"` | Use `motion-safe:animate-chart-enter` |
| 3 | Recharts animation not reduced-motion guarded | 68–70 | High | component-specific | S | `isAnimationActive={true} animationDuration={800}` | Respect `prefers-reduced-motion` |
| 4 | Default color `#4F46E5` (indigo-600) — good | 44 | Pass | — | — | `color = "#4F46E5"` | Matches `--color-primary` — correct |
| 5 | Axis tick `fill="#64748B"` (slate-500) hardcoded | 59 | Low | RC-02 | XS | `fill: "#64748B"` in tick config | Value is correct but not using CSS var reference — Low priority |

**Accessibility:** No ARIA on container (finding #1 — High). No screen reader alternative for chart data.

**Variants:** `color`, `height`, `valueFormatter` — reasonable API.

**Props API:** Clean. No `className` passthrough.

---

#### charts/MiniBarChart

**File:** `src/components/ui/charts/MiniBarChart.tsx` (84 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on chart container | 54 | High | component-specific | S | Plain `<div>` — no role or label | Add `role="img"` + `aria-label` prop |
| 2 | `animate-chart-enter` not guarded | 54 | High | component-specific | XS | `className="animate-chart-enter"` | `motion-safe:animate-chart-enter` |
| 3 | Recharts animation not reduced-motion guarded | 75–77 | High | component-specific | S | Always animates | Guard with `prefers-reduced-motion` |
| 4 | Axis tick `fill: "#94A3B8"` (slate-400) — low contrast | 62 | Medium | component-specific | XS | `fill: "#94A3B8"` = slate-400 — 2.9:1 on white | Fails WCAG AA for small text. Use `#64748B` (slate-500 = 4.6:1) minimum |
| 5 | Tooltip uses correct slate classes | 31–41 | Pass | — | — | `border-slate-200`, `text-slate-700`, `text-slate-900` | Good — retain |

**Accessibility:** No ARIA on container (finding #1 — High). Axis tick contrast fails WCAG AA (finding #4 — Medium). No data table alternative.

**Variants:** `bars` config, `height`, `showGrid`, `showXAxis` — reasonable.

**Props API:** Functional but no `className` or `aria-label` props.

---

#### charts/MiniLineChart

**File:** `src/components/ui/charts/MiniLineChart.tsx` (90 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on chart container | 57 | High | component-specific | S | Plain `<div>` — no role or label | Add `role="img"` + `aria-label` prop |
| 2 | `animate-chart-enter` not guarded | 57 | High | component-specific | XS | `className="animate-chart-enter"` | `motion-safe:animate-chart-enter` |
| 3 | Recharts animation not reduced-motion guarded | 80–81 | High | component-specific | S | `isAnimationActive={true}` | Guard with `prefers-reduced-motion` |
| 4 | Axis tick `fill: "#94A3B8"` — low contrast | 64 | Medium | component-specific | XS | slate-400 = 2.9:1 | Use slate-500 (#64748B = 4.6:1) |
| 5 | Tooltip uses correct slate classes | 33–43 | Pass | — | — | `border-slate-200`, `text-slate-700` | Good |

**Accessibility:** Same gaps as MiniBarChart — no ARIA, no data table alternative, axis contrast fails AA.

**Variants:** `lines` config, `height`, `showGrid`, `showXAxis`, `xDataKey` — adequate.

**Props API:** No `className` or `aria-label` props.

---

#### charts/MiniSparkline

**File:** `src/components/ui/charts/MiniSparkline.tsx` (41 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes — sparklines are purely decorative in context | 19 | Medium | component-specific | XS | No `role` or `aria-label` — but sparklines are decorative trend lines | Add `aria-hidden="true"` since sparkline is decorative context; or add `role="img" aria-label` prop for when used standalone |
| 2 | `animate-chart-enter` not guarded | 19 | High | component-specific | XS | `className="animate-chart-enter"` | `motion-safe:animate-chart-enter` |
| 3 | Recharts animation `isAnimationActive={true}` | 31 | High | component-specific | S | Always animates | Guard with `prefers-reduced-motion` |
| 4 | Default `color="#4F46E5"` — correct | 12 | Pass | — | — | `color = "#4F46E5"` | Matches `--color-primary` — good |

**Accessibility:** Sparklines are typically decorative when used in StatCard context — `aria-hidden="true"` would be appropriate. When used standalone, needs accessible label.

**Variants:** `color`, `height` — minimal and sufficient for sparkline use case.

**Props API:** `data`, `color`, `height` — clean and minimal.

---

#### charts/ScatterChart

**File:** `src/components/ui/charts/ScatterChart.tsx` (99 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on chart container | 59 | High | component-specific | S | Plain `<div>` | Add `role="img"` + `aria-label` prop |
| 2 | `animate-chart-enter` not guarded | 59 | High | component-specific | XS | `className="animate-chart-enter"` | `motion-safe:animate-chart-enter` |
| 3 | Recharts `isAnimationActive={true}` | 93 | High | component-specific | S | Always animates | Guard with `prefers-reduced-motion` |
| 4 | Axis tick `fill: "#94A3B8"` — low contrast | 67, 79 | Medium | component-specific | XS | slate-400 = 2.9:1 | Use slate-500 |
| 5 | Default `color="#4F46E5"` — correct | 54 | Pass | — | — | `color = "#4F46E5"` | Correct |

**Accessibility:** No ARIA. Scatter data includes `name` per point but no accessible data table alternative.

**Variants:** `xLabel`, `yLabel`, `height`, `color` — adequate.

**Props API:** No `className` or `aria-label` props.

---

#### charts/StackedBarChart

**File:** `src/components/ui/charts/StackedBarChart.tsx` (121 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on chart container | 71 | High | component-specific | S | Plain `<div>` | Add `role="img"` + `aria-label` prop |
| 2 | `animate-chart-enter` not guarded | 71 | High | component-specific | XS | `className="animate-chart-enter"` | `motion-safe:animate-chart-enter` |
| 3 | Recharts animation not reduced-motion guarded | 114–115 | High | component-specific | S | `isAnimationActive={true}` | Guard with `prefers-reduced-motion` |
| 4 | Axis tick `fill: "#94A3B8"` — low contrast | 86–87, 98 | Medium | component-specific | XS | slate-400 = 2.9:1 | Use slate-500 |
| 5 | Tooltip uses correct slate classes | 43–55 | Pass | — | — | `border-slate-200`, `text-slate-600`, `text-slate-900` | Good |

**Accessibility:** No ARIA. Multiple data series stacked — harder to convey without data table.

**Variants:** `horizontal`/`vertical` layout, `stacks` config — well-thought-out API.

**Props API:** Comprehensive. No `className` or `aria-label`.

---

#### charts/TreemapChart

**File:** `src/components/ui/charts/TreemapChart.tsx` (108 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on chart container | 92 | High | component-specific | S | Plain `<div>` | Add `role="img"` + `aria-label` prop |
| 2 | `animate-chart-enter` not guarded | 92 | High | component-specific | XS | `className="animate-chart-enter"` | `motion-safe:animate-chart-enter` |
| 3 | Recharts animation `isAnimationActive={true}` | 101 | High | component-specific | S | Always animates | Guard with `prefers-reduced-motion` |
| 4 | Text truncation in cells uses fragile `name.length / 8` formula | 53 | Low | component-specific | S | `name.slice(0, Math.floor(width / 8))` — assumes 8px/char | This is implementation-internal; acceptable for now |
| 5 | Color passed by caller — no brand enforcement | 8 | Medium | component-specific | Low | `color: string` in data | Document that callers should use MASTER.md palette |

**Accessibility:** No ARIA. Color-coded cells — purely visual. Tooltip provides data but no accessible alternative.

**Variants:** Single variant. `height`, `valueFormatter` — adequate.

**Props API:** `data`, `height`, `valueFormatter` — clean. No `className` or `aria-label`.

---

#### charts/WaterfallChart

**File:** `src/components/ui/charts/WaterfallChart.tsx` (133 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | No ARIA attributes on chart container | 99 | High | component-specific | S | Plain `<div>` | Add `role="img"` + `aria-label` prop |
| 2 | `animate-chart-enter` not guarded | 99 | High | component-specific | XS | `className="animate-chart-enter"` | `motion-safe:animate-chart-enter` |
| 3 | `increase`/`decrease` colors `#22C55E`/`#EF4444` hardcoded | 32–35 | Medium | RC-02 | XS | Raw hex colors | Map to MASTER.md tokens: `#22C55E` = `--color-success` (close; actual is `#16a34a`), `#EF4444` = `--color-error` (close; actual is `#dc2626`). Fix to exact token values |
| 4 | `total` color `#4F46E5` is correct | 35 | Pass | — | — | `"#4F46E5"` = `--color-primary` | Correct |
| 5 | Axis tick `fill: "#94A3B8"` — low contrast | 104 | Medium | component-specific | XS | slate-400 = 2.9:1 | Use slate-500 |

**Accessibility:** No ARIA. Waterfall semantics (increase/decrease) encoded only via color — screen readers cannot distinguish (finding combination #1 + #3 — High).

**Variants:** `height`, `valueFormatter` — adequate.

**Props API:** `data`, `height`, `valueFormatter` — clean. No `className` or `aria-label`.

---

### CommandPalette

**File:** `src/components/ui/CommandPalette.tsx` (388 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | All gray palette throughout | 257, 265, 267, 275, 283, 299, 307, 329, 369–373 | Medium | RC-01 | S | `border-gray-200`, `text-gray-900`, `placeholder-gray-400`, `text-gray-500`, `text-gray-700`, `hover:bg-gray-50`, `bg-gray-100`, `border-gray-300`, `text-gray-600` throughout | Replace all `gray-*` with `slate-*` |
| 2 | Selected item uses `bg-blue-50 text-blue-900 text-blue-600` | 298–309 | High | RC-02 | XS | `bg-blue-50 text-blue-900` for selected; `text-blue-600` for icon | `bg-indigo-50 text-indigo-900 text-indigo-600` per MASTER.md 1.1 |
| 3 | Shadow uses `shadow-2xl` | 255 | Low | RC-02 | XS | `shadow-2xl` | `shadow-[var(--shadow-modal)]` per MASTER.md 4.1 |
| 4 | Backdrop uses `bg-black/50` not `bg-slate-900/60` | 250–252 | Low | RC-01 | XS | `bg-black/50 backdrop-blur-sm` | `bg-slate-900/60 backdrop-blur-sm` per MASTER.md 5.4 |
| 5 | Missing ARIA combobox role pattern | 258–269 | High | component-specific | M | `<input type="text">` with no ARIA combobox attributes | Input should have `role="combobox"`, `aria-expanded={isOpen}`, `aria-haspopup="listbox"`, `aria-autocomplete="list"`, `aria-controls` pointing to listbox; results list needs `role="listbox"` |
| 6 | Result buttons lack `role="option"` | 290–320, 336–360 | High | component-specific | S | `<button>` elements in list — should use listbox/option pattern | Use `role="option"` on result items; container gets `role="listbox"` |
| 7 | `<kbd>` ESC hint in footer has no `aria-hidden` | 267–269 | Low | component-specific | XS | Visual keyboard hint visible to screen readers | Add `aria-hidden="true"` to `<kbd>` decorative hints |
| 8 | Input has no `aria-label` (placeholder only) | 259–264 | Medium | component-specific | XS | `placeholder="Search commands..."` — no `aria-label` | Add `aria-label="Search commands"` |

**Accessibility:** ARIA combobox pattern missing (finding #5 — High). No `role="listbox"` / `role="option"` on results (finding #6 — High). Keyboard navigation implemented (ArrowUp/Down/Enter/Escape) — good functional behavior, but semantic ARIA is absent. Screen reader users cannot identify this as a combobox.

**Variants:** No variants — single-purpose palette.

**Props API:** `isOpen` + `onClose` — minimal and appropriate. No extension points for custom commands at runtime (commands are hardcoded) — this is a design limitation but outside audit scope.

---

### ConfirmDialog

**File:** `src/components/ui/ConfirmDialog.tsx` (53 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Description text uses `text-gray-600` | 50 | Medium | RC-01 | XS | `text-sm text-gray-600` | `text-sm text-slate-600` — contrast check: slate-600 (#475569) on white = 7.1:1 — passes AA |
| 2 | Inherits all Modal accessibility gaps | — | High | RC-03 | — | Modal close button has no focus ring — see Modal findings | Fix at Modal level; ConfirmDialog inherits fix automatically |

**Accessibility:** Inherits Modal accessibility (role="dialog", Escape, backdrop close — all from Modal component). Body text contrast: `text-gray-600` (#4B5563 = 7.2:1) passes WCAG AA. One gray palette instance to fix.

**Variants:** `variant` (default/danger) — good. `loading` state — good. `confirmLabel`/`cancelLabel` — good customization.

**Props API:** All descriptive. Consistent with Modal. `onClose`/`onConfirm` naming — correct.

---

### DropdownMenu

**File:** `src/components/ui/DropdownMenu.tsx` (125 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Trigger uses `focus:ring` not `focus-visible:ring` | 72 | Medium | RC-03 | XS | `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` | `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` |
| 2 | Trigger uses gray palette | 71–72 | Medium | RC-01 | XS | `text-gray-500 hover:text-gray-700 hover:bg-gray-100` | `text-slate-500 hover:text-slate-700 hover:bg-slate-100` |
| 3 | Menu shadow uses `ring-black ring-opacity-5` | 85 | Low | RC-02 | XS | `shadow-lg ring-1 ring-black ring-opacity-5` | `shadow-[var(--shadow-elevated)]` per MASTER.md 4.1 |
| 4 | Menu items use gray palette | 94, 103, 106 | Medium | RC-01 | XS | `border-gray-100`, `text-gray-400`, `text-gray-700`, `hover:bg-gray-50` | All to `slate-*` equivalents |
| 5 | Menu items use `focus:ring-blue-500` (implied by absence of focus styles) | 100–107 | Medium | RC-03 | XS | No explicit `focus-visible:ring` on menu items | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset` to menu item buttons |
| 6 | Trigger button has no `aria-label` | 67–79 | Medium | component-specific | S | Uses `MoreVertical` icon by default — no accessible label | Add `triggerAriaLabel` prop defaulting to `"Open menu"` |
| 7 | `role="menu"` and `role="menuitem"` present — good | 88, 109 | Pass | — | — | Correct ARIA roles | Retain |

**Accessibility:** `role="menu"` + `role="menuitem"` present (pass). Escape key closes menu (pass). Missing focus rings on trigger (finding #1) and menu items (finding #5). Trigger icon button has no accessible label (finding #6 — Medium). Menu items don't receive focus via keyboard nav when open — tabindex management needed for true menuitem pattern.

**Variants:** `align` (left/right). `triggerIcon` for custom trigger content. Reasonable.

**Props API:** `items[]` array API — clean. `DropdownMenuItem` interface is well-typed with `divider` support.

---

### EmptyState

**File:** `src/components/ui/EmptyState.tsx` (30 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Icon wrapper uses `text-gray-400` | 19 | Medium | RC-01 | XS | `text-gray-400` | `text-slate-400` |
| 2 | Title uses `text-gray-900` | 23 | Medium | RC-01 | XS | `text-gray-900` | `text-slate-900` per MASTER.md 1.4 |
| 3 | Description uses `text-gray-500` | 25 | Medium | RC-01 | XS | `text-gray-500` | `text-slate-500` per MASTER.md 1.4 |

**Accessibility:** No interactive elements — no focus ring needed. Icon passed as `ReactNode` — caller responsible for icon accessibility. Title and description use semantic HTML (`h3`, `p`) — pass.

**Variants:** `icon`, `title`, `description`, `action` — complete for empty state use cases.

**Props API:** Clean. No `className` passthrough on outer container — Low gap.

---

### ErrorBoundary

**File:** `src/components/ui/ErrorBoundary.tsx` (78 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Title uses `text-gray-900` | 50 | Medium | RC-01 | XS | `text-gray-900` | `text-slate-900` |
| 2 | Body text uses `text-gray-500` | 53 | Medium | RC-01 | XS | `text-gray-500` | `text-slate-500` |
| 3 | "Try Again" button uses `bg-blue-600 hover:bg-blue-700` | 59 | High | RC-02 | XS | `bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700` | `bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 rounded-md` per MASTER.md 5.1 — also `rounded-lg` → `rounded-md` |
| 4 | Dev error block uses `bg-gray-100` | 65 | Medium | RC-01 | XS | `bg-gray-100 rounded-lg` | `bg-slate-100 rounded-lg` |
| 5 | "Try Again" button has no `focus-visible:ring` | 57–62 | High | RC-03 | XS | No focus ring on retry button | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` |

**Accessibility:** Error boundary fallback UI. Retry button has no focus ring (finding #5 — High). Error message is in a plain `<div>` with no `role="alert"` — Low priority since the full page renders the error fallback.

**Variants:** `fallback` prop for custom fallback UI — good. Default fallback has retry action.

**Props API:** `children` + `fallback` — appropriate for ErrorBoundary class component.

---

### FetchError

**File:** `src/components/ui/FetchError.tsx` (36 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Title uses `text-gray-900` | 19 | Medium | RC-01 | XS | `text-gray-900` | `text-slate-900` |
| 2 | Description uses `text-gray-500` | 22 | Medium | RC-01 | XS | `text-gray-500` | `text-slate-500` |
| 3 | "Try Again" button uses `text-blue-600 hover:text-blue-700 hover:bg-blue-50` | 28–30 | High | RC-02 | XS | Blue brand colors | `text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50` |
| 4 | "Try Again" button has no `focus-visible:ring` | 28–30 | High | RC-03 | XS | No focus ring | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-lg` |

**Accessibility:** Retry button has no focus ring (finding #4 — High). Icon container `bg-red-100 text-red-600` — pass, correct error state. The component lacks `role="alert"` — Low priority since it's inline, not a toast.

**Variants:** `message` + `onRetry` — minimal and focused.

**Props API:** Clean. No `className` passthrough — Low gap.

---

### Input

**File:** `src/components/ui/Input.tsx` (57 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Hint text uses `text-gray-500` | 53 | Medium | RC-01 | XS | `text-sm text-gray-500` | `text-sm text-slate-500` |
| 2 | Input uses `focus:ring-2` not `focus-visible:ring-2` | 38–43 | Medium | RC-03 | XS | `focus:ring-2 focus:border-transparent` | `focus-visible:ring-2 focus-visible:border-transparent` per MASTER.md 5.5 |
| 3 | `rounded-lg` used instead of `rounded-md` | 37 | Medium | RC-02 | XS | `rounded-lg` | `rounded-md` per MASTER.md 5.5 inputs use `rounded-md` |
| 4 | No portal variant (cyan focus ring) | — | Medium | RC-05 | M | Only indigo focus ring | Portal inputs need `focus:ring-cyan-500` per MASTER.md 5.5. Add `variant` prop or CSS custom property approach |

**Accessibility:** Label uses `htmlFor={name}` — pass. Required asterisk is visual-only `*` — Low gap (screen readers read `*` as asterisk). Error text is in `<p>` not `role="alert"` — medium gap for dynamic errors. Focus indicator present but using wrong pseudo-class (finding #2).

**Variants:** No portal variant (finding #4). No `size` variant (MASTER.md 3.2 mentions `py-3` minimum for scanner inputs — no size variant to enforce this).

**Props API:** `label`, `error`, `hint`, `required`, `disabled` — consistent with Textarea and Select. No `className` on input itself (it uses `className` prop via `...props` spread — actually present via spread). Good.

---

### Modal

**File:** `src/components/ui/Modal.tsx` (121 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Shadow value inlined (correct value, wrong technique) | 84 | Low | RC-02 | XS | `shadow-[0_20px_60px_rgba(0,0,0,0.15),0_4px_16px_rgba(0,0,0,0.05)]` | `shadow-[var(--shadow-modal)]` — same value but uses token |
| 2 | Close button has no focus ring | 93–110 | High | RC-03 | XS | `p-1 text-slate-400 hover:text-slate-600 transition-colors` | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded` |
| 3 | Close button has no `aria-label` | 93 | High | component-specific | XS | `<button onClick={handleClose} className="...">` — icon-only button | Add `aria-label="Close"` |
| 4 | Modal lacks `role="dialog"` and `aria-modal="true"` | 83 | High | component-specific | S | Plain `<div>` for modal container | Add `role="dialog"` `aria-modal="true"` `aria-labelledby` pointing to title element |
| 5 | `animate-modal-scale-up` not guarded for `prefers-reduced-motion` | 86 | High | component-specific | XS | `animate-modal-scale-up` / `animate-modal-scale-down` always runs | See cross-cutting section for globals.css fix |
| 6 | Missing `size="full"` variant for scanner workflows | — | Medium | component-specific | M | Sizes: sm/md/lg/xl | Add `full` size variant: `max-w-full h-screen` for full-screen scanner modals |
| 7 | No `aria-describedby` for modal body | 112 | Low | component-specific | XS | Body has no `id` for description linking | Add `id` to body div; link from container via `aria-describedby` |

**Accessibility:** Missing `role="dialog"` + `aria-modal` (finding #4 — High). Close button has no `aria-label` and no focus ring (findings #2, #3 — High). Escape key closes modal — pass. Backdrop click closes — pass. Body scroll locked when open — pass. Focus is NOT trapped inside modal — medium gap not flagged separately (would be part of #4 fix).

**Variants:** sm/md/lg/xl sizes — good. Missing `full` for scanner workflows (finding #6 — Medium).

**Props API:** `isOpen`, `onClose`, `title`, `children`, `footer`, `size` — clean and complete.

---

### Pagination

**File:** `src/components/ui/Pagination.tsx` (187 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Border uses `border-gray-200` | 70 | Medium | RC-01 | XS | `border-t border-gray-200` | `border-t border-slate-200` |
| 2 | Item count text uses `text-gray-600` | 73 | Medium | RC-01 | XS | `text-sm text-gray-600` | `text-sm text-slate-600` |
| 3 | Disabled state uses `text-gray-300` | 88–89 | Medium | RC-01 | XS | `text-gray-300 cursor-not-allowed` | `text-slate-300 cursor-not-allowed` |
| 4 | Active page uses `bg-gray-900 text-white` | 116 | High | RC-01 | XS | `bg-gray-900 text-white` for active page button | `bg-indigo-600 text-white` per MASTER.md 1.1 — active state must use brand primary |
| 5 | Inactive page hover uses `hover:bg-gray-100` | 117 | Medium | RC-01 | XS | `hover:bg-gray-100 hover:text-gray-900` | `hover:bg-slate-100 hover:text-slate-900` |
| 6 | Mobile page indicator uses `text-gray-600` | 129 | Medium | RC-01 | XS | `text-sm text-gray-600` | `text-sm text-slate-600` |
| 7 | Button tap targets are `w-9 h-9` (36px) — below 44px | 86, 113, 137 | Blocking | component-specific | S | `w-9 h-9` = 36px square | `min-w-[44px] min-h-[44px]` per MASTER.md 3.2 — but this is admin use (data tables), not scanner routes. Rating is High (not Blocking) for admin context; would be Blocking on scanner routes |
| 8 | No focus ring on pagination buttons | 82–96, 109–123, 134–148 | High | RC-03 | S | No `focus-visible:ring` on any pagination button | Add `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` to all pagination buttons |
| 9 | Ellipsis `<span>` uses `text-gray-400` | 104 | Medium | RC-01 | XS | `text-gray-400` | `text-slate-400` |

**Note on finding #7:** Pagination is used in admin data table context only (not scanner routes). `w-9 h-9` (36px) falls below the 44px accessibility guideline for touch targets. Rated **High** (not Blocking) since admin staff use desktop/mouse primarily. Would become Blocking if used on scanner routes.

**Accessibility:** No focus rings on any button (finding #8 — High). Active page has `aria-current="page"` — pass. Prev/Next have `aria-label` — pass. Ellipsis has no `aria-hidden` — Low gap.

**Variants:** Basic pagination. No per-page selector variant. `className` passthrough present.

**Props API:** `currentPage`, `totalItems`, `itemsPerPage`, `onPageChange`, `className` — clean. `usePagination` hook exported — good.

---

### ProductImage

**File:** `src/components/ui/ProductImage.tsx` (254 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | All gray palette throughout | 66–67, 71–72, 80–81, 97–98, 106, 125–126, 163, 172, 189, 227–229, 236, 250, 252 | Medium | RC-01 | S | `bg-gray-100`, `text-gray-300`, `bg-gray-200` throughout all variants and loading states | Replace all `gray-*` with `slate-*` |
| 2 | `alt` prop is required and passed through — pass | 10 | Pass | — | — | `alt: string` in props (required) | Good — alt text enforced at type level |
| 3 | Blur placeholder uses gray `#f3f4f6`/`#e5e7eb` (gray-100/gray-200) in SVG | 28–45 | Low | RC-01 | XS | Shimmer SVG uses `stop-color:#f3f4f6` / `#e5e7eb` | `#f1f5f9` (slate-100) / `#e2e8f0` (slate-200) for consistency |
| 4 | Loading pulse overlay uses `bg-gray-200 animate-pulse` | 97, 125 | Medium | RC-01 | XS | `bg-gray-200 animate-pulse` | `bg-slate-200 animate-pulse` |
| 5 | `animate-pulse` not guarded for `prefers-reduced-motion` | 97, 125, 189, 250 | High | component-specific | XS | Always shows pulse animation | Use `motion-safe:animate-pulse` |

**Accessibility:** `alt` prop is required — pass. Fallback state renders `<Package>` icon — this is decorative in context (no alt needed). Loading overlay has no `aria-label` but it's transient — acceptable.

**Variants:** `ProductImage` (default), `ProductImageCard` (aspect ratio variant), `ProductThumbnail` (fixed square) — good coverage for different use cases.

**Props API:** Three exported components with slightly different props — reasonable. All have `alt` (required), `src`, `className`. `ProductImage` adds `size`/`priority`; `ProductImageCard` adds `aspectRatio`.

---

### SearchSelect

**File:** `src/components/ui/SearchSelect.tsx` (272 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Focus ring uses always-on `ring-2 ring-indigo-500` not `focus-visible:ring` | 224–225 | Medium | RC-03 | XS | `border-indigo-500 ring-2 ring-indigo-500` when `isOpen` | This is the open-state indicator (correct for showing active state). But the input itself should also have `focus-visible:ring` when focused-but-not-open |
| 2 | Clear button (X) has no `aria-label` | 250–256 | High | component-specific | XS | `<button type="button" tabIndex={-1} onClick={handleClear}>` — icon-only | Add `aria-label="Clear selection"` |
| 3 | Missing `hint` prop | — | Medium | RC-05 | S | `label`, `error`, `disabled`, `required` present but no `hint` | Add `hint?: string` prop for parity with Input/Select/Textarea |
| 4 | Error state only shows text, not border color ring | 226–228 | Medium | RC-05 | XS | `border-red-500` when error but no ring | `border-red-500 ring-2 ring-red-500` to match Input behavior |
| 5 | Dropdown uses correct slate classes — good | 171, 174, 191–194 | Pass | — | — | `border-slate-200`, `text-slate-500`, `bg-indigo-50 text-indigo-700`, `bg-slate-100 text-slate-900` | Good slate usage in dropdown |
| 6 | Input has no `role="combobox"` | 232–247 | High | component-specific | M | `<input type="text">` — no combobox ARIA | Add `role="combobox"`, `aria-expanded={isOpen}`, `aria-haspopup="listbox"`, `aria-autocomplete="list"`, `aria-controls` pointing to dropdown list |
| 7 | Dropdown list has no `role="listbox"` | 162–204 | High | component-specific | S | `<div ref={listRef}>` — no ARIA role | Add `role="listbox"` to dropdown container |
| 8 | Option buttons have no `role="option"` | 178–199 | High | component-specific | XS | `<button>` elements | Change to `role="option"` or `role="listbox"` > `li` > `button` pattern |

**Accessibility:** Missing full ARIA combobox pattern (findings #6, #7, #8 — High). Clear button has no accessible label (finding #2 — High). Keyboard navigation implemented (ArrowUp/Down/Enter/Escape) — good functional behavior but ARIA semantics absent.

**Variants:** No `hint` prop (finding #3). No `portal` variant.

**Props API:** `label`, `error`, `required`, `disabled`, `placeholder` — mostly consistent with form components but missing `hint`.

---

### Select

**File:** `src/components/ui/Select.tsx` (69 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Hint text uses `text-gray-500` | 65 | Medium | RC-01 | XS | `text-sm text-gray-500` | `text-sm text-slate-500` |
| 2 | `focus:ring-2` not `focus-visible:ring-2` | 44–49 | Medium | RC-03 | XS | `focus:ring-2 focus:border-transparent` | `focus-visible:ring-2 focus-visible:border-transparent` |
| 3 | `rounded-lg` instead of `rounded-md` | 43 | Medium | RC-02 | XS | `rounded-lg` | `rounded-md` per MASTER.md 5.5 |
| 4 | No portal variant (cyan focus ring) | — | Medium | RC-05 | M | Only indigo focus ring | Add portal variant with `focus:ring-cyan-500` |

**Accessibility:** Label with `htmlFor` — pass. Required marker visual-only — Low gap. Native `<select>` has built-in keyboard/screen reader support — pass.

**Variants:** No portal variant. No `size` variant. Comparable gaps to Input.

**Props API:** Omits `className` from `SelectHTMLAttributes` via `Omit` — intentional but limits consumer overrides. `label`, `error`, `hint`, `required`, `disabled` — consistent with Input/Textarea.

---

### Skeleton

**File:** `src/components/ui/Skeleton.tsx` (444 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Base `Skeleton` uses `bg-gray-200` | 13 | Medium | RC-01 | XS | `animate-pulse bg-gray-200 rounded` | `animate-pulse bg-slate-200 rounded` |
| 2 | `SkeletonText` rows use `bg-gray-200` | 40 | Medium | RC-01 | XS | `h-4 bg-gray-200 rounded animate-pulse` | `bg-slate-200` |
| 3 | `SkeletonAvatar` uses `bg-gray-200` | 67 | Medium | RC-01 | XS | `bg-gray-200 animate-pulse` | `bg-slate-200` |
| 4 | `SkeletonCard` border uses `border-gray-200` | 91 | Medium | RC-01 | XS | `border-gray-200` | `border-slate-200` |
| 5 | `SkeletonCard` header uses `border-gray-100` and `bg-gray-50` | 95, 111 | Medium | RC-01 | XS | `border-b border-gray-100`, `bg-gray-50` | `border-slate-100`, `bg-slate-50` |
| 6 | `SkeletonTableRow` border uses `border-gray-100` | 132 | Medium | RC-01 | XS | `border-b border-gray-100` | `border-slate-100` |
| 7 | `SkeletonTable` header uses `border-gray-200` | 163 | Medium | RC-01 | XS | `border-b border-gray-200` | `border-slate-200` |
| 8 | `SkeletonList` divider uses `divide-gray-100` | 231 | Medium | RC-01 | XS | `divide-y divide-gray-100` | `divide-slate-100` |
| 9 | `SkeletonStatCard` border uses `border-gray-200` | 252 | Medium | RC-01 | XS | `border-gray-200` | `border-slate-200` |
| 10 | `SkeletonDonut` border uses `border-gray-200` | 418 | Medium | RC-01 | XS | `border-[16px] border-gray-200` | `border-slate-200` |
| 11 | `SkeletonChart` bars use `bg-gray-200` | 396 | Medium | RC-01 | XS | `bg-gray-200 rounded-t animate-pulse` | `bg-slate-200` |
| 12 | `animate-pulse` not guarded for `prefers-reduced-motion` | All locations | High | component-specific | S | `animate-pulse` on all skeleton components | All should use `motion-safe:animate-pulse`; this is a global fix |

**Accessibility:** All skeleton components use `aria-hidden="true"` — excellent. No screen reader issues.

**Variants:** Comprehensive — 14+ named skeleton variants for all common patterns. Well-designed library.

**Props API:** Each skeleton variant is a separate named export — clean pattern. All accept `className`. Consistent.

---

### Spinner

**File:** `src/components/ui/Spinner.tsx` (20 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Track uses `border-gray-200` | 15 | Medium | RC-01 | XS | `border-2 border-gray-200 border-t-blue-600` | `border-slate-200 border-t-indigo-600` |
| 2 | Active stroke uses `border-t-blue-600` | 15 | High | RC-02 | XS | `border-t-blue-600` | `border-t-indigo-600` per MASTER.md 1.1 |
| 3 | No `aria-label` / `role` on spinner | 13–17 | High | component-specific | XS | Plain `<div>` spinning — screen readers see nothing | Add `role="status"` and `aria-label="Loading"` to convey loading state |
| 4 | No `prefers-reduced-motion` guard on `animate-spin` | 14 | High | component-specific | XS | `animate-spin` always runs | Use `motion-safe:animate-spin` |

**Accessibility:** No ARIA (finding #3 — High). Screen reader users have no indication content is loading. `animate-spin` not guarded (finding #4 — High).

**Variants:** 3 sizes (sm/md/lg) — adequate.

**Props API:** Single `size` prop — minimal and sufficient.

---

### StatCard

**File:** `src/components/ui/StatCard.tsx` (105 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Default `iconColor` prop uses `bg-blue-50 text-blue-600` | 59 | High | RC-02 | XS | `iconColor = "bg-blue-50 text-blue-600"` | `iconColor = "bg-indigo-50 text-indigo-600"` per MASTER.md 1.1 |
| 2 | Icon `group-hover:scale-105` on icon — anti-pattern adjacent | 73 | Medium | component-specific | XS | `group-hover:scale-105` on icon container | Per RESEARCH.md pitfall guidance: Medium (not Blocking) — isolated to icon, not card layout. Remove or keep as visual polish; does not cause card layout shift |
| 3 | Skeleton card uses `rounded-xl border border-slate-200` — correct | 21 | Pass | — | — | Uses slate palette | Good |
| 4 | Main card uses correct slate palette throughout | 71–103 | Pass | — | — | `border-slate-200`, `text-slate-500`, `text-slate-900`, `text-slate-400` | Excellent — all correct except iconColor default |
| 5 | `animate-chart-enter` sparkline not guarded (via MiniSparkline) | 100 | High | component-specific | XS | MiniSparkline's `animate-chart-enter` | Fix at MiniSparkline level — see MiniSparkline findings |
| 6 | No `prefers-reduced-motion` for number animation | 33–55 | Medium | component-specific | M | `useAnimatedNumber` counts up on mount — no motion guard | Add check to `useAnimatedNumber` hook: if `prefers-reduced-motion`, skip animation |

**Accessibility:** No interactive elements — no focus ring needed. Change indicators use color (green/red) paired with `+/-` sign — passes WCAG 1.4.1 (color + text). Loading state uses `SkeletonStatCard` with `aria-hidden="true"` — pass.

**Variants:** No portal variant (iconColor default always indigo after fix). No `size` variant but StatCard is purpose-specific at `~178px` width per dashboard constraints. Adequate.

**Props API:** `icon`, `iconColor`, `label`, `value`, `change`, `changeLabel`, `loading`, `sparklineData`, `sparklineColor` — comprehensive and well-designed.

---

### StatusBadge

**File:** `src/components/ui/StatusBadge.tsx` (35 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Inherits all Badge color issues | — | High | RC-01, RC-02 | — | StatusBadge renders Badge with Tailwind class strings injected via `className` — inherits gray/yellow/blue Badge issues | Fix at Badge level; StatusBadge inherits fix automatically |
| 2 | `variantMap` uses Tailwind class string as key — fragile pattern | 12–18 | Medium | RC-05 | S | `variantMap["bg-green-100"] = "success"` | Should map semantic entity status strings directly to Badge variants, not via Tailwind class name. Refactor: use `getStatusColor` return value to map to variant directly, or have `getStatusColor` return a `variant` string |
| 3 | Dot indicator may redundantly repeat color information | 31 | Low | component-specific | XS | `<span className="{colors.dot}">` inside badge | Dot adds redundancy to color+text badge — Low concern |

**Accessibility:** Color + text + dot indicator — three signal types — passes WCAG 1.4.1 strongly. No interactive elements. Pass.

**Variants:** Driven by `entityType` + `status` mapping — correct approach for dynamic status display.

**Props API:** `status`, `entityType`, `size`, `className` — clean. Inherits Badge's `className` passthrough.

---

### Table

**File:** `src/components/ui/Table.tsx` (283 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Loading state header uses `border-gray-200` | 66 | Medium | RC-01 | XS | `border-b border-gray-200` | `border-slate-200` |
| 2 | Loading state header uses `text-gray-900` | 70 | Medium | RC-01 | XS | `text-sm font-semibold text-gray-900` | `text-slate-900` |
| 3 | Loading row borders use `border-gray-100` | 81 | Medium | RC-01 | XS | `border-b border-gray-100` | `border-slate-100` |
| 4 | Loading skeleton uses `bg-gray-200` | 89 | Medium | RC-01 | XS | `bg-gray-200 rounded animate-pulse` | `bg-slate-200` |
| 5 | Empty state icon uses `text-gray-300` | 103 | Medium | RC-01 | XS | `text-gray-300` | `text-slate-300` |
| 6 | Empty state text uses `text-gray-500` | 104 | Medium | RC-01 | XS | `text-gray-500` | `text-slate-500` |
| 7 | Mobile view toggle active state uses `bg-gray-900 text-white` | 118–119 | High | RC-01 | XS | `bg-gray-900 text-white` for active toggle | `bg-indigo-600 text-white` per MASTER.md 1.1 — active states use brand primary |
| 8 | Mobile view toggle buttons are `p-1.5` (~28px) — below 44px | 116, 126 | High | component-specific | S | `p-1.5 rounded-md` = ~28px tap target | `p-2.5` minimum or `min-h-[44px] min-w-[44px]` — Mobile is touch context |
| 9 | Mobile card view hover uses `hover:bg-gray-50 active:bg-gray-100` | 147 | Medium | RC-01 | XS | `hover:bg-gray-50 active:bg-gray-100` | `hover:bg-slate-50 active:bg-slate-100` |
| 10 | Mobile card uses `text-gray-900` / `text-gray-600` | 154, 161 | Medium | RC-01 | XS | `text-gray-900`, `text-sm text-gray-600` | `text-slate-900`, `text-slate-600` |
| 11 | Mobile detail columns use `text-gray-500` / `text-gray-900` | 181–185 | Medium | RC-01 | XS | `text-xs text-gray-500`, `text-sm text-gray-900` | `text-slate-500`, `text-slate-900` |
| 12 | Mobile table view headers use `text-gray-900` | 205 | Medium | RC-01 | XS | `text-sm font-semibold text-gray-900` | `text-slate-900` |
| 13 | Mobile table view rows use `border-gray-100` and `text-gray-700` | 218, 226 | Medium | RC-01 | XS | `border-b border-gray-100`, `text-sm text-gray-700` | `border-slate-100`, `text-slate-700` |
| 14 | Desktop table uses `border-gray-200`, `text-gray-900`, `text-gray-700` | 242, 246, 269 | Medium | RC-01 | XS | Multiple gray occurrences in desktop view | Replace all with slate equivalents |
| 15 | No sortable column support | — | Medium | component-specific | L | No `sort` prop or handler on Column interface | Add `sortKey?: string` + `onSort?: (key: string) => void` to Column/TableProps |
| 16 | Row hover uses `hover:bg-gray-50` — should be slate-50 | 219, 261 | Medium | RC-01 | XS | `hover:bg-gray-50` | `hover:bg-slate-50` |

**Accessibility:** Loading state uses `aria-hidden` via skeleton cells — acceptable. Empty state has no `role="status"` — Low. Mobile toggle buttons have `aria-label` — pass. No `<caption>` on table — Low (caller can add via custom column headers).

**Variants:** Mobile dual-mode (cards/table) — good. Missing sortable columns (finding #15 — Medium).

**Props API:** `Column<T>` interface is well-typed. `mobilePriority` system is clever. `rowClassName` function — good. No `id` prop for table accessibility (caption/aria linking) — Low.

---

### Textarea

**File:** `src/components/ui/Textarea.tsx` (57 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Label uses `text-gray-700` | 25 | Medium | RC-01 | XS | `block text-sm font-medium text-gray-700` | `text-slate-700` |
| 2 | Disabled state uses `bg-gray-100 text-gray-500` | 39 | Medium | RC-01 | XS | `disabled:bg-gray-100 disabled:text-gray-500` | `disabled:bg-slate-100 disabled:text-slate-500` |
| 3 | Hint text uses `text-gray-500` | 53 | Medium | RC-01 | XS | `text-sm text-gray-500` | `text-slate-500` |
| 4 | Normal border uses `border-gray-300` | 43 | Medium | RC-01 | XS | `border-gray-300` | `border-slate-300` |
| 5 | Focus ring uses `focus:ring-blue-500` | 42–43 | High | RC-02, RC-03 | XS | `focus:ring-2`, `focus:ring-blue-500` | `focus-visible:ring-2 focus-visible:ring-indigo-500` — two violations in one line |
| 6 | `rounded-lg` instead of `rounded-md` | 37 | Medium | RC-02 | XS | `rounded-lg` | `rounded-md` per MASTER.md 5.5 |
| 7 | No portal variant | — | Medium | RC-05 | M | Only blue/indigo focus ring | Add portal cyan variant |

**Accessibility:** Label uses `htmlFor` — pass. Focus ring present but wrong (finding #5). No `aria-describedby` linking error/hint text to textarea — Low gap.

**Variants:** No portal, no `size` variants. Same gaps as Input/Select.

**Props API:** `label`, `error`, `hint`, `required`, `disabled` — consistent with Input/Select. Gray palette violations throughout.

---

### Toast

**File:** `src/components/ui/Toast.tsx` (199 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Info toast uses `bg-blue-50 border-blue-200 text-blue-600` | 58–63 | High | RC-02 | XS | Blue for info | `bg-indigo-50 border-indigo-200 text-indigo-600` per MASTER.md 1.1 |
| 2 | Toast title and message use `text-gray-900` and `text-gray-700` | 179, 181 | Medium | RC-01 | XS | `text-gray-900`, `text-gray-700` | `text-slate-900`, `text-slate-700` |
| 3 | Dismiss button uses `text-gray-400 hover:text-gray-600 hover:bg-gray-100` | 188 | Medium | RC-01 | XS | Gray palette on dismiss button | `text-slate-400 hover:text-slate-600 hover:bg-slate-100` |
| 4 | `slide-in-from-right-full fade-in` animation not guarded | 171 | High | component-specific | XS | `animate-in slide-in-from-right-full fade-in duration-300` | Guard with `motion-safe:` prefix — or add `prefers-reduced-motion` media query in globals.css |
| 5 | Toast has `role="alert"` — correct | 174 | Pass | — | — | `role="alert"` | Correct ARIA pattern for toast notifications — retain |
| 6 | Dismiss button has `aria-label="Dismiss"` — correct | 189 | Pass | — | — | `aria-label="Dismiss"` | Good |
| 7 | Dismiss button has no `focus-visible:ring` | 188 | Medium | RC-03 | XS | No focus ring on dismiss button | Add `focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2` |
| 8 | Warning variant missing (only success/error/info) | 13 | Medium | component-specific | M | No `warning` type | Add `warning` toast type with amber styling per MASTER.md 1.3 |

**Accessibility:** `role="alert"` — pass. Dismiss button has `aria-label` — pass. Error toasts are manual-dismiss only — pass (important messages persist). No focus management when toast appears — Low.

**Variants:** Missing `warning` type (finding #8 — Medium). Three types cover most use cases.

**Props API:** `ToastProvider` wraps context. `useToast()` hook exports `success()`, `error()`, `info()`. Clean API. Missing `warning()` helper.

---

### Toggle

**File:** `src/components/ui/Toggle.tsx` (56 lines)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Checked state uses `bg-blue-600` | 38 | High | RC-02 | XS | `bg-blue-600` | `bg-indigo-600` (or `bg-[var(--color-primary)]`) per MASTER.md 1.1 |
| 2 | Unchecked state uses `bg-gray-200` | 38 | Medium | RC-01 | XS | `bg-gray-200` | `bg-slate-200` |
| 3 | Focus ring uses `focus:ring` not `focus-visible:ring` | 36 | Medium | RC-03 | XS | `focus:ring-2 focus:ring-blue-500 focus:ring-offset-2` | `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` |
| 4 | `role="switch"` and `aria-checked` present — correct | 29, 30 | Pass | — | — | `role="switch" aria-checked={checked}` | Correct ARIA switch pattern — retain |
| 5 | No `label` prop | — | Medium | RC-05 | M | No `label` text prop | Add optional `label?: string` + `labelPosition?: "left" | "right"` for accessibility and convenience |
| 6 | No portal color variant | — | Medium | RC-05 | M | Only indigo/blue checked state | Add `variant?: "admin" | "portal"` to support cyan portal variant |

**Accessibility:** `role="switch"` + `aria-checked` — pass. Disabled via `disabled` attribute — pass. Loading state shows spinner but no `aria-busy` — Low. Focus ring uses wrong pseudo-class (finding #3 — Medium). No text label (finding #5 — Medium).

**Variants:** No label, no portal color variant. Two sizes (sm/md) — adequate.

**Props API:** `checked`, `onChange`, `disabled`, `loading`, `size`, `className` — clean. Missing `label` prop reduces accessibility and usability.

---

## Section 2: Scanner Components (10)

> **Scanner Floor Rubric (MASTER.md Section 7 hard gates applied to every component below):**
> - 44px+ tap targets — Blocking if violated
> - 16px+ body text minimum (`text-base`) — Blocking for primary action text; High for secondary
> - Maximum 3 primary actions per screen
> - WCAG AA contrast minimum
> - No precision gestures (no hover-only interactions, no small checkboxes)

---

### PickingScanner

**File:** `src/components/internal/PickingScanner.tsx` (819 lines)
**Serves:** `/outbound/[id]` (picking workflow)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Audio toggle button is `p-2` (~32px) — below 44px tap target | 434–440 | Blocking | scanner-specific | XS | `p-2 rounded-lg` — raw `<button>` (not Button component) = ~32px | `p-3 min-h-[44px] min-w-[44px]` per MASTER.md Section 7 |
| 2 | Pick list item rows have `ghost`/`sm` size "Pick" button — `size="sm"` is ~32px | 753–763 | Blocking | scanner-specific | XS | `<Button variant="ghost" size="sm">Pick</Button>` on scanner route | Remove `size="sm"` or set `size="md"` minimum for scanner context |
| 3 | SKU text in pick list uses `text-sm font-mono` | 743 | High | RC-04 | XS | `text-sm text-gray-500 font-mono` (14px) | `text-base text-slate-500 font-mono` — secondary info but on scanner screen, 16px minimum for readability |
| 4 | "picked" label uses `text-xs` | 751 | High | RC-04 | XS | `text-xs text-gray-500` (12px) | `text-sm text-slate-500` minimum — secondary text below label |
| 5 | Location hint badges use `text-xs` | 772–776 | High | RC-04 | XS | `text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded` | `text-sm` minimum for warehouse floor readability |
| 6 | Progress bar subtitle uses `text-sm` | 427 | High | RC-04 | XS | `text-sm text-gray-500` for unit count | `text-base text-slate-500` — this is primary progress information |
| 7 | Loading spinner uses `border-blue-600` | 414 | High | RC-02 | XS | `border-4 border-blue-600 border-t-transparent` | `border-indigo-600 border-t-transparent` |
| 8 | Gray palette throughout | 425, 427, 437, 443, 443, 678, 700, 724 | Medium | RC-01 | S | `text-gray-900`, `text-gray-500`, `bg-gray-100`, `bg-gray-200`, `text-gray-300`, `text-gray-400`, `text-gray-500` | Replace all `gray-*` with `slate-*` |
| 9 | Blue used for pending/active state | 429, 436, 567, 636, 639–640, 644 | High | RC-02 | S | `text-blue-600`, `bg-blue-100`, `border-blue-200`, `text-blue-600`, `text-blue-700`, `bg-blue-50` throughout active states | `indigo-*` equivalents per MASTER.md 1.1 |
| 10 | Product name in scan result is `font-semibold text-gray-900 text-lg` — passes | 556 | Pass | — | — | `text-lg` = 18px — passes scanner floor minimum | Retain |
| 11 | "Complete" success text uses `text-sm` alongside icon | 451–453 | High | RC-04 | XS | `text-green-600 text-sm font-medium` | `text-base` minimum for scanner feedback |
| 12 | More than 3 primary actions visible simultaneously in `found` state | 603–673 | High | scanner-specific | M | "Add 1", "Add 5", "Add All", "Scan Next", "Confirm Pick" = 5 primary actions at once | Consolidate to scanner workflow pattern: single confirm action + stepper; limit visible CTAs to 3 |

**Scanner Rubric Summary:** Tap target violations on audio toggle and "Pick" buttons (Blocking). Text size violations on SKU, quantity label, location hints, progress subtitle (High). Primary action count exceeds 3 in found state (High). Blue brand used instead of indigo throughout (High).

**Accessibility:** No ARIA on native `<button>` audio toggle — needs `aria-label`. `BarcodeScanner` component handles its own ARIA. Product scan success state has no `aria-live` announcement.

---

### PickScanner

**File:** `src/components/internal/PickScanner.tsx` (582 lines)
**Serves:** `/tasks/pick` (task-driven pick flow)
**Note on deprecation status:** PickScanner is a more sophisticated replacement for PickingScanner. PickScanner integrates `warehouse-tasks` API (`getPickListItems`, `recordPickItem`, `recordShortPick`), `scan-events` logging, and `inventory-transactions`. PickingScanner uses direct Supabase queries and lacks these integrations. PickScanner appears to be the current/active implementation for task-driven picking. Both files exist; PickingScanner serves order-level picking, PickScanner serves task-driven picking — they are not duplicates but different use cases.

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Volume2 audio toggle button `variant="ghost" size="sm"` — `size="sm"` is ~32px | 406–410 | Blocking | scanner-specific | XS | `<Button variant="ghost" size="sm">` | Remove `size="sm"` or use `min-h-[44px] min-w-[44px]` |
| 2 | Decrement button `<Button size="sm" variant="secondary">-</Button>` — ~32px | 506 | Blocking | scanner-specific | XS | `size="sm"` stepper buttons | `size="md"` minimum for scanner stepper |
| 3 | Increment button `<Button size="sm" variant="secondary">+</Button>` — ~32px | 507 | Blocking | scanner-specific | XS | `size="sm"` stepper buttons | `size="md"` minimum for scanner stepper |
| 4 | "Pick All" button `size="sm"` — ~32px | 508 | Blocking | scanner-specific | XS | `size="sm"` button in quantity controls | `size="md"` minimum |
| 5 | SKU as primary identifier in pick list uses `font-medium` but text-base implied — check: `{item.product.sku}` in list uses default (16px from Card context) — pass | 565 | Pass | — | — | Default text size inherits from context | No violation in list |
| 6 | Secondary product name below SKU uses `text-sm` | 566 | High | RC-04 | XS | `text-sm text-gray-500` | `text-base text-slate-500` — product name on scanner is primary identification info |
| 7 | Item count text uses `text-sm` | 403 | High | RC-04 | XS | `text-sm text-gray-500` progress indicator | `text-base text-slate-500` |
| 8 | Progress bar is `h-2` — purely visual, no accessible label | 417–424 | Medium | component-specific | XS | `<div class="w-full bg-gray-200 ... h-2 ...">` — no aria-label | Add `aria-label="Pick progress"` + `aria-valuenow`/`aria-valuemax` attributes |
| 9 | Gray palette throughout | 386, 403, 417, 503, 546, 549, 565, 566 | Medium | RC-01 | S | `bg-gray-200`, `dark:bg-gray-700`, `text-gray-900`, `text-gray-500`, `bg-gray-50`, `dark:bg-gray-800` | Replace `gray-*` with `slate-*` (dark: variants use gray — also needs slate) |
| 10 | Blue used for active/selected state | 419, 453–454, 464, 544–545 | High | RC-02 | S | `bg-blue-600`, `border-blue-500`, `bg-blue-50 dark:bg-blue-900/20`, `border-blue-200 dark:border-blue-800` | `indigo-*` equivalents |
| 11 | Short pick button uses amber — correct for warning action | 524–528 | Pass | — | — | `text-amber-600 border-amber-300 hover:bg-amber-50` | Correct per MASTER.md 1.3 — amber for warnings |
| 12 | Dark mode classes throughout (`dark:text-white`, `dark:bg-gray-*`) — MASTER.md does not define dark mode | 398, 447, 459, 488, 538, 564 | Medium | RC-05 | M | `dark:text-white`, `dark:bg-gray-800`, `dark:text-gray-400` throughout | Remove dark mode classes — admin app does not support dark mode per MASTER.md |

**Scanner Rubric Summary:** Four `size="sm"` button violations on scanner route (Blocking). Secondary text uses `text-sm` where `text-base` required (High). Dark mode classes are not part of the design system (Medium).

**Accessibility:** Progress bar has no ARIA progressbar role. `BarcodeScanner` handles its own ARIA. Message display has no `role="alert"` for scan feedback.

---

### PackScanner

**File:** `src/components/internal/PackScanner.tsx` (500 lines)
**Serves:** `/outbound/[id]` (packing workflow)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Volume2 audio toggle `variant="ghost" size="sm"` — ~32px | 341–346 | Blocking | scanner-specific | XS | `<Button variant="ghost" size="sm">` on scanner route | Remove `size="sm"` or `min-h-[44px]` |
| 2 | Remove-from-carton `-1` button `variant="ghost" size="sm"` — ~32px | 395–400 | Blocking | scanner-specific | XS | `size="sm"` with just "-1" text inside carton | `size="md"` minimum |
| 3 | Carton count text uses `text-sm` | 339 | High | RC-04 | XS | `text-sm text-gray-500` for "X cartons" header | `text-base text-slate-500` |
| 4 | Carton item count uses `text-sm` | 379 | High | RC-04 | XS | `text-sm text-gray-500` "X items" in carton header | `text-base text-slate-500` |
| 5 | SKU label in carton contents uses `font-medium` default — passes | 393 | Pass | — | — | `font-medium text-gray-900` default = 16px | Passes scanner floor minimum |
| 6 | Carton stage text uses `text-sm` | 492 | High | RC-04 | XS | `text-sm text-gray-500 capitalize` for carton stage | `text-base` |
| 7 | Product name under SKU uses `text-sm` in items list | 465 | High | RC-04 | XS | `text-sm text-gray-500` product name in items-to-pack list | `text-base text-slate-500` |
| 8 | Gray palette throughout | 333, 339, 346, 379, 457, 459, 465, 468, 479, 488, 492 | Medium | RC-01 | S | `text-gray-900`, `text-gray-500`, `bg-gray-50`, `dark:bg-gray-800`, `bg-gray-200` throughout | All `gray-*` → `slate-*` |
| 9 | Blue used for audio active state | 346 | High | RC-02 | XS | `text-blue-600` for audio-on state | `text-indigo-600` |
| 10 | Dark mode classes throughout | 333, 375, 392, 453, 459, 465, 468, 479, 487, 492 | Medium | RC-05 | M | `dark:text-white`, `dark:bg-gray-*` throughout | Remove — admin app does not support dark mode |
| 11 | Empty state for no cartons found is centered, adequately sized | 339 | Pass | — | — | Card structure with adequate sizing | No violation |

**Scanner Rubric Summary:** Two `size="sm"` tap target violations (Blocking). Multiple `text-sm` secondary text violations on scanner route (High). Dark mode and gray palette (Medium).

**Accessibility:** Carton contents list has no ARIA list role. Status message has no `role="alert"`. Scan result feedback is visual-only.

---

### ShipScanner

**File:** `src/components/internal/ShipScanner.tsx` (399 lines)
**Serves:** `/outbound/[id]` (shipping workflow)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Volume2 audio toggle `variant="ghost" size="sm"` — ~32px | 243–247 | Blocking | scanner-specific | XS | `<Button variant="ghost" size="sm">` | `size="md"` or `min-h-[44px]` |
| 2 | Order number in header uses `text-sm` | 238 | High | RC-04 | XS | `text-sm text-gray-500 "Order: {orderNumber}"` | `text-base text-slate-500` — order number is critical identifying info on scanner |
| 3 | Carton scan progress text uses `text-sm` | 271 | High | RC-04 | XS | `text-sm text-gray-600` "Cartons verified" + count | `text-base text-slate-600` |
| 4 | Carton verified/pending status uses `text-sm` | 330–333 | High | RC-04 | XS | `text-sm text-green-600` / `text-sm text-gray-500` | `text-base` for status indicators on scanner |
| 5 | Carrier/tracking label uses `text-sm` | 352, 363 | High | RC-04 | XS | `text-sm text-gray-600` form labels | `text-base text-slate-600` — warehouse floor workers reading form labels |
| 6 | Carton scan confirmation allows shipping without carrier/tracking — correct gating in code | 378 | Pass | — | — | Button disabled until carrier + tracking filled | Good UX gate |
| 7 | Gray palette throughout | 232, 238, 243, 247, 271, 274, 277, 303, 316, 330, 333, 339, 350, 352, 363 | Medium | RC-01 | S | Pervasive `gray-*` usage | All `gray-*` → `slate-*` |
| 8 | Blue used for progress bar and audio state | 247, 279 | High | RC-02 | XS | `text-blue-600`, `bg-blue-600` | `text-indigo-600`, `bg-indigo-600` |
| 9 | Dark mode classes throughout | 232, 248, 316, 327, 332, 348, 356, 366 | Medium | RC-05 | M | `dark:text-white`, `dark:bg-*` | Remove |
| 10 | Carrier and tracking Input components are unformatted `<Input>` — no `size` variant for scanner context | 355–370 | High | RC-04 | S | Standard Input with default `py-2` | Scanner inputs should use `py-3 text-lg` minimum per MASTER.md Section 7 — add `scanner` size variant to Input |
| 11 | "Confirm Shipment" button uses `size="lg"` — correct | 377–390 | Pass | — | — | `size="lg"` with full width — adequate height | No violation on primary action CTA |

**Scanner Rubric Summary:** One tap target violation (audio toggle — Blocking). Five text-sm violations on secondary info (High). Carrier/tracking inputs lack scanner-appropriate sizing (High). Blue brand color throughout (High).

**Accessibility:** Status message has no `role="alert"`. Empty carton state has no ARIA role. Shipping confirmation is gated behind all-scanned + carrier + tracking — correct.

---

### PutawayScanner

**File:** `src/components/internal/PutawayScanner.tsx` (576 lines)
**Serves:** `/tasks/putaway`

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Volume2 audio toggle `variant="ghost" size="sm"` — ~32px | 411–415 | Blocking | scanner-specific | XS | `<Button variant="ghost" size="sm">` | `size="md"` or `min-h-[44px]` |
| 2 | Quantity `-` stepper `size="sm"` — ~32px | 475 | Blocking | scanner-specific | XS | `<Button size="sm" variant="secondary">-</Button>` | `size="md"` |
| 3 | Quantity `+` stepper `size="sm"` — ~32px | 477 | Blocking | scanner-specific | XS | `<Button size="sm" variant="secondary">+</Button>` | `size="md"` |
| 4 | Task info subtitle uses `text-xs` | 392 | Blocking | RC-04 | XS | `text-xs text-slate-500` for product name and qty in task banner | `text-base text-slate-500` — task context is primary information |
| 5 | LPN container type uses `text-sm` | 489 | High | RC-04 | XS | `text-sm text-gray-500 capitalize` for container type below LPN number | `text-base text-slate-500` |
| 6 | LPN contents list uses `text-sm` | 495–499 | High | RC-04 | XS | `<p class="text-gray-700 dark:text-gray-300">` using default text-sm context | `text-base text-slate-700` |
| 7 | Scan instructions text uses `text-sm` | 437 | High | RC-04 | XS | `text-sm text-gray-600` step instruction text | `text-base text-slate-600` — instructions are primary guidance on scanner screen |
| 8 | Recent putaways list uses `text-sm` | 566 | High | RC-04 | XS | `text-sm py-2 border-b` — putaway history list | `text-base` |
| 9 | Task info uses `text-xs` for product name — Blocking because product name is primary identifier | 392 | Blocking | RC-04 | XS | `text-xs text-slate-500` (12px) — product name in task banner | `text-base` — same as finding #4 but flagged separately for severity clarity |
| 10 | Gray palette throughout | 406, 415, 437, 465, 469, 489, 495, 503, 563 | Medium | RC-01 | S | `text-gray-900`, `text-gray-600`, `text-gray-400`, `bg-gray-50`, `dark:bg-gray-800` | All `gray-*` → `slate-*` |
| 11 | Blue used for audio active state | 415 | High | RC-02 | XS | `text-blue-600` for audio-on icon | `text-indigo-600` |
| 12 | Dark mode classes throughout | 406, 415, 465, 469, 484, 489, 495, 503, 538, 562, 563 | Medium | RC-05 | M | `dark:text-white`, `dark:bg-gray-*` | Remove |
| 13 | Loading spinner uses `border-indigo-600` — correct | 374–376 | Pass | — | — | `border-b-2 border-indigo-600` | Correct per MASTER.md 1.1 |

**Scanner Rubric Summary:** Three `size="sm"` tap target violations (Blocking). Task banner uses `text-xs` for product name — primary identifier (Blocking). Multiple `text-sm`/`text-xs` secondary text violations (High).

**Accessibility:** Task info card has no `aria-label`. Status messages have no `role="alert"`. Loading state has no `aria-label="Loading task"`.

---

### InspectionScanner

**File:** `src/components/internal/InspectionScanner.tsx` (417 lines)
**Serves:** `/tasks/inspection`

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Checklist pass/fail buttons use `size="sm"` — ~32px | 314–329 | Blocking | scanner-specific | XS | `<Button variant="..." size="sm">` for Pass/Fail buttons | Inspection checklist buttons require `size="md"` minimum — gloved warehouse workers need 44px |
| 2 | Checklist criterion label uses default text (not `text-sm`) — passes in context | 306 | Pass | — | — | `font-medium text-slate-900` — inherits base text | Passes |
| 3 | Product detail uses `text-sm text-slate-600` | 241–246 | High | RC-04 | XS | `text-sm text-slate-600` for SKU, Quantity, Location | `text-base text-slate-600` — inspection details are primary reference during task |
| 4 | Required tag uses `text-xs text-red-600` | 308 | High | RC-04 | XS | `text-xs text-red-600 font-medium` for "Required" label | `text-sm text-red-600` minimum |
| 5 | Audio toggle button `variant="secondary" size="sm"` — ~32px | 223–230 | Blocking | scanner-specific | XS | `size="sm"` audio toggle | `size="md"` |
| 6 | "Verified" badge uses `text-sm` | 250–253 | High | RC-04 | XS | `text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg` — "Verified" confirmation | `text-base` for scan confirmation feedback |
| 7 | Submit button uses `min-w-[200px]` with `variant="primary"` — no size specified | 407–413 | High | scanner-specific | XS | Default button size — check Button `md` = `py-2` (~40px) | `size="lg"` or explicit `min-h-[48px]` for primary submit action on scanner |
| 8 | Result summary counts use `text-sm` | 385–387 | High | RC-04 | XS | `text-sm text-slate-600` for "X passed, X failed" summary | `text-base text-slate-600` |
| 9 | Uses correct slate palette throughout most of component | 234, 241, 263, 270, 289, 303, 381 | Pass | — | — | `text-slate-900`, `text-slate-600`, `text-slate-500`, `border-slate-200` | Excellent — uses slate correctly unlike most other scanners |
| 10 | Uses correct indigo brand color for icons and controls | 228, 236, 266, 289 | Pass | — | — | `text-indigo-600`, `bg-indigo-50`, `bg-indigo-50 rounded-lg` | Correct per MASTER.md 1.1 |
| 11 | `(window as any).webkitAudioContext` uses unsafe any cast | 40 | Medium | component-specific | XS | `as any` for webkitAudioContext | Use same pattern as other scanners: `(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext` |

**Scanner Rubric Summary:** Two `size="sm"` tap target violations — notably on Pass/Fail checklist buttons which are the primary warehouse floor action (Blocking). Text size violations on product detail and feedback (High). InspectionScanner uses slate/indigo correctly — best palette discipline of all scanner components.

**Accessibility:** Checklist items are in a generic `<div>` — add `role="group"` with `aria-label` per criterion. Pass/Fail buttons have icon-only SVG (`CheckCircle`, `XCircle`) — need `aria-label="Pass"` / `aria-label="Fail"`.

---

### ReceivingScanner

**File:** `src/components/internal/ReceivingScanner.tsx` (825 lines)
**Serves:** `/inbound/[id]`

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Audio toggle raw `<button>` is `p-2` (~32px) | 339–345 | Blocking | scanner-specific | XS | Raw `<button class="p-2 rounded-lg">` | `min-h-[44px] min-w-[44px]` — same pattern as PickingScanner |
| 2 | Lot scan trigger button (scan lot icon) has no minimum size guarantee | 498–501 | Blocking | scanner-specific | XS | `<Button variant="secondary">` around `ScanLine w-4 h-4` with no explicit min size | Add `min-h-[44px]` class to lot scan button |
| 3 | Reset calendar button is bare `<button>` with `px-3 py-2` (~36px?) | 524–530 | Blocking | scanner-specific | XS | Raw `<button class="px-3 py-2 text-sm text-purple-600">` = borderline tap target | `min-h-[44px] min-w-[44px]` and `text-base` |
| 4 | Product name in lot entry uses `font-semibold text-gray-900` — passes | 445 | Pass | — | — | `font-semibold text-gray-900` = 16px+ from semantic context | Passes |
| 5 | SKU text in lot entry uses `text-sm font-mono` | 451 | High | RC-04 | XS | `text-sm text-gray-500 font-mono` | `text-base text-slate-500 font-mono` |
| 6 | "Remaining" qty uses `text-sm` | 453 | High | RC-04 | XS | `text-sm text-gray-600` | `text-base text-slate-600` |
| 7 | Lot form label text uses `text-sm` | 468, 509 | High | RC-04 | XS | `block text-sm font-medium text-gray-700` for "Lot Number" / "Expiration Date" labels | `text-base font-medium text-slate-700` |
| 8 | Calendar input uses `text-sm` and non-component `<input>` | 519–523 | High | RC-04 | XS | `px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500` raw input | Use Input component; add `text-base`; focus ring should use indigo not purple |
| 9 | Expiration date focus ring uses purple — not in brand | 520–522 | High | RC-02 | XS | `focus:ring-purple-500 focus:border-purple-500` | `focus:ring-indigo-500 focus:border-indigo-500` per MASTER.md 1.1 |
| 10 | Purple used for lot-tracked state (`bg-purple-50`, `text-purple-700`) | 425, 446, 447, 527, 781 | High | RC-02 | M | Purple is not in MASTER.md brand palette | Use `bg-indigo-50 text-indigo-700` for lot-tracked indicator, or document purple as extended semantic color in MASTER.md |
| 11 | Progress bar subtitle uses `text-sm` | 333 | High | RC-04 | XS | `text-sm text-gray-500` unit progress text | `text-base text-slate-500` |
| 12 | Pick list item SKU uses `text-sm` | 788 | High | RC-04 | XS | `text-sm text-gray-500 font-mono` in expected items list | `text-base` |
| 13 | Gray palette throughout | 329, 333, 339, 343, 347, 396, 451, 468, 509, 524, 527, 563, 716, 756, 759 | Medium | RC-01 | S | Pervasive `gray-*` | All `gray-*` → `slate-*` |
| 14 | Blue used throughout | 333, 341, 343, 562, 634 | High | RC-02 | S | `text-blue-600`, `bg-blue-100`, `bg-blue-50`, `text-blue-700` | `indigo-*` |
| 15 | "Complete Receiving" button has no `size="lg"` | 817–820 | High | scanner-specific | XS | Default size button for final completion action | `size="lg"` for primary scanner completion action |

**Scanner Rubric Summary:** Three tap target violations including raw `<button>` elements (Blocking). Extensive text size violations across lot entry flow (High). Purple is an off-brand color for lot-tracking indicators (High). Calendar input bypasses the Input component and uses hardcoded purple focus ring (High).

**Accessibility:** Lot entry form has no `<fieldset>`/`<legend>`. Audio toggle `<button>` has no `aria-label`. Calendar input is a raw `<input type="date">` with no label association.

---

### PalletBreakdownScanner

**File:** `src/components/internal/PalletBreakdownScanner.tsx` (523 lines)
**Serves:** `/inventory/pallet-breakdown`

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Raw `<input>` scan fields are `py-2 text-lg` — text-lg = 18px — passes | 325–333, 349–354, 402–413 | Pass | — | — | `text-lg focus:ring-2` — text size passes scanner floor | Text passes but `py-2` may not reach 44px height depending on font |
| 2 | Raw `<input>` elements bypass Input component — height check: `py-2` with `text-lg` = ~44px including padding | 325 | Pass | — | — | `px-3 py-2 border rounded-md text-lg` | Borderline pass — acceptable for text-lg context |
| 3 | Number input for quantity uses `text-lg` — passes | 402–413 | Pass | — | — | `text-lg focus:ring-2 focus:ring-blue-500` | Text size passes; focus ring uses blue |
| 4 | Quantity input focus ring uses `focus:ring-blue-500` | 332, 354, 412 | High | RC-02 | XS | `focus:ring-blue-500` on all raw inputs | `focus:ring-indigo-500` per MASTER.md 1.1 |
| 5 | Step indicator dots `w-2 h-2` — too small for gloved tapping | 263–267 | High | scanner-specific | XS | `w-2 h-2 rounded-full` step indicator dots | Step indicators should not be interactive but their tiny size adds visual noise — acceptable if not clickable |
| 6 | Product selection buttons `p-3` with `hover:bg-blue-50 hover:border-blue-300` | 358–380 | High | RC-02 | XS | `hover:bg-blue-50 hover:border-blue-300` | `hover:bg-indigo-50 hover:border-indigo-300` |
| 7 | Product selection buttons: `p-3` height check — border-radius content ~ 44px? | 358 | Pass | — | — | `p-3` on `<button>` = `12px*2 + content` — product name + sku ≈ 48px minimum | Passes scanner tap target |
| 8 | "1 unit", "1 case", "All" quick buttons use `variant="ghost" size="sm"` — ~32px | 416–430 | Blocking | scanner-specific | XS | `size="sm"` quick-select buttons | `size="md"` minimum |
| 9 | "Start Over" uses `variant="ghost" size="sm"` — ~32px | 513 | Blocking | scanner-specific | XS | `<Button variant="ghost" size="sm">Start Over</Button>` | `size="md"` |
| 10 | "Done" uses `variant="secondary" size="sm"` — ~32px | 517 | Blocking | scanner-specific | XS | `<Button variant="secondary" size="sm">Done</Button>` | `size="md"` |
| 11 | Step label text uses `text-sm` | 277 | High | RC-04 | XS | `text-sm font-medium text-gray-600` for step label | `text-base text-slate-600` |
| 12 | Pallet info text uses `text-xs` | 308 | Blocking | RC-04 | XS | `text-xs text-gray-500` for "X products | X total units" | `text-base text-slate-500` — pallet content summary is primary reference information |
| 13 | Success banner text uses `text-sm` | 284 | High | RC-04 | XS | `text-sm font-medium` for success confirmation | `text-base font-medium` |
| 14 | Error banner text uses `text-sm` | 293 | High | RC-04 | XS | `text-sm` for error message | `text-base` — error feedback must be readable on warehouse floor |
| 15 | Gray palette throughout | 277, 303, 308, 316, 332, 354, 364, 397, 412, 432, 434, 512 | Medium | RC-01 | S | `text-gray-600`, `text-gray-900`, `bg-gray-50`, `border-gray-300`, `bg-gray-300`, `text-gray-500`, `text-gray-400` | All `gray-*` → `slate-*` |
| 16 | Confirm card uses `bg-blue-50 border-blue-200` | 471 | High | RC-02 | XS | `bg-blue-50 border-blue-200` for confirmation display | `bg-indigo-50 border-indigo-200` |
| 17 | Error dismiss button `&times;` is a raw inline element with no tap target | 295–297 | Blocking | scanner-specific | XS | `<button onClick={() => setError("")} class="ml-auto text-red-400 hover:text-red-600">×</button>` — no padding | `min-h-[44px] min-w-[44px] flex items-center justify-center` |
| 18 | Bottom border separator uses `border-gray-200` | 512 | Medium | RC-01 | XS | `border-t border-gray-200` | `border-slate-200` |

**Scanner Rubric Summary:** Five tap target violations: `size="sm"` quick buttons, "Start Over", "Done", error dismiss (Blocking). Pallet info uses `text-xs` for primary reference (Blocking). Blue brand used throughout (High).

**Accessibility:** Progress step dots have no `aria-label` or `aria-current="step"`. Success/error banners have no `role="alert"`. Product selection list has no `role="listbox"`.

---

### ScannerModal

**File:** `src/components/internal/ScannerModal.tsx` (292 lines)
**Serves:** All scanner routes (modal wrapper for barcode lookup)

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| 1 | Action buttons explicitly set `min-h-[48px]` — correct | 227, 231 | Pass | — | — | `className="flex-1 min-h-[48px]"` on both action buttons | Correct — this is the only scanner component that explicitly enforces 48px minimum |
| 2 | Loading state spinner uses `border-blue-600` | 144 | High | RC-02 | XS | `border-4 border-blue-600 border-t-transparent` | `border-indigo-600 border-t-transparent` |
| 3 | Product info icon uses `bg-blue-100 text-blue-600` | 162 | High | RC-02 | XS | `bg-blue-100 … text-blue-600` for product icon container | `bg-indigo-50 text-indigo-600` per MASTER.md 1.1 |
| 4 | Scanned code uses `font-mono text-sm` | 170 | High | RC-04 | XS | `text-sm text-gray-500 font-mono` for scanned barcode | `text-base text-slate-500 font-mono` — scanner context |
| 5 | Gray palette throughout | 160, 184, 187, 204, 208, 211, 215, 219 | Medium | RC-01 | S | `bg-gray-50`, `text-gray-600`, `text-gray-900`, `text-gray-400`, `text-gray-700`, `text-gray-400` | All `gray-*` → `slate-*` |
| 6 | Inventory table headers use `text-sm font-medium text-gray-600` | 184 | High | RC-04 | XS | `text-sm` column headers | `text-base font-medium text-slate-600` — location names are primary scanner reference |
| 7 | Inventory location name uses `text-gray-900` default — passes | 191 | Pass | — | — | Default size in table row context | Passes |
| 8 | Available quantity color is conditional (green/red) — correct | 196 | Pass | — | — | `text-green-600` / `text-red-600` for available quantity | Correct semantic color per MASTER.md |
| 9 | Looking up product state uses `text-gray-600` for status text | 145–146 | Medium | RC-01 | XS | `text-gray-600` | `text-slate-600` |
| 10 | Product Not Found heading uses correct `text-lg font-semibold text-gray-900` — passes size | 244 | Pass | — | — | `text-lg` = 18px — passes scanner minimum | Size passes but color should be `text-slate-900` |
| 11 | Wrapped in Modal component which has `role="dialog"` gap | — | High | component-specific | — | ScannerModal uses Modal component which lacks `role="dialog"` + `aria-modal` | Fix at Modal level — ScannerModal inherits fix automatically |
| 12 | "Scan Another" and "Scan Again" buttons correctly set to `min-h-[48px]` | 255, 259 | Pass | — | — | `min-h-[48px]` on all secondary action buttons | Correct pattern — all scanner components should follow this |

**Scanner Rubric Summary:** Action buttons correctly sized to `min-h-[48px]` — only scanner component that does this correctly (Pass). Blue spinner and product icon use wrong brand color (High). Inventory header text uses `text-sm` in scanner context (High). ScannerModal is the positive template for tap target sizing in scanner workflows.

**Accessibility:** Inherits Modal accessibility gaps (`role="dialog"` missing). Loading state has no `aria-live` region. "Product Found" success badge has no `role="status"`.

---

### BarcodeScanner (Scanner Rubric Overlay)

**File:** `src/components/ui/BarcodeScanner.tsx` (479 lines)
**Cross-reference:** Section 1 has full 5-dimension audit. This entry adds scanner floor rubric overlay findings only.

| # | Finding | Lines | Severity | Root Cause | Effort | Current | Recommended |
|---|---------|-------|----------|------------|--------|---------|-------------|
| S1 | Instruction text `text-sm` on scanner route — Blocking | 375 | Blocking | RC-04 | XS | `text-sm text-gray-600` | `text-base text-slate-600` — already documented in Section 1 as finding #1 |
| S2 | Secondary instruction text `text-xs` | 378–380 | Blocking | RC-04 | XS | `text-xs text-gray-400` | `text-sm text-slate-500` — secondary acceptable at 14px but `text-xs` (12px) is Blocking |
| S3 | Modal close button target — check: button with `p-1` = ~26px | 440 | Blocking | scanner-specific | XS | `p-1 hover:bg-gray-100 rounded` — close button inside BarcodeScanner modal | `min-h-[44px] min-w-[44px]` for close button on scanner route |
| S4 | Torch toggle button `p-2` (~32px) plus icon margin | 357–370 | High | scanner-specific | XS | Button with `p-2` inside — check: total ~32–36px | `min-h-[44px]` for torch toggle — borderline |
| S5 | No `prefers-reduced-motion` guard on camera start animation | 258 | High | component-specific | XS | Loading animation runs unconditionally | Guard with `motion-safe:` — documented in cross-cutting section |

**Scanner Rubric Summary:** See Section 1 findings #1 and #2 (Blocking text size violations). Additional scanner rubric findings: close button and torch button may not meet 44px minimum (Blocking/High). Already the most comprehensive scanner infrastructure — fixes here cascade to all scanner components.

---

## Section 3: Cross-Cutting (globals.css + Systemic Patterns)

> These findings affect multiple components and should be fixed once at the source, not duplicated per component in Phase 3 page audits. Page audits should reference this section as "source: cross-cutting — see Section 3."

---

### CC-01: Missing `prefers-reduced-motion` in globals.css

**Scope:** All animated components in the application.
**File:** `src/app/globals.css`
**Severity:** High
**Effort:** S

**Finding:** `globals.css` defines the following animation keyframes with no `@media (prefers-reduced-motion: reduce)` block to disable or simplify them:

- `animate-modal-scale-up` — Modal open animation
- `animate-modal-scale-down` — Modal close animation
- `animate-widget-enter` — Dashboard widget entry animation
- `animate-chart-enter` — All 11 Recharts chart wrapper animations
- `slide-in-from-right` — Toast notification entry (via `animate-in slide-in-from-right-full`)

**Components directly affected:**

| Component | Animation | Documented In |
|-----------|-----------|---------------|
| Modal | `animate-modal-scale-up/down` | Section 1 — Modal finding #5 |
| BulletChart | `animate-chart-enter` | Section 1 — BulletChart finding #3 |
| CalendarHeatmap | `animate-chart-enter` | Section 1 — CalendarHeatmap finding #5 |
| DonutChart | `animate-chart-enter` | Section 1 — DonutChart finding #3, #4 |
| GaugeChart | `animate-chart-enter` | Section 1 — GaugeChart finding #3 |
| HorizontalBarChart | `animate-chart-enter` | Section 1 — HorizontalBarChart finding #2, #3 |
| MiniBarChart | `animate-chart-enter` | Section 1 — MiniBarChart finding #2, #3 |
| MiniLineChart | `animate-chart-enter` | Section 1 — MiniLineChart finding #2, #3 |
| MiniSparkline | `animate-chart-enter` | Section 1 — MiniSparkline finding #2, #3 |
| ScatterChart | `animate-chart-enter` | Section 1 — ScatterChart finding #2, #3 |
| StackedBarChart | `animate-chart-enter` | Section 1 — StackedBarChart finding #2, #3 |
| TreemapChart | `animate-chart-enter` | Section 1 — TreemapChart finding #2 |
| WaterfallChart | `animate-chart-enter` | Section 1 — WaterfallChart finding #2 |
| Toast | `slide-in-from-right-full` | Section 1 — Toast finding #4 |
| Skeleton | `animate-pulse` (Tailwind utility) | Section 1 — Skeleton finding #12 |
| ProductImage | `animate-pulse` | Section 1 — ProductImage finding #5 |
| Spinner | `animate-spin` | Section 1 — Spinner finding #4 |
| StatCard | `useAnimatedNumber` hook | Section 1 — StatCard finding #6 |

**Recommended fix (single globals.css change):**

```css
@media (prefers-reduced-motion: reduce) {
  .animate-modal-scale-up,
  .animate-modal-scale-down,
  .animate-widget-enter,
  .animate-chart-enter {
    animation: none !important;
  }
}
```

Additionally, all Tailwind animation utilities (`animate-pulse`, `animate-spin`, `animate-in`) need `motion-safe:` prefix at the usage site, OR rely on `globals.css` override. The `motion-safe:` prefix approach is preferred as it's explicit per component.

---

### CC-02: Systemic gray-to-slate migration (RC-01)

**Scope:** 19 shared UI components + 9 scanner components = 28 affected components.
**Root Cause:** RC-01
**Severity:** Medium (palette semantic error — does not cause contrast failures but violates brand token mandate)
**Effort:** S (mechanical find-and-replace; low risk)

**Finding:** MASTER.md mandates `slate-*` palette for all neutral colors. The `gray-*` palette is Consumer SaaS/generic. Warehouse management UI must use `slate-*` throughout for the industrial/professional brand voice.

**Affected components by count:**

| gray-* usage | Affected Components |
|--------------|---------------------|
| `gray-900` (near-black text) | Table, PickingScanner, PickScanner, PackScanner, ShipScanner, ReceivingScanner, PalletBreakdownScanner |
| `gray-700` / `gray-600` (body text) | Textarea, Table, PalletBreakdownScanner, ShipScanner, ReceivingScanner |
| `gray-500` (muted text) | Input, Select, Textarea, ConfirmDialog, FetchError, EmptyState, ErrorBoundary, PickingScanner, PackScanner, ShipScanner, PutawayScanner |
| `gray-400` (placeholder/icon) | DropdownMenu, BarcodeScanner, PickingScanner, ScannerModal |
| `gray-300` / `gray-200` / `gray-100` (backgrounds, borders, disabled) | Skeleton (14 instances), Spinner, Table (11 instances), BarcodeScanner, PickScanner, PalletBreakdownScanner |
| `gray-50` (hover/surface) | CommandPalette, Table, PickScanner, PackScanner, PalletBreakdownScanner |

**Section 1 components with RC-01:** Alert, Badge, BarcodeScanner, CommandPalette, ConfirmDialog, DropdownMenu, EmptyState, ErrorBoundary, FetchError, Input, Pagination, ProductImage, SearchSelect, Select, Skeleton, Spinner, Table, Textarea, Toast (19 components).

**Section 2 components with RC-01:** PickingScanner, PickScanner, PackScanner, ShipScanner, PutawayScanner, ReceivingScanner, PalletBreakdownScanner, ScannerModal (8 scanner components — InspectionScanner is the exception, using slate correctly).

**Fix approach:** Single codebase-wide find-and-replace in `src/components/`. The mapping is 1:1: `gray-50`→`slate-50`, `gray-100`→`slate-100`, `gray-200`→`slate-200`, `gray-300`→`slate-300`, `gray-400`→`slate-400`, `gray-500`→`slate-500`, `gray-600`→`slate-600`, `gray-700`→`slate-700`, `gray-900`→`slate-900`. Verify contrast ratios post-swap (slate values are nearly identical to gray at the same shade).

---

### CC-03: Systemic token non-use — blue vs indigo (RC-02)

**Scope:** 8 shared UI + 10 scanner components = 18 affected components.
**Root Cause:** RC-02
**Severity:** High (brand identity — `blue-*` is the wrong brand family for admin; `indigo-*` is `--color-primary`)
**Effort:** XS per instance (mechanical swap; verify each context)

**Finding:** MASTER.md Section 1.1 mandates `--color-primary: #4F46E5` (indigo-600) as the admin brand primary. The `blue-*` palette (#3B82F6 / #2563EB) is a different hue family and must not appear in admin UI except where semantically correct (e.g., external link indicators if explicitly defined).

**Affected color classes by frequency:**

| Class | Should be | Affected Components |
|-------|-----------|---------------------|
| `blue-600` / `border-blue-600` | `indigo-600` | Spinner, BarcodeScanner, PickingScanner, ReceivingScanner, PalletBreakdownScanner, ScannerModal |
| `bg-blue-100` / `text-blue-600` | `bg-indigo-50 text-indigo-600` | BarcodeScanner, ScannerModal, PickingScanner, StatCard |
| `bg-blue-50` / `border-blue-200` | `bg-indigo-50 border-indigo-200` | PickingScanner, PickScanner, PackScanner, ShipScanner, PalletBreakdownScanner |
| `text-blue-600` (active state) | `text-indigo-600` | PickingScanner, PackScanner, ShipScanner, PutawayScanner, PickScanner |
| `border-blue-500` / `bg-blue-500` | `border-indigo-500 bg-indigo-600` | PickScanner |
| `focus:ring-blue-500` | `focus:ring-indigo-500` | PalletBreakdownScanner (raw inputs) |
| `bg-blue-600 h-2` (progress bar) | `bg-indigo-600` | PickScanner, ShipScanner |

**Special case — purple in ReceivingScanner:** `bg-purple-50`, `text-purple-700`, `border-purple-200`, `focus:ring-purple-500` used for lot-tracking visual language. Purple is not in MASTER.md palette. Recommendation: use indigo for lot-tracking indicators (indigo already signals "system/admin action"), or add purple to MASTER.md as extended semantic color for lot/compliance contexts. This is an architectural decision (see deferred items).

**Fix approach:** Codebase-wide find-and-replace within `src/components/` for each class mapping above. The indigo-600 `#4F46E5` and blue-600 `#2563EB` are visually distinct — this fix is user-perceptible.

---

### CC-04: Portal variant absence (RC-05)

**Scope:** 5 shared UI components — Button, Input, Select, Textarea, Toggle.
**Root Cause:** RC-05
**Severity:** Medium (affects portal pages exclusively; admin pages unaffected)
**Effort:** M per component (5 components × M = significant)

**Finding:** The portal brand uses cyan/teal (`--color-portal: #0891B2`, MASTER.md 1.2) while admin uses indigo. All 5 interactive form components are built with indigo-only focus rings and checked states. Portal pages must work around this with `className` overrides — a fragile pattern that will drift as components evolve.

**Components missing portal variant:**

| Component | Current | Missing |
|-----------|---------|---------|
| Button | `from-indigo-500 to-indigo-600 focus-visible:ring-indigo-500` | `variant="portal"`: `from-cyan-500 to-teal-600 focus-visible:ring-cyan-500` |
| Input | `focus:ring-indigo-500 focus:border-transparent` | `variant="portal"`: `focus:ring-cyan-500` |
| Select | `focus:ring-indigo-500` | `variant="portal"`: `focus:ring-cyan-500` |
| Textarea | `focus:ring-blue-500` (already wrong for admin) | Should be `focus-visible:ring-indigo-500` for admin; add `variant="portal"` for `focus-visible:ring-cyan-500` |
| Toggle | `bg-blue-600` (wrong for admin), correct is `bg-indigo-600` | Add `variant` prop: `admin` (indigo) and `portal` (cyan) |

**Impact:** Any portal page form (client-facing portal) that uses Input, Select, Textarea, or Toggle will show indigo focus rings — a brand mismatch. The portal sidebar correctly uses cyan. Form controls do not. Portal button is currently routed through the same `primary` variant showing indigo.

**Recommended fix approach:** Add a `variant` prop (or `context` prop) to each component: `"admin"` (default, indigo) and `"portal"` (cyan). This is a coordinated change across 5 components and should be planned as a single PR.

---

### CC-05: `focus:ring` vs `focus-visible:ring` — systemic incorrect pseudo-class (RC-03)

**Scope:** 6 shared UI components.
**Root Cause:** RC-03
**Severity:** Medium (user experience — shows focus ring on mouse click, not just keyboard navigation)
**Effort:** XS per instance (find-and-replace pseudo-class)

**Finding:** MASTER.md mandates `focus-visible:ring` to show focus indicators only on keyboard navigation. `focus:ring` shows the ring on every click, which is visually disruptive for mouse users.

**Affected components:**

| Component | Line(s) | Current | Fix |
|-----------|---------|---------|-----|
| Alert | 65 | No focus ring | Add `focus-visible:ring` |
| BarcodeScanner | 357–370 | No focus ring on torch | Add `focus-visible:ring` |
| DropdownMenu | 72 | `focus:ring-2 focus:ring-blue-500` | `focus-visible:ring-2 focus-visible:ring-indigo-500` |
| Input | 38–43 | `focus:ring-2` | `focus-visible:ring-2` |
| Select | 44–49 | `focus:ring-2` | `focus-visible:ring-2` |
| Textarea | 42–43 | `focus:ring-2 focus:ring-blue-500` | `focus-visible:ring-2 focus-visible:ring-indigo-500` |
| Toggle | 36 | `focus:ring-2 focus:ring-blue-500` | `focus-visible:ring-2 focus-visible:ring-indigo-500` |

**Note:** The same fix also converts `blue-*` to `indigo-*` in focus rings (CC-03 overlap). These two fixes can be combined in a single pass.
