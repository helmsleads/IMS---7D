# Phase 2: Component Library Audit - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Audit all shared UI components against the locked MASTER.md design system. Produce `.planning/audit/components.md` with severity-rated findings per component, establishing a root-cause taxonomy so page audits (Phase 3) can trace issues to component vs. inline source. No code changes — audit only.

</domain>

<decisions>
## Implementation Decisions

### Component Priority
- **Equal depth for all** — every component gets the same level of scrutiny, no tiering by usage
- Charts directory (`src/components/ui/charts/`) included in this audit alongside other shared UI
- No specific pain points pre-identified — let the findings speak for themselves

### Audit Scope Per Component
- **Full audit** — five dimensions per component:
  1. Visual alignment to MASTER.md (colors, spacing, typography, shadows, radii)
  2. Accessibility (focus states, contrast ratios, ARIA attributes)
  3. Responsive behavior (mobile/tablet rendering)
  4. Variant completeness (flag missing variants that MASTER.md or industry standard suggests should exist)
  5. Props API consistency (naming, patterns across component library)
- **Flag hardcoded values** — components should use CSS custom properties from globals.css; flag hardcoded hex colors or Tailwind color classes that should reference design tokens instead
- Findings must include: file path, line range, current state, recommended change, effort estimate (carried from Phase 1 decision)

### Scanner Component Handling
- **Include all scanner components in Phase 2** — BarcodeScanner.tsx (ui/) + 8 internal scanner wrappers (PickingScanner, PackScanner, ShipScanner, PutawayScanner, InspectionScanner, ReceivingScanner, PalletBreakdownScanner) + ScannerModal.tsx
- Apply warehouse floor rubric (from MASTER.md Section 7) to all scanner components
- **Sidebars deferred to Phase 3** — Sidebar.tsx and PortalSidebar.tsx evaluated in page audit context

### Claude's Discretion
- Severity rating system (Blocking/High/Medium/Low or simpler)
- Accessibility finding organization (separate section vs inline with a11y tag)
- How to structure findings within components.md (by component alphabetically, by severity, or by dimension)

</decisions>

<specifics>
## Specific Ideas

- The root-cause taxonomy is the key deliverable — if a Button issue causes findings on 40 pages, it should appear once in components.md and page audits reference it
- Scanner components get the MASTER.md Section 7 warehouse floor rubric applied (44px+ tap targets, 16px+ text, no precision gestures)
- Token usage consistency is a cross-cutting concern — every component should be checked for hardcoded values that should use CSS custom properties

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `design-system/ims7d/MASTER.md`: 568-line locked rubric — Section 5 has component patterns (buttons, cards, tables, modals, inputs, badges)
- `.planning/phases/01-tool-setup-and-design-system/SCANNER-ROUTES.md`: 12 scanner routes with rubric
- `.planning/phases/01-tool-setup-and-design-system/DASHBOARD-CONSTRAINTS.md`: ~360px half-widget, ~178px StatCard

### Component Inventory (37 total)
**Shared UI (27 in src/components/ui/):**
Alert, Badge, BarcodeScanner, Breadcrumbs, Button, Card, charts/, CommandPalette, ConfirmDialog, DropdownMenu, EmptyState, ErrorBoundary, FetchError, Input, Modal, Pagination, ProductImage, SearchSelect, Select, Skeleton, Spinner, StatCard, StatusBadge, Table, Textarea, Toast, Toggle

**Scanner components (10 in src/components/internal/):**
PickingScanner, PickScanner, PackScanner, ShipScanner, PutawayScanner, InspectionScanner, ReceivingScanner, PalletBreakdownScanner, ScannerModal + BarcodeScanner (from ui/)

### Established Patterns
- Components use Tailwind utility classes inline (no CSS modules)
- Some components reference CSS custom properties, others use hardcoded Tailwind classes — inconsistency is expected finding
- `globals.css` has 29 CSS custom properties that components should reference

### Integration Points
- Audit output goes to `.planning/audit/components.md`
- Phase 3 page audits will cross-reference component findings to classify issues as "source: component" vs "source: inline override"

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-component-library-audit*
*Context gathered: 2026-03-18*
