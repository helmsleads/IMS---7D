---
phase: 07-scanner-components
plan: "01"
subsystem: ui
tags: [scanner, accessibility, tap-targets, warehouse, touch-ui]

# Dependency graph
requires:
  - phase: 06-shared-ui-components
    provides: Button component with variant/size props used for audio toggles
provides:
  - Tap-target and text-size compliant PickingScanner (audio toggle as Button, Pick list button 44px)
  - Tap-target and text-size compliant PickScanner (all qty controls 44px, audio toggle 44px)
  - Tap-target and text-size compliant BarcodeScanner (all instruction text text-base)
affects: [08-outbound-pages, 09-warehouse-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audio toggle: raw <button> replaced with Button component + variant=ghost + min-h-[44px] min-w-[44px] + aria-label"
    - "Quantity controls: size=sm removed, min-h-[44px] added explicitly"
    - "Minimum text-base rule: all text-xs and text-sm eliminated from scanner components"

key-files:
  created: []
  modified:
    - src/components/internal/PickingScanner.tsx
    - src/components/internal/PickScanner.tsx
    - src/components/ui/BarcodeScanner.tsx

key-decisions:
  - "Audio toggle converted from raw <button p-2> to Button component (ghost variant) — maintains design system consistency and enables proper tap targets via min-h-[44px]"
  - "size=sm removed from all interactive controls — default size meets 44px warehouse floor requirement"
  - "text-xs/text-sm replaced with text-base throughout — no exceptions for scanner UI per warehouse accessibility standard"
  - "Gray->slate color cleanup deferred per plan scope — only size/text fixes in this plan"

patterns-established:
  - "Scanner audio toggles use Button variant=ghost with min-h-[44px] min-w-[44px] and aria-label"
  - "Scanner quantity controls never use size=sm — always default size with min-h-[44px]"

requirements-completed: [SCAN-01, SCAN-02, SCAN-07]

# Metrics
duration: 15min
completed: 2026-03-20
---

# Phase 7 Plan 01: Scanner Components Accessibility Summary

**Eliminated all text-xs/text-sm and size="sm" from three scanner components, converting audio toggles to Button components with 44px tap targets for warehouse floor accessibility**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-20T14:17:00Z
- **Completed:** 2026-03-20T14:31:57Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- PickingScanner: Audio toggle converted from raw `<button p-2>` to `Button variant="ghost"` with min-h-[44px] min-w-[44px]; Pick list button size="sm" removed and min-h-[44px] added; 18 text-xs/text-sm instances upgraded to text-base
- PickScanner: Audio toggle size="sm" removed and min-h-[44px]/min-w-[44px] added with aria-label; decrement, increment, and Pick All buttons all upgraded to min-h-[44px]; 7 text-xs/text-sm instances upgraded to text-base
- BarcodeScanner: 9 text-xs/text-sm instances upgraded to text-base (tap targets were already 44px+ from prior work)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix PickingScanner tap targets and text sizes** - `cf90fb0` (feat)
2. **Task 2: Fix PickScanner tap targets and text sizes** - `e56c4d3` (feat)
3. **Task 3: Fix BarcodeScanner text sizes** - `705e2cb` (feat)

## Files Created/Modified
- `src/components/internal/PickingScanner.tsx` - Audio toggle as Button component; all text-xs/text-sm -> text-base; Pick list button min-h-[44px]
- `src/components/internal/PickScanner.tsx` - All qty control buttons min-h-[44px]; audio toggle upgraded; all text-xs/text-sm -> text-base
- `src/components/ui/BarcodeScanner.tsx` - All instruction/status text text-xs/text-sm -> text-base

## Decisions Made
- Audio toggle in PickingScanner converted from raw `<button>` to Button component for design system consistency — this also resolves the tap target requirement via min-h-[44px] class
- Gray->slate color normalization deferred per plan scope (not a tap-target or text-size issue)
- BarcodeScanner tap targets were already compliant (w-11 h-11 torch, w-11 h-11 modal close, min-h-[48px] footer Close) — verified before starting Task 3

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three scanner components now meet SCAN-01 (44px tap targets), SCAN-02 (text-base minimum), and SCAN-07 (BarcodeScanner accessibility) requirements
- Ready for Phase 8 (outbound pages) and Phase 9 (warehouse pages) which will use these components

---
*Phase: 07-scanner-components*
*Completed: 2026-03-20*
