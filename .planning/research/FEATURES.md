# Feature Research

**Domain:** UI/UX audit and design system generation for 3PL warehouse management SaaS
**Researched:** 2026-03-18
**Confidence:** MEDIUM-HIGH

---

## Context: What This Milestone Is Building

This is NOT a new product — it is an audit and design system overlay for an existing 60+ page warehouse management app. The "features" here are the outputs and capabilities of the audit/design system milestone itself:

1. UI/UX Max Pro tool integration and configuration
2. A generated 3PL-specific design system
3. A page-by-page audit of all admin and portal pages
4. A prioritized action plan for implementing the design system

The downstream consumer of this milestone is a human developer implementing visual improvements in the next milestone.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that a professional UI/UX audit and design system output must include to be credible and actionable. Missing these means the audit is not usable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Industry-specific design system (colors, typography, spacing) | Any professional audit produces a coherent, named system — not a list of individual tweaks | MEDIUM | Must cover both admin (indigo) and portal (cyan) brands; must work in Tailwind CSS |
| Component-level inventory and inconsistency report | Standard audit deliverable; developers need to know what components exist, which have variants, and where they are inconsistent | MEDIUM | IMS-7D has ~15 custom components — all need assessment |
| Severity-rated findings list | Audit findings without severity ratings are noise; P1/P2/P3 or High/Med/Low lets implementers triage | LOW | Severity = impact × effort; consistent scoring required |
| Per-page audit results | Each of the 60+ pages needs a named finding set so the next milestone has page-specific guidance | HIGH | Volume is high; 60+ pages across admin + portal |
| Quick wins list (low effort, high impact) | Industry standard — every stakeholder wants to know what's "free"; surfaces momentum items | LOW | Likely: spacing inconsistencies, color token drift, badge/status standardization |
| Accessibility assessment | WCAG compliance is expected in enterprise software; 3PL clients are B2B, have compliance obligations | MEDIUM | Focus: color contrast ratios, focus states, keyboard navigation |
| Typography scale recommendation | Without a named type scale, future development drifts; 3PL UIs need clear data hierarchy | LOW | Heading → subheading → body → label → caption; optimized for data density |
| Status/color semantics system | 3PL UIs rely heavily on status badges (order state, inventory alerts, dock status); without a semantic color system these diverge quickly | MEDIUM | Critical for warehouse ops: red = urgent/error, amber = warning, green = success, blue = informational |
| Spacing and layout grid | Enterprise data-dense UIs need a consistent grid; tables and dashboards break without it | LOW | 4px base unit standard; 8px increments; confirm against existing Tailwind config |

### Differentiators (Competitive Advantage)

Features that make this audit output more useful than a generic design review.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 3PL/logistics-specific design rationale | Generic design systems don't explain WHY a choice fits warehouse ops; logistics-specific rationale (e.g., "high-contrast status badges because warehouse monitors are viewed from distance") gives implementers defensible decisions | MEDIUM | UI/UX Max Pro has 161 industry rules including logistics/warehouse patterns — surface and document these |
| Dual-brand audit (admin vs portal) | Most audits treat a product as one brand; this app has two intentionally distinct brands (indigo admin, cyan portal); auditing each separately and their shared components is a differentiator | MEDIUM | Shared components (Button, Card, Table, Input) behave slightly differently per brand — must document the intentional divergences vs unintentional inconsistencies |
| Scanner/mobile interface audit | Most WMS UI audits focus on desktop; IMS-7D has scanner interfaces for warehouse floor operations (picking, packing, receiving) — auditing these for high-contrast, large-tap-target, minimal-cognitive-load patterns is differentiated | HIGH | Different standards apply: WCAG 3:1 minimum becomes inadequate for handheld scanners in bright warehouse lighting; target size min 44×44px |
| Dashboard widget design system | IMS-7D has 24 customizable dashboard widgets across admin + portal; auditing widget visual consistency, data-ink ratio, and scanability is specific to this app | MEDIUM | StatCard, chart widgets, alert widgets — each class needs its own visual standard |
| Data table audit for information density | 3PL operations are table-heavy; an audit that specifically grades tables on information density, column hierarchy, batch-action affordances, and row-level status clarity is directly actionable | MEDIUM | Most pages: Inventory, Orders, Billing, Clients, Products — all primarily table-based |
| Action plan with implementation sequencing | A flat list of recommendations is not enough; sequencing recommendations so components are fixed before pages (token → component → page → cross-cutting) prevents rework | MEDIUM | Dependencies: fix spacing tokens before fixing component padding; fix status colors before auditing badge usage |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem like good audit outputs but create problems in this context.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Pixel-perfect Figma mockups of all 60+ pages | "We want to see what it looks like fixed" | Out of scope (project says audit-only); Figma work for 60+ pages is a separate project costing weeks; creates false precision about implementation | Provide annotated screenshots with overlay notes for critical pages only; use action plan descriptions instead of mockups |
| Complete design system from scratch | "Let's replace everything" | The existing system (indigo/cyan/slate) is intentional and documented; replacing it introduces brand inconsistency and breaks the dual-identity design | Audit and extend the existing system; document gaps and token drift rather than full replacement |
| Automated accessibility scanner as sole method | "Just run axe-core on every page" | Automated scanners catch ~30-40% of accessibility issues; cognitive load, focus order, and motion-sickness issues require human judgment | Use automated scan as a starting point; supplement with manual review checklist on high-traffic pages |
| Single universal color palette | "Simplify to one brand" | Admin (indigo) and portal (cyan) visual separation is a product decision, not a mistake — clients and staff must never confuse which portal they're in | Audit each palette separately; document the intentional differences; ensure each has full semantic coverage (primary, secondary, states, status) |
| Per-component Storybook/docs generation | "Build a live component library" | Implementation work, not audit work; belongs in next milestone | Action plan item: "Add Storybook in v2 milestone"; note which components are candidates |

---

## Feature Dependencies

```
[UI/UX Max Pro installation + configuration]
    └──required by──> [Design system generation]
                          └──required by──> [Per-page audit]
                                               └──required by──> [Action plan]

[Component inventory]
    └──feeds──> [Inconsistency report]
                    └──feeds──> [Quick wins list]
                    └──feeds──> [Severity-rated findings]

[Status/color semantics system]
    └──feeds──> [Per-page badge/status audit]
    └──feeds──> [Dashboard widget audit]

[Typography scale]
    └──feeds──> [Data table audit]
    └──feeds──> [Per-page hierarchy audit]

[Spacing/grid system]
    └──feeds──> [Component-level spacing audit]
    └──feeds──> [Per-page layout audit]

[Admin audit] ──parallel──> [Portal audit]
    both feed──> [Action plan]

[Accessibility assessment] ──informs──> [Severity ratings]
    (accessibility violations elevate severity)
```

### Dependency Notes

- **UI/UX Max Pro must be installed before everything:** All design system generation and audit capabilities flow from this tool. Install and verify before any audit work begins.
- **Design system generation precedes page audits:** Pages are audited against the generated system, not in isolation. Running page audits before having the system produces uncheckable findings.
- **Component audit precedes page audit:** Components appear on multiple pages; fixing component-level issues is more efficient than noting the same inconsistency on 20 pages.
- **Admin and portal audits are parallel:** They share components but have separate brands. They can be audited simultaneously without dependency.
- **Action plan is the final dependency:** It cannot be written until all audit findings are collected and severity-rated; it synthesizes everything.

---

## MVP Definition

### Launch With (v1 — This Milestone)

Minimum viable audit output — what's needed for the next milestone to implement improvements.

- [ ] UI/UX Max Pro installed and configured with 3PL/warehouse context — without this nothing else works
- [ ] Generated design system covering: color tokens (admin + portal), typography scale, spacing scale, semantic status colors — the reference spec for all audit findings
- [ ] Component inventory with inconsistency flags — which of the 15 custom components have variants, drift, or violations
- [ ] Per-page audit covering all admin pages — findings per page with severity ratings
- [ ] Per-page audit covering all portal pages — findings per page with severity ratings
- [ ] Prioritized action plan with implementation sequencing — P1/P2/P3 items, grouped by token/component/page/cross-cutting, with effort estimates

### Add After Validation (v1.x)

Items to add once the core audit is done and accepted.

- [ ] Accessibility compliance matrix (WCAG AA) — add after base audit shows which pages are closest to compliant; focus effort there first
- [ ] Scanner interface audit — add if warehouse staff report usability issues with pick/pack/receive flows; requires device-specific testing context

### Future Consideration (v2+)

Defer these until the implementation milestone (v2) is underway.

- [ ] Live component library (Storybook) — useful for ongoing governance but is implementation work, not audit work
- [ ] Animation and motion audit — low impact for a logistics tool; defer unless client feedback requests it
- [ ] Dark mode design system — not part of existing design; major addition that needs separate product decision

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| UI/UX Max Pro install + config | HIGH | LOW | P1 |
| Design system generation (tokens, typography, spacing) | HIGH | LOW | P1 |
| Status/color semantics system | HIGH | LOW | P1 |
| Component inventory + inconsistency report | HIGH | MEDIUM | P1 |
| Per-page admin audit (severity-rated) | HIGH | HIGH | P1 |
| Per-page portal audit (severity-rated) | HIGH | HIGH | P1 |
| Quick wins list | HIGH | LOW | P1 |
| Prioritized action plan with sequencing | HIGH | MEDIUM | P1 |
| Accessibility assessment (high-traffic pages) | MEDIUM | MEDIUM | P2 |
| Data table audit for information density | MEDIUM | MEDIUM | P2 |
| Dashboard widget visual audit | MEDIUM | MEDIUM | P2 |
| Scanner/mobile interface audit | MEDIUM | HIGH | P2 |
| Dual-brand divergence documentation | MEDIUM | LOW | P2 |
| Full accessibility scan (all pages) | LOW | HIGH | P3 |
| Figma annotated mockups (critical pages only) | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for the audit milestone to produce a usable action plan
- P2: Should have — significantly improves the implementation milestone's precision
- P3: Nice to have — adds completeness but doesn't block implementation

---

## Competitor Feature Analysis

How leading 3PL/WMS platforms handle the visual design elements that this audit will evaluate.

| Visual Pattern | Extensiv (3PL WMS) | Logiwa (WMS) | Our Current State | Audit Target |
|---------------|-------------------|--------------|-------------------|--------------|
| Status badges | Color-coded by order state; consistent across views | Minimal badge variants; heavy color reliance | StatusBadge component exists; variants not fully standardized | Document all status states, define semantic color map |
| Data tables | Fixed headers, sortable columns, bulk actions | Clean rows, low visual noise, density controls | Table component exists; bulk actions inconsistent | Add density control; standardize row actions placement |
| Dashboard cards | Large KPI numbers, trend indicators, threshold alerts | Widget-based, role-specific presets | StatCard, 24 widgets, drag-drop | Audit data-ink ratio; ensure threshold/alert states defined |
| Navigation | Sidebar with role-based items; minimal grouping | Tab-based; role switching prominent | Admin sidebar (indigo) + Portal sidebar (cyan); collapsible | Verify active state contrast; confirm group labels are scannable |
| Alert/error states | Inline alerts with icon + color + text; dismissible | Toast-style; no inline blocking | Inconsistent — some pages use toasts, some inline | Standardize: define when to use toast vs inline vs modal alert |
| Typography | Monospaced for quantities/codes; sans-serif for labels | Clean sans-serif throughout; numeric data larger | Slate + standard Tailwind fonts | Define numeric/quantity font treatment; establish h1-caption scale |
| Form controls | Compact; inline validation; minimal chrome | Standard inputs; visible validation | Input, Select, Textarea exist; validation display inconsistent | Standardize validation display (error below field, red border, icon) |

---

## 3PL Warehouse UI Visual Standards (Research Findings)

This section documents what "professional and purpose-built" means for warehouse management interfaces, based on analysis of leading WMS products and logistics UX research. These standards feed directly into what the audit should measure.

### Information Density
- 3PL operations staff need more data per screen than typical SaaS users; tables should support compact, comfortable, and spacious density modes
- Critical metrics (shipment count, stock alerts, order status) belong above the fold on every relevant page
- Progressive disclosure: secondary data accessible via expand/detail, not visible at rest

### Status Visualization
- Industry-standard semantic colors: red = urgent/error/out-of-stock, amber = warning/low-stock/delayed, green = success/on-time/in-stock, blue = informational/in-transit, gray = neutral/inactive/draft
- Status badges must have both color AND text label (never color-only — fails accessibility and colorblindness)
- Order lifecycle states (Pending > Confirmed > Processing > Packed > Shipped > Delivered) need visually distinct treatment that maps clearly to the warehouse workflow

### Dashboard Patterns
- Role-specific widget presets are expected; warehouse operators, billing admins, and client portals need different default views
- KPI cards: large number, trend indicator (up/down arrow + %), comparison period label
- Alert widgets: count badge on sidebar nav items for unresolved alerts (e.g., "3 low-stock items")

### Scanner/Mobile Interfaces
- High contrast required: warehouse lighting varies from direct sunlight to dim loading docks
- Tap targets minimum 44×44px; 56×56px preferred for gloved-hand operation
- Minimal cognitive load: one primary action per screen; no dense tables on mobile
- Numeric inputs (qty, lot, bin) should use numeric keyboard on mobile

### Typography for Data
- Monospaced or tabular-numeral fonts for quantities, order numbers, LPN codes — prevents column misalignment
- Clear distinction between interactive text (links, buttons) and static labels
- Minimum 14px for body text in enterprise tools; 12px acceptable only for supporting metadata

### Sources

- [UI/UX Design for the 3PL Software Platform — Cieden](https://cieden.com/designing-a-powerful-3pl-software-platform)
- [Warehouse Management System UX/UI Case Study — Rossul](https://www.rossul.com/portfolio/warehouse-management-system/)
- [Dashboard UI/UX Design for Logistics & Supply Chain — AufaitUX](https://www.aufaitux.com/blog/dashboard-design-logistics-supply-chain-ux/)
- [Logistics UX/UI Design: 5 Principles — Lazarev Agency](https://www.lazarev.agency/articles/logistics-ux-ui-design)
- [How to Run a Design System Audit — Netguru](https://www.netguru.com/blog/design-system-audit)
- [Design System Audit — DOOR3](https://www.door3.com/blog/design-system-audit)
- [UX/UI Audit in 12 Steps — Edana](https://edana.ch/en/2025/10/11/ux-ui-audit-in-12-steps-operational-methodology-deliverables-and-roi-driven-prioritization/)
- [Status Indicator Pattern — Carbon Design System](https://carbondesignsystem.com/patterns/status-indicator-pattern/)
- [Table Design UX Guide — Eleken](https://www.eleken.co/blog-posts/table-design-ux)
- [Best 3PL Warehouse Management Systems 2026 — Deposco](https://deposco.com/blog/best-3pl-warehouse-management-systems-of-2026/)

---

*Feature research for: UI/UX audit and design system generation — IMS-7D 3PL warehouse management*
*Researched: 2026-03-18*
