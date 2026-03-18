# Requirements: IMS-7D UI/UX Audit & Design System

**Defined:** 2026-03-18
**Core Value:** Platform must look and feel purpose-built for 3PL warehouse management — professional, consistent, and industry-appropriate across every page.

## v1.0 Requirements

Requirements for UI/UX audit milestone. Each maps to roadmap phases.

### Tool Setup

- [ ] **SETUP-01**: User can install uipro-cli globally and initialize it for Claude Code integration
- [ ] **SETUP-02**: User can configure dual-brand constraints (admin indigo, portal cyan) as hard rules before audit
- [ ] **SETUP-03**: User can verify Python 3.x availability and test uipro-cli connection
- [ ] **SETUP-04**: User can compile scanner-facing route inventory and dashboard grid cell dimensions as audit inputs

### Design System

- [ ] **DSYS-01**: User can generate a 3PL/warehouse-specific MASTER.md design system with colors, typography, layouts, effects, and anti-patterns
- [ ] **DSYS-02**: User can review design system recommendations for both admin (indigo) and portal (cyan) brand variants
- [ ] **DSYS-03**: User can validate generated design tokens against existing globals.css custom properties

### Component Audit

- [ ] **COMP-01**: User can audit all shared UI components (Button, Card, Modal, Table, Input, Select, Badge, etc.) against the generated design system
- [ ] **COMP-02**: User can review component findings with severity ratings (blocking, high, medium, low)
- [ ] **COMP-03**: User can identify accessibility gaps in shared components (focus states, contrast ratios, ARIA)

### Page Audit — Admin

- [ ] **PADM-01**: User can audit all admin pages (dashboard, inventory, orders, billing, reports, settings) against design system
- [ ] **PADM-02**: User can audit scanner/warehouse floor pages with warehouse-specific rubric (44x44px tap targets, high contrast, glove-friendly)
- [ ] **PADM-03**: User can review per-page findings with inconsistency documentation

### Page Audit — Portal

- [ ] **PPRT-01**: User can audit all portal pages (dashboard, orders, inventory, billing, arrivals, integrations) against design system
- [ ] **PPRT-02**: User can review portal-specific findings against cyan brand guidelines
- [ ] **PPRT-03**: User can identify portal pages that unintentionally diverge from portal brand

### Action Plan

- [ ] **PLAN-01**: User can review a severity-tiered action plan with capped tiers (Blocking ≤20, High-value ≤40)
- [ ] **PLAN-02**: User can identify quick wins (high impact, low effort changes)
- [ ] **PLAN-03**: User can review a sequenced implementation roadmap with effort estimates for each change
- [ ] **PLAN-04**: User can use the action plan as direct input for the next milestone's implementation phases

## v2 Requirements

Deferred to implementation milestone.

### Design Implementation

- **IMPL-01**: Apply design system tokens to globals.css and Tailwind config
- **IMPL-02**: Update shared UI components to match design system
- **IMPL-03**: Update admin pages per action plan priorities
- **IMPL-04**: Update portal pages per action plan priorities
- **IMPL-05**: Validate scanner pages meet warehouse-specific accessibility standards

## Out of Scope

| Feature | Reason |
|---------|--------|
| Implementing UI changes | Audit-only milestone; implementation deferred to v2 |
| Backend/API changes | Purely visual/UX focused |
| New features or functionality | Audit existing, don't add new |
| Mobile app design | Web platform only |
| Automated testing of visual changes | No code changes to test |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SETUP-01 | — | Pending |
| SETUP-02 | — | Pending |
| SETUP-03 | — | Pending |
| SETUP-04 | — | Pending |
| DSYS-01 | — | Pending |
| DSYS-02 | — | Pending |
| DSYS-03 | — | Pending |
| COMP-01 | — | Pending |
| COMP-02 | — | Pending |
| COMP-03 | — | Pending |
| PADM-01 | — | Pending |
| PADM-02 | — | Pending |
| PADM-03 | — | Pending |
| PPRT-01 | — | Pending |
| PPRT-02 | — | Pending |
| PPRT-03 | — | Pending |
| PLAN-01 | — | Pending |
| PLAN-02 | — | Pending |
| PLAN-03 | — | Pending |
| PLAN-04 | — | Pending |

**Coverage:**
- v1.0 requirements: 20 total
- Mapped to phases: 0
- Unmapped: 20 (pending roadmap)

---
*Requirements defined: 2026-03-18*
*Last updated: 2026-03-18 after initial definition*
