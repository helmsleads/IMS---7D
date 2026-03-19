---
phase: 04-action-plan-compilation
plan: "02"
subsystem: action-plan
tags: [implementation-roadmap, wave-structure, ui-ux, audit, action-plan]
dependency_graph:
  requires:
    - ".planning/action-plan/PRIORITIES.md"
    - ".planning/audit/components.md"
    - ".planning/audit/admin-pages.md"
    - ".planning/audit/portal-pages.md"
  provides:
    - ".planning/action-plan/IMPLEMENTATION.md"
  affects:
    - "Phase 5 implementation milestone (v2.0)"
tech_stack:
  added: []
  patterns:
    - "Wave-based implementation sequencing (globals → components → scanners → pages)"
    - "Component-layer fixes cascade to all pages that use them (multiplier principle)"
    - "Each wave independently mergeable as a pull request"
key_files:
  created:
    - ".planning/action-plan/IMPLEMENTATION.md"
  modified: []
key-decisions:
  - "5-phase v2.0 implementation roadmap: P1 Foundation (Wave 0+1), P2 Scanner Safety (Wave 2), P3 Admin Pages (Wave 3), P4 Portal Pages (Wave 4), P5 Verification"
  - "Waves 3 and 4 can run in parallel after Wave 1 completes — documented in wave dependency diagram"
  - "All 20 Blocking and 40 High-Value items cross-referenced to specific wave sections with file paths"
  - "106 src/ file path references in IMPLEMENTATION.md — every action item has a specific file path"
requirements-completed:
  - PLAN-03
  - PLAN-04

duration: 5min
completed: "2026-03-19"
---

# Phase 4 Plan 02: Create IMPLEMENTATION.md Summary

**Wave-structured implementation guide mapping all 60 action items to specific file paths, exact changes, and effort estimates across 5 waves with explicit dependency sequencing for v2.0 milestone.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T15:48:24Z
- **Completed:** 2026-03-19T15:53:34Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created `.planning/action-plan/IMPLEMENTATION.md` with complete Wave 0–4 structure covering all 60 action items
- Every action item has a specific `src/` file path, exact change description, and effort estimate — 106 total `src/` references
- Cross-reference tables verify all 20 Blocking and 40 High-Value items are accounted for across waves
- Suggested 5-phase implementation roadmap for v2.0 milestone with effort estimates and dependency graph

## Task Commits

Each task was committed atomically:

1. **Task 1: Create wave-structured IMPLEMENTATION.md** - `8ead376` (feat)

## Files Created/Modified

- `.planning/action-plan/IMPLEMENTATION.md` — 1,250-line wave-structured implementation guide with file paths, exact changes, effort estimates, wave dependencies, and suggested v2.0 phases

## Decisions Made

- Organized Wave 1 components by: Blocking items first (Button, Input, Select, Textarea, Toggle portal variants; BarcodeScanner; Modal; SearchSelect; Pagination), then High-Value items ordered by multiplier impact
- Grouped Wave 3 into 3a (scanner routes — highest priority), 3b (non-scanner pages with inline overrides), and 3c (component-propagation-only pages that auto-resolve after Wave 1)
- Grouped Wave 4 into 4a (inline blue/indigo bleed), 4b (auth pages), and 4c (component-propagation-only pages)
- Suggested 5-phase v2.0 structure: P1 Foundation + P2 Scanner Safety + P3 Admin + P4 Portal + P5 Verification — directly consumable by `/gsd:new-milestone`
- Combined B-24 (Location Sublocations non-Blocking High fixes) into the same section as Blocking #15 (same file) to reduce developer context-switching

## Deviations from Plan

None — plan executed exactly as written.

IMPLEMENTATION.md contains all required elements:
- Wave 0–4 sections with explicit dependency documentation
- All 21 Wave 1 shared UI component entries with file paths and exact change lists
- All 10 Wave 2 scanner component entries with Blocking + High changes separated
- All Wave 3 admin page entries split into 3a scanner routes, 3b inline overrides, 3c propagation-only
- All Wave 4 portal page entries split into 4a inline overrides, 4b auth pages, 4c propagation-only
- Suggested Implementation Phases section with 5 phases, effort estimates, and dependency graph
- Cross-reference tables verifying all 20 Blocking and 40 High-Value items present

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Both Phase 4 deliverables complete: `PRIORITIES.md` (04-01) and `IMPLEMENTATION.md` (04-02)
- Phase 4 is fully complete — action plan is ready for v2.0 implementation milestone
- `/gsd:new-milestone` for v2.0 can consume IMPLEMENTATION.md's "Suggested Implementation Phases" section directly
- Implementation order: P1 Foundation → P2 Scanner Safety + P3 Admin + P4 Portal (parallel) → P5 Verification

---
*Phase: 04-action-plan-compilation*
*Completed: 2026-03-19*
