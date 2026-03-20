---
phase: 06-shared-ui-components
plan: "03"
subsystem: ui-components
tags: [accessibility, aria, focus-trap, keyboard-nav, modal, searchselect, breadcrumbs, card]
dependency_graph:
  requires: []
  provides: [accessible-modal, accessible-searchselect, accessible-breadcrumbs, accessible-card]
  affects: [30+ pages using Modal, form pages using SearchSelect, all pages with Breadcrumbs, all pages with clickable Card]
tech_stack:
  added: []
  patterns: [WAI-ARIA combobox, ARIA dialog, focus trap, keyboard interaction]
key_files:
  created: []
  modified:
    - src/components/ui/Modal.tsx
    - src/components/ui/SearchSelect.tsx
    - src/components/ui/Breadcrumbs.tsx
    - src/components/ui/Card.tsx
decisions:
  - useId() for stable ARIA ID generation (Modal title, SearchSelect listbox)
  - Custom focus trap without external library — inline FOCUSABLE_SELECTORS query
  - SearchSelect options changed from <button> to <div role=option> for WAI-ARIA listbox correctness
  - Card role=button expressed as conditional JSX prop, not literal string
metrics:
  duration: "3min"
  completed_date: "2026-03-20"
  tasks_completed: 2
  files_modified: 4
requirements_addressed: [COMP-09, COMP-10, COMP-11, COMP-12]
---

# Phase 6 Plan 3: ARIA and Keyboard Accessibility for Core UI Components Summary

**One-liner:** Full WAI-ARIA dialog pattern with focus trap on Modal, combobox pattern with arrow-key navigation on SearchSelect, nav aria-label on Breadcrumbs, and keyboard-clickable Card with Enter/Space support.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add focus trap and ARIA dialog to Modal, ARIA combobox to SearchSelect | 73484f0 | Modal.tsx, SearchSelect.tsx |
| 2 | Add ARIA to Breadcrumbs and keyboard accessibility to Card | 2b4a2d4 | Breadcrumbs.tsx, Card.tsx |

## What Was Built

### Modal.tsx
- Added `role="dialog"` and `aria-modal="true"` to modal container
- Used `useId()` to generate stable title ID; `aria-labelledby` points to `<h2 id={titleId}>`
- Close button: `aria-label="Close"` and `focus-visible:ring-2 focus-visible:ring-indigo-500`
- Full focus trap: `handleKeyDown` cycles Tab/Shift+Tab through focusable elements within modal
- `FOCUSABLE_SELECTORS` constant queries all interactive elements
- `triggerRef` saves `document.activeElement` on open, restores on close via `useEffect`
- `useEffect` auto-focuses first focusable element when modal opens
- Moved Escape key handling into `handleKeyDown` (was previously a `document.addEventListener`)
- Backdrop gets `aria-hidden="true"`, close button SVG gets `aria-hidden="true"`

### SearchSelect.tsx
- `role="combobox"` on input, `aria-expanded={isOpen}`, `aria-controls={listboxId}`
- `aria-autocomplete="list"`, `aria-haspopup="listbox"` on input
- `aria-activedescendant` points to currently highlighted option's ID
- Dropdown container: `role="listbox"`, `id={listboxId}`
- Each option: `role="option"`, unique `id={listboxId}-option-{index}`, `aria-selected={option.value === value}`
- Options changed from `<button>` elements to `<div role="option">` for correct listbox semantics
- ArrowDown now opens dropdown if closed before moving highlight
- Clear button gets `aria-label="Clear selection"`, ChevronDown icon gets `aria-hidden="true"`

### Breadcrumbs.tsx
- `<nav aria-label="Breadcrumb">` on container
- Home icon link: `aria-label="Go to dashboard"`, icon gets `aria-hidden="true"`
- All links: `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 rounded-sm`
- Last/current breadcrumb item: `aria-current="page"`
- ChevronRight separator gets `aria-hidden="true"`

### Card.tsx
- `role={onClick ? "button" : undefined}` — conditional, not always present
- `tabIndex={onClick ? 0 : undefined}` — only focusable when clickable
- `onKeyDown` handler: Enter or Space calls `e.preventDefault()` then `onClick()` (Space prevents page scroll)
- `focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2` added to clickable card class string

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] SearchSelect option elements changed from button to div**
- **Found during:** Task 1
- **Issue:** The plan specified `role="option"` on items, but existing code used `<button>` elements. WAI-ARIA listbox pattern requires `role="option"` on non-button elements within a `role="listbox"` container. Mixing semantic `<button>` with `role="option"` is invalid.
- **Fix:** Changed option elements from `<button>` to `<div role="option">` with `onMouseDown` for selection. Kept `cursor-pointer` class.
- **Files modified:** src/components/ui/SearchSelect.tsx
- **Commit:** 73484f0

None other — plan executed as written.

## Verification

All 4 files pass TypeScript compilation (no errors on `--skipLibCheck`).

- `grep "role=\"dialog\""` confirms Modal dialog role (line 134)
- `grep "combobox"` confirms SearchSelect combobox pattern (line 252)
- `grep "aria-label=\"Breadcrumb\""` confirms Breadcrumbs nav label (line 18)
- Card uses `role={onClick ? "button" : undefined}` (line 55) — conditional JSX expression

## Self-Check: PASSED

- FOUND: src/components/ui/Modal.tsx
- FOUND: src/components/ui/SearchSelect.tsx
- FOUND: src/components/ui/Breadcrumbs.tsx
- FOUND: src/components/ui/Card.tsx
- FOUND commit: 73484f0 (Task 1)
- FOUND commit: 2b4a2d4 (Task 2)
