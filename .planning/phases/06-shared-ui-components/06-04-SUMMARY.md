---
phase: 06-shared-ui-components
plan: 04
subsystem: ui
tags: [react, accessibility, aria, recharts, animation, reduced-motion]

# Dependency graph
requires:
  - phase: 06-shared-ui-components
    provides: Chart component library (DonutChart, HorizontalBarChart, etc.) and StatCard
provides:
  - useReducedMotion hook at src/hooks/useReducedMotion.ts
  - ARIA-accessible chart components (role=img, aria-label, sr-only data tables)
  - Reduced-motion-aware chart animations (isAnimationActive flag)
  - StatCard with indigo default iconColor and motion-aware animated numbers
affects:
  - Any page using chart components or StatCard
  - Screen reader users across all dashboards

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useReducedMotion hook pattern: matchMedia listener initialized in useEffect, state updated on change"
    - "Chart ARIA pattern: outer div with role=img + aria-label, sr-only table inside for data"
    - "Recharts reduced-motion: pass isAnimationActive={!prefersReducedMotion} to chart primitives"

key-files:
  created:
    - src/hooks/useReducedMotion.ts
  modified:
    - src/components/ui/StatCard.tsx
    - src/components/ui/charts/DonutChart.tsx
    - src/components/ui/charts/HorizontalBarChart.tsx
    - src/components/ui/charts/MiniBarChart.tsx
    - src/components/ui/charts/MiniLineChart.tsx
    - src/components/ui/charts/MiniSparkline.tsx
    - src/components/ui/charts/ScatterChart.tsx
    - src/components/ui/charts/StackedBarChart.tsx
    - src/components/ui/charts/TreemapChart.tsx
    - src/components/ui/charts/WaterfallChart.tsx
    - src/components/ui/charts/BulletChart.tsx
    - src/components/ui/charts/CalendarHeatmap.tsx
    - src/components/ui/charts/GaugeChart.tsx

key-decisions:
  - "Sr-only data tables for Recharts charts; sr-only summary paragraph for CalendarHeatmap (complex grid data); no sr-only table needed for GaugeChart (single value already in aria-label)"
  - "BulletChart and GaugeChart: motion guard applied via conditional CSS class (not isAnimationActive) since they are SVG-based, not Recharts"
  - "CalendarHeatmap unused weekKey variable removed as a minor cleanup during the rewrite"

patterns-established:
  - "Accessibility pattern: all chart wrappers use div[role=img][aria-label] with sr-only data table inside"
  - "Motion pattern: import useReducedMotion, pass !prefersReducedMotion to isAnimationActive in Recharts; conditionally skip animate-chart-enter class for SVG charts"

requirements-completed: [COMP-04, COMP-13, COMP-14, XCUT-01]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 6 Plan 04: Accessibility and Reduced Motion for Charts Summary

**ARIA role/aria-label + sr-only data tables added to all 12 Recharts and SVG chart components, with useReducedMotion hook wiring animation off for prefers-reduced-motion users, and StatCard fixed to indigo defaults**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T13:12:12Z
- **Completed:** 2026-03-20T13:17:00Z
- **Tasks:** 2
- **Files modified:** 14 (1 new hook, 12 chart components, 1 StatCard)

## Accomplishments
- Created reusable `useReducedMotion` hook that listens to `prefers-reduced-motion` OS preference and updates reactively
- Added `role="img"`, `aria-label` prop, and sr-only data tables to all 12 chart components — screen readers can now navigate chart data
- Wired `isAnimationActive={!prefersReducedMotion}` into all Recharts-based charts; SVG charts conditionally skip CSS animation class
- Fixed StatCard `iconColor` default from `bg-blue-50 text-blue-600` (wrong design system color) to `bg-indigo-50 text-indigo-600`
- Made `AnimatedValue` and `AnimatedStringValue` in StatCard immediately display target values when reduced motion is preferred

## Task Commits

Each task was committed atomically:

1. **Task 1: Create useReducedMotion hook and fix StatCard** - `ad85942` (feat)
2. **Task 2: Add ARIA and reduced-motion to all 12 chart components** - `a743b63` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `src/hooks/useReducedMotion.ts` - New hook: matchMedia listener for prefers-reduced-motion, returns boolean
- `src/components/ui/StatCard.tsx` - Fixed iconColor default to indigo; AnimatedValue respects reduced motion
- `src/components/ui/charts/DonutChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/HorizontalBarChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/MiniBarChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/MiniLineChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/MiniSparkline.tsx` - ARIA wrapper, sr-only summary, useReducedMotion
- `src/components/ui/charts/ScatterChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/StackedBarChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/TreemapChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/WaterfallChart.tsx` - ARIA wrapper, sr-only table, useReducedMotion
- `src/components/ui/charts/BulletChart.tsx` - Added "use client", ARIA wrapper div, sr-only table, useReducedMotion import
- `src/components/ui/charts/CalendarHeatmap.tsx` - ARIA wrapper div, sr-only summary paragraph, useReducedMotion (conditional CSS class)
- `src/components/ui/charts/GaugeChart.tsx` - Added "use client", ARIA wrapper div, dynamic aria-label with value, useReducedMotion

## Decisions Made
- Sr-only data tables for Recharts charts; sr-only summary paragraph for CalendarHeatmap (complex grid data doesn't map cleanly to a table)
- BulletChart and GaugeChart use SVG rendering — motion guard applied by conditionally including `animate-chart-enter` CSS class, not `isAnimationActive` (Recharts-only prop)
- GaugeChart aria-label dynamically includes the current value and label so screen readers get useful information without a table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added "use client" directive to BulletChart and GaugeChart**
- **Found during:** Task 2 (adding useReducedMotion hook)
- **Issue:** Both files lacked "use client" directive — hooks cannot run in Server Components
- **Fix:** Added "use client" as first line of both files
- **Files modified:** src/components/ui/charts/BulletChart.tsx, src/components/ui/charts/GaugeChart.tsx
- **Verification:** TypeScript compile passes with no errors
- **Committed in:** a743b63 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for correctness — hook usage requires client component. No scope creep.

## Issues Encountered
None — plan executed with one auto-fix for a missing "use client" directive.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 12 chart components are now accessible to screen readers
- Reduced-motion preference is respected across the entire chart library and StatCard
- `useReducedMotion` hook is available at `@/hooks/useReducedMotion` for any future components that animate

---
*Phase: 06-shared-ui-components*
*Completed: 2026-03-20*
