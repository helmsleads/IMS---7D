# Roadmap: IMS-7D

## Milestones

- ✅ **v1.0 UI/UX Audit & Design System** — Phases 1-4 (shipped 2026-03-19)
- 🚧 **v2.0 UI/UX Implementation** — Phases 5-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 UI/UX Audit & Design System (Phases 1-4) — SHIPPED 2026-03-19</summary>

- [x] Phase 1: Tool Setup and Design System (2/2 plans) — completed 2026-03-18
- [x] Phase 2: Component Library Audit (2/2 plans) — completed 2026-03-19
- [x] Phase 3: Page Audits (3/3 plans) — completed 2026-03-19
- [x] Phase 4: Action Plan Compilation (2/2 plans) — completed 2026-03-19

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v2.0 UI/UX Implementation (In Progress)

**Milestone Goal:** Execute the severity-tiered action plan — apply design system tokens, fix all 20 Blocking items, resolve 40 High-Value items, and bring the platform to visual/UX production quality across all 91 pages.

- [x] **Phase 5: Design Tokens** — Apply globals.css tokens and reduced-motion foundations (completed 2026-03-19)
- [ ] **Phase 6: Shared UI Components** — Portal variants, color corrections, ARIA, gray→slate migration
- [ ] **Phase 7: Scanner Components** — Tap target and text size fixes across all scanner components
- [ ] **Phase 8: Admin Pages** — Inline color corrections and scanner page fixes for admin routes
- [ ] **Phase 9: Portal Pages** — Cyan brand corrections across all portal routes

## Phase Details

### Phase 5: Design Tokens
**Goal**: The CSS foundation supports the dual-brand design system — custom properties, keyframe animations, and reduced-motion fallbacks are all in place before any component work begins.
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: TOKN-01, TOKN-02, XCUT-02
**Success Criteria** (what must be TRUE):
  1. The `globals.css` file contains a `@media (prefers-reduced-motion: reduce)` block that disables all custom keyframes (modal-scale-up/down, widget-enter, chart-enter)
  2. CSS custom properties `--shadow-card`, `--shadow-modal`, and `--shadow-elevated` are defined and available site-wide
  3. All custom keyframe animations defined in `globals.css` have corresponding reduced-motion fallbacks
**Plans:** 1/1 plans complete
Plans:
- [x] 05-01-PLAN.md — Add reduced-motion media query block and verify shadow tokens

### Phase 6: Shared UI Components
**Goal**: Every shared UI component is brand-correct, accessible, and portal-capable — portal variant components exist for Button/Input/Select/Textarea/Toggle, color tokens are applied, ARIA attributes are present, and the gray→slate migration is complete.
**Depends on**: Phase 5
**Requirements**: PRTL-01, PRTL-02, PRTL-03, PRTL-04, PRTL-05, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, COMP-09, COMP-10, COMP-11, COMP-12, COMP-13, COMP-14, COMP-15, COMP-16, COMP-17, XCUT-01
**Success Criteria** (what must be TRUE):
  1. Buttons rendered in portal context show the cyan-to-teal gradient with cyan focus ring (not indigo)
  2. All interactive components (Modal, Breadcrumbs, Card, SearchSelect) respond correctly to keyboard navigation and expose correct ARIA roles and labels to screen readers
  3. All 12 chart components have `aria-label` and `role="img"` and stop animating when the user has prefers-reduced-motion enabled
  4. No shared UI component uses `gray-*` palette classes — all instances are `slate-*`
  5. Warning states on Alert, Badge, and Toast show amber (not yellow); info states show indigo (not blue)
**Plans:** 5 plans
Plans:
- [ ] 06-01-PLAN.md — Portal variants for Button/Input/Select/Textarea/Toggle + Toggle/Textarea admin color fixes
- [ ] 06-02-PLAN.md — Color corrections for Alert, Badge, Spinner, Toast, Pagination
- [ ] 06-03-PLAN.md — ARIA and keyboard accessibility for Modal, SearchSelect, Breadcrumbs, Card
- [ ] 06-04-PLAN.md — Charts ARIA + reduced-motion + useReducedMotion hook + StatCard fixes
- [ ] 06-05-PLAN.md — Gray-to-slate migration + dark mode removal + StatusBadge refactor

### Phase 7: Scanner Components
**Goal**: Every scanner component meets the warehouse floor accessibility standard — all tap targets are at least 44px, all text is at least text-base size, and dark mode classes are removed.
**Depends on**: Phase 6
**Requirements**: SCAN-01, SCAN-02, SCAN-03, SCAN-04, SCAN-05, SCAN-06, SCAN-07, SCAN-08
**Success Criteria** (what must be TRUE):
  1. A warehouse worker using any scanner page (PickingScanner, PickScanner, PackScanner, ShipScanner, ReceivingScanner, PalletBreakdownScanner) can tap every button without precision — no button is smaller than 44×44px
  2. All instructional and status text in scanner components is at least text-base — nothing requires squinting to read on a handheld device
  3. The BarcodeScanner close button and instruction text meet the same 44px and text-base standards
  4. Pagination buttons are at least 44×44px, making them safe for use on Pick/Putaway/Inspection scanner routes
**Plans**: TBD

### Phase 8: Admin Pages
**Goal**: Every admin-facing page uses the correct indigo brand palette and scanner pages are fully compliant — no blue/yellow/purple inline overrides remain and all scanner-route admin pages pass the tap-target rubric.
**Depends on**: Phase 6
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04, ADMN-05, ADMN-06, ADMN-07, ADMN-08, ADMN-09, ADMN-10, SCAN-09, SCAN-10, SCAN-11
**Success Criteria** (what must be TRUE):
  1. The admin Dashboard, Inbound, Outbound, Tasks, Lots, Reports, Settings, and Inventory List pages show only indigo and amber for brand/status colors — no blue, yellow, or purple inline overrides remain
  2. The Inventory Transfers scanner page uses the slate palette throughout and has no action buttons below 44px
  3. The Pick Queue, Putaway Queue, and Inspection Queue pages have no action buttons below 44px
  4. The Location Sublocations page uses the slate/indigo palette exclusively with correct focus rings on all form inputs
  5. The Task Detail page back button is at least 44px and the timeline uses indigo indicators
**Plans**: TBD

### Phase 9: Portal Pages
**Goal**: Every portal-facing page uses the correct cyan brand palette — no blue or indigo inline overrides remain, portal auth pages match the dark-gradient login design, and all portal-specific flows feel visually cohesive.
**Depends on**: Phase 6
**Requirements**: PRTP-01, PRTP-02, PRTP-03, PRTP-04, PRTP-05, PRTP-06, PRTP-07, PRTP-08, PRTP-09
**Success Criteria** (what must be TRUE):
  1. Portal order, inventory, lot, and billing pages show only cyan/teal for brand colors — no blue or indigo inline overrides remain
  2. The portal forgot-password and reset-password pages show the dark gradient background matching the client-login page design
  3. The portal templates page uses the cyan gradient CTA button and cyan icon containers; all form fields use design system components
  4. The request-shipment confirmation page and billing/plan pages are fully cyan-branded
  5. The Shopify location integration page shows cyan for selected state and the save button uses the portal Button variant
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in dependency order: 5 → 6 → 7 (parallel with 8) → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Tool Setup and Design System | v1.0 | 2/2 | Complete | 2026-03-18 |
| 2. Component Library Audit | v1.0 | 2/2 | Complete | 2026-03-19 |
| 3. Page Audits | v1.0 | 3/3 | Complete | 2026-03-19 |
| 4. Action Plan Compilation | v1.0 | 2/2 | Complete | 2026-03-19 |
| 5. Design Tokens | v2.0 | 1/1 | Complete | 2026-03-19 |
| 6. Shared UI Components | v2.0 | 0/5 | Not started | - |
| 7. Scanner Components | v2.0 | 0/? | Not started | - |
| 8. Admin Pages | v2.0 | 0/? | Not started | - |
| 9. Portal Pages | v2.0 | 0/? | Not started | - |
