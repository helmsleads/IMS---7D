---
phase: 05-design-tokens
plan: 01
subsystem: ui
tags: [css, animations, reduced-motion, accessibility, design-tokens]

# Dependency graph
requires: []
provides:
  - "@media (prefers-reduced-motion: reduce) block in globals.css covering all 6 spatial-motion keyframes"
  - "Shadow tokens --shadow-card, --shadow-modal, --shadow-elevated confirmed in :root"
  - "Fade-only fallback animations for all custom keyframe utilities"
affects:
  - 06-components
  - 07-admin-pages
  - 08-portal-pages
  - 09-cross-cutting

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reduced-motion: redefine keyframes inside @media block so same class names work without components changing"
    - "Fade-only fallback: remove all transform properties (translateX, translateY, scale, scaleY) in reduced-motion variants, keep opacity"
    - "Stagger delays preserved under reduced-motion — sequential timing is not spatial motion"

key-files:
  created: []
  modified:
    - src/app/globals.css

key-decisions:
  - "Fade-only approach for all reduced-motion fallbacks — opacity transitions preserved, no transforms at all"
  - "Single @media block at end of globals.css — cleanest cascade; components keep existing class names unchanged"
  - "Stagger delay classes (.stagger-1 through .stagger-8) left untouched — timing is not considered motion"
  - "chart-grow reduced to 200ms fade-in (from 600ms scaleY) to maintain visual continuity at faster pace"
  - "Shadow tokens already present and correct — Task 2 was verification-only, no modifications needed"

patterns-established:
  - "Reduced-motion override pattern: place all @media (prefers-reduced-motion: reduce) overrides in a single block at end of globals.css"
  - "No transform properties anywhere inside the reduced-motion media query block"

requirements-completed: [TOKN-01, TOKN-02, XCUT-02]

# Metrics
duration: 8min
completed: 2026-03-19
---

# Phase 5 Plan 01: Design Tokens Summary

**`@media (prefers-reduced-motion: reduce)` block added to globals.css — all 6 spatial-motion keyframes (slide-in-from-right, modal-scale-up/down, fade-in-up, widget-enter, chart-grow) redefined as fade-only variants with no translateX/Y or scale transforms**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-19T23:00:00Z
- **Completed:** 2026-03-19T23:08:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `@media (prefers-reduced-motion: reduce)` block at the end of globals.css covering all custom keyframe animations
- Redefined 6 spatial-motion keyframes as fade-only: `slide-in-from-right`, `modal-scale-up`, `modal-scale-down`, `fade-in-up`, `widget-enter`, `chart-grow`
- Overrode all 7 animation utility classes inside the media block (`.animate-in`, `.slide-in-from-right-full`, `.animate-fade-in-up`, `.animate-modal-scale-up`, `.animate-modal-scale-down`, `.animate-widget-enter`, `.animate-chart-enter`)
- Confirmed shadow tokens `--shadow-card`, `--shadow-modal`, `--shadow-elevated` already present in `:root`
- Next.js build passes with no CSS-related errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Add prefers-reduced-motion media query block** - `ccba059` (feat)
2. **Task 2: Verify shadow tokens and build** - verification-only, no code changes

## Files Created/Modified

- `src/app/globals.css` - Added 119-line `@media (prefers-reduced-motion: reduce)` block redefining all spatial-motion keyframes as fade-only variants

## Decisions Made

- Used a single `@media` block at the end of globals.css (not split sections near each keyframe) — cleaner cascade and easier to audit
- Stagger delay classes intentionally excluded from reduced-motion overrides — sequential timing is not spatial motion
- chart-grow duration reduced from 600ms to 200ms inside reduced-motion block for appropriate pacing without scaleY
- Shadow tokens required no changes — values were already approved and correct per the context document

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — implementation was straightforward. The verification script in the plan used shell-escaped characters that caused a bash parse error (`\!`), resolved by writing the check inline with proper Node.js syntax. Confirmed no spatial transforms appear in CSS rules (comments referencing transforms are purely descriptive).

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- globals.css CSS foundation is complete — all Phase 6-9 component and page work can proceed
- Components consuming animation classes (`Modal.tsx`, `Toast.tsx`, dashboard widgets, chart components) will automatically get reduced-motion behavior with no code changes needed
- Shadow tokens (`--shadow-card`, `--shadow-modal`, `--shadow-elevated`) are available for Phase 6 component consumption

---
*Phase: 05-design-tokens*
*Completed: 2026-03-19*
