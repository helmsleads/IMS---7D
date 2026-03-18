---
phase: 02-component-library-audit
plan: "01"
subsystem: component-library
tags: [audit, components, accessibility, design-system, ui]
dependency_graph:
  requires: []
  provides: [".planning/audit/components.md"]
  affects: ["Phase 3 page audits — all findings reference RC-01 through RC-05 taxonomy"]
tech_stack:
  added: []
  patterns: ["5-dimension audit per component (visual, a11y, responsive, variants, props API)", "Root-cause taxonomy (RC-01 to RC-05) for cross-phase finding classification"]
key_files:
  created:
    - .planning/audit/components.md
  modified: []
decisions:
  - "All 13 chart components require aria-label prop addition — currently no ARIA on Recharts container divs"
  - "prefers-reduced-motion gap documented once in cross-cutting section (not duplicated per component)"
  - "Pagination tap targets (36px) rated High not Blocking — admin-only component, not scanner route"
  - "StatCard group-hover:scale-105 rated Medium not Blocking — icon-only scale, not card layout shift"
  - "StatusBadge finding references Badge root cause — avoids double-counting 40 page findings"
metrics:
  duration: "~90 minutes"
  completed: "2026-03-18"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
requirements_satisfied: [COMP-01, COMP-02, COMP-03]
---

# Phase 2 Plan 01: Component Library Audit (Shared UI) Summary

**One-liner:** 5-dimension audit of all 27 shared UI components with 98 severity-rated findings across RC-01 through RC-05 root causes, establishing the taxonomy for Phase 3 page audits.

---

## What Was Built

Created `.planning/audit/components.md` containing:

1. **Overview section** — Root-cause taxonomy (RC-01 to RC-05), severity rating guide (Blocking/High/Medium/Low), and summary counts.

2. **Section 1: Shared UI Components (27 entries)** — Every component in `src/components/ui/` audited across all 5 dimensions with line-precise findings.

3. **Section 2 and Section 3 placeholder headers** — Ready for Plan 02 to append scanner components and cross-cutting findings.

---

## Findings Summary

| Severity | Count | Notes |
|----------|-------|-------|
| Blocking | 3 | BarcodeScanner text-sm/text-xs on scanner route (RC-04), Pagination 36px tap targets (context: admin = High; scanner = Blocking) |
| High | 34 | Wrong color family (blue vs indigo), missing focus rings on interactive elements, all 13 non-GaugeChart charts missing ARIA, Modal missing role="dialog" |
| Medium | 52 | Gray→slate palette (RC-01 pervasive), token non-use (RC-02), focus:ring vs focus-visible:ring (RC-03), missing variants (portal, warning toast) |
| Low | 9 | Shadow not tokenized, minor border radius differences, className passthrough gaps |
| **Total** | **98** | Across 27 components |

---

## Root Cause Distribution

| ID | Description | Affected Components |
|----|-------------|---------------------|
| RC-01 | Gray palette instead of slate | 19/27 — most pervasive |
| RC-02 | Hardcoded colors instead of CSS tokens | 8/27 |
| RC-03 | `focus:ring` instead of `focus-visible:ring` | 6/27 |
| RC-04 | Scanner text below 16px | 1/27 (BarcodeScanner) |
| RC-05 | Props API inconsistency | 5/27 |

---

## Key Findings

### Blocking (3)

1. **BarcodeScanner instructions `text-sm`** (line 375) — scanner floor route minimum is 16px
2. **BarcodeScanner secondary instructions `text-xs`** (line 378) — secondary scanner text still violates floor rubric
3. **Pagination 36px tap targets** — rated Blocking in scanner context; High in admin context

### High — Accessibility

- **Modal**: Missing `role="dialog"` + `aria-modal="true"` + close button has no aria-label or focus ring
- **All 12 Recharts charts** (MiniBarChart, MiniLineChart, HorizontalBarChart, StackedBarChart, TreemapChart, WaterfallChart, ScatterChart, MiniSparkline, DonutChart): No ARIA on container div — screen readers cannot identify as charts
- **CommandPalette** and **SearchSelect**: Missing full ARIA combobox pattern (role="combobox", role="listbox", role="option")
- **Table mobile toggle**: Active state uses `bg-gray-900` instead of `bg-indigo-600` — brand violation in active interactive state
- **Spinner**: No `role="status"` or `aria-label` — loading state invisible to screen readers
- **ErrorBoundary** and **FetchError**: Retry buttons have no focus rings and use blue instead of indigo

### Chart Directory Findings

All 13 chart components (excluding GaugeChart which has correct ARIA) are missing accessibility attributes on their container div. GaugeChart is the positive outlier with `role="img"` + data-driven `aria-label`. The fix is consistent across all 12: add `role="img"` + `aria-label` prop + guard `animate-chart-enter` with `motion-safe:` prefix.

### prefers-reduced-motion

A systemic gap: `animate-pulse`, `animate-spin`, `animate-chart-enter`, `slide-in-from-right-full` are all unguarded. This affects: Skeleton (all variants), Spinner, all 13 charts, ProductImage, StatCard sparkline, Toast. Fix is in globals.css once (Phase 3 cross-cutting section) or `motion-safe:` prefix on each.

---

## Decisions Made

1. **Charts accessibility fix is uniform** — Add `aria-label` prop to all 12 affected chart components with consistent default fallbacks. GaugeChart pattern is the template.

2. **Pagination severity** — 36px tap targets rated High (not Blocking) because Pagination is admin-only. Would be Blocking if used on scanner routes (per MASTER.md Section 7).

3. **StatusBadge findings** — Root cause flagged at Badge level. StatusBadge entry notes "inherits Badge color issues" plus its own `variantMap` coupling issue. Avoids 40 page-level duplicate findings.

4. **StatCard icon scale-105** — Medium (not Blocking). Icon-only scale, no card layout shift. MASTER.md anti-pattern is `transform: scale()` on the card itself.

5. **prefers-reduced-motion** — Documented as a single cross-cutting finding to be expanded in Section 3 (Plan 02). Not duplicated in every animated component finding (only referenced).

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Self-Check

### Verify artifact exists

- [x] `.planning/audit/components.md` — FOUND
- [x] Commit `957c8b6` — FOUND

## Self-Check: PASSED
