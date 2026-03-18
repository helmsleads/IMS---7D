# IMS-7D UI/UX Overhaul

## What This Is

A warehouse management system (IMS) built for 7 Degrees Co, a 3PL provider. Dual-portal Next.js app with Supabase backend — internal staff portal (admin) and external client portal. This milestone focuses on integrating UI/UX Max Pro to audit the platform's visual design and produce a comprehensive, industry-specific design system and action plan.

## Core Value

The platform must look and feel purpose-built for 3PL warehouse management — professional, consistent, and industry-appropriate across every page.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- Existing design system: indigo admin, cyan portal, slate neutrals, frosted glass modals
- Dual-portal layout: AppShell (admin) + PortalShell (client) with sidebar navigation
- Custom UI components: Button, Card, Badge, Modal, Input, Select, Table, etc.
- Dashboard widget system with drag-drop customization and layout persistence
- Responsive mobile support with collapsible sidebars

### Active

<!-- Current scope. Building toward these. -->

- [ ] Install and configure UI/UX Max Pro skill for Claude integration
- [ ] Generate 3PL/warehouse-specific design system (colors, typography, layouts, patterns)
- [ ] Audit all admin pages against generated design system
- [ ] Audit all portal pages against generated design system
- [ ] Audit shared UI components for consistency and polish
- [ ] Produce prioritized action plan for implementation

### Out of Scope

- Implementing UI changes to the platform — deferred to next milestone
- Backend/API changes — this is purely visual/UX focused
- New features or functionality — audit only
- Mobile app design — web only

## Context

- Platform has ~60+ pages across admin and portal
- Existing design system documented in memory/design-system.md
- UI/UX Max Pro provides 67 UI styles, 161 color palettes, 57 font pairings, 99 UX guidelines
- Tool supports Next.js + Tailwind CSS stack (our exact stack)
- 161 industry-specific reasoning rules including logistics/warehouse patterns

## Constraints

- **Tech stack**: Next.js 14, Tailwind CSS, Supabase — design system must work within these
- **Dual-brand**: Admin (indigo) and portal (cyan) must remain visually distinct
- **No breaking changes**: Audit only — no code modifications in this milestone
- **Tool**: UI/UX Max Pro CLI (`uipro-cli`) for design system generation

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Audit-first approach | Let the tool identify issues rather than guessing; produces data-driven action plan | -- Pending |
| UI/UX Max Pro as design intelligence | 161 industry rules, warehouse/logistics coverage, integrates with Claude | -- Pending |

## Current Milestone: v1.0 UI/UX Audit & Design System

**Goal:** Install UI/UX Max Pro, generate a 3PL-specific design system, audit every page, and produce a prioritized action plan for implementation.

**Target features:**
- UI/UX Max Pro integration and configuration
- Industry-specific design system generation
- Comprehensive page-by-page audit
- Prioritized implementation action plan

---
*Last updated: 2026-03-18 after milestone v1.0 initialization*
