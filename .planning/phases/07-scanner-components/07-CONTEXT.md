# Phase 7: Scanner Components - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix all scanner component tap targets (44px minimum) and text sizes (text-base minimum) across 7 scanner components + Pagination. This covers Blocking items #1-7 and High items B-14 through B-18 from PRIORITIES.md. Pagination 44px already done in Phase 6 (COMP-08), so SCAN-08 is pre-satisfied.

</domain>

<decisions>
## Implementation Decisions

### Button Sizing Strategy
- **Uniform 44px minimum** — all scanner buttons meet 44px but keep their current relative sizing. Primary actions stay larger, secondary actions just get bumped to the minimum.
- **Convert raw `<button>` elements to Button component** where possible (e.g., audio toggles with `p-2`, action buttons). More consistent with design system. Only keep raw buttons where Button component doesn't fit (e.g., highly custom layout).
- Error dismiss buttons (like `×` on PalletBreakdownScanner) become **full-width "Dismiss" buttons** at bottom of error — not just 44px squares. Easier to tap on warehouse floor with gloves.

### Text Size Strategy
- **Everything text-base** — no text smaller than `text-base` anywhere in scanner components. No exceptions for secondary/helper text. Maximum readability on warehouse handheld devices.
- `text-xs` → `text-base` (two sizes up)
- `text-sm` → `text-base` (one size up)
- Instruction text in BarcodeScanner also goes to `text-base`

### Already Completed (Phase 6)
- Pagination buttons already upgraded to `min-w-[44px] min-h-[44px]` (Plan 06-02, COMP-08)
- Dark mode classes already removed from 5 scanner components (Plan 06-06, COMP-16)

### Claude's Discretion
- Whether to use `size="md"` (which gives 44px) or explicit `min-h-[44px]` class — pick whichever is cleaner per component
- Layout adjustments needed after buttons get bigger (spacing, wrapping)
- Whether BarcodeScanner close button becomes a Button component or stays raw with min-h-[44px]

</decisions>

<specifics>
## Specific Ideas

- Error dismiss should say "Dismiss" as text, not just an × icon — warehouse workers wearing gloves need obvious tap targets
- Audio toggle buttons should be clearly labeled (not just icon-only) if converting to Button component

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- Button component now has `variant="admin"` with `size="md"` giving 44px height — scanner buttons can use this
- Pagination already fixed in Phase 6 — SCAN-08 requirement is pre-satisfied
- Phase 6 removed dark: classes from all 5 scanner components — cleaner starting point

### Established Patterns
- Scanner components use `size="sm"` on Button for action buttons — removing this defaults to `size="md"` (44px)
- Raw `<button>` elements with `p-2` are used for audio toggles and close buttons
- PalletBreakdownScanner has `×` dismiss button and quick-action buttons ("1 unit"/"1 case"/"All")

### Integration Points
- 7 scanner component files in `src/components/internal/`: PickingScanner, PickScanner, PackScanner, ShipScanner, ReceivingScanner, PalletBreakdownScanner
- 1 shared component: BarcodeScanner in `src/components/ui/`
- Pagination already done — no work needed

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-scanner-components*
*Context gathered: 2026-03-20*
