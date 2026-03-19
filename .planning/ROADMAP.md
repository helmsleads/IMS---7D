# Roadmap: IMS-7D UI/UX Audit & Design System

## Overview

This milestone layers structured design intelligence onto a mature 60+ page warehouse management application. The work proceeds through a strict dependency chain: install and configure the audit tool, lock in a 3PL-specific design system, audit shared components (so page findings can trace to their root cause), audit all admin and portal pages against the design system, then synthesize findings into a tiered, sequenced action plan that drives the next milestone. Every phase produces artifacts consumed by the next — no source code is modified.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Tool Setup and Design System** - Install uipro-cli, lock constraints, and generate the 3PL-specific MASTER.md design system (completed 2026-03-18)
- [x] **Phase 2: Component Library Audit** - Audit all shared UI components against the design system to establish root-cause taxonomy before page audits (completed 2026-03-19)
- [ ] **Phase 3: Page Audits** - Audit all admin and portal pages against the design system, informed by component findings
- [ ] **Phase 4: Action Plan Compilation** - Synthesize all findings into a tiered, sequenced implementation action plan

## Phase Details

### Phase 1: Tool Setup and Design System
**Goal**: The audit tool is operational and a warehouse-specific design system exists as a locked evaluation rubric for all subsequent work
**Depends on**: Nothing (first phase)
**Requirements**: SETUP-01, SETUP-02, SETUP-03, SETUP-04, DSYS-01, DSYS-02, DSYS-03
**Success Criteria** (what must be TRUE):
  1. User can invoke uipro-cli from the command line and Claude Code activates the skill automatically from natural language prompts
  2. User can open `design-system/ims7d/MASTER.md` and find separate token sections for admin (indigo) and portal (cyan) brand variants
  3. User can see scanner-facing routes explicitly listed and tagged before any audit runs
  4. User can verify the generated design tokens reference the same CSS custom property names as `src/app/globals.css`
  5. User can confirm dashboard widget minimum grid cell dimensions are recorded in the design system before component auditing begins
**Plans:** 2/2 plans complete

Plans:
- [ ] 01-01-PLAN.md — Install uipro-cli, verify Python + skill connectivity, compile scanner routes and dashboard grid constraints
- [ ] 01-02-PLAN.md — Generate dual-brand MASTER.md design system and validate tokens against globals.css

### Phase 2: Component Library Audit
**Goal**: Every shared UI component has been evaluated against MASTER.md with severity-rated findings, establishing a root-cause taxonomy that prevents the same component defect appearing as dozens of separate page findings
**Depends on**: Phase 1
**Requirements**: COMP-01, COMP-02, COMP-03
**Success Criteria** (what must be TRUE):
  1. User can open `.planning/audit/components.md` and find a finding entry for each of the 15+ shared components (Button, Card, Modal, Table, Input, Select, Badge, etc.)
  2. User can see each finding rated as Blocking, High, Medium, or Low severity
  3. User can identify which components have accessibility gaps — missing focus states, failing contrast ratios, or absent ARIA attributes
**Plans:** 2/2 plans complete

Plans:
- [ ] 02-01-PLAN.md — Audit 27 shared UI components (5 dimensions each) and create components.md with root-cause taxonomy
- [ ] 02-02-PLAN.md — Audit 10 scanner components with warehouse floor rubric, add cross-cutting findings, finalize summary counts

### Phase 3: Page Audits
**Goal**: Every admin and portal page has been evaluated against the design system with findings that classify each issue as either page-specific or tracing back to a shared component
**Depends on**: Phase 2
**Requirements**: PADM-01, PADM-02, PADM-03, PPRT-01, PPRT-02, PPRT-03
**Success Criteria** (what must be TRUE):
  1. User can open `.planning/audit/admin-pages.md` and find severity-rated findings for all admin pages including scanner/warehouse floor pages evaluated against the 44px+ tap target and high-contrast rubric
  2. User can open `.planning/audit/portal-pages.md` and find severity-rated findings for all portal pages evaluated against the cyan brand guidelines
  3. User can identify which portal pages have unintentionally diverged from portal brand (cyan) versus those with intentional design overrides
  4. User can see each page finding classified as either "source: component" (traces to Phase 2) or "source: inline override" (page-specific)
**Plans:** 1/3 plans executed

Plans:
- [ ] 03-01-PLAN.md — Audit admin core pages (~30 pages: Dashboard, Inventory, Products, Inbound, Outbound, Clients, Billing)
- [ ] 03-02-PLAN.md — Audit all portal pages (~29 pages) with brand divergence detection
- [ ] 03-03-PLAN.md — Audit admin remaining pages (~32 pages: Reports, Tasks, Locations, Settings, etc.) and finalize summary

### Phase 4: Action Plan Compilation
**Goal**: All component and page findings are synthesized into a tiered, sequenced implementation guide with capped tiers that the next milestone can execute without paralysis
**Depends on**: Phase 3
**Requirements**: PLAN-01, PLAN-02, PLAN-03, PLAN-04
**Success Criteria** (what must be TRUE):
  1. User can open `.planning/action-plan/PRIORITIES.md` and find a Blocking tier (<=20 items), a High-value tier (<=40 items), and a Polish backlog — with no tier exceeding its cap
  2. User can identify quick wins: changes with high visual impact and low implementation effort, surfaced as a distinct list
  3. User can open `.planning/action-plan/IMPLEMENTATION.md` and find each action item with a specific file path, the exact change required, and an effort estimate
  4. User can hand the action plan directly to the next milestone as implementation input without needing further synthesis or re-prioritization
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Tool Setup and Design System | 2/2 | Complete    | 2026-03-18 |
| 2. Component Library Audit | 2/2 | Complete    | 2026-03-19 |
| 3. Page Audits | 1/3 | In Progress|  |
| 4. Action Plan Compilation | 0/TBD | Not started | - |
