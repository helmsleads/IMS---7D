# Project Research Summary

**Project:** IMS-7D UI/UX Audit and Design System
**Domain:** UI/UX audit tooling + design system generation for existing 3PL warehouse management SaaS
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is not building a new product — it is layering structured design intelligence onto a mature, 60+ page warehouse management application. The approach centers on installing the UI/UX Max Pro skill (via `uipro-cli`) into the Claude Code environment, generating a warehouse-specific design system as a persistent reference document, and then conducting a systematic audit of all admin and portal pages against that reference. The entire milestone produces only markdown artifacts — no source code is modified. The next milestone consumes the audit output to implement improvements.

The recommended approach is strictly sequential: install the skill, generate `design-system/ims7d/MASTER.md` once with all constraints stated upfront (dual-brand, warehouse operator persona, Next.js/Tailwind 4 stack), audit shared components before any page, then audit admin pages, then portal pages, then compile a tiered action plan. This sequencing is not a preference — it is load-bearing. Auditing pages before the design system exists produces uncheckable findings. Auditing pages before components inflates the action plan with duplicate entries that all trace to one shared component fix.

The dominant risk in this milestone is context contamination: audit tools optimize for consistency and consumer-grade UX without knowing that this app has two intentionally distinct brands (indigo admin, cyan portal), warehouse floor interfaces requiring 48px+ touch targets, and a dashboard widget grid system that breaks if component sizing changes without grid math validation. Every phase requires explicit constraint injection before the tool runs. The second risk is action plan paralysis — a thorough audit of 60+ pages will produce hundreds of findings that must be tiered (Blocking / High-value / Polish) before the implementation milestone can use them.

## Key Findings

### Recommended Stack

UI/UX Max Pro (`uipro-cli` v2.5.0) is the sole new dependency for this milestone. It installs as a self-contained Claude Code skill under `.claude/skills/ui-ux-pro-max/` — not as a project `node_modules` dependency. The tool ships a pure Python stdlib BM25 search engine with 10 domain CSVs covering 161 product types, 96 color palettes, 99 UX guidelines, and 161 industry reasoning rules (including logistics/warehouse). Both runtime prerequisites — Node.js 22.17.0 and Python 3.11.9 — are already present. No additional package installs are needed.

**Core technologies:**
- `uipro-cli@2.5.0`: One-time global install, initializes the Claude Code skill — primary tool for design intelligence
- Python 3.11.9 (stdlib only): Runtime for `search.py`, `core.py`, `design_system.py` — already installed, no pip deps required
- Node.js 22.17.0: Required only to install `uipro-cli` globally — already present, no version change needed

For full version compatibility and installation commands, see `.planning/research/STACK.md`.

### Expected Features

This milestone delivers audit artifacts, not user-facing features. The "features" are the outputs the next (implementation) milestone depends on.

**Must have (table stakes):**
- Industry-specific design system covering color tokens (admin + portal separately), typography scale, spacing scale, and semantic status colors — the evaluation rubric for all audit findings
- Component inventory with inconsistency report — 15+ custom components assessed for variant drift and violations
- Severity-rated findings per page (all 60+ admin and portal pages) — P1/P2/P3 or Blocking/High-value/Polish
- Prioritized action plan with implementation sequencing — token → component → page → cross-cutting, prevents rework
- Quick wins list — surfaces high-impact, low-effort items for immediate momentum

**Should have (competitive differentiators for this audit):**
- 3PL/logistics-specific design rationale documented — warehouse-specific justifications, not generic SaaS advice
- Dual-brand audit with explicit divergence documentation — intentional admin/portal differences vs. unintentional drift
- Data table audit for information density — most pages are table-primary; column hierarchy and batch-action standards needed
- Dashboard widget visual audit — 24 widgets need data-ink ratio and scanability assessment
- Accessibility assessment (high-traffic pages) — WCAG AA compliance check focused on contrast and focus states

**Defer (v2+):**
- Live component library (Storybook) — implementation work, not audit work
- Scanner/mobile interface audit — add only after warehouse staff report usability issues; requires device testing
- Dark mode design system — not part of existing design, requires separate product decision
- Animation and motion audit — low impact for an operational logistics tool

For complete feature dependency graph, see `.planning/research/FEATURES.md`.

### Architecture Approach

The architecture is a read-only audit pipeline with a strict layered hierarchy: the installed skill reads the existing codebase and generates a design system reference (`design-system/ims7d/MASTER.md`); subsequent audit passes read both the design system and source files to produce findings in `.planning/audit/`; the final action plan in `.planning/action-plan/` distills findings into implementation-ready instructions. Zero source files are modified during this milestone — `src/app/globals.css` and all components in `src/components/ui/` are read targets only.

**Major components:**
1. `.claude/skills/ui-ux-pro-max/` — BM25 design intelligence engine; auto-activates from natural language; self-contained, no external deps
2. `design-system/ims7d/MASTER.md` — generated global design system; source of truth for all audit evaluations; generated once, locked before audits begin
3. `design-system/ims7d/pages/*.md` — per-page design overrides; page rules win over MASTER when they conflict; one file per audited page group
4. `.planning/audit/` (components.md, admin-pages.md, portal-pages.md) — audit findings in finding/severity/current/recommended format; produced by Claude during audit workflow
5. `.planning/action-plan/` (PRIORITIES.md, IMPLEMENTATION.md) — tiered action plan with file paths, specific changes, and effort estimates

The key architectural constraint is Tailwind CSS 4's config-free model: there is no `tailwind.config.ts` in this project. All token integration targets `src/app/globals.css` via CSS custom properties (`--color-primary`, `--color-portal`, etc.), not a separate config file.

For the full system diagram and data flow, see `.planning/research/ARCHITECTURE.md`.

### Critical Pitfalls

1. **Audit collapses dual-brand differentiation** — The tool has no awareness of the intentional admin (indigo) / portal (cyan) visual split. Without explicit constraint injection, it will normalize colors across both portals. Prevention: state dual-brand constraint before any audit runs; generate separate token sets per portal; never run a single unified palette generation.

2. **Scanner interfaces degraded by consumer-grade standards** — Warehouse floor interfaces (BarcodeScanner, inbound receiving, cycle counts, pick/pack) require 48px+ touch targets, 16px+ body text, and max 3 actions per screen. Audit tools apply standard SaaS heuristics that will recommend reducing these. Prevention: pre-classify scanner-facing routes with a warehouse floor rubric; reject any density or sizing reduction on those pages.

3. **Action plan paralysis from untiered findings** — A 60+ page audit will produce hundreds of findings. Without pre-committed tiering (Blocking ≤ 20 items, High-value ≤ 40 items, rest to Polish backlog), the implementation milestone cannot prioritize and may never start. Prevention: define the tier structure before generating the action plan; cap tier sizes before output.

4. **Component inheritance missed, action plan inflated** — Auditing pages before shared components causes the same Button focus ring issue to appear as 37 separate page findings instead of one component fix. Prevention: complete the component library audit before starting any page audit; trace all page findings to their source component.

5. **Dashboard widget grid broken by sizing recommendations** — StatCard and widget Card components are grid-constrained; typography or padding increases that look fine at unconstrained size will overflow saved user layouts. Prevention: document minimum grid cell dimensions for dashboard components before auditing them; validate all size-affecting recommendations against grid math.

6. **Token migration started piecemeal** — Partial adoption of CSS custom property tokens (some components using `var(--color-primary)`, others still using `indigo-500`) produces more inconsistency than the original state. Prevention: mark all token migration items as "full migration required" in the action plan; no partial token changes in Tier 1 or Tier 2.

For full pitfall details and recovery strategies, see `.planning/research/PITFALLS.md`.

## Implications for Roadmap

Based on research, the milestone has four natural phases driven by hard dependencies. Each phase gates the next.

### Phase 1: Tool Setup and Design System Generation

**Rationale:** The entire audit depends on having `design-system/ims7d/MASTER.md` as an evaluation rubric. There is no Phase 2 without it. This phase also locks in all constraints (dual-brand, warehouse persona, grid limitations) that prevent the pitfalls documented in PITFALLS.md. Constraints injected here propagate to every subsequent phase automatically.

**Delivers:**
- `uipro-cli` installed globally; skill verified working
- `design-system/ims7d/MASTER.md` generated with dual-brand anchor (indigo admin, cyan portal), warehouse operator persona, and Next.js/Tailwind 4 context
- Pre-audit constraint documentation: scanner routes tagged, dashboard widget minimum dimensions recorded

**Addresses:**
- UI/UX Max Pro install + config (P1 feature)
- Design system generation — color tokens, typography scale, spacing scale, semantic status colors (P1 feature)

**Avoids:** Brand collapse pitfall (dual-brand constraint stated here), consumer UX applied to operational interface (persona configured here), dashboard grid breakage (minimum dimensions documented here)

**Research flag:** Standard patterns — installation is well-documented; no deeper research needed. The design system generation prompt requires careful constraint specification but the mechanics are clear.

---

### Phase 2: Component Library Audit

**Rationale:** The 15+ shared components appear across all 60+ pages. Auditing components first means every page-level finding can be classified as "traces to component" or "page-specific." Without this separation, the action plan will report the same component issue 40+ times and the implementation milestone will underestimate the leverage of a single component fix.

**Delivers:**
- `.planning/audit/components.md` — per-component findings with severity ratings and source classification
- Identification of all inline Tailwind overrides that will resist component-level fixes
- Component-level quick wins (fix once, propagates everywhere)

**Addresses:**
- Component inventory with inconsistency report (P1 feature)
- Quick wins list (P1 feature, partial — component tier)

**Avoids:** Component inheritance miss, inflated action plan with duplicate page-level entries for shared component issues

**Research flag:** Standard patterns — component audit against a design rubric is well-established methodology.

---

### Phase 3: Page Audits (Admin and Portal)

**Rationale:** Pages are audited against MASTER.md (established in Phase 1), informed by component findings (established in Phase 2). Admin and portal can run in parallel since they share components but have separate brands. Admin is audited first as the larger surface area; portal audit can reference admin baselines for shared component behavior.

**Delivers:**
- `.planning/audit/admin-pages.md` — severity-rated findings for all ~20 admin pages
- `.planning/audit/portal-pages.md` — severity-rated findings for all ~8 portal pages
- `design-system/ims7d/pages/*.md` — per-page design overrides for intentional deviations
- Dashboard widget visual audit embedded in admin dashboard page findings
- Accessibility findings flagged at page level, elevating severity on critical-path pages

**Addresses:**
- Per-page admin and portal audits (P1 features)
- Accessibility assessment on high-traffic pages (P2 feature)
- Data table audit for information density (P2 feature)
- Dashboard widget visual audit (P2 feature)
- Dual-brand divergence documentation (P2 feature)

**Avoids:** Scanner interface degradation (warehouse floor rubric applied to scanner routes during this phase), consumer UX applied to operational pages (operational density preserved)

**Research flag:** High volume, no deeper tool research needed, but requires careful prompt construction per page to maintain audit consistency across 28+ pages.

---

### Phase 4: Action Plan Compilation

**Rationale:** The action plan cannot be written until all findings are collected. It synthesizes component and page findings, clusters by type (color / typography / spacing / component / accessibility), scores by impact × frequency × severity, and produces a tiered, sequenced implementation guide. This is the primary deliverable consumed by the next milestone.

**Delivers:**
- `.planning/action-plan/PRIORITIES.md` — Blocking (≤20 items), High-value (≤40 items), Polish (backlog)
- `.planning/action-plan/IMPLEMENTATION.md` — per-priority file path, specific change, effort estimate
- Complete quick wins list across all tiers

**Addresses:**
- Prioritized action plan with implementation sequencing (P1 feature)
- Severity-rated findings list finalized

**Avoids:** Action plan paralysis (enforced tier caps), token migration started piecemeal (all token items marked full-migration-required and grouped), implementation milestone starting without a clear entry point

**Research flag:** No deeper research needed — action plan synthesis is deterministic given complete audit inputs. The tiering rules and cap sizes are specified.

---

### Phase Ordering Rationale

- Phase 1 before all others: MASTER.md is the evaluation rubric; audits without it produce unchecked findings
- Phase 2 before Phase 3: Component audit prevents duplicate reporting; establishes "source: component vs. source: inline override" taxonomy before page-level findings are logged
- Admin and portal within Phase 3 can overlap: they share components (audited in Phase 2) but have separate brand configs; no blocking dependency between them
- Phase 4 is strictly last: it requires complete audit coverage to produce accurate impact scoring; partial synthesis produces an action plan with missing leverage calculations
- This order directly mirrors the build order specified in ARCHITECTURE.md, validated independently by FEATURES.md dependency graph and PITFALLS.md phase-mapping table

### Research Flags

Phases with standard patterns (no additional research-phase needed):
- **Phase 1 (Tool Setup):** Installation mechanics are well-documented; constraint specification is a prompt-engineering task, not a research task
- **Phase 2 (Component Audit):** Standard design audit methodology; 15 known components with clear scope
- **Phase 3 (Page Audits):** Repeatable audit loop; methodology established by Phase 2
- **Phase 4 (Action Plan):** Deterministic synthesis; tiering rules defined in PITFALLS.md

No phases require a `/gsd:research-phase` call. All unknowns are resolved in this research output.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims verified against npm registry, GitHub source, and official docs; Python stdlib-only BM25 confirmed; version compatibility confirmed against project's current Node/Python versions |
| Features | MEDIUM-HIGH | Audit methodology is well-established; 3PL-specific feature standards drawn from multiple logistics UX sources; some scanner interface specifics inferred from general industrial UX research |
| Architecture | MEDIUM | Core install mechanics and MASTER.md output structure are well-documented; token-to-CSS-custom-property mapping for Tailwind 4 is inferred from Tailwind 4 documentation, not from UI/UX Max Pro docs directly |
| Pitfalls | HIGH | Domain experience + multiple independent sources; dual-brand and industrial UX pitfalls are well-documented categories; all 7 pitfalls are independently sourced |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **MASTER.md output format for dual-brand:** The tool's documentation does not explicitly describe how to generate separate token sets for two brands in one project. The recommended approach (anchor generation to existing primary colors via explicit constraint in the prompt) is based on general design system tooling patterns, not UI/UX Max Pro docs. Verify this produces two distinct token sections before accepting the generated output.

- **uipro-cli version discrepancy:** STACK.md notes that v2.5.0 is referenced in one source and v2.2.2 in another. Run `uipro versions` at install time to confirm the actual latest version. If v2.2.2 is latest, verify `--design-system --persist` flags are available (introduced in v2.0).

- **Dashboard widget minimum grid dimensions:** PITFALLS.md specifies that these must be documented before auditing dashboard components, but they are not in the codebase research. Phase 1 must include a step to read the dashboard widget grid implementation and record minimum cell dimensions before Phase 3 begins.

- **Scanner-facing route inventory:** PITFALLS.md requires pre-classifying scanner routes before audit. The specific routes (BarcodeScanner component, inbound receiving, cycle count, pick/pack) are referenced but a complete route list is not compiled. Phase 1 should produce an explicit list of scanner-facing routes from the codebase.

## Sources

### Primary (HIGH confidence)
- [uipro-cli on npm](https://www.npmjs.com/package/uipro-cli) — version history, install mechanics
- [GitHub: nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — source structure, feature capabilities, file layout
- [GitHub Releases: ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/releases) — design system generator availability per version
- [Carbon Design System: Status Indicator Pattern](https://carbondesignsystem.com/patterns/status-indicator-pattern/) — semantic color standards for status visualization
- Codebase direct inspection: `src/app/globals.css`, `package.json`, `src/components/ui/` — existing token names, component inventory

### Secondary (MEDIUM confidence)
- [DeepWiki: Getting Started](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/1.1-getting-started) — installation steps, Python requirements
- [DeepWiki: Skill Architecture](https://deepwiki.com/nextlevelbuilder/ui-ux-pro-max-skill/3-uiux-pro-max-skill) — BM25 stdlib-only, file structure
- [Official docs: CLI Reference](https://ui-ux-pro-max-skill.com/en/docs/cli-reference/) — CLI flags, design system output format
- [Cieden: UI/UX Design for 3PL Software](https://cieden.com/designing-a-powerful-3pl-software-platform) — 3PL-specific design standards
- [Rossul: WMS UX Case Study](https://www.rossul.com/portfolio/warehouse-management-system/) — warehouse domain patterns
- [Tailwind CSS 4 @theme tokens](https://medium.com/@sureshdotariya/tailwind-css-4-theme-the-future-of-design-tokens-at-2025-guide-48305a26af06) — CSS custom property integration
- [Netguru: Design System Audit](https://www.netguru.com/blog/design-system-audit) — audit methodology and scope
- [DOOR3: Design System Audit](https://www.door3.com/blog/design-system-audit) — prioritization frameworks

### Tertiary (MEDIUM-LOW confidence)
- [Lazarev Agency: Logistics UX/UI Design](https://www.lazarev.agency/articles/logistics-ux-ui-design) — 3PL UX principles (single agency perspective)
- [Steer73: UX in an Industrial Setting](https://steer73.com/2025/01/20/ux-in-an-industrial-setting/) — industrial/warehouse UX constraints (small consultancy, single source)
- [Medium: Building a multi-brand design system](https://medium.com/bts-design-team/building-a-multi-brand-design-system-79469d425bf3) — multi-brand token architecture

---
*Research completed: 2026-03-18*
*Ready for roadmap: yes*
