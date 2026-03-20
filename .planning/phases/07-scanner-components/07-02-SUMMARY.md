---
phase: 07-scanner-components
plan: 02
subsystem: scanner-components
tags: [accessibility, tap-targets, text-size, warehouse, scanners]
dependency_graph:
  requires: []
  provides: [compliant-pack-scanner, compliant-ship-scanner, compliant-receiving-scanner]
  affects: [outbound-packing-workflow, outbound-shipping-workflow, inbound-receiving-workflow]
tech_stack:
  added: []
  patterns: [min-h-[44px] tap target enforcement, Button component over raw button elements, Input component over raw input elements]
key_files:
  created: []
  modified:
    - src/components/internal/PackScanner.tsx
    - src/components/internal/ShipScanner.tsx
    - src/components/internal/ReceivingScanner.tsx
decisions:
  - "Audio toggle buttons on all three scanners use Button component (not raw button) for consistent sizing and focus behavior"
  - "ReceivingScanner date input uses Input component replacing raw input with purple focus ring — now uses indigo via design system"
  - "Calendar reset button converted from raw button to Button variant=ghost with min-h-[44px] for consistent tap target"
  - "Lot tracking badge (text-xs) changed to text-base — visual size is controlled by badge padding, not text-xs; text-base ensures readability at arm's length"
metrics:
  duration: 6min
  completed_date: "2026-03-20"
  tasks_completed: 3
  files_modified: 3
---

# Phase 7 Plan 02: Scanner Tap Targets and Text Sizes Summary

**One-liner:** Upgraded PackScanner, ShipScanner, and ReceivingScanner to 44px minimum tap targets and text-base minimum text size for warehouse floor accessibility (SCAN-03, SCAN-04, SCAN-05).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix PackScanner tap targets and text sizes | 0edb9ef | src/components/internal/PackScanner.tsx |
| 2 | Fix ShipScanner tap targets and text sizes | f7babe2 | src/components/internal/ShipScanner.tsx |
| 3 | Fix ReceivingScanner tap targets and text sizes | 94ff3b0 | src/components/internal/ReceivingScanner.tsx |

## What Was Built

### PackScanner (Blocking #3 + B-16)
- Audio toggle: removed `size="sm"`, added `min-h-[44px] min-w-[44px]`, added `aria-label`, upgraded icon to `w-5 h-5`
- Remove-from-carton "-1" button: removed `size="sm"`, added `min-h-[44px]`
- Text changes: carton count, items count, "Scan items to add" instruction, product name, carton stage → all `text-base text-slate-500`

### ShipScanner (Blocking #4 + B-17)
- Audio toggle: removed `size="sm"`, added `min-h-[44px] min-w-[44px]`, added `aria-label`, upgraded icon to `w-5 h-5`
- Text changes: order number, progress "Cartons verified" text, carton status "Verified"/"Pending", "Items may not have been packed" text, Carrier label, Tracking Number label, "Scan all cartons" footer hint → all `text-base` with appropriate slate color

### ReceivingScanner (Blocking #5 + B-18)
- Audio toggle: converted raw `<button p-2>` to `<Button variant="ghost">` with `min-h-[44px] min-w-[44px]` and `aria-label`
- Calendar reset: converted raw `<button>` to `<Button variant="ghost">` with `min-h-[44px] min-w-[44px]`
- Date input: replaced raw `<input type="date">` with `<Input type="date">` — removes purple focus ring, adds indigo via design system
- Cancel Scan button: removed `size="sm"` (already had `className="w-full"`)
- Max button: removed `size="sm"`, added `min-h-[44px]`
- Lot scan trigger: added `min-h-[44px]`
- Receive/Enter Lot pick list buttons: removed `size="sm"`, added `min-h-[44px]`
- Text changes: 18+ text-xs/text-sm instances changed to text-base throughout (progress subtitle, complete indicator, not-found/not-expected messages, lot form labels, SKU/remaining qty, lot tracking badge, qty stats grid, add-to-qty label, pending/new-total display, idle state instruction, pick list SKU and received label)

## Verification Results

```
text-xs/text-sm counts:
  PackScanner.tsx: 0
  ShipScanner.tsx: 0
  ReceivingScanner.tsx: 0

size="sm" counts:
  PackScanner.tsx: 0
  ShipScanner.tsx: 0
  ReceivingScanner.tsx: 0

purple focus rings in ReceivingScanner: none (focus:ring-purple removed)

TypeScript: no errors in scanner files
```

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written with one small addition.

**Note:** Lot scan trigger button (line ~496) had no `size` prop but also no explicit `min-h` constraint. Added `min-h-[44px]` proactively to meet the 44px minimum for all interactive elements per SCAN-05 requirement.

## Requirements Met

- SCAN-03: PackScanner audio toggle and remove-from-carton buttons >= 44px tap targets, all text >= text-base
- SCAN-04: ShipScanner audio toggle >= 44px tap target, all text >= text-base
- SCAN-05: ReceivingScanner audio toggle, lot scan trigger, calendar reset buttons >= 44px; date input uses Input component with indigo focus ring; all text >= text-base

## Self-Check: PASSED

Files created/modified:
- FOUND: src/components/internal/PackScanner.tsx
- FOUND: src/components/internal/ShipScanner.tsx
- FOUND: src/components/internal/ReceivingScanner.tsx

Commits verified:
- FOUND: 0edb9ef (PackScanner fixes)
- FOUND: f7babe2 (ShipScanner fixes)
- FOUND: 94ff3b0 (ReceivingScanner fixes)
