# IMS-7D UI/UX Overhaul

## What This Is

A warehouse management system (IMS) built for 7 Degrees Co, a 3PL provider. Dual-portal Next.js app with Supabase backend — internal staff portal (admin) and external client portal. The platform has been fully audited against a 3PL-specific design system with a comprehensive implementation action plan ready for execution.

## Core Value

The platform must look and feel purpose-built for 3PL warehouse management — professional, consistent, and industry-appropriate across every page.

## Requirements

### Validated

- ✓ UI/UX Max Pro integration and configuration — v1.0
- ✓ 3PL-specific design system with dual-brand tokens (admin indigo, portal cyan) — v1.0
- ✓ Shared UI component audit (37 components, 195 findings, root cause taxonomy) — v1.0
- ✓ Admin page audit (62 pages, 213 findings, scanner floor rubric) — v1.0
- ✓ Portal page audit (29 pages, 116 findings, brand divergence detection) — v1.0
- ✓ Severity-tiered action plan with capped tiers and quick wins — v1.0
- ✓ Wave-structured implementation guide with file paths and effort estimates — v1.0

### Active

- [ ] Apply design system tokens to globals.css (reduced-motion, CSS custom properties)
- [ ] Add portal variants to Button, Input, Select, Textarea, Toggle components
- [ ] Fix scanner tap targets (44px minimum) across 7 scanner components + Pagination
- [ ] Fix scanner text sizes (text-base minimum) across 5 scanner components
- [ ] Add ARIA attributes to Modal, SearchSelect, Breadcrumbs, Card, charts
- [ ] Migrate gray→slate across all shared UI components (~19 components)
- [ ] Fix admin page inline color corrections (blue→indigo, yellow→amber)
- [ ] Fix portal page inline color corrections (blue→cyan, indigo→cyan)
- [ ] Add prefers-reduced-motion guards to animations and charts
- [ ] Validate all changes against MASTER.md rubric

### Out of Scope

- Mobile app design — web platform only
- Backend/API changes — purely visual/UX focused
- New features or functionality — audit and implement existing design improvements only

## Context

Shipped v1.0 audit milestone with 524 findings across 91 pages and 37 components.
Tech stack: Next.js 14, Tailwind CSS, Supabase, TypeScript.
Design system: `design-system/ims7d/MASTER.md` (dual-brand, warehouse-specific).
Action plan: `.planning/action-plan/PRIORITIES.md` + `IMPLEMENTATION.md` (5-wave structure).
Key finding: component-layer fixes have enormous multiplier effects — Button portal variant alone resolves 38 Blocking findings.

## Constraints

- **Tech stack**: Next.js 14, Tailwind CSS, Supabase — all changes within these
- **Dual-brand**: Admin (indigo) and portal (cyan) must remain visually distinct
- **Wave dependencies**: globals.css → shared components → scanner components → pages
- **Tier caps**: Blocking ≤20 items, High-value ≤40 items (from audit action plan)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Audit-first approach | Data-driven action plan vs guessing | ✓ Good — 524 findings with root causes |
| UI/UX Max Pro as design intelligence | 161 industry rules, warehouse coverage | ✓ Good — produced MASTER.md rubric |
| Component-before-page audit order | Enables root cause tracing | ✓ Good — RC taxonomy prevents duplicate findings |
| Per-component granularity for portal variants | Each component variant is a separate Blocking item | ✓ Good — clear implementation scope |
| 5-wave implementation structure | Dependency-ordered: globals → components → scanner → pages | -- Pending (v2.0) |

## Current Milestone: v2.0 UI/UX Implementation

**Goal:** Execute the severity-tiered action plan — apply design system tokens, fix all 20 Blocking items, resolve 40 High-Value items, and bring the platform to visual/UX production quality across all 91 pages.

**Target features:**
- Apply design system tokens to globals.css and Tailwind config (Wave 0)
- Update shared UI components — portal variants, color corrections, accessibility fixes (Wave 1)
- Fix scanner components for tap targets, text sizes, and color corrections (Wave 2)
- Update admin pages per action plan priorities (Wave 3)
- Update portal pages per action plan priorities (Wave 4)

---
*Last updated: 2026-03-19 after v2.0 milestone start*
