# Requirements: IMS-7D UI/UX Implementation

**Defined:** 2026-03-19
**Core Value:** Platform must look and feel purpose-built for 3PL warehouse management — professional, consistent, and industry-appropriate across every page.

## v2.0 Requirements

Requirements for UI/UX implementation milestone. Each maps to roadmap phases.

### Design Tokens

- [x] **TOKN-01**: globals.css contains `@media (prefers-reduced-motion: reduce)` block covering all custom keyframes (modal-scale-up/down, widget-enter, chart-enter)
- [x] **TOKN-02**: CSS custom properties for shadow tokens (--shadow-card, --shadow-modal, --shadow-elevated) are defined and available

### Portal Variants

- [x] **PRTL-01**: Button component has portal variant (`from-cyan-500 to-teal-600`, `focus-visible:ring-cyan-500`)
- [x] **PRTL-02**: Input component has portal variant (`focus-visible:ring-cyan-500`)
- [x] **PRTL-03**: Select component has portal variant (`focus-visible:ring-cyan-500`)
- [x] **PRTL-04**: Textarea component has portal variant (`focus-visible:ring-cyan-500`)
- [x] **PRTL-05**: Toggle component has portal variant (`bg-cyan-600` active state)

### Scanner Accessibility

- [ ] **SCAN-01**: PickingScanner has no buttons below 44px tap target and no text below text-base
- [ ] **SCAN-02**: PickScanner has no buttons below 44px tap target and no text below text-base
- [ ] **SCAN-03**: PackScanner has no buttons below 44px tap target and no text below text-base
- [ ] **SCAN-04**: ShipScanner has no buttons below 44px tap target and no text below text-base
- [ ] **SCAN-05**: ReceivingScanner has no buttons below 44px tap target and no text below text-base
- [ ] **SCAN-06**: PalletBreakdownScanner has no buttons below 44px tap target, no text below text-base, error dismiss ≥44px
- [ ] **SCAN-07**: BarcodeScanner close button ≥44px, instruction text ≥text-base
- [ ] **SCAN-08**: Pagination buttons are min 44x44px for scanner route usage
- [ ] **SCAN-09**: Inventory Transfers page uses slate palette, no size="sm" action buttons, text-base date cells
- [ ] **SCAN-10**: Task queue pages (Pick/Putaway/Inspection) have no size="sm" action buttons
- [ ] **SCAN-11**: Location Sublocations page uses slate/indigo palette with correct focus rings

### Component Colors & ARIA

- [x] **COMP-01**: Alert component uses amber for warning, indigo for info, has dismiss button aria-label and focus-visible:ring
- [x] **COMP-02**: Badge component uses amber for warning, indigo for info, has border pattern on all variants
- [x] **COMP-03**: Spinner uses indigo-600, slate-200, has role="status" and aria-label, motion-safe prefix
- [x] **COMP-04**: StatCard iconColor defaults to indigo-50/indigo-600 instead of blue
- [x] **COMP-05**: Toast uses indigo for info, has warning variant (amber), motion-safe prefix, focus-visible dismiss
- [x] **COMP-06**: Toggle admin checked state uses indigo-600, unchecked slate-200, focus-visible:ring-indigo-500
- [x] **COMP-07**: Textarea admin uses focus-visible:ring-indigo-500, rounded-md, slate palette
- [x] **COMP-08**: Pagination active page uses indigo-600, all buttons have focus-visible:ring, slate palette
- [x] **COMP-09**: Breadcrumbs has aria-label on nav, home icon link, and focus-visible:ring on all links
- [x] **COMP-10**: Card has role="button", tabIndex, onKeyDown when onClick present, focus-visible:ring on clickable
- [x] **COMP-11**: Modal has role="dialog", aria-modal="true", aria-labelledby, close button aria-label and focus-visible:ring
- [x] **COMP-12**: SearchSelect has ARIA combobox pattern (role="combobox", role="listbox", role="option")
- [x] **COMP-13**: All 12 chart components have aria-label prop and role="img" wrapper
- [x] **COMP-14**: All Recharts chart components respect prefers-reduced-motion via isAnimationActive
- [x] **COMP-15**: Gray→slate migration complete across all shared UI components (~19 components)
- [x] **COMP-16**: Dark mode classes removed from 5 scanner components (outside MASTER.md scope)
- [x] **COMP-17**: StatusBadge refactored from Tailwind class key to semantic status→variant mapping

### Admin Pages

- [ ] **ADMN-01**: Dashboard page uses indigo StatCard icons, no decorative blobs, rounded-md hero buttons, focus-visible:ring
- [ ] **ADMN-02**: Inbound and Outbound list pages use amber (not yellow) and indigo (not blue/purple) status tabs
- [ ] **ADMN-03**: Tasks List page uses indigo icons, Badge component for priority
- [ ] **ADMN-04**: Lots List page uses indigo tabs, count badges, search input, and lot number links
- [ ] **ADMN-05**: Reports Hub uses indigo icon colors, focus-visible:ring on report card links
- [ ] **ADMN-06**: Location Sublocations non-Blocking overrides use indigo palette
- [ ] **ADMN-07**: Settings page active sidebar tab uses indigo palette
- [ ] **ADMN-08**: Inventory List status map uses amber for quarantine, indigo for reserved, slate for returned
- [ ] **ADMN-09**: Outbound orders list uses cyan for "portal" source badge, slate for "internal"
- [ ] **ADMN-10**: Task Detail page uses ≥44px back button, text-sm timestamps, indigo timeline indicator

### Portal Pages

- [ ] **PRTP-01**: Portal orders/[id] status config uses cyan for packed/confirmed (not indigo/blue)
- [ ] **PRTP-02**: Portal inventory/[id] uses cyan for lot tracking badge, shipment button, spinner
- [ ] **PRTP-03**: Portal inventory/history uses cyan for ship/pack transaction types
- [ ] **PRTP-04**: Portal lots/[id] uses cyan for transfer/shipped transaction types
- [ ] **PRTP-05**: Portal auth flow (forgot-password, reset-password) has dark gradient background matching client-login
- [ ] **PRTP-06**: Portal templates page uses cyan gradient CTA, cyan icon containers, design system form components
- [ ] **PRTP-07**: Portal integrations/shopify/location uses cyan for selected location and info box, Button variant="portal"
- [ ] **PRTP-08**: Portal request-shipment/confirmation uses cyan palette (not blue)
- [ ] **PRTP-09**: Portal billing/plan pages use cyan palette (not blue)

### Cross-Cutting

- [x] **XCUT-01**: StatCard useAnimatedNumber hook respects prefers-reduced-motion
- [x] **XCUT-02**: All custom keyframe animations in globals.css have reduced-motion fallbacks

## Future Requirements

Deferred to Polish milestone. Tracked but not in current roadmap.

### Polish Backlog

- **PLSH-01**: Page-level gray→slate inline overrides (15 pages, P-01 through P-15)
- **PLSH-02**: Page-level RC-02 color corrections below Quick Wins threshold (P-16 through P-26)
- **PLSH-03**: Remaining focus:ring→focus-visible:ring on pages (P-27 through P-33)
- **PLSH-04**: Component props API gaps (P-34 through P-41)
- **PLSH-05**: Component non-use on pages — replace raw HTML with design system components (P-42 through P-47)
- **PLSH-06**: CommandPalette improvements (P-48 through P-51)
- **PLSH-07**: Error/utility component polish (P-52 through P-54)
- **PLSH-08**: Scanner component color corrections — gray→slate, blue→indigo (P-55 through P-60)
- **PLSH-09**: Chart component minor fixes (P-61 through P-64)
- **PLSH-10**: Low priority polish items (P-65 through P-76)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Polish backlog items (P-01 through P-76) | Medium/Low severity — deferred to future milestone |
| New features or functionality | This milestone is purely visual/UX |
| Backend/API changes | Frontend-only scope |
| Mobile app design | Web platform only |
| Dark mode support | MASTER.md is light-mode only; remove stray dark: classes |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TOKN-01 | Phase 5 | Complete |
| TOKN-02 | Phase 5 | Complete |
| XCUT-02 | Phase 5 | Complete |
| PRTL-01 | Phase 6 | Complete |
| PRTL-02 | Phase 6 | Complete |
| PRTL-03 | Phase 6 | Complete |
| PRTL-04 | Phase 6 | Complete |
| PRTL-05 | Phase 6 | Complete |
| COMP-01 | Phase 6 | Complete |
| COMP-02 | Phase 6 | Complete |
| COMP-03 | Phase 6 | Complete |
| COMP-04 | Phase 6 | Complete |
| COMP-05 | Phase 6 | Complete |
| COMP-06 | Phase 6 | Complete |
| COMP-07 | Phase 6 | Complete |
| COMP-08 | Phase 6 | Complete |
| COMP-09 | Phase 6 | Complete |
| COMP-10 | Phase 6 | Complete |
| COMP-11 | Phase 6 | Complete |
| COMP-12 | Phase 6 | Complete |
| COMP-13 | Phase 6 | Complete |
| COMP-14 | Phase 6 | Complete |
| COMP-15 | Phase 6 | Complete |
| COMP-16 | Phase 6 | Complete |
| COMP-17 | Phase 6 | Complete |
| XCUT-01 | Phase 6 | Complete |
| SCAN-01 | Phase 7 | Pending |
| SCAN-02 | Phase 7 | Pending |
| SCAN-03 | Phase 7 | Pending |
| SCAN-04 | Phase 7 | Pending |
| SCAN-05 | Phase 7 | Pending |
| SCAN-06 | Phase 7 | Pending |
| SCAN-07 | Phase 7 | Pending |
| SCAN-08 | Phase 7 | Pending |
| ADMN-01 | Phase 8 | Pending |
| ADMN-02 | Phase 8 | Pending |
| ADMN-03 | Phase 8 | Pending |
| ADMN-04 | Phase 8 | Pending |
| ADMN-05 | Phase 8 | Pending |
| ADMN-06 | Phase 8 | Pending |
| ADMN-07 | Phase 8 | Pending |
| ADMN-08 | Phase 8 | Pending |
| ADMN-09 | Phase 8 | Pending |
| ADMN-10 | Phase 8 | Pending |
| SCAN-09 | Phase 8 | Pending |
| SCAN-10 | Phase 8 | Pending |
| SCAN-11 | Phase 8 | Pending |
| PRTP-01 | Phase 9 | Pending |
| PRTP-02 | Phase 9 | Pending |
| PRTP-03 | Phase 9 | Pending |
| PRTP-04 | Phase 9 | Pending |
| PRTP-05 | Phase 9 | Pending |
| PRTP-06 | Phase 9 | Pending |
| PRTP-07 | Phase 9 | Pending |
| PRTP-08 | Phase 9 | Pending |
| PRTP-09 | Phase 9 | Pending |

**Coverage:**
- v2.0 requirements: 56 total
- Mapped to phases: 56
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — traceability populated after roadmap creation*
